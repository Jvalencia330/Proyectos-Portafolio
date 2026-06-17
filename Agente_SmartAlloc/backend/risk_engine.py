"""
Motor de riesgo de stockout para SupplyChain AI.

Lógica automática sin input manual:
  daily_demand = products_sold / 30
  safety_stock = daily_demand × std_lead_time × 1.65  (95% nivel de servicio)
  ROP          = daily_demand × avg_lead_time + safety_stock
  stock_proj   = stock_levels - (daily_demand × 7)     (proyección 7 días)

Semáforo:
  CRÍTICO (rojo)   — stock proyectado ≤ 0
  ALERTA  (amarillo) — stock proyectado ≤ ROP
  OK      (verde)  — stock proyectado > ROP

En dropshipping, el proveedor gestiona el stock → este panel se oculta en el frontend.
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any

DAYS_PROJECTION = 7     # días a proyectar hacia adelante
SERVICE_LEVEL   = 1.65  # z-score para 95% de nivel de servicio


def calculate_stockout_risk(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Calcula el estado de riesgo de stockout para cada SKU del dataset.
    No requiere input del usuario: todo se deriva del CSV.
    """
    results = []

    for _, row in df.iterrows():
        sku          = str(row["SKU"])
        product_type = str(row["Product type"])
        stock        = float(row["Stock levels"])
        sold_monthly = float(row["Number of products sold"])
        avg_lead     = float(row["Lead times"])

        # Demanda diaria estimada (mes de 30 días)
        daily_demand = sold_monthly / 30.0

        # Desviación estándar del lead time: usamos 20% del promedio como proxy
        # (sin datos históricos de lead time real, es la mejor estimación)
        std_lead_time = avg_lead * 0.2

        # Stock de seguridad para 95% de nivel de servicio
        safety_stock = daily_demand * std_lead_time * SERVICE_LEVEL

        # Punto de reorden
        rop = daily_demand * avg_lead + safety_stock

        # Stock proyectado en DAYS_PROJECTION días
        stock_projected = stock - (daily_demand * DAYS_PROJECTION)

        # Clasificación semáforo
        if stock_projected <= 0:
            status = "CRÍTICO"
        elif stock_projected <= rop:
            status = "ALERTA"
        else:
            status = "OK"

        results.append({
            "sku":             sku,
            "product_type":    product_type,
            "stock_level":     round(stock, 0),
            "daily_demand":    round(daily_demand, 2),
            "avg_lead_time":   round(avg_lead, 1),
            "rop":             round(rop, 1),
            "stock_projected": round(stock_projected, 1),
            "status":          status,
        })

    # Ordena: críticos primero, luego alertas, luego OK
    order = {"CRÍTICO": 0, "ALERTA": 1, "OK": 2}
    results.sort(key=lambda x: (order[x["status"]], x["stock_projected"]))

    return results


def get_stockout_summary(statuses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Resumen ejecutivo del estado de stockout de toda la cadena."""
    total    = len(statuses)
    criticos = sum(1 for s in statuses if s["status"] == "CRÍTICO")
    alertas  = sum(1 for s in statuses if s["status"] == "ALERTA")
    ok       = sum(1 for s in statuses if s["status"] == "OK")

    return {
        "total":    total,
        "criticos": criticos,
        "alertas":  alertas,
        "ok":       ok,
        "pct_riesgo": round((criticos + alertas) / total * 100, 1) if total > 0 else 0.0,
    }
