#!/bin/bash
set -e

echo "Construyendo y subiendo imagen Docker a ECR..."
ECR_URL=$(cd terraform && terraform output -raw ecr_repository_url)
echo "ECR URL: $ECR_URL"
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL
docker build -t iot-api ./api
docker tag iot-api:latest $ECR_URL:latest
docker push $ECR_URL:latest
echo "Imagen subida a ECR."

echo "Inicializando base de datos PostgreSQL..."
PG_HOST=$(cd terraform && terraform output -raw postgres_endpoint | cut -d: -f1)
echo "PostgreSQL host: $PG_HOST"
until PGPASSWORD=SensorPass2024! psql -h $PG_HOST -U sensoradmin -d sensorhistory -c '\q' 2>/dev/null; do
    echo "Esperando PostgreSQL..."; sleep 10
done
PGPASSWORD=SensorPass2024! psql -h $PG_HOST -U sensoradmin -d sensorhistory -f init_db.sql
echo "Base de datos inicializada."

echo "Forzando redeploy del servicio ECS..."
aws ecs update-service \
    --cluster iot-edge-lab-cluster \
    --service iot-edge-lab-api-service \
    --force-new-deployment \
    --region us-east-1 > /dev/null
echo "Servicio ECS actualizado."

echo ""
echo "============================================"
echo "Proyecto desplegado exitosamente."
echo "API URL: http://$(cd terraform && terraform output -raw api_url 2>/dev/null | sed 's|http://||')"
echo "============================================"
