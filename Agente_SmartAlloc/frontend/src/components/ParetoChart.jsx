import { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis
} from 'recharts'
import { getPareto } from '../api'

const METRICS = [
  { value: 'margin',          label: 'Margen ($)',         fmt: v => `$${Number(v).toFixed(0)}` },
  { value: 'lead_time',       label: 'Lead Time (días)',   fmt: v => `${Number(v).toFixed(1)}d` },
  { value: 'co2_kg',          label: 'CO₂ (kg)',           fmt: v => `${(Number(v)*1000).toFixed(1)}g` },
  { value: 'defect_rate',     label: 'Defect Rate (%)',    fmt: v => `${(Number(v)*100).toFixed(1)}%` },
  { value: 'strategic_score', label: 'Score Estratégico',  fmt: v => Number(v).toFixed(1) },
]

function TooltipContent({ active, payload, xMeta, yMeta }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="font-bold text-white mb-1">{d.supplier}</div>
      <div className="text-gray-400 mb-2 text-xs">{d.transport_mode} · {d.route} · {d.carrier}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">{xMeta?.label}</span>
          <span className="text-blue-400 font-mono">{xMeta?.fmt(d.x)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">{yMeta?.label}</span>
          <span className="text-purple-400 font-mono">{yMeta?.fmt(d.y)}</span>
        </div>
      </div>
      {d.is_pareto && <div className="mt-2 text-yellow-400 font-semibold">⭐ Pareto-óptima</div>}
    </div>
  )
}

export default function ParetoChart({ config }) {
  const [obj1, setObj1]     = useState('margin')
  const [obj2, setObj2]     = useState('lead_time')
  const [raw, setRaw]       = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr]       = useState('')
  const [counts, setCounts] = useState({ pareto: 0, total: 0 })

  useEffect(() => {
    setLoading(true)
    setErr('')
    getPareto({
      obj1,
      obj2,
      business_model: config?.businessModel || 'own',
    })
      .then(resp => {
        setRaw(resp.points || [])
        setCounts({ pareto: resp.pareto_count || 0, total: resp.total_count || 0 })
      })
      .catch(e => setErr('Error al cargar: ' + (e?.response?.data?.detail || e.message)))
      .finally(() => setLoading(false))
  }, [obj1, obj2, config])

  // Map raw points → {x, y, ...meta} for Recharts
  const points = raw.map(p => ({ ...p, x: p[obj1], y: p[obj2] }))
  const paretoPoints    = points.filter(p => p.is_pareto)
  const nonParetoPoints = points.filter(p => !p.is_pareto)

  const xMeta = METRICS.find(m => m.value === obj1)
  const yMeta = METRICS.find(m => m.value === obj2)

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="card-title mb-1">Frontera de Pareto — Análisis Multi-objetivo</h2>
        <p className="text-xs text-gray-500">
          Rutas ⭐ donde mejorar una métrica obliga a sacrificar la otra (trade-off óptimo).
        </p>
      </div>

      {/* Selectores */}
      <div className="flex gap-4 flex-wrap items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Eje X</label>
          <select value={obj1} onChange={e => setObj1(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2 py-1.5">
            {METRICS.filter(m => m.value !== obj2).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Eje Y</label>
          <select value={obj2} onChange={e => setObj2(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2 py-1.5">
            {METRICS.filter(m => m.value !== obj1).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2 items-center flex-wrap">
          <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-1 rounded-full">
            ⭐ {counts.pareto} Pareto-óptimas
          </span>
          <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">
            {counts.total} rutas totales
          </span>
        </div>
      </div>

      {/* Gráfica */}
      {loading ? (
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-2xl animate-spin mb-2">⚙️</div>
            <p className="text-sm">Calculando frontera Pareto...</p>
          </div>
        </div>
      ) : err ? (
        <div className="h-80 flex items-center justify-center text-red-400 text-sm">{err}</div>
      ) : points.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-gray-500 text-sm">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="x"
              type="number"
              name={xMeta?.label}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              label={{ value: xMeta?.label, position: 'insideBottom', offset: -20, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name={yMeta?.label}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              label={{ value: yMeta?.label, angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 11 }}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip content={<TooltipContent xMeta={xMeta} yMeta={yMeta} />} />

            <Scatter
              name="Dominadas"
              data={nonParetoPoints}
              fill="#374151"
              opacity={0.7}
            />
            <Scatter
              name="Pareto-óptima"
              data={paretoPoints}
              fill="#f59e0b"
              stroke="#fbbf24"
              strokeWidth={1}
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-xs text-gray-500 border-t border-gray-800 pt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Pareto-óptima — trade-off irreducible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-600" />
          <span>Dominada — existe una opción mejor en ambas</span>
        </div>
      </div>

      {/* Tabla de Pareto */}
      {paretoPoints.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-2">Rutas Pareto-óptimas</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-2 px-2">Proveedor</th>
                  <th className="text-left py-2 px-2">Transporte · Ruta</th>
                  <th className="text-right py-2 px-2">{xMeta?.label}</th>
                  <th className="text-right py-2 px-2">{yMeta?.label}</th>
                  <th className="text-right py-2 px-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {paretoPoints.map((p, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-1.5 px-2 text-yellow-300">{p.supplier}</td>
                    <td className="py-1.5 px-2 text-gray-400">{p.transport_mode} · {p.route}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-blue-400">{xMeta?.fmt(p.x)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-purple-400">{yMeta?.fmt(p.y)}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-green-400">{Number(p.strategic_score).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
