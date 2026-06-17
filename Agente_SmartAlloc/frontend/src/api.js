/**
 * Capa de comunicación con el backend FastAPI.
 * Todas las llamadas HTTP pasan por aquí — el frontend nunca llama directamente.
 */
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── Optimización A* ──────────────────────────────────────────────────────────

export const optimize = (params) =>
  api.post('/optimize', params).then(r => r.data)

export const simulate = (params) =>
  api.post('/simulate', params).then(r => r.data)

// ── Stockout ─────────────────────────────────────────────────────────────────

export const getStockout = (productType) =>
  api.get('/stockout', { params: productType ? { product_type: productType } : {} })
     .then(r => r.data)

// ── Pareto ───────────────────────────────────────────────────────────────────

export const getPareto = (params) =>
  api.post('/pareto', params).then(r => r.data)

// ── Carbono ──────────────────────────────────────────────────────────────────

export const getCarbonRoute = (route) =>
  api.get(`/carbon/${route.toLowerCase().replace(' ', '-')}`).then(r => r.data)

export const getCarbonAll = () =>
  api.get('/carbon').then(r => r.data)

// ── Configuración ────────────────────────────────────────────────────────────

export const saveConfig = (config) =>
  api.post('/config', config).then(r => r.data)

export const getConfig = () =>
  api.get('/config').then(r => r.data)

// ── Simulaciones guardadas ───────────────────────────────────────────────────

export const saveSimulation = (sim) =>
  api.post('/simulations/save', sim).then(r => r.data)

export const listSimulations = () =>
  api.get('/simulations').then(r => r.data)

export const getSimulation = (id) =>
  api.get(`/simulations/${id}`).then(r => r.data)

// ── Carriers ─────────────────────────────────────────────────────────────────

export const getCarrierRates = (origin = 'Mumbai', destination = 'Delhi', weightKg = 1.0) =>
  api.get('/carrier/rates', { params: { origin, destination, weight_kg: weightKg } })
     .then(r => r.data)

// ── Health ───────────────────────────────────────────────────────────────────

export const getHealth = () =>
  api.get('/health').then(r => r.data)
