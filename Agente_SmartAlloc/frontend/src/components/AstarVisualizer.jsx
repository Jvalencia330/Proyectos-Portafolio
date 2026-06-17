/**
 * Visualizador de la traza del algoritmo A*.
 * Muestra paso a paso cómo A* explora, poda y encuentra el camino óptimo.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { optimize } from '../api'

const STAGE_ORDER = ['supplier', 'fulfillment', 'transport', 'route', 'goal']
const STAGE_ICONS = { supplier: '🏭', fulfillment: '📦', transport: '🚛', route: '🗺️', goal: '🏆' }
const ACTION_META = {
  explore: { color: 'text-blue-400',  bg: 'bg-blue-900/30',  border: 'border-blue-800/50', icon: '🔍', label: 'Explorar' },
  prune:   { color: 'text-red-400',   bg: 'bg-red-900/20',   border: 'border-red-900/40',  icon: '✂️', label: 'Podar' },
  goal:    { color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-800/50',icon: '🏆', label: 'Meta' },
}

export default function AstarVisualizer({ config }) {
  const [trace, setTrace]       = useState([])
  const [results, setResults]   = useState([])
  const [stats, setStats]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState('')
  const [step, setStep]         = useState(0)
  const [playing, setPlaying]   = useState(false)
  const [speed, setSpeed]       = useState(120)      // ms per step
  const intervalRef             = useRef(null)
  const logRef                  = useRef(null)

  const runTrace = useCallback(async () => {
    setLoading(true)
    setErr('')
    setTrace([])
    setStep(0)
    setPlaying(false)
    try {
      const r = await optimize({
        business_model: config?.businessModel || 'own',
        top_k: 5,
        collect_trace: true,
      })
      setTrace(r.trace || [])
      setResults(r.results || [])
      setStats(r.stats || null)
    } catch (e) {
      setErr('Error al conectar con el backend: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }, [config])

  // Auto-play
  useEffect(() => {
    if (playing && trace.length > 0) {
      intervalRef.current = setInterval(() => {
        setStep(s => {
          if (s >= trace.length - 1) {
            setPlaying(false)
            return s
          }
          return s + 1
        })
      }, speed)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [playing, trace.length, speed])

  // Scroll log to current step
  useEffect(() => {
    if (logRef.current) {
      const el = logRef.current.querySelector(`[data-step="${step}"]`)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [step])

  const current = trace[step] || null
  const visited = trace.slice(0, step + 1)
  const exploreCount = visited.filter(t => t.action === 'explore').length
  const pruneCount   = visited.filter(t => t.action === 'prune').length
  const goalCount    = visited.filter(t => t.action === 'goal').length

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="card-title mb-0">🔍 Traza del Algoritmo A*</h2>
            <p className="text-xs text-gray-500 mt-1">
              Observa cómo A* expande nodos usando f(n) = g(n) + h(n) hasta encontrar el óptimo global.
            </p>
          </div>
          <button
            onClick={runTrace}
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? '⚙️ Ejecutando...' : trace.length ? '↺ Reiniciar' : '▶ Ejecutar A*'}
          </button>
        </div>

        {err && <div className="mt-3 text-red-400 text-sm bg-red-900/20 rounded-lg p-3">{err}</div>}

        {stats && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Combinaciones" value={stats.total_combinations} color="gray" />
            <MiniStat label="Explorados" value={stats.nodes_explored} color="blue" />
            <MiniStat label="Podados" value={stats.nodes_pruned} color="red" />
            <MiniStat label="Mejor score" value={stats.best_score?.toFixed(1)} color="green" />
          </div>
        )}
      </div>

      {trace.length > 0 && (
        <>
          {/* Controles */}
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Botones */}
              <div className="flex gap-1">
                <CtrlBtn onClick={() => { setPlaying(false); setStep(0) }} title="Inicio">⏮</CtrlBtn>
                <CtrlBtn onClick={() => setStep(s => Math.max(0, s - 1))} title="Atrás">⏪</CtrlBtn>
                <button
                  onClick={() => setPlaying(p => !p)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  {playing ? '⏸' : '▶'}
                </button>
                <CtrlBtn onClick={() => setStep(s => Math.min(trace.length - 1, s + 1))} title="Siguiente">⏩</CtrlBtn>
                <CtrlBtn onClick={() => { setPlaying(false); setStep(trace.length - 1) }} title="Final">⏭</CtrlBtn>
              </div>

              {/* Progreso */}
              <div className="flex-1 min-w-[160px]">
                <input
                  type="range" min={0} max={trace.length - 1} value={step}
                  onChange={e => { setPlaying(false); setStep(Number(e.target.value)) }}
                  className="slider w-full"
                />
              </div>

              <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                {step + 1} / {trace.length}
              </span>

              {/* Velocidad */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Velocidad</span>
                <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-1.5 py-1">
                  <option value={300}>Lento</option>
                  <option value={120}>Normal</option>
                  <option value={40}>Rápido</option>
                  <option value={8}>Ultra</option>
                </select>
              </div>
            </div>

            {/* Mini-barra de progreso coloreada */}
            <div className="mt-3 flex gap-0.5 h-3 rounded overflow-hidden">
              {trace.map((t, i) => (
                <div
                  key={i}
                  onClick={() => { setPlaying(false); setStep(i) }}
                  title={`Paso ${i+1}: ${t.action} — ${t.label}`}
                  className={`flex-1 cursor-pointer transition-opacity ${
                    i <= step ? 'opacity-100' : 'opacity-20'
                  } ${
                    t.action === 'goal'    ? 'bg-green-500' :
                    t.action === 'prune'   ? 'bg-red-500' :
                    t.action === 'explore' ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Contadores en tiempo real */}
            <div className="mt-2 flex gap-4 text-xs">
              <span className="text-blue-400">🔍 {exploreCount} explorados</span>
              <span className="text-red-400">✂️ {pruneCount} podados</span>
              <span className="text-green-400">🏆 {goalCount} metas</span>
            </div>
          </div>

          {/* Panel principal: Nodo actual + Cola */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Nodo activo */}
            {current && (
              <CurrentNodeCard step={current} stepNum={step + 1} />
            )}

            {/* Cola de prioridad (open set) */}
            {current?.queue_top && (
              <QueuePanel queue={current.queue_top} />
            )}
          </div>

          {/* Log de pasos */}
          <StepLog trace={trace} currentStep={step} onJump={i => { setPlaying(false); setStep(i) }} logRef={logRef} />

          {/* Rutas encontradas */}
          {results.length > 0 && (
            <ResultsPreview results={results} />
          )}
        </>
      )}

      {!trace.length && !loading && (
        <div className="card h-48 flex items-center justify-center text-gray-600 text-center">
          <div>
            <div className="text-4xl mb-3">🧠</div>
            <p className="text-sm">Pulsa "Ejecutar A*" para ver el algoritmo en acción</p>
            <p className="text-xs text-gray-700 mt-1">270 pasos · 5 niveles de decisión · heurística admisible p90</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function MiniStat({ label, value, color }) {
  const c = { gray: 'text-gray-400', blue: 'text-blue-400', red: 'text-red-400', green: 'text-green-400' }
  return (
    <div className="bg-gray-800/40 rounded-lg p-2.5">
      <div className={`text-lg font-bold ${c[color]}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  )
}

function CtrlBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      className="px-2.5 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
      {children}
    </button>
  )
}

function CurrentNodeCard({ step: t, stepNum }) {
  const meta = ACTION_META[t.action] || ACTION_META.explore
  return (
    <div className={`card border ${meta.border} ${meta.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
          <span className="text-xs text-gray-600">paso {stepNum}</span>
        </div>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
          {STAGE_ICONS[t.stage]} {t.stage}
        </span>
      </div>

      <div className="text-lg font-bold text-white mb-1">{t.label}</div>
      <div className="text-xs text-gray-500 font-mono mb-3">{t.node_id}</div>

      {/* f/g/h */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <FGHBox label="f(n)" value={t.f_score} color="text-white" desc="g+h" />
        <FGHBox label="g(n)" value={t.g_cost}  color="text-red-400" desc="costo" />
        <FGHBox label="h(n)" value={t.h_score} color="text-blue-400" desc="heur." />
      </div>

      {/* Métricas de meta */}
      {t.action === 'goal' && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniMetric label="Margen" value={t.margin != null ? `$${t.margin?.toFixed(0)}` : '—'} />
          <MiniMetric label="Lead" value={t.lead_time != null ? `${t.lead_time}d` : '—'} />
          <MiniMetric label="Score" value={t.score?.toFixed(1)} highlight />
        </div>
      )}

      {/* g breakdown */}
      {t.g_breakdown && (
        <div className="bg-gray-900/60 rounded-lg p-2 text-xs space-y-0.5">
          <div className="text-gray-500 mb-1">Desglose g(n):</div>
          {Object.entries(t.g_breakdown).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-gray-500 capitalize">{k.replace('_', ' ')}</span>
              <span className="font-mono text-yellow-400">{Number(v).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {t.reason && (
        <div className="text-xs text-gray-600 mt-2 italic">{t.reason}</div>
      )}

      {t.is_new_best && (
        <div className="mt-2 text-xs text-green-400 font-semibold">★ Nueva mejor solución</div>
      )}
    </div>
  )
}

function FGHBox({ label, value, color, desc }) {
  return (
    <div className="bg-gray-900/60 rounded-lg p-2 text-center">
      <div className="text-xs text-gray-500">{label} <span className="text-gray-700">({desc})</span></div>
      <div className={`font-mono font-bold text-sm mt-0.5 ${color}`}>
        {value != null ? Number(value).toFixed(1) : '—'}
      </div>
    </div>
  )
}

function MiniMetric({ label, value, highlight }) {
  return (
    <div className="bg-gray-900/60 rounded-lg p-2 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`font-bold text-sm mt-0.5 ${highlight ? 'text-green-400' : 'text-gray-300'}`}>{value}</div>
    </div>
  )
}

function QueuePanel({ queue }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-300">Cola de Prioridad</span>
        <span className="text-xs text-gray-600">(Open Set — top 5)</span>
      </div>
      <div className="space-y-1.5">
        {queue.map((item, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs
            ${i === 0 ? 'bg-blue-900/40 border border-blue-800/50' : 'bg-gray-800/40'}`}>
            <span className={`font-bold w-4 text-center ${i === 0 ? 'text-blue-400' : 'text-gray-600'}`}>
              {i + 1}
            </span>
            <div className="flex-1">
              <div className={`font-medium ${i === 0 ? 'text-white' : 'text-gray-400'}`}>{item.label}</div>
              <div className="text-gray-600 text-xs">{item.stage}</div>
            </div>
            <span className={`font-mono ${i === 0 ? 'text-blue-300' : 'text-gray-500'}`}>
              f={Number(item.f_score).toFixed(1)}
            </span>
            {i === 0 && <span className="text-blue-400 text-xs">← próximo</span>}
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-600 mt-2">
        A* siempre expande el nodo con menor f(n) — por eso garantiza óptimalidad.
      </div>
    </div>
  )
}

function StepLog({ trace, currentStep, onJump, logRef }) {
  const [filter, setFilter] = useState('all')

  const filtered = trace.map((t, i) => ({ ...t, _i: i })).filter(t =>
    filter === 'all' || t.action === filter
  )

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-300">Log de Exploración</span>
        <div className="flex gap-1">
          {['all', 'explore', 'prune', 'goal'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {f === 'all' ? 'Todo' : f === 'explore' ? '🔍' : f === 'prune' ? '✂️' : '🏆'}
            </button>
          ))}
        </div>
      </div>

      <div ref={logRef} className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
        {filtered.map(t => {
          const meta = ACTION_META[t.action] || ACTION_META.explore
          const isActive = t._i === currentStep
          return (
            <div
              key={t._i}
              data-step={t._i}
              onClick={() => onJump(t._i)}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-xs transition-all
                ${isActive
                  ? `${meta.bg} border ${meta.border} ring-1 ring-blue-500/30`
                  : 'hover:bg-gray-800/40'
                }`}
            >
              <span className="text-gray-700 font-mono w-6 text-right">{t._i + 1}</span>
              <span>{meta.icon}</span>
              <span className={`${isActive ? meta.color : 'text-gray-500'} w-16 shrink-0`}>
                {meta.label}
              </span>
              <span className={`font-medium flex-1 truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {t.label}
              </span>
              <span className="text-gray-600 shrink-0">{STAGE_ICONS[t.stage]}</span>
              <span className="font-mono text-gray-600 shrink-0">f={Number(t.f_score).toFixed(0)}</span>
              {t.is_new_best && <span className="text-yellow-400 shrink-0">★</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultsPreview({ results }) {
  const best = results[0]
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Rutas Encontradas por A* — Top {results.length}
      </h3>
      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-lg p-3 text-xs
            ${i === 0 ? 'bg-green-900/20 border border-green-800/40' : 'bg-gray-800/30'}`}>
            <span className={`font-bold text-base ${i === 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
              {i === 0 ? '★' : i + 1}
            </span>
            <div className="flex-1">
              <div className={`font-medium ${i === 0 ? 'text-white' : 'text-gray-300'}`}>
                {r.supplier} → {r.transport_mode} → {r.route} → {r.carrier}
              </div>
              <div className="text-gray-600 mt-0.5">
                g={r.g_cost?.toFixed(1)} · h={r.h_score?.toFixed(1)} · margen ${r.margin?.toFixed(0)} · {r.lead_time}d
              </div>
            </div>
            <div className={`text-lg font-bold ${i === 0 ? 'text-green-400' : 'text-gray-400'}`}>
              {r.strategic_score?.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
