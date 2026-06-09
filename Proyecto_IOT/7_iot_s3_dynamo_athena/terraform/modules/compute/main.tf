# ==========================================
# LAMBDA: S3 → PostgreSQL (Histórico)
# ==========================================

# Subir el ZIP de la Lambda a S3 para que Terraform lo despliegue
resource "aws_s3_object" "lambda_zip" {
  bucket = var.lambda_bucket_name
  key    = "lambdas/s3_to_postgres.zip"
  source = "${path.root}/../lambda/s3_to_postgres/s3_to_postgres.zip"
  etag   = filemd5("${path.root}/../lambda/s3_to_postgres/s3_to_postgres.zip")
}

# La función Lambda
resource "aws_lambda_function" "s3_to_postgres" {
  function_name = "${var.project_name}-${var.environment}-s3-to-postgres"
  role          = var.lab_role_arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.12"

  s3_bucket = var.lambda_bucket_name
  s3_key    = aws_s3_object.lambda_zip.key

  timeout     = 30
  memory_size = 256

  environment {
    variables = {
      DB_HOST     = var.postgres_host
      DB_NAME     = var.postgres_db_name
      DB_USER     = var.postgres_username
      DB_PASSWORD = var.db_password
      DB_PORT     = "5432"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Permiso para que S3 invoque esta Lambda
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_to_postgres.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.sensor_bucket_arn
}

# Trigger: cuando se crea un objeto en S3, llama a la Lambda
resource "aws_s3_bucket_notification" "sensor_data_trigger" {
  bucket = var.sensor_bucket_id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_to_postgres.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "data/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

# ==========================================
# SISTEMA DE ALERTAS: SQS + 2 LAMBDAS
# ==========================================

# Cola SQS para alertas
resource "aws_sqs_queue" "alerts" {
  name                       = "${var.project_name}-${var.environment}-alerts"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 3600

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group para urgencias
resource "aws_cloudwatch_log_group" "urgent_alerts" {
  name              = "/iot/${var.project_name}/${var.environment}/urgent-alerts"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_stream" "urgent_alerts" {
  name           = "sensor-alerts"
  log_group_name = aws_cloudwatch_log_group.urgent_alerts.name
}

# ZIP Lambda 1
resource "aws_s3_object" "alert_lambda_zip" {
  bucket = var.lambda_bucket_name
  key    = "lambdas/alert_to_sqs.zip"
  source = "${path.root}/../lambda/alert_to_sqs/alert_to_sqs.zip"
  etag   = filemd5("${path.root}/../lambda/alert_to_sqs/alert_to_sqs.zip")
}

# Lambda 1: IoT → SQS
resource "aws_lambda_function" "alert_to_sqs" {
  function_name = "${var.project_name}-${var.environment}-alert-to-sqs"
  role          = var.lab_role_arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.12"
  s3_bucket     = var.lambda_bucket_name
  s3_key        = aws_s3_object.alert_lambda_zip.key
  timeout       = 15

  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.alerts.url
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Permiso para que IoT Core invoque Lambda 1
resource "aws_lambda_permission" "iot_invoke_alert" {
  statement_id  = "AllowIoTInvokeAlert"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_to_sqs.function_name
  principal     = "iot.amazonaws.com"
}

# ZIP Lambda 2
resource "aws_s3_object" "sqs_lambda_zip" {
  bucket = var.lambda_bucket_name
  key    = "lambdas/sqs_to_cloudwatch.zip"
  source = "${path.root}/../lambda/sqs_to_cloudwatch/sqs_to_cloudwatch.zip"
  etag   = filemd5("${path.root}/../lambda/sqs_to_cloudwatch/sqs_to_cloudwatch.zip")
}

# Lambda 2: SQS → CloudWatch
resource "aws_lambda_function" "sqs_to_cloudwatch" {
  function_name = "${var.project_name}-${var.environment}-sqs-to-cloudwatch"
  role          = var.lab_role_arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.12"
  s3_bucket     = var.lambda_bucket_name
  s3_key        = aws_s3_object.sqs_lambda_zip.key
  timeout       = 30

  environment {
    variables = {
      LOG_GROUP_NAME  = aws_cloudwatch_log_group.urgent_alerts.name
      LOG_STREAM_NAME = aws_cloudwatch_log_stream.urgent_alerts.name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Trigger: SQS dispara Lambda 2
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.alerts.arn
  function_name    = aws_lambda_function.sqs_to_cloudwatch.arn
  batch_size       = 1
}

# ==========================================
# ECR: Repositorio para imagen Docker API
# ==========================================
resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-${var.environment}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# ==========================================
# ECS: Cluster, Task Definition, Service
# ==========================================

resource "aws_ecs_cluster" "api" {
  name = "${var.project_name}-${var.environment}-cluster"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "ecs_api" {
  name              = "/ecs/${var.project_name}-${var.environment}-api"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.lab_role_arn
  task_role_arn            = var.lab_role_arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.ecr_repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "AWS_REGION",          value = var.aws_region },
      { name = "DYNAMO_TABLE_SHADOW", value = var.dynamo_table_shadow },
      { name = "DYNAMO_TABLE_EVENTS", value = var.dynamo_table_events },
      { name = "DB_HOST",             value = var.postgres_host },
      { name = "DB_NAME",             value = var.postgres_db_name },
      { name = "DB_USER",             value = var.postgres_username },
      { name = "DB_PASSWORD",         value = var.db_password }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}-api"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-${var.environment}-api-service"
  cluster         = aws_ecs_cluster.api.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [aws_cloudwatch_log_group.ecs_api]
}
