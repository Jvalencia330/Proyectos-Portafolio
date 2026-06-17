"""
Motor de simulaciones what-if para SupplyChain AI.

Orquesta el A* con los parámetros modificados por los sliders del usuario.
Cada llamada a simulate() re-ejecuta el A* completo con el nuevo escenario,
permitiendo comparar "¿qué pasa si el shipping sube 2x?" en tiempo real.
"""
import pandas as pd
from typing import Optional, Dict, Any, List

from astar_engine import AStarEngine


def simulate(
    df:                      pd.DataFrame,
    engine:                  AStarEngine,
    name:                    str,
    product_type:            Optional[str] = None,
    business_model:          str = "own",
    is_express:              bool = False,
    express_threshold_days:  int = 3,
    shipping_shock:          float = 1.0,
    demand_variation:        float = 1.0,
    price_variation:         float = 1.0,
    manufacturing_variation: float = 1.0,
    priority_weights:        Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Ejecuta una simulación what-if y retorna los resultados en formato listo para guardar.

    Parámetros de los sliders:
      shipping_shock:          0.5x–3.0x   (impacto de shock de costos de envío)
      demand_variation:        0.5x–2.0x   (cambio en demanda)
      price_variation:         0.7x–1.5x   (ajuste de precios de venta)
      manufacturing_variation: 0.5x–2.0x   (variación de costos de manufactura)
    """
    if priority_weights is None:
        priority_weights = {"margin": 25, "speed": 25, "risk": 25, "carbon": 25}

    run = engine.optimize(
        product_type=product_type,
        business_model=business_model,
        is_express=is_express,
        express_threshold_days=express_threshold_days,
        shipping_shock=shipping_shock,
        demand_variation=demand_variation,
        price_variation=price_variation,
        manufacturing_variation=manufacturing_variation,
        priority_weights=priority_weights,
        top_k=5,
    )
    results = run["results"]

    best_route = ""
    best_score = 0.0
    if results:
        best = results[0]
        best_route = (
            f"{best['supplier']} → {best['transport_mode']} → "
            f"{best['route']} → {best['carrier']}"
        )
        best_score = best["strategic_score"]

    # Parámetros del escenario para persistencia
    parameters = {
        "name":                    name,
        "product_type":            product_type,
        "business_model":          business_model,
        "is_express":              is_express,
        "express_threshold_days":  express_threshold_days,
        "shipping_shock":          shipping_shock,
        "demand_variation":        demand_variation,
        "price_variation":         price_variation,
        "manufacturing_variation": manufacturing_variation,
        "priority_weights":        priority_weights,
    }

    return {
        "name":       name,
        "parameters": parameters,
        "results":    results,
        "best_route": best_route,
        "best_score": best_score,
        "summary":    _build_summary(results),
    }


def compute_pareto(
    routes_df: pd.DataFrame,
    obj1: str = "margin",
    obj2: str = "lead_time"
) -> pd.DataFrame:
    """
    Calcula la frontera de Pareto sobre el conjunto de rutas.

    Una ruta es Pareto-óptima si ninguna otra ruta es MEJOR en AMBAS métricas
    simultáneamente. Esto representa las rutas donde no puedes mejorar una
    dimensión sin sacrificar la otra.

    obj1 se maximiza (ej. margen), obj2 se minimiza (ej. lead_time).
    """
    if routes_df.empty:
        return routes_df

    # Mapeo: qué métricas se maximizan y cuáles se minimizan
    maximize_metrics = {"margin", "strategic_score"}

    pareto_mask = []
    for i, row_i in routes_df.iterrows():
        dominated = False
        for j, row_j in routes_df.iterrows():
            if i == j:
                continue

            # ¿row_j domina a row_i? (row_j es mejor o igual en AMBAS métricas)
            if obj1 in maximize_metrics:
                better_obj1 = row_j[obj1] >= row_i[obj1]
            else:
                better_obj1 = row_j[obj1] <= row_i[obj1]

            if obj2 in maximize_metrics:
                better_obj2 = row_j[obj2] >= row_i[obj2]
            else:
                better_obj2 = row_j[obj2] <= row_i[obj2]

            if better_obj1 and better_obj2:
                # row_j es al menos tan bueno como row_i en ambas → row_i es dominado
                # Verificamos que row_j sea ESTRICTAMENTE mejor en al menos una
                strictly_better_1 = (row_j[obj1] > row_i[obj1]) if obj1 in maximize_metrics else (row_j[obj1] < row_i[obj1])
                strictly_better_2 = (row_j[obj2] > row_i[obj2]) if obj2 in maximize_metrics else (row_j[obj2] < row_i[obj2])
                if strictly_better_1 or strictly_better_2:
                    dominated = True
                    break

        pareto_mask.append(not dominated)

    result = routes_df.copy()
    result["is_pareto"] = pareto_mask
    return result


def _build_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Construye un resumen estadístico de los resultados del A*."""
    if not results:
        return {}
    margins = [r["margin"] for r in results]
    lead_times = [r["lead_time"] for r in results]
    co2s = [r["co2_kg"] for r in results]
    return {
        "avg_margin":    round(sum(margins) / len(margins), 2),
        "best_margin":   round(max(margins), 2),
        "avg_lead_time": round(sum(lead_times) / len(lead_times), 1),
        "min_lead_time": round(min(lead_times), 1),
        "avg_co2":       round(sum(co2s) / len(co2s), 5),
        "min_co2":       round(min(co2s), 5),
        "routes_found":  len(results),
    }
