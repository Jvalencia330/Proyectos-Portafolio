import json
import os
import boto3
import time

logs_client = boto3.client("logs")
LOG_GROUP  = os.environ["LOG_GROUP_NAME"]
LOG_STREAM = os.environ["LOG_STREAM_NAME"]

def lambda_handler(event, context):
    for record in event["Records"]:
        body = json.loads(record["body"])
        print(f"Procesando alerta SQS: {body}")

        log_message = (
            f"URGENCIA | {body.get('alert_type')} | "
            f"Sensor: {body.get('device_id')} | "
            f"Valor: {body.get('value')} | "
            f"Tiempo: {body.get('timestamp')}"
        )

        try:
            logs_client.put_log_events(
                logGroupName  = LOG_GROUP,
                logStreamName = LOG_STREAM,
                logEvents     = [{"timestamp": int(time.time() * 1000), "message": log_message}]
            )
            print(f"Log de urgencia escrito: {log_message}")
        except Exception as e:
            print(f"Error escribiendo log: {e}")
            raise

    return {"statusCode": 200}
