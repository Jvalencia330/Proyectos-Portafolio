"""
Motor A* real para SupplyChain AI.

Estructura del grafo de decisión (5 niveles):
  START → [Proveedor] → [Fulfillment] → [Transporte] → [Ruta] → [Carrier] → GOAL

Función de costo g(n):
  g(n) = shipping_cost + manufacturing_cost + costs + opp_cost
  opp_cost = (price × 0.15 × lead_time) / 365

Heurística admisible h(n):
  h(n) = percentil 90 del margen histórico de rutas similares desde este nodo.
  Usa el p90 por nivel de estado: más específico → cota más ajustada.

Poda real:
  Si f(n) = margen_posible + h(n) << mejor_encontrado, la rama se descarta.

Traza de exploración:
  Cuando collect_trace=True, cada paso de la búsqueda queda registrado con
  f/g/h, acción (explore/prune/goal), camino de decisiones y estado de la cola.
  Esto permite al frontend hacer replay paso a paso del algoritmo.
"""
import heapq
import itertools
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List, Tuple

# ─── Constantes del dominio ────────────────────────────────────────────────────

ROUTE_DISTANCES: Dict[str, float] = {
    "Route A":  500.0,
    "Route B": 1200.0,
    "Route C": 2500.0,
}

# Factores de emisión CO₂ (kg CO₂ por tonelada-km) — GLEC Framework
CARBON_FACTORS: Dict[str, float] = {
    "Road": 0.062,
    "Air":  0.602,
    "Sea":  0.003,
    "Rail": 0.022,
}

# Tiempos de tránsito por modo (días)
TRANSPORT_TIMES: Dict[str, int] = {
    "Road": 3,
    "Air":  1,
    "Sea":  14,
    "Rail": 5,
}

ALL_ROUTES     = ["Route A", "Route B", "Route C"]
ALL_CARRIERS   = ["Carrier A", "Carrier B", "Carrier C"]
ALL_TRANSPORTS = ["Road", "Air", "Sea", "Rail"]

# Orden de niveles del grafo (para la visualización)
STAGE_ORDER = ["supplier", "fulfillment", "transport", "route", "goal"]


class AStarEngine:
    """Motor A* que optimiza rutas de supply chain según métricas estratégicas."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self._normalize_defect_rates()
        self._precompute_heuristics()

    def _normalize_defect_rates(self):
        max_dr = self.df["Defect rates"].max()
        if max_dr > 1.0:
            self.df["Defect rates"] = self.df["Defect rates"] / max_dr

    def _precompute_heuristics(self):
        """
        Precalcula cotas superiores admisibles h(n).
        Usa p90 del margen histórico: optimista pero acotado.

        h(n) está en unidades de MARGEN ($). Cuanto más específico es el estado
        (más decisiones tomadas), más ajustada y útil es la cota.
        """
        all_margins = self._raw_margins(self.df)
        self.h_global = float(np.percentile(all_margins, 90)) if all_margins else 0.0

        self.h_by_supplier: Dict[str, float] = {}
        for s in self.df["Supplier name"].unique():
            sdf = self.df[self.df["Supplier name"] == s]
            margins = self._raw_margins(sdf)
            self.h_by_supplier[s] = float(np.percentile(margins, 90)) if margins else self.h_global

        self.h_by_transport: Dict[str, float] = {}
        for t in ALL_TRANSPORTS:
            tdf = self.df[self.df["Transportation modes"] == t]
            margins = self._raw_margins(tdf) if not tdf.empty else []
            self.h_by_transport[t] = float(np.percentile(margins, 90)) if margins else self.h_global

        all_m = all_margins or [-1000.0, 0.0]
        self.margin_min = float(np.min(all_m))
        self.margin_max = float(np.max(all_m))
        self.best_observable_margin = float(np.max(all_m))

    def _raw_margins(self, df: pd.DataFrame) -> List[float]:
        if df.empty:
            return []
        return (df["Price"] - df["Manufacturing costs"]
                - df["Shipping costs"] - df["Costs"]).tolist()

    def _g_cost(self, row, shipping_shock, mfg_var, price_var) -> float:
        """g(n) — costo acumulado de la ruta incluyendo costo de oportunidad."""
        shipping = float(row["Shipping costs"]) * shipping_shock
        mfg      = float(row["Manufacturing costs"]) * mfg_var
        fixed    = float(row["Costs"])
        price    = float(row["Price"]) * price_var
        opp      = (price * 0.15 * float(row["Lead times"])) / 365.0
        return shipping + mfg + fixed + opp

    def _h(self, supplier=None, transport=None) -> float:
        """
        h(n) — heurística admisible.
        Cota superior del margen ADICIONAL alcanzable desde este nodo parcial.
        Más decisiones tomadas → cota más ajustada.
        """
        if supplier and transport:
            return min(
                self.h_by_supplier.get(supplier, self.h_global),
                self.h_by_transport.get(transport, self.h_global),
            )
        if supplier:
            return self.h_by_supplier.get(supplier, self.h_global)
        return self.h_global

    def _calc_co2(self, transport_mode: str, route: str) -> float:
        return CARBON_FACTORS.get(transport_mode, 0.062) * 0.001 * ROUTE_DISTANCES.get(route, 500.0)

    def _strategic_score(self, margin, lead_time, co2, defect_rate, weights) -> float:
        total_w = sum(weights.values()) or 100
        w_m = weights.get("margin", 25) / total_w
        w_s = weights.get("speed",  25) / total_w
        w_r = weights.get("risk",   25) / total_w
        w_c = weights.get("carbon", 25) / total_w

        rng  = self.margin_max - self.margin_min
        m_s  = max(0.0, min(1.0, (margin - self.margin_min) / rng)) if rng > 0 else 0.5
        sp_s = max(0.0, 1.0 - lead_time / 45.0)
        r_s  = max(0.0, 1.0 - defect_rate)
        c_s  = max(0.0, 1.0 - co2 / 2.0)

        return (w_m * m_s + w_s * sp_s + w_r * r_s + w_c * c_s) * 100.0

    def _get_representative_row(self, df, supplier, transport, prefer_fast=False):
        exact = df[(df["Supplier name"] == supplier) & (df["Transportation modes"] == transport)]
        if not exact.empty:
            return exact.sort_values("Lead times").iloc[0] if prefer_fast else exact.iloc[0]
        sub = df[df["Supplier name"] == supplier]
        if not sub.empty:
            return sub.sort_values("Lead times").iloc[0] if prefer_fast else sub.iloc[0]
        return df.sort_values("Lead times").iloc[0] if prefer_fast else df.iloc[0]

    # ─── Traza: helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _node_id(state: dict) -> str:
        """ID único del nodo basado en las decisiones tomadas hasta aquí."""
        parts = []
        for key in ("supplier", "fulfillment", "transport", "route"):
            if key in state:
                parts.append(state[key])
        return "/".join(parts) if parts else "START"

    @staticmethod
    def _node_label(state: dict) -> str:
        """Etiqueta corta del nodo para mostrar en el visualizador."""
        stage = state.get("stage", "")
        if stage == "supplier":    return state.get("supplier", "?")
        if stage == "fulfillment": return state.get("fulfillment", "?").upper()
        if stage == "transport":   return state.get("transport", "?")
        if stage == "route":       return state.get("route", "?").replace("Route ", "R")
        return "?"

    @staticmethod
    def _queue_snapshot(open_set: list) -> List[Dict]:
        """Instantánea de los top-5 elementos de la cola de prioridad."""
        snap = []
        for neg_f, _, st in sorted(open_set)[:5]:
            snap.append({
                "node_id": AStarEngine._node_id(st),
                "label":   AStarEngine._node_label(st),
                "stage":   st.get("stage", "?"),
                "f_score": round(-neg_f, 1),
            })
        return snap

    # ─── Búsqueda A* principal ────────────────────────────────────────────────

    def optimize(
        self,
        product_type:            Optional[str] = None,
        business_model:          str  = "own",
        is_express:              bool = False,
        express_threshold_days:  int  = 3,
        shipping_shock:          float = 1.0,
        demand_variation:        float = 1.0,
        price_variation:         float = 1.0,
        manufacturing_variation: float = 1.0,
        priority_weights:        Optional[Dict[str, float]] = None,
        top_k:                   int  = 5,
        collect_trace:           bool = False,
    ) -> Dict[str, Any]:
        """
        Ejecuta la búsqueda A* sobre el grafo de 5 niveles de decisión.

        Si collect_trace=True, registra cada paso de la exploración (útil para
        el visualizador interactivo del frontend que hace replay del algoritmo).

        Retorna:
          {
            "results":  list[dict],   # top-k rutas ordenadas por score
            "trace":    list[dict],   # pasos del A* (si collect_trace=True)
            "stats":    dict,         # estadísticas del run
          }
        """
        if priority_weights is None:
            priority_weights = {"margin": 25, "speed": 25, "risk": 25, "carbon": 25}

        df = self.df.copy()
        if product_type:
            filtered = df[df["Product type"].str.lower() == product_type.lower()]
            if not filtered.empty:
                df = filtered
        df["Number of products sold"] = df["Number of products sold"] * demand_variation

        # ── Estado del algoritmo ──────────────────────────────────────────────
        results:        List[Dict[str, Any]] = []
        best_found:     float = float("-inf")
        best_margin:    float = float("-inf")
        nodes_explored: int = 0
        nodes_pruned:   int = 0
        trace:          List[Dict[str, Any]] = []

        open_set: List[Tuple[float, int, Dict]] = []
        _counter = itertools.count()

        # ── NIVEL 0: inicializar con todos los proveedores ─────────────────────
        for supplier in df["Supplier name"].unique():
            h_val = self._h(supplier)
            heapq.heappush(open_set, (-h_val, next(_counter), {
                "stage": "supplier", "supplier": supplier, "h_est": h_val,
            }))

        # ── BUCLE PRINCIPAL A* ─────────────────────────────────────────────────
        while open_set:
            neg_f, _, state = heapq.heappop(open_set)
            f_estimate = -neg_f
            nodes_explored += 1
            stage = state["stage"]

            # ── PODA ──────────────────────────────────────────────────────────
            # Comparación en unidades de margen ($):
            # si el mejor alcanzable desde aquí (f_estimate = h(n)) es mucho
            # peor que lo mejor encontrado, la rama no puede competir.
            margin_range = abs(self.margin_max - self.margin_min) or 100.0
            pruned = (best_margin > float("-inf") and
                      f_estimate < best_margin - margin_range * 2)

            if pruned:
                nodes_pruned += 1
                if collect_trace:
                    trace.append({
                        "step":       nodes_explored + nodes_pruned,
                        "action":     "prune",
                        "stage":      stage,
                        "node_id":    self._node_id(state),
                        "label":      self._node_label(state),
                        "f_score":    round(f_estimate, 1),
                        "h_score":    round(state.get("h_est", f_estimate), 1),
                        "g_cost":     None,
                        "best_found": round(best_found, 1),
                        "best_margin":round(best_margin, 1),
                        "queue_size": len(open_set),
                        "reason":     f"f={f_estimate:.0f} ≪ mejor_margen={best_margin:.0f} − 2×rango",
                        "queue_top":  self._queue_snapshot(open_set) if collect_trace else [],
                    })
                continue

            # ── REGISTRO DE EXPLORACIÓN ────────────────────────────────────────
            if collect_trace:
                trace.append({
                    "step":       nodes_explored,
                    "action":     "explore",
                    "stage":      stage,
                    "node_id":    self._node_id(state),
                    "label":      self._node_label(state),
                    "f_score":    round(f_estimate, 1),
                    "h_score":    round(state.get("h_est", f_estimate), 1),
                    "g_cost":     None,
                    "best_found": round(best_found, 1) if best_found != float("-inf") else None,
                    "best_margin":round(best_margin, 1) if best_margin != float("-inf") else None,
                    "queue_size": len(open_set),
                    "reason":     f"Mejor en cola: f={f_estimate:.0f}",
                    "queue_top":  self._queue_snapshot(open_set),
                })

            # ── NIVEL 1 → 2: Proveedor → Fulfillment ──────────────────────────
            if stage == "supplier":
                for fm in self._get_fulfillments(business_model):
                    h_val = self._h(state["supplier"])
                    heapq.heappush(open_set, (-h_val, next(_counter), {
                        **state, "stage": "fulfillment", "fulfillment": fm, "h_est": h_val,
                    }))

            # ── NIVEL 2 → 3: Fulfillment → Transporte ─────────────────────────
            elif stage == "fulfillment":
                for t in self._get_transports(state["fulfillment"], is_express, express_threshold_days):
                    h_val = self._h(state["supplier"], t)
                    heapq.heappush(open_set, (-h_val, next(_counter), {
                        **state, "stage": "transport", "transport": t, "h_est": h_val,
                    }))

            # ── NIVEL 3 → 4: Transporte → Ruta ────────────────────────────────
            elif stage == "transport":
                for route in ALL_ROUTES:
                    h_val = self._h(state["supplier"], state["transport"]) * 0.95
                    heapq.heappush(open_set, (-h_val, next(_counter), {
                        **state, "stage": "route", "route": route, "h_est": h_val,
                    }))

            # ── NIVEL 4 → 5: Ruta → Carrier (NODO GOAL) ───────────────────────
            elif stage == "route":
                fm       = state["fulfillment"]
                carriers = ["N/A"] if fm == "dropshipping" else ALL_CARRIERS
                transport = state["transport"]
                route     = state["route"]
                supplier  = state["supplier"]

                row = self._get_representative_row(df, supplier, transport, prefer_fast=is_express)

                g_cost      = self._g_cost(row, shipping_shock, manufacturing_variation, price_variation)
                price       = float(row["Price"]) * price_variation
                margin      = price - g_cost
                transit_t   = TRANSPORT_TIMES.get(transport, 3)
                lead_time   = float(row["Lead times"]) + transit_t

                # Valida express
                if is_express and lead_time > express_threshold_days:
                    nodes_pruned += 1
                    continue

                co2_kg      = self._calc_co2(transport, route)
                defect_rate = float(row["Defect rates"])
                express_pen = 0.0
                if is_express:
                    express_pen = max(0.0, lead_time - express_threshold_days * 0.7) * 3.0

                for carrier in carriers:
                    score = self._strategic_score(
                        margin - express_pen, lead_time, co2_kg, defect_rate, priority_weights
                    )
                    is_new_best = score > best_found
                    if is_new_best:
                        best_found = score
                    if margin > best_margin:
                        best_margin = margin

                    # ── Traza del nodo GOAL ────────────────────────────────────
                    if collect_trace:
                        carrier_label = carrier if fm != "dropshipping" else "N/A"
                        trace.append({
                            "step":        len(trace) + 1,
                            "action":      "goal",
                            "stage":       "goal",
                            "node_id":     f"{self._node_id(state)}/{carrier}",
                            "label":       carrier_label,
                            "f_score":     round(margin, 1),
                            "h_score":     0.0,
                            "g_cost":      round(g_cost, 1),
                            "margin":      round(margin, 1),
                            "score":       round(score, 2),
                            "lead_time":   round(lead_time, 1),
                            "co2_kg":      round(co2_kg, 4),
                            "is_new_best": is_new_best,
                            "best_found":  round(best_found, 1),
                            "best_margin": round(best_margin, 1),
                            "queue_size":  len(open_set),
                            "reason":      "Nodo GOAL: ruta completa evaluada",
                            "queue_top":   self._queue_snapshot(open_set),
                            # Composición del g(n) — para mostrar en el desglose
                            "g_breakdown": {
                                "shipping":       round(float(row["Shipping costs"]) * shipping_shock, 2),
                                "manufacturing":  round(float(row["Manufacturing costs"]) * manufacturing_variation, 2),
                                "fixed_costs":    round(float(row["Costs"]), 2),
                                "opp_cost":       round(g_cost - float(row["Shipping costs"]) * shipping_shock
                                                       - float(row["Manufacturing costs"]) * manufacturing_variation
                                                       - float(row["Costs"]), 2),
                            },
                        })

                    results.append({
                        "supplier":           supplier,
                        "location":           str(row["Location"]),
                        "fulfillment_mode":   fm,
                        "transport_mode":     transport if fm != "dropshipping" else "N/A",
                        "route":              route,
                        "carrier":            carrier,
                        "g_cost":             round(g_cost, 2),
                        "h_score":            round(self._h(supplier, transport), 2),
                        "f_score":            round(margin + self._h(supplier, transport), 2),
                        "margin":             round(margin, 2),
                        "lead_time":          round(lead_time, 1),
                        "co2_kg":             round(co2_kg, 4),
                        "defect_rate":        round(defect_rate, 4),
                        "strategic_score":    round(score, 2),
                        "is_express_valid":   not is_express or lead_time <= express_threshold_days,
                        "price":              round(price, 2),
                        "shipping_cost":      round(float(row["Shipping costs"]) * shipping_shock, 2),
                        "manufacturing_cost": round(float(row["Manufacturing costs"]) * manufacturing_variation, 2),
                        "nodes_explored":     nodes_explored,
                        "nodes_pruned":       nodes_pruned,
                    })

        # ── Post-procesamiento ────────────────────────────────────────────────
        results.sort(key=lambda x: x["strategic_score"], reverse=True)

        seen: set = set()
        unique: List[Dict] = []
        for r in results:
            key = (r["supplier"], r["transport_mode"], r["route"])
            if key not in seen:
                seen.add(key)
                unique.append(r)
            if len(unique) >= top_k:
                break

        for r in unique:
            r["nodes_explored"] = nodes_explored
            r["nodes_pruned"]   = nodes_pruned

        # ── Marca la ruta óptima en la traza ──────────────────────────────────
        if collect_trace and unique:
            best = unique[0]
            optimal_node_ids = {
                best["supplier"],
                best["fulfillment_mode"].upper(),
                best["transport_mode"],
                best["route"].replace("Route ", "R"),
                best["carrier"],
            }
            for entry in trace:
                entry["is_optimal"] = (
                    entry.get("action") in ("explore", "goal") and
                    entry.get("label") in optimal_node_ids
                )

        # Cuántas combinaciones eran posibles en total
        n_suppliers     = len(df["Supplier name"].unique())
        n_fulfillments  = 1
        n_transports    = len(self._get_transports(
            self._get_fulfillments(business_model)[0], is_express, express_threshold_days
        ))
        n_routes        = len(ALL_ROUTES)
        n_carriers      = 1 if business_model == "dropshipping" else len(ALL_CARRIERS)
        total_combos    = n_suppliers * n_fulfillments * n_transports * n_routes * n_carriers

        pruning_rate = nodes_pruned / max(nodes_explored + nodes_pruned, 1)

        return {
            "results": unique,
            "trace":   trace,
            "stats": {
                "total_combinations": total_combos,
                "nodes_explored":     nodes_explored,
                "nodes_pruned":       nodes_pruned,
                "pruning_rate":       round(pruning_rate, 3),
                "h_global":           round(self.h_global, 2),
                "margin_range":       [round(self.margin_min, 1), round(self.margin_max, 1)],
                "best_score":         round(best_found, 2) if best_found != float("-inf") else 0,
                "suppliers_in_run":   list(df["Supplier name"].unique()),
            },
        }

    # ─── Helpers privados ─────────────────────────────────────────────────────

    def _get_fulfillments(self, business_model: str) -> List[str]:
        return {"own": ["own"], "3pl": ["3pl"], "dropshipping": ["dropshipping"]}.get(
            business_model, ["own"]
        )

    def _get_transports(self, fulfillment, is_express, express_threshold_days) -> List[str]:
        """
        Siempre retorna los 4 modos de transporte disponibles (Road/Air/Sea/Rail).
        En modo express, la penalización de velocidad se aplica en el score estratégico,
        no descartando rutas — todas las opciones siguen siendo visibles y comparables.
        Dropshipping usa Road (el proveedor despacha directamente).
        """
        if fulfillment == "dropshipping":
            return ["Road"]
        return ALL_TRANSPORTS

    def get_all_routes_for_pareto(
        self,
        product_type=None, business_model="own",
        shipping_shock=1.0, demand_variation=1.0,
        price_variation=1.0, manufacturing_variation=1.0,
    ) -> pd.DataFrame:
        run = self.optimize(
            product_type=product_type, business_model=business_model,
            shipping_shock=shipping_shock, demand_variation=demand_variation,
            price_variation=price_variation, manufacturing_variation=manufacturing_variation,
            priority_weights={"margin": 25, "speed": 25, "risk": 25, "carbon": 25},
            top_k=200,
        )
        return pd.DataFrame(run["results"]) if run["results"] else pd.DataFrame()
