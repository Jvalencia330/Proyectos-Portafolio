# SupplyChain AI — Optimización con Algoritmo A*

Sistema completo de optimización de cadena de suministro para e-commerce. Usa el algoritmo **A* real** para encontrar las rutas óptimas entre proveedores, modos de transporte, rutas y carriers, balanceando margen, velocidad, riesgo y huella de carbono.

## Arquitectura

```
agentefinal/
├── backend/                    # FastAPI + Python
│   ├── main.py                 # Servidor y todos los endpoints
│   ├── astar_engine.py         # Motor A* con poda real
│   ├── risk_engine.py          # Riesgo de stockout automático
│   ├── simulation_engine.py    # Simulaciones what-if
│   ├── carbon_engine.py        # Huella de carbono CO₂
│   ├── carrier_api.py          # APIs de carriers con fallback
│   ├── database.py             # SQLite — toda la persistencia
│   ├── models.py               # Modelos Pydantic
│   └── requirements.txt
├── frontend/                   # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx             # Dashboard principal
│       ├── api.js              # Capa de comunicación
│       └── components/
│           ├── BusinessModelSelector.jsx
│           ├── WhatIfPanel.jsx
│           ├── AstarResults.jsx
│           ├── StockoutPanel.jsx
│           ├── ParetoChart.jsx
│           ├── CarbonPanel.jsx
│           ├── CarrierRates.jsx
│           └── SimulationHistory.jsx
└── supply_chain_data.csv       # Dataset de entrada
```

## Requisitos del Sistema

- **Python** 3.10+ con pip
- **Node.js** 18+ con npm
- `supply_chain_data.csv` en la raíz del proyecto

## Instalación

### Backend

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Configurar API Keys de Carriers (Opcional)

El sistema funciona **completamente offline** sin API keys, usando los datos del CSV con un badge de advertencia. Para activar rates en vivo:

```bash
# Copia el template y rellena tus keys
cp backend/.env.example backend/.env
```

```env
# backend/.env
SHIPENGINE_API_KEY=se-xxx...   # https://app.shipengine.com/
EASYPOST_API_KEY=EZTxxx...     # https://www.easypost.com/signup
SHIPPO_API_KEY=shippo_xxx...   # https://apps.goshippo.com/signup
```

| Carrier   | API       | Proveedor real | Free tier          |
|-----------|-----------|----------------|--------------------|
| Carrier A | ShipEngine| UPS            | 500 llamadas/mes   |
| Carrier B | EasyPost  | FedEx          | 120 llamadas/mes   |
| Carrier C | Shippo    | DHL            | 25 envíos/mes      |

## Ejecutar el Sistema

### Opción 1: Dos terminales (recomendado para desarrollo)

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Abre http://localhost:5173 en tu navegador.

### Opción 2: Script de inicio rápido

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

## Paneles del Dashboard

### Selector de Modelo de Negocio
Primera pantalla al iniciar. Define qué nodos del grafo A* son activos:
- **Fulfillment Propio**: todos los nodos activos
- **3PL**: nodo de transporte lo decide el 3PL
- **Dropshipping**: sin nodo de transporte ni carrier propio

### Optimizador A* (Tab: Optimizar)
Panel izquierdo: sliders what-if + distribución de prioridades.
Panel derecho: top-5 rutas óptimas con desglose g(n), h(n), score estratégico.

Los sliders re-ejecutan A* en tiempo real:
| Slider | Rango | Efecto |
|--------|-------|--------|
| Shock de Shipping | 0.5x–3.0x | Simula crisis de costos de envío |
| Variación de Demanda | -50%–+100% | Cambio en volumen de ventas |
| Variación de Precios | -30%–+50% | Ajuste de precios de venta |
| Variación Manufactura | 0.5x–2.0x | Cambio en costos de producción |
| Umbral Express | 1–14 días | Máximo para entrega express |

### Riesgo de Stockout (Tab: Stockout)
Semáforos automáticos por SKU sin input del usuario:
- 🔴 **CRÍTICO**: stock proyectado en 7 días ≤ 0
- 🟡 **ALERTA**: stock proyectado ≤ ROP
- 🟢 **OK**: stock suficiente

*Oculto en modo Dropshipping.*

### Frontera de Pareto (Tab: Pareto)
Scatter plot interactivo de rutas Pareto-óptimas.
> Una ruta es Pareto-óptima si **no existe ninguna otra ruta que sea mejor en AMBAS métricas al mismo tiempo**.

Métricas seleccionables: Margen, Lead Time, CO₂, Defect Rate, Score Estratégico.

### Huella de Carbono (Tab: CO₂)
Comparativa de emisiones por modo de transporte y ruta.
Badge **ECO** para rutas con emisiones bajo el promedio del conjunto.
Factores (kg CO₂/ton·km): Road=0.062, Air=0.602, Sea=0.003, Rail=0.022.

### Carriers (Tab: Carriers)
Rates en tiempo real de UPS (ShipEngine), FedEx (EasyPost), DHL (Shippo).
Fallback automático a datos locales con badge `⚠️ Usando datos locales`.

### Historial (Tab: Historial)
Todas las simulaciones guardadas con sus parámetros y resultados.
Expandir cualquiera para ver detalle y cargar sus parámetros en el simulador.

## Algoritmo A*

### Estructura del Grafo
```
START → [Proveedor] → [Fulfillment] → [Transporte] → [Ruta] → [Carrier] → GOAL
```

### Función de Costo g(n)
```
g(n) = shipping_cost + manufacturing_cost + costs + opp_cost
opp_cost = (price × 0.15 × lead_time) / 365
```

### Heurística Admisible h(n)
```
h(n) = percentil_90(margen_histórico de rutas similares desde este nodo)
```
La heurística usa el p90 del margen histórico: optimista pero acotado. Garantiza que A* explore primero los caminos más prometedores y pode ramas que no pueden superar la mejor solución encontrada.

### Poda
Cuando `f(n) = margin_so_far + h(n) < best_found × 0.5`, la rama se descarta completamente.

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/optimize` | Ejecuta A* |
| POST | `/api/simulate` | Simulación what-if |
| GET | `/api/stockout` | Estado de stockout |
| POST | `/api/pareto` | Frontera de Pareto |
| GET | `/api/carbon/{route}` | CO₂ por ruta |
| GET | `/api/carbon` | Resumen CO₂ general |
| POST | `/api/config` | Guarda configuración |
| GET | `/api/config` | Obtiene configuración |
| POST | `/api/simulations/save` | Guarda simulación |
| GET | `/api/simulations` | Lista simulaciones |
| GET | `/api/simulations/{id}` | Detalle de simulación |
| GET | `/api/carrier/rates` | Rates de carriers |
| GET | `/api/health` | Estado del servidor |

Documentación interactiva: http://localhost:8000/docs
