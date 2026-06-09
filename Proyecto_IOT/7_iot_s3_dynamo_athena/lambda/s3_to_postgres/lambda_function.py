import json
import os
import boto3
import psycopg2
from urllib.parse import unquote_plus

DB_HOST     = os.environ["DB_HOST"]
DB_NAME     = os.environ["DB_NAME"]
DB_USER     = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_PORT     = int(os.environ.get("DB_PORT", 5432))

s3_client = boto3.client("s3")

def lambda_handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key    = unquote_plus(record["s3"]["object"]["key"])

        print(f"Procesando: s3://{bucket}/{key}")

        response = s3_client.get_object(Bucket=bucket, Key=key)
        body     = response["Body"].read().decode("utf-8")
        data     = json.loads(body)

        print(f"Datos recibidos: {data}")

        device_id   = data.get("device_id")
        sensor_type = data.get("sensor_type")
        value       = data.get("value")
        timestamp   = data.get("timestamp")

        if not all([device_id, sensor_type, value, timestamp]):
            print(f"WARN: Datos incompletos, skipping: {data}")
            continue

        conn = None
        try:
            conn = psycopg2.connect(
                host=DB_HOST, database=DB_NAME,
                user=DB_USER, password=DB_PASSWORD, port=DB_PORT
            )
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO sensor_events (device_id, sensor_type, value, timestamp)
                VALUES (%s, %s, %s, %s)
                """,
                (device_id, sensor_type, float(value), timestamp)
            )
            conn.commit()
            cur.close()
            print(f"Insertado en PostgreSQL: {device_id} / {sensor_type} = {value}")
        except Exception as e:
            print(f"Error insertando en PostgreSQL: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()

    return {"statusCode": 200, "body": "OK"}
