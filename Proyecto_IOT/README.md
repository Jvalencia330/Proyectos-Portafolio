# 🌐 Plataforma IoT con AWS — Edge Gateway a SaaS Cloud

> Plataforma completa de IoT construida sobre AWS con infraestructura como código (Terraform), procesamiento serverless (Lambda), almacenamiento híbrido (DynamoDB + PostgreSQL) y API REST en contenedores (ECS Fargate).

---

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Prerrequisitos](#prerrequisitos)
- [Despliegue](#despliegue)
- [API REST](#api-rest)
- [Sistema de Alertas](#sistema-de-alertas)
- [Demo y Pruebas](#demo-y-pruebas)
- [Fase 7 — Nuevo Sensor](#fase-7--agregar-nuevo-sensor)
- [Comandos de Referencia](#comandos-de-referencia)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                ENTORNO LOCAL (Docker Compose)               │
│                                                             │
│  [Sensor Temp]    [Sensor Humedad]    [Sensor CO2]          │
│       └──────────────┴──────────────────┘                   │
│                       │ MQTT local                          │
│              [Mosquitto Edge Gateway]                        │
└───────────────────────┼─────────────────────────────────────┘
                        │ MQTT sobre TLS (mTLS / X.509)
┌───────────────────────▼─────────────────────────────────────┐
│                  NUBE (AWS)                                  │
│                                                             │
│              [AWS IoT Core]                                  │
│         ┌────────┬────────┬────────┐                        │
│      Regla1   Regla2   Regla3   Regla4                       │
│         │        │     temp>30    │                          │
│         ▼        ▼       │        ▼                          │
│     DynamoDB    S3   Lambda    DynamoDB                      │
│    (Shadow)  (Cold)  Alerta   (Events)                       │
│         │        │       │                                   │
│         │   Trigger   SQS Queue                              │
│         │   S3→λ         │                                   │
│         │        ▼       ▼                                   │
│         │   PostgreSQL  Lambda                               │
│         │    (RDS)   CloudWatch                              │
│         │        │       │                                   │
│         └────────┴───────┘                                   │
│                  │                                           │
│         [FastAPI — ECS Fargate]                              │
│              [ALB HTTP :80]                                  │
└─────────────────────────────────────────────────────────────┘
```

### Flujos de datos

| Flujo | Ruta | Propósito |
|-------|------|-----------|
| **Hot Data** | IoT Core → Regla 1 → DynamoDB Shadow | Estado actual de cada sensor (Device Twin) |
| **Cold Data** | IoT Core → Regla 2 → S3 | Almacenamiento histórico particionado por fecha |
| **Histórico** | S3 → Lambda → PostgreSQL | Histórico estructurado y consultable con SQL |
| **Eventos recientes** | IoT Core → Regla 4 → DynamoDB Events | Últimos N eventos por sensor con Sort Key |
| **Alertas** | IoT Core → Regla 3 → Lambda → SQS → Lambda → CloudWatch | Notificaciones en tiempo real cuando temp > 30°C |
| **API** | ALB → ECS Fargate → FastAPI | Expone todos los datos a través de REST |

---

## Tecnologías

| Categoría | Tecnología |
|-----------|------------|
| Infraestructura como código | Terraform >= 1.0 |
| Edge Gateway | Eclipse Mosquitto 2 (Docker) |
| Simulador de sensores | Python 3.12 + paho-mqtt |
| Mensajería IoT | AWS IoT Core (MQTT sobre TLS) |
| Hot Data | Amazon DynamoDB |
| Cold Data | Amazon S3 |
| Histórico relacional | Amazon RDS PostgreSQL 15 |
| Procesamiento serverless | AWS Lambda (Python 3.12) |
| Desacoplamiento de alertas | Amazon SQS |
| Monitoreo y logs | Amazon CloudWatch Logs |
| API REST | FastAPI + Uvicorn |
| Contenedor de API | Amazon ECS Fargate |
| Registro de imágenes | Amazon ECR |
| Load Balancer | Application Load Balancer (ALB) |
| Orquestación local | Docker Compose |

---

## Estructura del Proyecto

```
📁 proyecto-iot-aws/
├── 📁 terraform/                    # Infraestructura como código
│   ├── main.tf                      # Orquestador de módulos
│   ├── variables.tf                 # Variables globales
│   ├── outputs.tf                   # Outputs: URL API, endpoints
│   ├── data.tf                      # Data sources: LabRole, región
│   └── 📁 modules/
│       ├── 📁 storage/              # Buckets S3
│       ├── 📁 database/             # DynamoDB + PostgreSQL RDS
│       ├── 📁 iot/                  # IoT Core: Thing, certs, reglas
│       ├── 📁 compute/              # Lambda + SQS + ECR + ECS
│       └── 📁 networking/           # VPC, Security Groups, ALB
│
├── 📁 lambda/                       # Funciones Lambda
│   ├── 📁 s3_to_postgres/           # S3 → PostgreSQL (histórico)
│   │   ├── lambda_function.py
│   │   ├── requirements.txt
│   │   └── s3_to_postgres.zip       # Generado: pip install + zip
│   ├── 📁 alert_to_sqs/             # IoT Core → SQS (alerta)
│   │   ├── lambda_function.py
│   │   └── alert_to_sqs.zip
│   └── 📁 sqs_to_cloudwatch/        # SQS → CloudWatch (log urgencia)
│       ├── lambda_function.py
│       └── sqs_to_cloudwatch.zip
│
├── 📁 api/                          # API REST FastAPI
│   ├── main.py                      # 5 endpoints REST
│   ├── requirements.txt
│   └── Dockerfile
│
├── 📁 scripts/
│   └── deploy.sh                    # Post-Terraform: ECR push + DB init + ECS
│
├── 📁 python_device/                # Simulador de sensores
│   ├── sensor_simulator.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── 📁 edge_gateway/                 # Mosquitto Edge Gateway
│   ├── Dockerfile
│   └── 📁 certs/                    # ⚠️ Generado por Terraform (en .gitignore)
│
├── init_db.sql                      # Esquema PostgreSQL
├── docker-compose.yml               # Sensores + Mosquitto locales
├── Makefile                         # Comandos principales
└── README.md
```

---

## Prerrequisitos

### Herramientas necesarias

```bash
# Verificar versiones
terraform --version   # >= 1.0.0
docker --version      # >= 20.0
docker compose version
aws --version         # >= 2.0
```

### Instalación

- **Terraform**: https://developer.hashicorp.com/terraform/install
- **Docker Desktop**: https://www.docker.com/products/docker-desktop/
- **AWS CLI**: https://aws.amazon.com/cli/

### Cuenta AWS

Este proyecto está diseñado para **AWS Academy Learner Lab**. Necesitas:

1. Acceso a un AWS Learner Lab activo
2. Permisos para crear: IoT Core, DynamoDB, S3, RDS, Lambda, SQS, ECS, ECR, ALB

---

## Despliegue

### Paso 1 — Configurar credenciales AWS

Cada vez que inicies el laboratorio, actualiza las credenciales:

```bash
nano ~/.aws/credentials
```

Pega las credenciales del lab (AWS Details → AWS CLI):

```ini
[default]
aws_access_key_id=ASIA...
aws_secret_access_key=xxxx...
aws_session_token=xxxx...
```

Verifica:

```bash
aws sts get-caller-identity
```

### Paso 2 — Preparar los ZIPs de las Lambdas

Solo necesario la primera vez o cuando modifiques el código:

```bash
# Lambda S3 → PostgreSQL (requiere psycopg2 compilado para Linux)
cd lambda/s3_to_postgres
pip install -r requirements.txt -t ./package \
  --platform manylinux2014_x86_64 \
  --only-binary=:all:
cp lambda_function.py ./package/
cd package && zip -r ../s3_to_postgres.zip . && cd ../..

# Lambda Alert → SQS (solo boto3, ya incluido en Lambda)
cd lambda/alert_to_sqs
zip alert_to_sqs.zip lambda_function.py
cd ../..

# Lambda SQS → CloudWatch
cd lambda/sqs_to_cloudwatch
zip sqs_to_cloudwatch.zip lambda_function.py
cd ../..
```

### Paso 3 — Desplegar toda la infraestructura

```bash
make aws-up
```

Este comando ejecuta automáticamente:

1. `terraform init && terraform apply` — Crea los 45 recursos en AWS
2. `scripts/deploy.sh` — Construye y sube la imagen Docker a ECR
3. Espera a que PostgreSQL esté disponible y ejecuta `init_db.sql`
4. Fuerza redeploy de ECS con la nueva imagen

Al finalizar verás:

```
Apply complete! Resources: 45 added, 0 changed, 0 destroyed.

API URL: http://iot-edge-lab-alb-XXXX.us-east-1.elb.amazonaws.com
```

### Paso 4 — Levantar los sensores locales

```bash
make local-up
```

### Paso 5 — Verificar que todo funciona

```bash
# Obtener la URL de la API
API_URL=$(cd terraform && terraform output -raw api_url)

# Health check
curl $API_URL/health
# → {"status":"ok"}

# Listar sensores
curl -s $API_URL/sensors | python3 -m json.tool
```

---

## API REST

La API está disponible en la URL del ALB generada por Terraform.

| Endpoint | Método | Fuente | Descripción |
|----------|--------|--------|-------------|
| `/health` | GET | — | Health check del servicio |
| `/sensors` | GET | DynamoDB | Lista todos los sensores registrados |
| `/sensors` | POST | DynamoDB | Registra un nuevo sensor |
| `/sensor/{id}/current` | GET | DynamoDB | Último valor en tiempo real (Device Shadow) |
| `/sensor/{id}/recent` | GET | DynamoDB | Últimos 10 eventos del sensor |
| `/sensor/{id}/history` | GET | PostgreSQL | Histórico completo |
| `/docs` | GET | — | Documentación Swagger UI interactiva |

### Ejemplos de uso

```bash
API_URL="http://iot-edge-lab-alb-XXXX.us-east-1.elb.amazonaws.com"

# Listar todos los sensores
curl -s $API_URL/sensors | python3 -m json.tool

# Registrar nuevo sensor
curl -X POST $API_URL/sensors \
  -H "Content-Type: application/json" \
  -d '{"device_id":"sensor-co2-01","sensor_type":"co2","location":"sala-1"}'

# Dato actual en tiempo real
curl -s $API_URL/sensor/sensor-temp-01/current | python3 -m json.tool

# Últimos 10 eventos (DynamoDB con Sort Key)
curl -s $API_URL/sensor/sensor-temp-01/recent | python3 -m json.tool

# Histórico completo (PostgreSQL)
curl -s "$API_URL/sensor/sensor-temp-01/history?limit=50" | python3 -m json.tool
```

### Ejemplo de respuesta — `/sensor/{id}/current`

```json
{
  "device_id": "sensor-temp-01",
  "sensor_type": "temperature",
  "value": "27.34",
  "timestamp": "2026-06-03T19:00:00.000000+00:00"
}
```

### Ejemplo de respuesta — `/sensor/{id}/history`

```json
{
  "device_id": "sensor-temp-01",
  "count": 100,
  "history": [
    {
      "device_id": "sensor-temp-01",
      "sensor_type": "temperature",
      "value": 27.34,
      "timestamp": "2026-06-03 19:00:00+00:00",
      "created_at": "2026-06-03 19:00:02+00:00"
    }
  ]
}
```

---

## Sistema de Alertas

Cuando un sensor de temperatura supera **30°C**, se activa automáticamente el pipeline de alertas:

```
IoT Core (temp > 30°C)
    │
    ▼ Lambda alert_to_sqs
    │
    ▼ Cola SQS (desacoplamiento)
    │
    ▼ Lambda sqs_to_cloudwatch
    │
    ▼ CloudWatch Logs
      /iot/iot-edge/lab/urgent-alerts
```

### Verificar alertas en tiempo real

```bash
# Ver logs de urgencia en CloudWatch
aws logs tail /iot/iot-edge/lab/urgent-alerts \
  --region us-east-1 \
  --follow
```

### Forzar una alerta manualmente

```bash
# Publicar temperatura crítica en Mosquitto local
docker exec edge-gateway-mosquitto mosquitto_pub \
  -h localhost -p 1883 \
  -t "lab/sensors/data" \
  -m '{"device_id":"sensor-temp-01","sensor_type":"temperature","value":45.0,"timestamp":"2026-06-03T19:00:00+00:00"}'
```

---

## Demo y Pruebas

El script `demo_proyecto_iot.sh` permite demostrar y verificar todos los componentes del sistema:

```bash
# Menú interactivo
bash demo_proyecto_iot.sh

# Demo completa automática
bash demo_proyecto_iot.sh all

# Prueba específica
bash demo_proyecto_iot.sh 4   # Solo alertas
bash demo_proyecto_iot.sh 7   # Monitoreo en vivo
```

| Opción | Prueba |
|--------|--------|
| 1 | Sensores en tiempo real (Device Shadow) |
| 2 | Últimos 10 eventos por sensor |
| 3 | Histórico completo en PostgreSQL |
| 4 | Sistema de alertas completo |
| 5 | Pipeline S3 → Lambda → PostgreSQL |
| 6 | Registro de nuevo sensor |
| 7 | Monitoreo en vivo 30 segundos |

---

## Fase 7 — Agregar Nuevo Sensor

Para añadir un nuevo tipo de sensor (ej. CO2, presión, luminosidad):

### 1. Modificar `python_device/sensor_simulator.py`

```python
def generate_sensor_data():
    value = 0.0
    if SENSOR_TYPE == "temperature":
        value = round(random.uniform(20.0, 35.0), 2)
    elif SENSOR_TYPE == "humidity":
        value = round(random.uniform(40.0, 60.0), 2)
    elif SENSOR_TYPE == "co2":           # ← NUEVO
        value = round(random.uniform(400.0, 2000.0), 2)
    else:
        value = round(random.uniform(0.0, 100.0), 2)
    ...
```

### 2. Agregar servicio en `docker-compose.yml`

```yaml
  sensor_co2_01:
    build:
      context: ./python_device
      dockerfile: Dockerfile
    container_name: sensor-co2-01
    environment:
      - MQTT_HOST=mosquitto
      - CLIENT_ID=sensor-co2-01
      - SENSOR_TYPE=co2
      - INTERVAL=6
    depends_on:
      - mosquitto
    restart: unless-stopped
```

### 3. Reiniciar y registrar

```bash
# Reiniciar contenedores
make local-down && make local-up

# Registrar el sensor en la API
API_URL=$(cd terraform && terraform output -raw api_url)
curl -X POST $API_URL/sensors \
  -H "Content-Type: application/json" \
  -d '{"device_id":"sensor-co2-01","sensor_type":"co2","location":"sala-1"}'

# Verificar dato actual
curl -s $API_URL/sensor/sensor-co2-01/current | python3 -m json.tool
```

---

## Comandos de Referencia

```bash
# ── Infraestructura AWS ──────────────────────────────────────
make aws-up          # Despliega TODA la infraestructura + imagen + DB
make aws-down        # Destruye todos los recursos de AWS
make clean           # Para contenedores + destruye AWS + limpia archivos

# ── Entorno local ────────────────────────────────────────────
make local-up        # Levanta Mosquitto + sensores Docker
make local-down      # Para los contenedores locales
make logs            # Logs en tiempo real de todos los contenedores

# ── Terraform ────────────────────────────────────────────────
cd terraform && terraform output              # Ver todos los outputs
cd terraform && terraform output api_url      # URL de la API
cd terraform && terraform output postgres_endpoint
cd terraform && terraform state list          # Listar recursos

# ── AWS CLI útiles ───────────────────────────────────────────
# Ver logs de Lambda en tiempo real
aws logs tail /aws/lambda/iot-edge-lab-s3-to-postgres --follow

# Ver alertas en tiempo real
aws logs tail /iot/iot-edge/lab/urgent-alerts --follow

# Ver datos en DynamoDB
aws dynamodb scan --table-name SensorData-lab --region us-east-1

# Ver archivos en S3
aws s3 ls s3://lab-iot-edge-sensor-data-XXXX/data/ --recursive

# Estado del servicio ECS
aws ecs describe-services \
  --cluster iot-edge-lab-cluster \
  --services iot-edge-lab-api-service \
  --query 'services[0].{Status:status,Running:runningCount}'
```

---

## Notas Importantes

> **⚠️ Credenciales del Learner Lab**: Las credenciales de AWS Academy expiran cada 4 horas. Debes actualizar `~/.aws/credentials` cada vez que reabras el laboratorio antes de ejecutar cualquier comando de Terraform o AWS CLI.

> **⚠️ make clean**: Este comando destruye TODOS los recursos de AWS y elimina el estado de Terraform. Todos los datos en DynamoDB, S3 y PostgreSQL se perderán. Usar solo al finalizar la sesión de laboratorio.

> **ℹ️ Tiempo de despliegue**: `make aws-up` tarda entre 8 y 12 minutos. La mayor parte del tiempo corresponde a la creación de la instancia RDS PostgreSQL (~5 min) y al arranque del servicio ECS (~3 min).

---

## Licencia

Proyecto académico — Laboratorio de IoT con AWS.
