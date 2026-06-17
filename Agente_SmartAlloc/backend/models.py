"""
Modelos Pydantic para SupplyChain AI.
Define la estructura de datos de requests/responses de todos los endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class BusinessModel(str, Enum):
    OWN = "own"
    TPL = "3pl"
    DROPSHIPPING = "dropshipping"


class BusinessConfigRequest(BaseModel):
    business_model: BusinessModel
    priority_weights: Dict[str, float] = Field(
        default={"margin": 25, "speed": 25, "risk": 25, "carbon": 25},
        description="Pesos de prioridad que suman 100"
    )
    express_threshold_days: int = Field(default=3, ge=1, le=14)


class OptimizeRequest(BaseModel):
    product_type: Optional[str] = Field(default=None, description="haircare | skincare | cosmetics")
    business_model: BusinessModel = BusinessModel.OWN
    is_express: bool = False
    priority_weights: Dict[str, float] = Field(
        default={"margin": 25, "speed": 25, "risk": 25, "carbon": 25}
    )
    # Sliders de simulación what-if
    shipping_shock: float = Field(default=1.0, ge=0.5, le=3.0)
    demand_variation: float = Field(default=1.0, ge=0.5, le=2.0)
    price_variation: float = Field(default=1.0, ge=0.7, le=1.5)
    manufacturing_variation: float = Field(default=1.0, ge=0.5, le=2.0)
    express_threshold_days: int = Field(default=3, ge=1, le=14)
    top_k: int = Field(default=5, ge=1, le=20)
    collect_trace: bool = Field(default=False, description="Activa la traza paso a paso para el visualizador")


class SimulateRequest(BaseModel):
    name: str
    product_type: Optional[str] = None
    business_model: BusinessModel = BusinessModel.OWN
    is_express: bool = False
    priority_weights: Dict[str, float] = Field(
        default={"margin": 25, "speed": 25, "risk": 25, "carbon": 25}
    )
    shipping_shock: float = Field(default=1.0, ge=0.5, le=3.0)
    demand_variation: float = Field(default=1.0, ge=0.5, le=2.0)
    price_variation: float = Field(default=1.0, ge=0.7, le=1.5)
    manufacturing_variation: float = Field(default=1.0, ge=0.5, le=2.0)
    express_threshold_days: int = Field(default=3, ge=1, le=14)


class SaveSimulationRequest(BaseModel):
    name: str
    parameters: Dict[str, Any]
    results: List[Dict[str, Any]]
    best_route: str
    best_score: float


class ParetoRequest(BaseModel):
    """Parámetros para calcular la frontera de Pareto."""
    obj1: str = Field(default="margin", description="margin | lead_time | co2_kg | defect_rate")
    obj2: str = Field(default="lead_time", description="margin | lead_time | co2_kg | defect_rate")
    product_type: Optional[str] = None
    business_model: BusinessModel = BusinessModel.OWN
    shipping_shock: float = 1.0
    demand_variation: float = 1.0
    price_variation: float = 1.0
    manufacturing_variation: float = 1.0


class RouteResult(BaseModel):
    supplier: str
    location: str
    fulfillment_mode: str
    transport_mode: str
    route: str
    carrier: str
    g_cost: float
    h_score: float
    f_score: float
    margin: float
    lead_time: float
    co2_kg: float
    defect_rate: float
    strategic_score: float
    is_express_valid: bool
    price: float
    shipping_cost: float
    manufacturing_cost: float
    nodes_explored: int
    nodes_pruned: int


class StockoutStatus(BaseModel):
    sku: str
    product_type: str
    stock_level: float
    daily_demand: float
    avg_lead_time: float
    rop: float
    stock_projected: float
    status: str  # 'OK' | 'ALERTA' | 'CRÍTICO'


class CarbonResult(BaseModel):
    route: str
    transport_mode: str
    distance_km: float
    co2_kg: float
    is_eco: bool
    label: str
