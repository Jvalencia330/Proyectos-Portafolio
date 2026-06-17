/**
 * Historial de simulaciones guardadas.
 * Lista las simulaciones previas y permite cargar cualquiera de ellas
 * para re-analizar el escenario o comparar con el estado actual.
 */
import { useState, useEffect } from 'react'
import { listSimulations, getSimulation } from '../api'

export default function SimulationHistory({ onLoad }) {
  const [simulations, setSims] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    listSimulations()
      .then(d => setSims(d.simulations || []))
      .catch(console.error)
  }, [])

  const handleExpand = async (sim) => {
    if (expanded === sim.id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(sim.id)
    setLoading(true)
    try {
      const d = await getSimulation(sim.id)
      setDetail(d.simulation)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLoad = (sim) => {
    if (detail && onLoad) onLoad(detail.parameters)
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  if (!simulations.length) {
    return (
      <div className="card flex items-center justify-center h-28">
        <p className="text-gray-600 text-sm text-center">
          Sin simulaciones guardadas.<br />
          <span className="text-xs text-gray-700">Guarda una desde el panel What-If.</span>
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <h2 className="card-title mb-0">Historial de Simulaciones</h2>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {simulations.map(sim => (
          <div key={sim.id} className="border border-gray-800 rounded-xl overflow-hidden">
            {/* Fila principal */}
            <button
              onClick={() => handleExpand(sim)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
            >
              <div className="text-gray-500 font-mono text-xs w-6">#{sim.id}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{sim.name}</div>
                <div className="text-xs text-gray-500">{formatDate(sim.timestamp)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-green-400">
                  {sim.best_score?.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600">score</div>
              </div>
              <div className="text-gray-600 text-xs ml-1">
                {expanded === sim.id ? '▲' : '▼'}
              </div>
            </button>

            {/* Detalle expandido */}
            {expanded === sim.id && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                {loading ? (
                  <p className="text-xs text-gray-500 animate-pulse">Cargando...</p>
                ) : detail ? (
                  <div className="space-y-3">
                    {/* Mejor ruta */}
                    <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-500 mb-0.5">Mejor ruta</div>
                      <div className="text-sm text-white font-medium">{detail.best_route || '—'}</div>
                    </div>

                    {/* Parámetros */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      {detail.parameters && Object.entries(detail.parameters)
                        .filter(([k]) => !['name', 'priority_weights'].includes(k))
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between bg-gray-800/30 rounded px-2 py-1">
                            <span className="text-gray-600">{k.replace(/_/g, ' ')}</span>
                            <span className="text-gray-300 font-mono">
                              {typeof v === 'number' ? v.toFixed(2) : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Top resultados */}
                    {detail.results?.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Top rutas guardadas</div>
                        <div className="space-y-1">
                          {detail.results.slice(0, 3).map((r, i) => (
                            <div key={i} className="text-xs bg-gray-800/30 rounded px-2 py-1 flex justify-between">
                              <span className="text-gray-400">{r.supplier} → {r.transport_mode} → {r.route}</span>
                              <span className="text-green-400">{r.strategic_score?.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleLoad}
                      className="btn-secondary text-xs w-full py-1.5"
                    >
                      Cargar estos parámetros en el simulador
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
