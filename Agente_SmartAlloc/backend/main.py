"""
Servidor principal FastAPI para SupplyChain AI.

Endpoints disponibles:
  POST /api/optimize          — Ejecuta A* con parámetros dados
  POST /api/simulate          — Ejecuta simulación what-if
  GET  /api/stockout          — Estado de stockout por SKU
  GET  /api/pareto            — Frontera de Pareto
  GET  /api/carbon/{route}    — CO₂ de una ruta específica
  GET  /api/carbon/comparison — CO₂ comparativo de las últimas rutas A*
  POST /api/config            — Guarda configuración del negocio
  GET  /api/config            — Obtiene configuración actual
  POST /api/simulations/save  — Guarda simulación
  GET  /api/simulations       — Lista simulaciones guardadas
  GET  /api/simulations/{id}  — Obtiene simulación específica
  GET  /api/carrier/rates     — Rates en vivo (con fallback)
  GET  /api/health            — Health check
"""
import os
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    BusinessConfigRequest, OptimizeRequest, SimulateRequest,
    SaveSimulationRequest, ParetoRequest
)
from database import (
    init_db, save_business_config, get_business_config,
    save_simulation, list_simulations, get_simulation
)
from astar_engine import AStarEngine
from risk_engine import calculate_stockout_risk, get_stockout_summary
from simulation_engine import simulate, compute_pareto
from carbon_engine import (
    get_carbon_for_route, get_carbon_comparison, carbon_summary_by_transport
)
from carrier_api import get_all_carrier_rates

# ─── Setup ────────────────────────────────────────────────────────────────────

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("supplychain")

app = FastAPI(
    title="SupplyChain AI",
    description="Optimización de cadena de suministro con algoritmo A*",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Carga de datos y motores ─────────────────────────────────────────────────

CSV_PATH = Path(__file__).parent.parent / "supply_chain_data.csv"

def load_dataframe() -> pd.DataFrame:
    """Carga el CSV. Si no existe, lanza un error descriptivo."""
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró supply_chain_data.csv en {CSV_PATH}. "
            "Coloca el archivo en la raíz del proyecto."
        )
    return pd.read_csv(CSV_PATH)

# Carga al arrancar (en memoria durante toda la sesión)
_df: Optional[pd.DataFrame] = None
_engine: Optional[AStarEngine] = None


def get_df() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = load_dataframe()
    return _df


def get_engine() -> AStarEngine:
    global _engine
    if _engine is None:
        _engine = AStarEngine(get_df())
    return _engine


@app.on_event("startup")
def startup():
    init_db()
    # Pre-carga el engine para que el primer request sea rápido
    try:
        get_engine()
        logger.info(f"CSV cargado: {len(get_df())} filas, engine A* listo.")
    except Exception as e:
        logger.error(f"Error al cargar datos: {e}")


# ─── Endpoints de Optimización ────────────────────────────────────────────────

@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    """
    Ejecuta el algoritmo A* y retorna las mejores rutas de supply chain.

    Con collect_trace=True devuelve la traza completa paso a paso para
    el visualizador interactivo (cada nodo explorado/podado con f/g/h).
    """
    try:
        engine = get_engine()
        run = engine.optimize(
            product_type=req.product_type,
            business_model=req.business_model.value,
            is_express=req.is_express,
            express_threshold_days=req.express_threshold_days,
            shipping_shock=req.shipping_shock,
            demand_variation=req.demand_variation,
            price_variation=req.price_variation,
            manufacturing_variation=req.manufacturing_variation,
            priority_weights=req.priority_weights,
            top_k=req.top_k,
            collect_trace=req.collect_trace,
        )
        return {
            "status":  "ok",
            "results": run["results"],
            "trace":   run["trace"],
            "stats":   run["stats"],
            "count":   len(run["results"]),
            "params":  req.dict(),
        }
    except Exception as e:
        logger.error(f"Error en /api/optimize: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulate")
def simulate_whatif(req: SimulateRequest):
    """
    Ejecuta una simulación what-if y la prepara para ser guardada.
    """
    try:
        result = simulate(
            df=get_df(),
            engine=get_engine(),
            name=req.name,
            product_type=req.product_type,
            business_model=req.business_model.value,
            is_express=req.is_express,
            express_threshold_days=req.express_threshold_days,
            shipping_shock=req.shipping_shock,
            demand_variation=req.demand_variation,
            price_variation=req.price_variation,
            manufacturing_variation=req.manufacturing_variation,
            priority_weights=req.priority_weights,
        )
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Error en /api/simulate: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Endpoints de Riesgo ──────────────────────────────────────────────────────

@app.get("/api/stockout")
def get_stockout(
    product_type: Optional[str] = Query(default=None)
):
    """
    Retorna el estado de stockout por SKU con clasificación semáforo.
    No requiere input manual — se calcula automáticamente del CSV.
    """
    try:
        df = get_df()
        if product_type:
            df = df[df["Product type"].str.lower() == product_type.lower()]
        statuses = calculate_stockout_risk(df)
        summary  = get_stockout_summary(statuses)
        return {"status": "ok", "items": statuses, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Endpoints de Pareto ──────────────────────────────────────────────────────

@app.post("/api/pareto")
def get_pareto(req: ParetoRequest):
    """
    Calcula y retorna la frontera de Pareto.
    Resalta las rutas donde mejorar una métrica implica empeorar la otra.
    """
    valid_metrics = {"margin", "lead_time", "co2_kg", "defect_rate", "strategic_score"}
    if req.obj1 not in valid_metrics or req.obj2 not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Métricas válidas: {valid_metrics}"
        )

    try:
        engine = get_engine()
        all_routes_df = engine.get_all_routes_for_pareto(
            product_type=req.product_type,
            business_model=req.business_model.value,
            shipping_shock=req.shipping_shock,
            demand_variation=req.demand_variation,
            price_variation=req.price_variation,
            manufacturing_variation=req.manufacturing_variation,
        )

        if all_routes_df.empty:
            return {"status": "ok", "points": [], "pareto_count": 0}

        result_df = compute_pareto(all_routes_df, obj1=req.obj1, obj2=req.obj2)
        points    = result_df.to_dict(orient="records")

        return {
            "status":       "ok",
            "points":       points,
            "pareto_count": int(result_df["is_pareto"].sum()),
            "total_count":  len(points),
            "obj1":         req.obj1,
            "obj2":         req.obj2,
        }
    except Exception as e:
        logger.error(f"Error en /api/pareto: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Endpoints de Carbono ─────────────────────────────────────────────────────

@app.get("/api/carbon/{route}")
def get_carbon_route(route: str):
    """
    Retorna la huella de carbono de una ruta para todos los modos de transporte.
    Badge ECO para modos bajo el promedio.
    """
    valid_routes = {"Route A", "Route B", "Route C"}
    # Normaliza el formato (route-a → Route A)
    formatted = route.replace("-", " ").title()
    if formatted not in valid_routes:
        raise HTTPException(
            status_code=400,
            detail=f"Ruta inválida. Válidas: {valid_routes}"
        )
    return {"status": "ok", "data": get_carbon_for_route(formatted)}


@app.get("/api/carbon")
def get_carbon_all():
    """Retorna resumen de emisiones de carbono para todas las combinaciones."""
    return {"status": "ok", "data": carbon_summary_by_transport()}


# ─── Endpoints de Configuración ───────────────────────────────────────────────

@app.post("/api/config")
def post_config(req: BusinessConfigRequest):
    """Guarda la configuración del modelo de negocio en SQLite."""
    try:
        save_business_config(
            business_model=req.business_model.value,
            priority_weights=req.priority_weights,
            express_threshold_days=req.express_threshold_days,
        )
        return {"status": "ok", "message": "Configuración guardada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
def get_config():
    """Obtiene la configuración actual del negocio desde SQLite."""
    config = get_business_config()
    if config is None:
        return {"status": "ok", "config": None, "is_first_run": True}
    return {"status": "ok", "config": config, "is_first_run": False}


# ─── Endpoints de Simulaciones ────────────────────────────────────────────────

@app.post("/api/simulations/save")
def save_sim(req: SaveSimulationRequest):
    """Persiste una simulación con sus parámetros y resultados."""
    try:
        sim_id = save_simulation(
            name=req.name,
            parameters=req.parameters,
            results=req.results,
            best_route=req.best_route,
            best_score=req.best_score,
        )
        return {"status": "ok", "id": sim_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulations")
def get_simulations_list():
    """Lista todas las simulaciones guardadas (resumen sin resultados detallados)."""
    return {"status": "ok", "simulations": list_simulations()}


@app.get("/api/simulations/{sim_id}")
def get_simulation_detail(sim_id: int):
    """Obtiene una simulación completa por ID."""
    sim = get_simulation(sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail=f"Simulación {sim_id} no encontrada")
    return {"status": "ok", "simulation": sim}


# ─── Endpoints de Carriers ────────────────────────────────────────────────────

@app.get("/api/carrier/rates")
async def get_carrier_rates_endpoint(
    origin:      str = Query(default="Mumbai"),
    destination: str = Query(default="Delhi"),
    weight_kg:   float = Query(default=1.0)
):
    """
    Obtiene rates en vivo de los 3 carriers (ShipEngine, EasyPost, Shippo).
    Fallback automático a datos locales si no hay API keys configuradas.
    """
    try:
        result = await get_all_carrier_rates(origin, destination, weight_kg)
        return {"status": "ok", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    """Verifica que el servidor y los datos estén disponibles."""
    try:
        df = get_df()
        config = get_business_config()
        return {
            "status":        "ok",
            "rows_loaded":   len(df),
            "product_types": df["Product type"].unique().tolist(),
            "suppliers":     df["Supplier name"].unique().tolist(),
            "has_config":    config is not None,
            "api_keys": {
                "shipengine": bool(os.getenv("SHIPENGINE_API_KEY")),
                "easypost":   bool(os.getenv("EASYPOST_API_KEY")),
                "shippo":     bool(os.getenv("SHIPPO_API_KEY")),
            },
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}
