"""
Motor de cálculo de huella de carbono para SupplyChain AI.

Fórmula:
  co2_kg = CARBON_FACTORS[transport_mode] × weight_tons × distance_km

Factores de emisión (kg CO₂ por tonelada-km):
  Road: 0.062  — camión convencional (GLEC Framework)
  Air:  0.602  — carga aérea (incluye factor de forzamiento radiativo)
  Sea:  0.003  — transporte marítimo (el más eficiente por unidad)
  Rail: 0.022  — ferrocarril eléctrico promedio

Badge ECO: ruta cuya emisión está bajo el promedio del conjunto analizado.
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any

# Factores de emisión GLEC / IPCC (kg CO₂ / ton·km)
CARBON_FACTORS: Dict[str, float] = {
    "Road": 0.062,
    "Air":  0.602,
    "Sea":  0.003,
    "Rail": 0.022,
}

# Distancias estimadas por ruta (km)
ROUTE_DISTANCES: Dict[str, float] = {
    "Route A":  500.0,
    "Route B": 1200.0,
    "Route C": 2500.0,
}

# Peso base por unidad (toneladas) — aprox. 1 kg por unidad de e-commerce
UNIT_WEIGHT_TONS = 0.001


def calc_co2(transport_mode: str, route: str) -> float:
    """Calcula las emisiones de CO₂ en kg para una combinación transporte-ruta."""
    factor   = CARBON_FACTORS.get(transport_mode, 0.062)
    distance = ROUTE_DISTANCES.get(route, 500.0)
    return factor * UNIT_WEIGHT_TONS * distance


def get_carbon_for_route(route: str) -> List[Dict[str, Any]]:
    """
    Retorna la huella de carbono de una ruta específica para todos los modos de transporte.
    Incluye badge ECO para los modos con emisiones bajo el promedio de la ruta.
    """
    results = []
    co2_values = []

    for transport in CARBON_FACTORS:
        co2 = calc_co2(transport, route)
        co2_values.append(co2)
        results.append({
            "route":          route,
            "transport_mode": transport,
            "distance_km":    ROUTE_DISTANCES.get(route, 500.0),
            "co2_kg":         round(co2, 5),
            "is_eco":         False,
            "label":          "",
        })

    # Marca como ECO los modos que están bajo el promedio
    avg_co2 = np.mean(co2_values)
    for r in results:
        if r["co2_kg"] < avg_co2:
            r["is_eco"] = True
            r["label"]  = "ECO"

    results.sort(key=lambda x: x["co2_kg"])
    return results


def get_carbon_comparison(
    df: pd.DataFrame,
    top_routes: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Genera comparativa de huella de carbono para las rutas devueltas por A*.
    Añade badge ECO a las que estén bajo el promedio del conjunto.
    """
    if not top_routes:
        return []

    enriched = []
    for r in top_routes:
        co2 = r.get("co2_kg", calc_co2(r.get("transport_mode", "Road"), r.get("route", "Route A")))
        enriched.append({
            "supplier":       r.get("supplier", ""),
            "transport_mode": r.get("transport_mode", "Road"),
            "route":          r.get("route", "Route A"),
            "distance_km":    ROUTE_DISTANCES.get(r.get("route", "Route A"), 500.0),
            "co2_kg":         round(co2, 5),
            "is_eco":         False,
            "label":          "",
        })

    avg_co2 = np.mean([x["co2_kg"] for x in enriched])
    for item in enriched:
        if item["co2_kg"] < avg_co2:
            item["is_eco"] = True
            item["label"]  = "ECO"

    enriched.sort(key=lambda x: x["co2_kg"])
    return enriched


def carbon_summary_by_transport() -> Dict[str, Any]:
    """Resumen estático de emisiones por modo de transporte (útil para el dashboard)."""
    data = []
    for transport, factor in CARBON_FACTORS.items():
        # Co2 para ruta media (Route B = 1200 km)
        co2_medium = calc_co2(transport, "Route B")
        data.append({
            "transport_mode": transport,
            "factor_per_ton_km": factor,
            "co2_route_a":  round(calc_co2(transport, "Route A"), 5),
            "co2_route_b":  round(calc_co2(transport, "Route B"), 5),
            "co2_route_c":  round(calc_co2(transport, "Route C"), 5),
        })
    return {"modes": data, "distances": ROUTE_DISTANCES}
