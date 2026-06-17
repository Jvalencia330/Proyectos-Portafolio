/**
 * Panel de huella de carbono.
 * Muestra CO₂ por ruta y modo de transporte.
 * Badge ECO para rutas bajo el promedio del conjunto.
 */
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getCarbonAll } from '../api'

const TRANSPORT_ICONS = {
  Road: '🚛',
  Air:  '✈️',
  Sea:  '🚢',
  Rail: '🚆',
}

const TRANSPORT_COLORS = {
  Road: '#3b82f6',
  Air:  '#ef4444',
  Sea:  '#10b981',
  Rail: '#8b5cf6',
}

const ROUTE_DISTANCES = { 'Route A': 500, 'Route B': 1200, 'Route C': 2500 }

const CARBON_FACTORS = { Road: 0.062, Air: 0.602, Sea: 0.003, Rail: 0.022 }

function calcCo2(transport, route) {
  return (CARBON_FACTORS[transport] || 0.062) * 0.001 * (ROUTE_DISTANCES[route] || 500)
}

export default function CarbonPanel({ astarResults = [] }) {
  const [selectedRoute, setRoute] = useState('Route A')
  const [carbonAll, setCarbonAll]  = useState(null)

  useEffect(() => {
    getCarbonAll().then(d => setCarbonAll(d.data)).catch(console.error)
  }, [])

  // Datos para la gráfica de la ruta seleccionada
  const routeData = Object.keys(CARBON_FACTORS).map(transport => {
    const co2  = calcCo2(transport, selectedRoute)
    const avg  = Object.keys(CARBON_FACTORS).reduce((s, t) => s + calcCo2(t, selectedRoute), 0) / 4
    return {
      name:     `${TRANSPORT_ICONS[transport]} ${transport}`,
      transport,
      co2_g:    +(co2 * 1000).toFixed(2),
      is_eco:   co2 < avg,
    }
  })

  // Datos para la gráfica de rutas del A*
  const astarCarbon = astarResults.map(r => ({
    name:      `${r.supplier?.split(' ')[1] || ''} ${r.transport_mode} ${r.route?.replace('Route ', 'R')}`,
    co2_g:     +((r.co2_kg || 0) * 1000).toFixed(2),
    transport: r.transport_mode,
    is_eco:    r.co2_kg < (astarResults.reduce((s, x) => s + (x.co2_kg || 0), 0) / (astarResults.length || 1)),
  }))

  return (
    <div className="card space-y-5">
      <h2 className="card-title mb-0">Huella de Carbono CO₂</h2>

      {/* Selector de ruta */}
      <div className="flex gap-2">
        {['Route A', 'Route B', 'Route C'].map(r => (
          <button
            key={r}
            onClick={() => setRoute(r)}
            className={`text-xs px-3 py-1 rounded-full transition-colors
              ${selectedRoute === r
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {r} <span className="text-gray-500 ml-1">({ROUTE_DISTANCES[r]}km)</span>
          </button>
        ))}
      </div>

      {/* Gráfica por modo de transporte */}
      <div>
        <div className="text-xs text-gray-500 mb-2">CO₂ por modo de transporte — {selectedRoute}</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={routeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} unit="g" />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              formatter={(v) => [`${v}g CO₂`, 'Emisión']}
            />
            <Bar dataKey="co2_g" radius={[4, 4, 0, 0]}>
              {routeData.map((d, i) => (
                <Cell key={i} fill={TRANSPORT_COLORS[d.transport] || '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tarjetas por modo */}
      <div className="grid grid-cols-2 gap-2">
        {routeData.map(d => (
          <div
            key={d.transport}
            className={`rounded-lg p-2.5 border ${d.is_eco
              ? 'border-emerald-700/50 bg-emerald-950/20'
              : 'border-gray-700/50 bg-gray-800/30'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">{d.name}</span>
              {d.is_eco && <span className="badge-green text-xs">ECO</span>}
            </div>
            <div className={`font-bold ${d.is_eco ? 'text-emerald-400' : 'text-gray-300'}`}>
              {d.co2_g}g CO₂
            </div>
          </div>
        ))}
      </div>

      {/* Rutas A* con CO₂ */}
      {astarCarbon.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">CO₂ de las rutas A* actuales</div>
          <div className="space-y-1.5">
            {astarCarbon.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TRANSPORT_COLORS[d.transport] ? '' : 'bg-gray-500'}`}
                     style={{ backgroundColor: TRANSPORT_COLORS[d.transport] || '#6b7280' }} />
                <span className="text-gray-400 flex-1 truncate">{d.name}</span>
                <span className={`font-mono ${d.is_eco ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {d.co2_g}g
                </span>
                {d.is_eco && <span className="badge-green">ECO</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factor de referencia */}
      <div className="bg-gray-800/30 rounded-lg p-2 text-xs text-gray-600">
        CO₂ = factor × 0.001 ton × distancia_km · Sea es 200x más eficiente que Air
      </div>
    </div>
  )
}
