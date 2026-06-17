/**
 * Panel de simulaciones what-if con sliders interactivos.
 * Cada movimiento de slider re-ejecuta el A* en tiempo real.
 * El usuario también puede distribuir sus 100 puntos de prioridad.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { optimize, saveSimulation } from '../api'

const SLIDERS = [
  { key: 'shipping_shock',          label: 'Shock de Shipping',       icon: '🚢', min: 0.5,  max: 3.0, step: 0.1,  format: v => `${v.toFixed(1)}x`, desc: 'Multiplicador de costos de envío' },
  { key: 'demand_variation',        label: 'Variación de Demanda',    icon: '📈', min: 0.5,  max: 2.0, step: 0.05, format: v => `${((v-1)*100).toFixed(0)}%`, desc: '-50% a +100% de demanda' },
  { key: 'price_variation',         label: 'Variación de Precios',    icon: '💲', min: 0.7,  max: 1.5, step: 0.05, format: v => `${((v-1)*100).toFixed(0)}%`, desc: '-30% a +50% de precio de venta' },
  { key: 'manufacturing_variation', label: 'Variación Manufactura',   icon: '🏭', min: 0.5,  max: 2.0, step: 0.1,  format: v => `${v.toFixed(1)}x`, desc: 'Multiplicador de costos de manufactura' },
  { key: 'express_threshold_days',  label: 'Umbral Express (días)',    icon: '⚡', min: 1,    max: 14,  step: 1,    format: v => `${v}d`, desc: 'Máximo de días para entrega express' },
]

const WEIGHT_KEYS = [
  { key: 'margin',  label: 'Margen',    icon: '💰', color: 'text-green-400' },
  { key: 'speed',   label: 'Velocidad', icon: '⚡', color: 'text-yellow-400' },
  { key: 'risk',    label: 'Riesgo',    icon: '🛡️', color: 'text-red-400' },
  { key: 'carbon',  label: 'CO₂',       icon: '🌱', color: 'text-emerald-400' },
]

const DEFAULTS = {
  shipping_shock: 1.0,
  demand_variation: 1.0,
  price_variation: 1.0,
  manufacturing_variation: 1.0,
  express_threshold_days: 3,
}

export default function WhatIfPanel({ config, onResults }) {
  const [params, setParams]       = useState(DEFAULTS)
  const [weights, setWeights]     = useState(config?.weights || { margin: 25, speed: 25, risk: 25, carbon: 25 })
  const [isExpress, setExpress]   = useState(false)
  const [productType, setProduct] = useState('')
  const [loading, setLoading]     = useState(false)
  const [simName, setSimName]     = useState('')
  const [saveMsg, setSaveMsg]     = useState('')
  const [lastResults, setLastResults] = useState([])
  const debounceRef = useRef(null)

  // Re-ejecuta A* cada vez que cambian los parámetros (con debounce 300ms)
  const runOptimize = useCallback(async (p, w, express) => {
    setLoading(true)
    try {
      const result = await optimize({
        product_type:            productType || null,
        business_model:          config?.businessModel || 'own',
        is_express:              express,
        priority_weights:        w,
        shipping_shock:          p.shipping_shock,
        demand_variation:        p.demand_variation,
        price_variation:         p.price_variation,
        manufacturing_variation: p.manufacturing_variation,
        express_threshold_days:  p.express_threshold_days,
        top_k:                   5,
        collect_trace:           false,
      })
      const results = result.results || []
      setLastResults(results)
      onResults(results)
    } catch (e) {
      console.error('Optimize error:', e)
    } finally {
      setLoading(false)
    }
  }, [config, productType, onResults])

  // Debounced re-run cuando cambia cualquier parámetro
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runOptimize(params, weights, isExpress)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [params, weights, isExpress, runOptimize])

  const adjustWeight = (key, value) => {
    const val = Math.max(0, Math.min(100, Number(value)))
    const remaining = 100 - val
    const otherKeys = Object.keys(weights).filter(k => k !== key)
    const currentOtherSum = otherKeys.reduce((s, k) => s + weights[k], 0)
    const newW = { ...weights, [key]: val }
    if (currentOtherSum > 0) {
      otherKeys.forEach(k => { newW[k] = Math.round((weights[k] / currentOtherSum) * remaining) })
    } else {
      const share = Math.floor(remaining / otherKeys.length)
      otherKeys.forEach(k => { newW[k] = share })
    }
    setWeights(newW)
  }

  const handleSave = async () => {
    if (!simName.trim()) { setSaveMsg('Ingresa un nombre'); return }
    if (!lastResults.length) { setSaveMsg('Ejecuta primero el A*'); return }
    const best = lastResults[0]
    try {
      await saveSimulation({
        name: simName,
        parameters: { ...params, weights, isExpress, productType },
        results: lastResults,
        best_route: `${best.supplier} → ${best.transport_mode} → ${best.route} → ${best.carrier}`,
        best_score: best.strategic_score,
      })
      setSaveMsg('Guardado ✓')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch { setSaveMsg('Error al guardar') }
  }

  const resetParams = () => setParams(DEFAULTS)

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="card-title mb-0">Simulador What-If</h2>
        {loading && (
          <span className="text-xs text-blue-400 animate-pulse">Recalculando A*...</span>
        )}
      </div>

      {/* Filtro de producto */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Filtrar por producto</label>
        <select
          value={productType}
          onChange={e => setProduct(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 w-full"
        >
          <option value="">Todos los productos</option>
          <option value="haircare">Haircare</option>
          <option value="skincare">Skincare</option>
          <option value="cosmetics">Cosmetics</option>
        </select>
      </div>

      {/* Toggle express */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setExpress(!isExpress)}
          className={`relative w-10 h-5 rounded-full transition-colors ${isExpress ? 'bg-yellow-500' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isExpress ? 'translate-x-5' : ''}`} />
        </div>
        <span className="text-sm text-gray-300">⚡ Modo express</span>
      </label>

      {/* Sliders de escenario */}
      <div className="space-y-4">
        {SLIDERS.map(s => (
          <div key={s.key}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-400">{s.icon} {s.label}</span>
              <span className={`text-xs font-bold ${params[s.key] !== DEFAULTS[s.key] ? 'text-yellow-400' : 'text-gray-500'}`}>
                {s.format(params[s.key])}
              </span>
            </div>
            <input
              type="range"
              min={s.min} max={s.max} step={s.step}
              value={params[s.key]}
              onChange={e => setParams(p => ({ ...p, [s.key]: Number(e.target.value) }))}
              className="slider"
            />
            <div className="text-xs text-gray-600">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Pesos de prioridad */}
      <div>
        <div className="card-title text-xs mb-3">Distribución de prioridades (100 pts)</div>
        <div className="space-y-3">
          {WEIGHT_KEYS.map(({ key, label, icon, color }) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400">{icon} {label}</span>
                <span className={`text-xs font-bold ${color}`}>{weights[key]}</span>
              </div>
              <input
                type="range" min={0} max={100} value={weights[key]}
                onChange={e => adjustWeight(key, e.target.value)}
                className="slider"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-2 border-t border-gray-800">
        <input
          type="text"
          placeholder="Nombre de la simulación..."
          value={simName}
          onChange={e => setSimName(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5"
        />
        <button onClick={handleSave} className="btn-primary text-sm px-3 py-1.5">
          Guardar
        </button>
        <button onClick={resetParams} className="btn-secondary text-sm px-3 py-1.5">
          Reset
        </button>
      </div>
      {saveMsg && <p className={`text-xs ${saveMsg.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</p>}
    </div>
  )
}
