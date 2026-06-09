# Data sources para obtener VPC y subnets default
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_dynamodb_table" "sensor_data" {
  # Añadimos el sufijo del entorno para evitar conflictos si hay varios ambientes
  name           = "SensorData-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  
  # Al tener SOLO un Partition Key (hash_key) y NO tener Sort Key (range_key),
  # cada vez que llegue un evento con el mismo device_id, DynamoDB
  # simplemente sobrescribirá el registro existente.
  hash_key       = "device_id"

  attribute {
    name = "device_id"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# --- POSTGRESQL (RDS) ---

# Grupo de subnets para RDS (usa las subnets default de la VPC)
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.environment}-postgres-subnet"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Security Group para RDS
resource "aws_security_group" "postgres" {
  name        = "${var.project_name}-${var.environment}-postgres-sg"
  description = "Permite acceso PostgreSQL desde Lambda y ECS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # En producción real, restringir a las IPs de Lambda/ECS
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Instancia RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-${var.environment}-postgres"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "sensorhistory"
  username = "sensoradmin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]
  publicly_accessible    = true   # Necesario para acceso desde Lambda en VPC default
  skip_final_snapshot    = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Tabla DynamoDB para eventos recientes (con sort key timestamp)
resource "aws_dynamodb_table" "sensor_events_recent" {
  name         = "SensorEvents-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "device_id"
  range_key    = "timestamp"

  attribute {
    name = "device_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
