/**
 * Resultados del A* con el camino óptimo como protagonista visual.
 * Muestra: ruta de 5 nodos, f/g/h values, stats de exploración, tabla comparativa.
 */
export default function AstarResults({ results = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card flex items-center justify-center h-32">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2 animate-spin">⚙️</div>
            <p className="text-sm">Ejecutando A*...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!results.length) {
    return (
      <div className="card flex items-center justify-center h-48">
        <div className="text-center text-gray-600">
          <div className="text-3xl mb-2">🧠</div>
          <p className="text-sm">Ajusta los parámetros para ejecutar A*</p>
          <p className="text-xs text-gray-700 mt-1">El algoritmo explorará el grafo de 5 niveles</p>
        </div>
      </div>
    )
  }

  const best = results[0]

  return (
    <div className="space-y-4">
      {/* ── Encabezado: Stats de exploración A* ── */}
      <AstarStatsBar best={best} total={results.length} />

      {/* ── Camino óptimo: 5 nodos del grafo A* ── */}
      <OptimalPath best={best} />

      {/* ── Desglose f/g/h del nodo ganador ── */}
      <FGHBreakdown best={best} />

      {/* ── Tabla comparativa de rutas ── */}
      <RoutesTable results={results} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function AstarStatsBar({ best, total }) {
  const efficiency = best.nodes_explored > 0
    ? Math.round((1 - best.nodes_pruned / (best.nodes_explored + best.nodes_pruned)) * 100)
    : 0

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="card-title mb-0">🧠 Algoritmo A* — Exploración del Grafo</h2>
        <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full font-mono">
          f(n) = g(n) + h(n)
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Nodos explorados"
          value={best.nodes_explored}
          icon="🔍"
          color="blue"
          hint="Nodos expandidos por A*"
        />
        <StatCard
          label="Ramas podadas"
          value={best.nodes_pruned}
          icon="✂️"
          color="yellow"
          hint="Podados por f(n) < mejor−2σ"
        />
        <StatCard
          label="Rutas encontradas"
          value={total}
          icon="🏆"
          color="green"
          hint="Top-K caminos al GOAL"
        />
        <StatCard
          label="Eficiencia poda"
          value={`${efficiency}%`}
          icon="⚡"
          color="purple"
          hint="Nodos útiles vs totales"
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, hint }) {
  const colorMap = {
    blue:   'bg-blue-900/30 border-blue-800/50 text-blue-400',
    yellow: 'bg-yellow-900/30 border-yellow-800/50 text-yellow-400',
    green:  'bg-green-900/30 border-green-800/50 text-green-400',
    purple: 'bg-purple-900/30 border-purple-800/50 text-purple-400',
  }
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`} title={hint}>
      <div className="text-lg font-bold">{icon} {value}</div>
      <div className="text-xs opacity-70 mt-0.5">{label}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function OptimalPath({ best }) {
  const nodes = [
    { id: 'START',   label: 'START',           sub: 'Origen',               icon: '▶', color: 'bg-gray-700 border-gray-500' },
    { id: 'supplier',label: best.supplier,      sub: best.location,          icon: '🏭', color: 'bg-blue-900/60 border-blue-600' },
    { id: 'fulfill', label: best.fulfillment_mode, sub: 'Fulfillment',       icon: '📦', color: 'bg-purple-900/60 border-purple-600' },
    { id: 'transport',label: best.transport_mode, sub: `${best.lead_time}d`, icon: modeIcon(best.transport_mode), color: 'bg-orange-900/60 border-orange-600' },
    { id: 'route',   label: best.route,         sub: 'Ruta',                 icon: '🗺️', color: 'bg-teal-900/60 border-teal-600' },
    { id: 'carrier', label: best.carrier,       sub: 'Carrier',              icon: '🚚', color: 'bg-indigo-900/60 border-indigo-600' },
    { id: 'GOAL',    label: 'GOAL',             sub: `Score ${best.strategic_score.toFixed(1)}`, icon: '🏆', color: 'bg-green-900/60 border-green-500' },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Camino Óptimo — Grafo de Decisión (5 niveles)</h3>
        <span className="text-xs text-green-400 font-mono">★ Mejor ruta</span>
      </div>

      {/* Nodos en línea con flechas */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-1 shrink-0">
            <PathNode node={node} isGoal={i === nodes.length - 1} isStart={i === 0} />
            {i < nodes.length - 1 && (
              <Arrow />
            )}
          </div>
        ))}
      </div>

      {/* f/g/h en la ruta */}
      <div className="mt-3 flex gap-4 text-xs text-gray-600 border-t border-gray-800 pt-3">
        <span>
          <span className="text-red-400 font-mono font-bold">g(n)</span>
          {' '}= {best.g_cost.toFixed(1)} (costo acumulado)
        </span>
        <span>
          <span className="text-blue-400 font-mono font-bold">h(n)</span>
          {' '}= {best.h_score.toFixed(1)} (heurística p90)
        </span>
        <span>
          <span className="text-green-400 font-mono font-bold">f(n)</span>
          {' '}= {(best.g_cost + best.h_score).toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function PathNode({ node, isGoal, isStart }) {
  return (
    <div className={`border rounded-xl px-3 py-2 text-center min-w-[80px] ${node.color}
      ${isGoal ? 'ring-2 ring-green-500/50' : ''}
      ${isStart ? 'opacity-60' : ''}`}>
      <div className="text-lg leading-tight">{node.icon}</div>
      <div className="text-xs font-bold text-white mt-0.5 truncate max-w-[90px]">{node.label}</div>
      <div className="text-xs text-gray-400 truncate max-w-[90px]">{node.sub}</div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex flex-col items-center text-gray-600">
      <div className="text-xs">─▶</div>
    </div>
  )
}

function modeIcon(mode) {
  return { Air: '✈️', Sea: '🚢', Road: '🚛', Rail: '🚂' }[mode] || '🚛'
}

/* ─────────────────────────────────────────────────────────────────────────── */

function FGHBreakdown({ best }) {
  const oppCost = (best.price * 0.15 * best.lead_time) / 365
  const fixed   = best.g_cost - (best.shipping_cost || 0) - (best.manufacturing_cost || 0) - oppCost
  const gItems = [
    { label: 'Costo envío',       value: best.shipping_cost,       color: 'text-red-400' },
    { label: 'Manufactura',       value: best.manufacturing_cost,  color: 'text-orange-400' },
    { label: 'Costos fijos',      value: Math.max(0, fixed),       color: 'text-yellow-400' },
    { label: 'Costo oportunidad', value: oppCost,                  color: 'text-pink-400' },
  ].filter(item => item.value != null)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Desglose del Nodo Ganador</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* g(n) breakdown */}
        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono font-bold text-red-400 text-base">g(n)</span>
            <span className="text-xs text-gray-500">Costo acumulado</span>
            <span className="ml-auto font-mono text-red-300 font-bold">{best.g_cost.toFixed(1)}</span>
          </div>
          {gItems.length > 0 ? (
            <div className="space-y-1">
              {gItems.map(item => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{item.label}</span>
                  <span className={`font-mono ${item.color}`}>{item.value.toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>shipping + mfg + fixed + oportunidad</span>
              </div>
            </div>
          )}
        </div>

        {/* h(n) */}
        <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono font-bold text-blue-400 text-base">h(n)</span>
            <span className="text-xs text-gray-500">Heurística admisible</span>
            <span className="ml-auto font-mono text-blue-300 font-bold">{best.h_score.toFixed(1)}</span>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>Percentil p90 del margen histórico</div>
            <div>filtrado por proveedor + transporte</div>
            <div className="text-blue-600 mt-2 italic">Garantiza optimalidad de A*</div>
          </div>
        </div>

        {/* Score final */}
        <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono font-bold text-green-400 text-base">Score</span>
            <span className="text-xs text-gray-500">Estratégico</span>
            <span className="ml-auto font-mono text-green-300 font-bold text-lg">{best.strategic_score.toFixed(1)}</span>
          </div>
          <div className="space-y-1">
            <ScoreBar label="Margen" value={best.margin} maxAbs={200} color="green" />
            <ScoreBar label="Velocidad" value={-best.lead_time} maxAbs={14} color="yellow" invert />
            <ScoreBar label="CO₂" value={-best.co2_kg} maxAbs={0.002} color="emerald" invert />
          </div>
        </div>

      </div>
    </div>
  )
}

function ScoreBar({ label, value, maxAbs, color, invert }) {
  const colorMap = { green: 'bg-green-500', yellow: 'bg-yellow-500', emerald: 'bg-emerald-500' }
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / maxAbs) * 100))
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${colorMap[color]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function RoutesTable({ results }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Rutas Comparadas — Top {results.length}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Proveedor → Ruta</th>
              <th className="text-right py-2 px-2 font-mono text-red-500">g(n)</th>
              <th className="text-right py-2 px-2 font-mono text-blue-500">h(n)</th>
              <th className="text-right py-2 px-2 font-mono text-green-500">f(n)</th>
              <th className="text-right py-2 px-2">Margen $</th>
              <th className="text-right py-2 px-2">Lead</th>
              <th className="text-right py-2 px-2">CO₂</th>
              <th className="text-right py-2 px-2 font-bold">Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors
                  ${i === 0 ? 'bg-green-950/10' : ''}`}
              >
                <td className="py-2 px-2">
                  <span className={`font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {i === 0 ? '★' : i + 1}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className={`font-medium ${i === 0 ? 'text-white' : 'text-gray-300'}`}>
                    {r.supplier}
                  </div>
                  <div className="text-gray-600">
                    {modeIcon(r.transport_mode)} {r.transport_mode} · {r.route} · {r.carrier}
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono text-red-400">{r.g_cost.toFixed(0)}</td>
                <td className="py-2 px-2 text-right font-mono text-blue-400">{r.h_score.toFixed(0)}</td>
                <td className="py-2 px-2 text-right font-mono text-gray-300">
                  {(r.g_cost + r.h_score).toFixed(0)}
                </td>
                <td className={`py-2 px-2 text-right font-mono ${r.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${r.margin.toFixed(0)}
                </td>
                <td className="py-2 px-2 text-right text-gray-400">{r.lead_time}d</td>
                <td className="py-2 px-2 text-right text-gray-400">{(r.co2_kg * 1000).toFixed(1)}g</td>
                <td className="py-2 px-2 text-right">
                  <span className={`font-bold text-sm ${i === 0 ? 'text-green-400' : 'text-gray-300'}`}>
                    {r.strategic_score.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-4 flex-wrap text-xs text-gray-600 border-t border-gray-800 pt-3">
        <span><span className="text-red-400 font-mono">g(n)</span> = shipping + manufactura + fijos + oportunidad</span>
        <span><span className="text-blue-400 font-mono">h(n)</span> = p90 margen histórico (heurística admisible)</span>
        <span><span className="text-green-400 font-mono">f(n)</span> = g(n) + h(n) — criterio de expansión A*</span>
      </div>
    </div>
  )
}
