import json
import os
import boto3

sqs = boto3.client("sqs")
QUEUE_URL = os.environ["SQS_QUEUE_URL"]

def lambda_handler(event, context):
    print(f"ALERTA RECIBIDA: {json.dumps(event)}")

    device_id   = event.get("device_id", "unknown")
    value       = event.get("value", 0)
    sensor_type = event.get("sensor_type", "unknown")
    timestamp   = event.get("timestamp", "")

    message = {
        "alert_type": "TEMPERATURE_CRITICAL",
        "device_id":   device_id,
        "sensor_type": sensor_type,
        "value":       value,
        "timestamp":   timestamp,
        "message":     f"ALERTA CRITICA: {device_id} reporto {value}C (umbral superado)"
    }

    sqs.send_message(
        QueueUrl    = QUEUE_URL,
        MessageBody = json.dumps(message)
    )

    print(f"Mensaje enviado a SQS: {message['message']}")
    return {"statusCode": 200}
