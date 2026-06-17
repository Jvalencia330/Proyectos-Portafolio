/**
 * Panel de rates en vivo de carriers.
 * Muestra tarifa, tiempo de tránsito y fuente (live / cache / fallback).
 * Badge "⚠️ Usando datos locales" cuando no hay API keys configuradas.
 */
import { useState, useEffect } from 'react'
import { getCarrierRates } from '../api'

const CARRIER_LOGOS = {
  'Carrier A': { label: 'UPS',   color: 'text-amber-400',   icon: '🟤' },
  'Carrier B': { label: 'FedEx', color: 'text-purple-400',  icon: '🟣' },
  'Carrier C': { label: 'DHL',   color: 'text-yellow-400',  icon: '🟡' },
}

const CITIES = ['Mumbai', 'Kolkata', 'Delhi', 'Bangalore']

export default function CarrierRates() {
  const [rates, setRates]         = useState([])
  const [origin, setOrigin]       = useState('Mumbai')
  const [destination, setDest]    = useState('Delhi')
  const [loading, setLoading]     = useState(false)
  const [warning, setWarning]     = useState(null)
  const [haslive, setHasLive]     = useState(false)

  const fetchRates = () => {
    if (origin === destination) return
    setLoading(true)
    getCarrierRates(origin, destination, 1.0)
      .then(data => {
        setRates(data.rates || [])
        setWarning(data.warning || null)
        setHasLive(data.has_live_data || false)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRates() }, [origin, destination])

  const sourceLabel = {
    live:     { text: '🟢 En vivo', cls: 'badge-green' },
    cache:    { text: '🔵 Caché',   cls: 'badge-blue' },
    fallback: { text: '⚠️ Local',   cls: 'badge-yellow' },
  }

  const cheapest = rates.length > 0
    ? rates.reduce((a, b) => (a.rate_usd < b.rate_usd ? a : b))
    : null

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-title mb-0">Rates de Carriers</h2>
        {warning && (
          <span className="badge-yellow text-xs">{warning}</span>
        )}
        {haslive && (
          <span className="badge-green text-xs">🟢 Datos en vivo</span>
        )}
      </div>

      {/* Selector origen-destino */}
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Origen</label>
          <select
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2 py-1.5 w-full"
          >
            {CITIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="text-gray-600 mt-4">→</div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Destino</label>
          <select
            value={destination}
            onChange={e => setDest(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2 py-1.5 w-full"
          >
            {CITIES.filter(c => c !== origin).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button
          onClick={fetchRates}
          disabled={loading}
          className="btn-secondary text-sm px-3 py-1.5 mt-4"
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      {/* Tarjetas de carriers */}
      {loading ? (
        <div className="text-center text-gray-500 text-sm py-6 animate-pulse">
          Consultando carriers...
        </div>
      ) : (
        <div className="space-y-2">
          {rates.map((r, i) => {
            const meta   = CARRIER_LOGOS[r.carrier] || { label: r.carrier, color: 'text-gray-400', icon: '📦' }
            const src    = sourceLabel[r.source] || sourceLabel.fallback
            const isBest = cheapest?.carrier === r.carrier

            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl p-3 border transition-all
                  ${isBest
                    ? 'border-green-700/60 bg-green-950/20'
                    : 'border-gray-700/50 bg-gray-800/30'}`}
              >
                <span className="text-xl">{meta.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${meta.color}`}>{r.carrier}</span>
                    <span className="text-gray-500 text-xs">({meta.label})</span>
                    {isBest && <span className="badge-green text-xs">MÁS BARATO</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.service} · {r.transit_days} días tránsito
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-lg ${isBest ? 'text-green-400' : 'text-white'}`}>
                    ${r.rate_usd.toFixed(2)}
                  </div>
                  <span className={`${src.cls} text-xs`}>{src.text}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota sobre API keys */}
      <div className="bg-gray-800/30 rounded-lg p-2 text-xs text-gray-600">
        Sin API keys: usa datos de referencia del CSV.
        Con keys (SHIPENGINE / EASYPOST / SHIPPO): rates en tiempo real.
      </div>
    </div>
  )
}
