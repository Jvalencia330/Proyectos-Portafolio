"""
Integración con APIs externas de carriers para SupplyChain AI.

Carrier → API externa:
  Carrier A → ShipEngine API  (UPS)   — https://www.shipengine.com/docs/
  Carrier B → EasyPost API    (FedEx) — https://www.easypost.com/docs/api
  Carrier C → Shippo API      (DHL)   — https://goshippo.com/docs/

Fallback graceful:
  Si no hay API key configurada o la llamada falla, el sistema usa los datos
  del CSV y añade un badge "⚠️ Usando datos locales" en el response.

Variables de entorno requeridas (opcionales — el sistema funciona sin ellas):
  SHIPENGINE_API_KEY
  EASYPOST_API_KEY
  SHIPPO_API_KEY
"""
import os
import logging
import httpx
import pandas as pd
from typing import Dict, Any, Optional

from database import cache_carrier_rate, get_cached_rate

logger = logging.getLogger("carrier_api")

# Mapeo de carrier interno → API a usar
CARRIER_API_MAP = {
    "Carrier A": "shipengine",
    "Carrier B": "easypost",
    "Carrier C": "shippo",
}

# Coordenadas aproximadas de las ciudades para calcular distancias
CITY_CODES = {
    "Mumbai":    "BOM",
    "Kolkata":   "CCU",
    "Delhi":     "DEL",
    "Bangalore": "BLR",
}


async def get_live_rate(
    carrier: str,
    origin: str,
    destination: str,
    weight_kg: float = 1.0
) -> Dict[str, Any]:
    """
    Obtiene la tarifa en tiempo real del carrier especificado.

    Intenta primero el caché (1 hora), luego la API real,
    y si falla usa fallback a datos del CSV con warning.

    Retorna:
      {"carrier": str, "rate_usd": float, "transit_days": int,
       "service": str, "source": "live"|"cache"|"fallback"}
    """
    # 1. Verificar caché
    cached = get_cached_rate(carrier, origin, destination)
    if cached:
        return {
            "carrier":      carrier,
            "rate_usd":     cached["rate_usd"],
            "transit_days": cached["transit_days"],
            "service":      "cached",
            "source":       "cache",
        }

    # 2. Intentar API real según el carrier
    api_type = CARRIER_API_MAP.get(carrier, "fallback")
    result = None

    if api_type == "shipengine":
        result = await _call_shipengine(carrier, origin, destination, weight_kg)
    elif api_type == "easypost":
        result = await _call_easypost(carrier, origin, destination, weight_kg)
    elif api_type == "shippo":
        result = await _call_shippo(carrier, origin, destination, weight_kg)

    # 3. Fallback si la API falló o no hay key
    if result is None:
        result = _fallback_rate(carrier, origin, destination)

    # 4. Guarda en caché si vino de API real
    if result.get("source") == "live":
        cache_carrier_rate(
            carrier, origin, destination,
            result["rate_usd"], result["transit_days"]
        )

    return result


async def _call_shipengine(
    carrier: str, origin: str, destination: str, weight_kg: float
) -> Optional[Dict[str, Any]]:
    """Llama a ShipEngine API para obtener rates de UPS."""
    api_key = os.getenv("SHIPENGINE_API_KEY", "")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                "https://api.shipengine.com/v1/rates/estimate",
                headers={"API-Key": api_key, "Content-Type": "application/json"},
                json={
                    "carrier_ids": ["se-ups"],
                    "from_country_code": "IN",
                    "from_postal_code": _city_to_postal(origin),
                    "to_country_code": "IN",
                    "to_postal_code": _city_to_postal(destination),
                    "weight": {"value": weight_kg * 1000, "unit": "gram"},
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                rates = data.get("rate_response", {}).get("rates", [])
                if rates:
                    best = min(rates, key=lambda r: r.get("shipping_amount", {}).get("amount", 999))
                    return {
                        "carrier":      carrier,
                        "rate_usd":     float(best["shipping_amount"]["amount"]),
                        "transit_days": int(best.get("delivery_days", 3)),
                        "service":      best.get("service_type", "UPS Ground"),
                        "source":       "live",
                    }
    except Exception as e:
        logger.warning(f"ShipEngine API error: {e}")
    return None


async def _call_easypost(
    carrier: str, origin: str, destination: str, weight_kg: float
) -> Optional[Dict[str, Any]]:
    """Llama a EasyPost API para obtener rates de FedEx."""
    api_key = os.getenv("EASYPOST_API_KEY", "")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # EasyPost requiere autenticación básica
            resp = await client.post(
                "https://api.easypost.com/v2/shipments",
                auth=(api_key, ""),
                json={
                    "shipment": {
                        "to_address": {"city": destination, "country": "IN"},
                        "from_address": {"city": origin, "country": "IN"},
                        "parcel": {"weight": weight_kg * 35.274},  # oz
                    }
                }
            )
            if resp.status_code == 201:
                data = resp.json()
                rates = data.get("rates", [])
                fedex_rates = [r for r in rates if "FEDEX" in r.get("carrier", "").upper()]
                if fedex_rates:
                    best = min(fedex_rates, key=lambda r: float(r.get("rate", 999)))
                    return {
                        "carrier":      carrier,
                        "rate_usd":     float(best["rate"]),
                        "transit_days": int(best.get("delivery_days", 3)),
                        "service":      best.get("service", "FedEx Ground"),
                        "source":       "live",
                    }
    except Exception as e:
        logger.warning(f"EasyPost API error: {e}")
    return None


async def _call_shippo(
    carrier: str, origin: str, destination: str, weight_kg: float
) -> Optional[Dict[str, Any]]:
    """Llama a Shippo API para obtener rates de DHL."""
    api_key = os.getenv("SHIPPO_API_KEY", "")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                "https://api.goshippo.com/shipments/",
                headers={"Authorization": f"ShippoToken {api_key}"},
                json={
                    "address_from": {"city": origin, "country": "IN"},
                    "address_to":   {"city": destination, "country": "IN"},
                    "parcels": [{"weight": str(weight_kg), "mass_unit": "kg",
                                 "length": "20", "width": "15", "height": "10",
                                 "distance_unit": "cm"}],
                    "async": False,
                }
            )
            if resp.status_code == 201:
                data = resp.json()
                rates = data.get("rates", [])
                dhl_rates = [r for r in rates if "DHL" in r.get("provider", "").upper()]
                if dhl_rates:
                    best = min(dhl_rates, key=lambda r: float(r.get("amount", 999)))
                    return {
                        "carrier":      carrier,
                        "rate_usd":     float(best["amount"]),
                        "transit_days": int(best.get("estimated_days", 5)),
                        "service":      best.get("servicelevel", {}).get("name", "DHL Express"),
                        "source":       "live",
                    }
    except Exception as e:
        logger.warning(f"Shippo API error: {e}")
    return None


def _fallback_rate(carrier: str, origin: str, destination: str) -> Dict[str, Any]:
    """
    Fallback graceful usando rangos típicos del CSV cuando no hay API key.
    El frontend mostrará un badge "⚠️ Usando datos locales".
    """
    # Rates de fallback basados en el rango del CSV (1-10 USD)
    fallback_rates = {
        "Carrier A": {"rate_usd": 5.50, "transit_days": 3, "service": "UPS Ground (est.)"},
        "Carrier B": {"rate_usd": 7.20, "transit_days": 2, "service": "FedEx Express (est.)"},
        "Carrier C": {"rate_usd": 4.80, "transit_days": 5, "service": "DHL Standard (est.)"},
    }
    base = fallback_rates.get(carrier, {"rate_usd": 5.0, "transit_days": 3, "service": "Standard"})
    return {
        "carrier":      carrier,
        "rate_usd":     base["rate_usd"],
        "transit_days": base["transit_days"],
        "service":      base["service"],
        "source":       "fallback",
        "warning":      "⚠️ Usando datos locales — configura API keys para rates en vivo",
    }


async def get_all_carrier_rates(
    origin: str = "Mumbai",
    destination: str = "Delhi",
    weight_kg: float = 1.0
) -> Dict[str, Any]:
    """
    Obtiene rates de los 3 carriers en paralelo para comparación.
    """
    rates = []
    for carrier in ["Carrier A", "Carrier B", "Carrier C"]:
        rate = await get_live_rate(carrier, origin, destination, weight_kg)
        rates.append(rate)

    has_live = any(r["source"] == "live" for r in rates)
    using_fallback = all(r["source"] == "fallback" for r in rates)

    return {
        "rates":         rates,
        "origin":        origin,
        "destination":   destination,
        "weight_kg":     weight_kg,
        "has_live_data": has_live,
        "warning":       "⚠️ Usando datos locales" if using_fallback else None,
    }


def _city_to_postal(city: str) -> str:
    """Mapeo simple ciudad → código postal aproximado para las APIs."""
    postal_map = {
        "Mumbai":    "400001",
        "Kolkata":   "700001",
        "Delhi":     "110001",
        "Bangalore": "560001",
    }
    return postal_map.get(city, "400001")
