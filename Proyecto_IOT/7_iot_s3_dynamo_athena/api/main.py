from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import boto3
import psycopg2
import os
from boto3.dynamodb.conditions import Key
from typing import Optional
import uvicorn

app = FastAPI(title="IoT Sensor API", version="1.0.0")

# Configuración DynamoDB
dynamodb     = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
table_shadow = dynamodb.Table(os.environ.get("DYNAMO_TABLE_SHADOW", "SensorData-lab"))
table_events = dynamodb.Table(os.environ.get("DYNAMO_TABLE_EVENTS", "SensorEvents-lab"))

# Configuración PostgreSQL
def get_db_conn():
    return psycopg2.connect(
        host     = os.environ["DB_HOST"],
        database = os.environ.get("DB_NAME", "sensorhistory"),
        user     = os.environ.get("DB_USER", "sensoradmin"),
        password = os.environ["DB_PASSWORD"],
        port     = int(os.environ.get("DB_PORT", 5432))
    )

class SensorCreate(BaseModel):
    device_id:   str
    sensor_type: str
    location:    Optional[str] = "unknown"
    description: Optional[str] = ""

# GET /sensors → DynamoDB shadow
@app.get("/sensors")
def list_sensors():
    response = table_shadow.scan()
    return {"sensors": response.get("Items", []), "count": response.get("Count", 0)}

# POST /sensors → DynamoDB shadow
@app.post("/sensors", status_code=201)
def create_sensor(sensor: SensorCreate):
    item = {
        "device_id":   sensor.device_id,
        "sensor_type": sensor.sensor_type,
        "location":    sensor.location,
        "description": sensor.description,
        "value":       None,
        "timestamp":   None
    }
    table_shadow.put_item(Item=item)
    return {"message": "Sensor registrado", "sensor": item}

# GET /sensor/{id}/current → DynamoDB shadow (último valor)
@app.get("/sensor/{device_id}/current")
def get_current(device_id: str):
    response = table_shadow.get_item(Key={"device_id": device_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail=f"Sensor '{device_id}' no encontrado")
    return item

# GET /sensor/{id}/recent → DynamoDB eventos (últimos 10)
@app.get("/sensor/{device_id}/recent")
def get_recent(device_id: str, limit: int = 10):
    try:
        response = table_events.query(
            KeyConditionExpression = Key("device_id").eq(device_id),
            ScanIndexForward       = False,
            Limit                  = limit
        )
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail=f"No hay eventos recientes para '{device_id}'")
        return {"device_id": device_id, "events": items, "count": len(items)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET /sensor/{id}/history → PostgreSQL (histórico completo)
@app.get("/sensor/{device_id}/history")
def get_history(device_id: str, limit: int = 100):
    conn = None
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute(
            """
            SELECT device_id, sensor_type, value, timestamp, created_at
            FROM sensor_events
            WHERE device_id = %s
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (device_id, limit)
        )
        rows = cur.fetchall()
        cur.close()
        if not rows:
            raise HTTPException(status_code=404, detail=f"No hay historial para '{device_id}'")
        history = [
            {"device_id": r[0], "sensor_type": r[1], "value": float(r[2]),
             "timestamp": str(r[3]), "created_at": str(r[4])}
            for r in rows
        ]
        return {"device_id": device_id, "history": history, "count": len(history)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

# GET /health
@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
