/**
 * App principal de SupplyChain AI.
 * Maneja el flujo de onboarding (selector de modelo) → dashboard.
 * Coordina el estado global: resultados A*, configuración y parámetros activos.
 */
import { useState, useEffect, useRef } from 'react'
import { getConfig, getHealth } from './api'
import BusinessModelSelector from './components/BusinessModelSelector'
import WhatIfPanel           from './components/WhatIfPanel'
import AstarResults          from './components/AstarResults'
import AstarVisualizer       from './components/AstarVisualizer'
import StockoutPanel         from './components/StockoutPanel'
import ParetoChart           from './components/ParetoChart'
import SimulationHistory     from './components/SimulationHistory'
import CarrierRates          from './components/CarrierRates'

const MODEL_LABELS = {
  own:          { label: 'Fulfillment Propio', icon: '🏭', color: 'text-blue-400' },
  '3pl':        { label: '3PL',                icon: '🤝', color: 'text-purple-400' },
  dropshipping: { label: 'Dropshipping',       icon: '📦', color: 'text-green-400' },
}

export default function App() {
  const [config, setConfig]     = useState(null)     // { businessModel, weights, expressThreshold }
  const [loading, setLoading]   = useState(true)
  const [astarResults, setAstar] = useState([])
  const [activeTab, setTab]     = useState('optimize')
  const [health, setHealth]     = useState(null)
  const prevConfigRef = useRef(null)

  const DEFAULT_CONFIG = {
    businessModel:    'own',
    weights:          { margin: 25, speed: 25, risk: 25, carbon: 25 },
    expressThreshold: 3,
  }

  // Al arrancar, carga configuración guardada o usa defaults (sin bloquear con selector)
  useEffect(() => {
    Promise.all([getConfig(), getHealth()])
      .then(([cfgResp, healthResp]) => {
        if (!cfgResp.is_first_run && cfgResp.config) {
          setConfig({
            businessModel:    cfgResp.config.business_model,
            weights:          cfgResp.config.priority_weights,
            expressThreshold: cfgResp.config.express_threshold_days,
          })
        } else {
          setConfig(DEFAULT_CONFIG)
        }
        setHealth(healthResp)
      })
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setLoading(false))
  }, [])

  // Onboarding: muestra el selector hasta que haya configuración
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-3 animate-spin">⚙️</div>
          <p>Iniciando SupplyChain AI...</p>
        </div>
      </div>
    )
  }

  // BusinessModelSelector sólo si el usuario hace click en "Cambiar modelo"
  if (config === 'selecting') {
    return (
      <BusinessModelSelector
        onSelect={setConfig}
        onCancel={() => setConfig(prevConfigRef.current || DEFAULT_CONFIG)}
      />
    )
  }

  const modelMeta = MODEL_LABELS[config.businessModel] || MODEL_LABELS.own

  const TABS = [
    { id: 'optimize',  label: '🧠 A* Optimizar',    show: true },
    { id: 'astar',     label: '🔍 Trazar A*',        show: true },
    { id: 'pareto',    label: '📊 Pareto',            show: true },
    { id: 'carriers',  label: '🚚 Carriers',          show: true },
    { id: 'stockout',  label: '🚦 Riesgo',            show: config.businessModel !== 'dropshipping' },
    { id: 'history',   label: '📋 Historial',         show: true },
  ].filter(t => t.show)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Top Bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⛓️</span>
            <h1 className="text-white font-bold">SupplyChain AI</h1>
            <span className="text-gray-700">·</span>
            <span className={`text-sm ${modelMeta.color}`}>
              {modelMeta.icon} {modelMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats rápidas */}
            {health && (
              <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
                <span>{health.rows_loaded} SKUs</span>
                <span>·</span>
                <span>{health.suppliers?.length} proveedores</span>
                {!Object.values(health.api_keys || {}).some(Boolean) && (
                  <span className="badge-yellow">⚠️ Sin API keys</span>
                )}
              </div>
            )}

            {/* Botón cambiar modelo */}
            <button
              onClick={() => { prevConfigRef.current = config; setConfig('selecting') }}
              className="btn-secondary text-xs py-1 px-3"
            >
              Cambiar modelo
            </button>
          </div>
        </div>
      </header>

      {/* Tabs de navegación */}
      <nav className="bg-gray-900/50 border-b border-gray-800 px-6">
        <div className="max-w-screen-2xl mx-auto flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`text-sm px-4 py-3 font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Contenido principal */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* ── Tab: Visualizador A* ────────────────────────────────────────── */}
        {activeTab === 'astar' && (
          <AstarVisualizer config={config} />
        )}

        {/* ── Tab: Optimizar ─────────────────────────────────────────────── */}
        {activeTab === 'optimize' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel de controles */}
            <div className="lg:col-span-1">
              <WhatIfPanel
                config={config}
                onResults={setAstar}
              />
            </div>

            {/* Resultados A* */}
            <div className="lg:col-span-2">
              <AstarResults results={astarResults} />
            </div>
          </div>
        )}

        {/* ── Tab: Stockout ───────────────────────────────────────────────── */}
        {activeTab === 'stockout' && (
          <div className="max-w-2xl">
            <StockoutPanel
              businessModel={config.businessModel}
              productFilter={null}
            />
          </div>
        )}

        {/* ── Tab: Pareto ─────────────────────────────────────────────────── */}
        {activeTab === 'pareto' && (
          <ParetoChart config={config} />
        )}

        {/* ── Tab: Carriers ───────────────────────────────────────────────── */}
        {activeTab === 'carriers' && (
          <div className="max-w-lg">
            <CarrierRates />
          </div>
        )}

        {/* ── Tab: Historial ──────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="max-w-2xl">
            <SimulationHistory
              onLoad={(params) => {
                setTab('optimize')
                // Los parámetros se cargaran en el WhatIfPanel via prop drilling
                // En una app real se usaría Context o Zustand
              }}
            />
          </div>
        )}

      </main>
    </div>
  )
}
