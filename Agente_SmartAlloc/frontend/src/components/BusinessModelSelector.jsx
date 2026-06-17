/**
 * Selector de modelo de negocio — primer paso del onboarding.
 * La elección determina qué nodos del grafo A* se activan y qué paneles son visibles.
 */
import { useState } from 'react'
import { saveConfig } from '../api'

const MODELS = [
  {
    id: 'own',
    title: 'Fulfillment Propio',
    icon: '🏭',
    description: 'Controlas el inventario, transporte y logística completa.',
    features: ['Todos los nodos A* activos', 'Métricas: stockout, rutas, carriers, CO₂, margen', 'Máximo control sobre la cadena'],
    color: 'blue',
  },
  {
    id: '3pl',
    title: 'Tercero Logístico (3PL)',
    icon: '🤝',
    description: 'Delegas la logística a un proveedor 3PL especializado.',
    features: ['Nodos: proveedor → 3PL → carrier', 'El transporte lo decide el 3PL', 'Métricas: costo 3PL vs margen, lead time'],
    color: 'purple',
  },
  {
    id: 'dropshipping',
    title: 'Dropshipping',
    icon: '📦',
    description: 'El proveedor envía directamente al cliente sin pasar por ti.',
    features: ['Nodos: proveedor → ruta directa al cliente', 'Sin nodo de transporte ni carrier propio', 'Métricas: margen, defect rate, velocidad'],
    color: 'green',
  },
]

const WEIGHT_DEFAULTS = { margin: 25, speed: 25, risk: 25, carbon: 25 }

export default function BusinessModelSelector({ onSelect, onCancel }) {
  const [selected, setSelected] = useState(null)
  const [weights, setWeights] = useState(WEIGHT_DEFAULTS)
  const [expressThreshold, setExpressThreshold] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Ajusta un peso y redistribuye el restante proporcionalmente entre los demás
  const adjustWeight = (key, value) => {
    const val = Math.max(0, Math.min(100, Number(value)))
    const remaining = 100 - val
    const otherKeys = Object.keys(weights).filter(k => k !== key)
    const currentOtherSum = otherKeys.reduce((s, k) => s + weights[k], 0)

    const newWeights = { ...weights, [key]: val }
    if (currentOtherSum > 0) {
      otherKeys.forEach(k => {
        newWeights[k] = Math.round((weights[k] / currentOtherSum) * remaining)
      })
    } else {
      const share = Math.floor(remaining / otherKeys.length)
      otherKeys.forEach(k => { newWeights[k] = share })
    }
    setWeights(newWeights)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    const cfg = { businessModel: selected, weights, expressThreshold }
    try {
      await saveConfig({
        business_model: selected,
        priority_weights: weights,
        express_threshold_days: expressThreshold,
      })
    } catch (e) {
      setError('No se pudo guardar en el servidor, usando configuración local.')
    } finally {
      setSaving(false)
      onSelect(cfg)
    }
  }

  const colorMap = {
    blue:   'border-blue-500 bg-blue-950/30',
    purple: 'border-purple-500 bg-purple-950/30',
    green:  'border-green-500 bg-green-950/30',
  }
  const btnColorMap = {
    blue:   'bg-blue-600 hover:bg-blue-500',
    purple: 'bg-purple-600 hover:bg-purple-500',
    green:  'bg-green-600 hover:bg-green-500',
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-950">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">⛓️</div>
          <h1 className="text-4xl font-bold text-white mb-2">SupplyChain AI</h1>
          <p className="text-gray-400 text-lg">Optimización con algoritmo A* real</p>
        </div>

        {/* Selección de modelo */}
        <h2 className="text-lg font-semibold text-gray-300 mb-4 text-center">
          Selecciona tu modelo de negocio
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={`text-left p-6 rounded-xl border-2 transition-all cursor-pointer
                ${selected === m.id
                  ? colorMap[m.color]
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}
            >
              <div className="text-3xl mb-3">{m.icon}</div>
              <div className="font-bold text-white text-lg mb-2">{m.title}</div>
              <div className="text-gray-400 text-sm mb-4">{m.description}</div>
              <ul className="space-y-1">
                {m.features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                    <span className="text-gray-600 mt-0.5">›</span>{f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* Pesos de prioridad */}
        {selected && (
          <div className="card mb-6 animate-fade-in">
            <div className="card-title">Distribuye tus 100 puntos de prioridad</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { key: 'margin',  label: 'Margen',    icon: '💰', color: 'text-green-400' },
                { key: 'speed',   label: 'Velocidad', icon: '⚡', color: 'text-yellow-400' },
                { key: 'risk',    label: 'Riesgo',    icon: '🛡️', color: 'text-red-400' },
                { key: 'carbon',  label: 'CO₂',       icon: '🌱', color: 'text-emerald-400' },
              ].map(({ key, label, icon, color }) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">{icon} {label}</span>
                    <span className={`font-bold ${color}`}>{weights[key]}</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={weights[key]}
                    onChange={e => adjustWeight(key, e.target.value)}
                    className="slider"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 text-center text-xs text-gray-500">
              Total: <span className={Object.values(weights).reduce((a,b)=>a+b,0) === 100 ? 'text-green-400' : 'text-red-400'}>
                {Object.values(weights).reduce((a,b)=>a+b,0)}
              </span> / 100
            </div>
          </div>
        )}

        {/* Umbral express */}
        {selected && (
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">⚡ Umbral de entrega express (días)</span>
              <span className="font-bold text-yellow-400">{expressThreshold} días</span>
            </div>
            <input
              type="range" min={1} max={14} value={expressThreshold}
              onChange={e => setExpressThreshold(Number(e.target.value))}
              className="slider"
            />
          </div>
        )}

        {/* Botón confirmar + cancelar */}
        <div className="flex items-center justify-center gap-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-xl font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all"
            >
              ← Volver
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selected || saving}
            className={`px-8 py-3 rounded-xl font-bold text-white text-lg transition-all
              ${selected
                ? `${btnColorMap[MODELS.find(m=>m.id===selected)?.color || 'blue']} shadow-lg`
                : 'bg-gray-700 cursor-not-allowed'}`}
          >
            {saving ? 'Guardando...' : 'Iniciar Dashboard →'}
          </button>
        </div>
        {error && <p className="text-center text-xs text-yellow-400 mt-2">{error}</p>}
      </div>
    </div>
  )
}
