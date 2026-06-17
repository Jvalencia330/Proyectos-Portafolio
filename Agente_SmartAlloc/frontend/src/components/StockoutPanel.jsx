/**
 * Panel de riesgo de stockout con semáforos por SKU.
 * Se calcula automáticamente desde el CSV — sin input del usuario.
 * Se oculta en modo dropshipping (el proveedor gestiona el stock).
 */
import { useEffect, useState } from 'react'
import { getStockout } from '../api'

const STATUS_CONFIG = {
  'CRÍTICO': { dot: 'bg-red-500',    badge: 'badge-red',    icon: '🔴', pulse: true  },
  'ALERTA':  { dot: 'bg-yellow-500', badge: 'badge-yellow', icon: '🟡', pulse: false },
  'OK':      { dot: 'bg-green-500',  badge: 'badge-green',  icon: '🟢', pulse: false },
}

export default function StockoutPanel({ businessModel, productFilter }) {
  const [items, setItems]       = useState([])
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('ALL')

  // Dropshipping: el proveedor gestiona el stock, ocultar panel
  if (businessModel === 'dropshipping') {
    return (
      <div className="card flex items-center justify-center h-32">
        <p className="text-gray-500 text-sm text-center">
          📦 En dropshipping el proveedor gestiona el stock.<br />
          <span className="text-xs text-gray-600">Este panel no aplica para tu modelo de negocio.</span>
        </p>
      </div>
    )
  }

  useEffect(() => {
    setLoading(true)
    getStockout(productFilter)
      .then(data => {
        setItems(data.items || [])
        setSummary(data.summary || null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [productFilter])

  const filtered = filter === 'ALL'
    ? items
    : items.filter(i => i.status === filter)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-title mb-0">Riesgo de Stockout</h2>
        {loading && <span className="text-xs text-blue-400 animate-pulse">Cargando...</span>}
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryChip label="Total SKUs" value={summary.total} color="blue" />
          <SummaryChip label="Crítico" value={summary.criticos} color="red" />
          <SummaryChip label="Alerta" value={summary.alertas} color="yellow" />
          <SummaryChip label="OK" value={summary.ok} color="green" />
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-2">
        {['ALL', 'CRÍTICO', 'ALERTA', 'OK'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1 rounded-full transition-colors
              ${filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Lista de SKUs */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((item, i) => {
          const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['OK']
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-2"
            >
              {/* Semáforo */}
              <div className="relative flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                {cfg.pulse && (
                  <div className={`absolute inset-0 w-3 h-3 rounded-full ${cfg.dot} animate-ping opacity-75`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{item.sku}</span>
                  <span className="text-xs text-gray-500">{item.product_type}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Stock: <b className="text-gray-300">{item.stock_level}</b> ·
                  Proyectado: <b className={item.stock_projected <= 0 ? 'text-red-400' : 'text-gray-300'}>
                    {item.stock_projected.toFixed(0)}
                  </b> ·
                  ROP: <b className="text-gray-400">{item.rop.toFixed(0)}</b>
                </div>
              </div>

              <span className={cfg.badge}>{item.status}</span>
            </div>
          )
        })}

        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-4">Sin resultados para este filtro</p>
        )}
      </div>

      {/* Fórmula de referencia */}
      <div className="bg-gray-800/30 rounded-lg p-2 text-xs text-gray-600">
        ROP = demanda_diaria × lead_time_prom + safety_stock · safety_stock = demanda × σ(lead_time) × 1.65
      </div>
    </div>
  )
}

function SummaryChip({ label, value, color }) {
  const colorMap = {
    blue:   'bg-blue-900/30 text-blue-400',
    red:    'bg-red-900/30 text-red-400',
    yellow: 'bg-yellow-900/30 text-yellow-400',
    green:  'bg-green-900/30 text-green-400',
  }
  return (
    <div className={`rounded-lg p-2 text-center ${colorMap[color]}`}>
      <div className="font-bold text-lg">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  )
}
