"""
Capa de persistencia SQLite para SupplyChain AI.
Maneja configuración del negocio, historial de simulaciones y caché de carriers.
Toda la persistencia pasa por aquí — sin localStorage ni dependencias externas de BD.
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_PATH = Path(__file__).parent / "supplychain.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Crea las tablas si no existen. Se llama al iniciar el servidor."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS business_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_model TEXT NOT NULL,
            priority_weights TEXT NOT NULL,
            express_threshold_days INTEGER DEFAULT 3,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS simulations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            parameters TEXT NOT NULL,
            results TEXT NOT NULL,
            best_route TEXT,
            best_score REAL
        );

        CREATE TABLE IF NOT EXISTS carrier_rates_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carrier TEXT NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            rate_usd REAL,
            transit_days INTEGER,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(carrier, origin, destination)
        );
    """)
    conn.commit()
    conn.close()


# ─── Business Config ──────────────────────────────────────────────────────────

def save_business_config(
    business_model: str,
    priority_weights: dict,
    express_threshold_days: int
):
    """Guarda (o actualiza) la configuración del modelo de negocio."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    existing = cursor.execute(
        "SELECT id FROM business_config ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if existing:
        cursor.execute(
            """UPDATE business_config
               SET business_model=?, priority_weights=?, express_threshold_days=?, updated_at=?
               WHERE id=?""",
            (business_model, json.dumps(priority_weights), express_threshold_days, now, existing["id"])
        )
    else:
        cursor.execute(
            """INSERT INTO business_config (business_model, priority_weights, express_threshold_days, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)""",
            (business_model, json.dumps(priority_weights), express_threshold_days, now, now)
        )
    conn.commit()
    conn.close()


def get_business_config() -> Optional[Dict[str, Any]]:
    """Obtiene la configuración más reciente del negocio."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM business_config ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if row:
        return {
            "business_model": row["business_model"],
            "priority_weights": json.loads(row["priority_weights"]),
            "express_threshold_days": row["express_threshold_days"],
        }
    return None


# ─── Simulations ──────────────────────────────────────────────────────────────

def save_simulation(
    name: str,
    parameters: dict,
    results: list,
    best_route: str,
    best_score: float
) -> int:
    """Persiste una simulación completa. Retorna el ID generado."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO simulations (name, timestamp, parameters, results, best_route, best_score)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name, datetime.now().isoformat(), json.dumps(parameters),
         json.dumps(results), best_route, best_score)
    )
    conn.commit()
    sim_id = cursor.lastrowid
    conn.close()
    return sim_id


def list_simulations() -> List[Dict[str, Any]]:
    """Lista todas las simulaciones guardadas (sin los resultados detallados)."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, timestamp, best_route, best_score FROM simulations ORDER BY timestamp DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_simulation(sim_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una simulación completa por ID."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM simulations WHERE id=?", (sim_id,)).fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["parameters"] = json.loads(d["parameters"])
        d["results"] = json.loads(d["results"])
        return d
    return None


# ─── Carrier Rates Cache ──────────────────────────────────────────────────────

def cache_carrier_rate(
    carrier: str, origin: str, destination: str,
    rate_usd: float, transit_days: int
):
    """Guarda un rate de carrier en caché para evitar llamadas repetidas a las APIs."""
    conn = get_connection()
    conn.execute(
        """INSERT OR REPLACE INTO carrier_rates_cache
           (carrier, origin, destination, rate_usd, transit_days, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (carrier, origin, destination, rate_usd, transit_days, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()


def get_cached_rate(carrier: str, origin: str, destination: str) -> Optional[Dict[str, Any]]:
    """Recupera un rate cacheado si existe (caché de 1 hora)."""
    conn = get_connection()
    row = conn.execute(
        """SELECT * FROM carrier_rates_cache
           WHERE carrier=? AND origin=? AND destination=?
           AND datetime(fetched_at) > datetime('now', '-1 hour')""",
        (carrier, origin, destination)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
