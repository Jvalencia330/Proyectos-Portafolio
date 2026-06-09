variable "project_name" { type = string }
variable "environment"  { type = string }
variable "lab_role_arn" { type = string }

variable "lambda_bucket_name" { type = string }
variable "sensor_bucket_arn"  { type = string }
variable "sensor_bucket_id"   { type = string }

variable "postgres_host"     { type = string }
variable "postgres_db_name"  { type = string }
variable "postgres_username" { type = string }

variable "db_password" {
  type      = string
  sensitive = true
}

variable "ecr_repository_url" {
  type    = string
  default = ""
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "dynamo_table_shadow" {
  type    = string
  default = ""
}

variable "dynamo_table_events" {
  type    = string
  default = ""
}

variable "subnet_ids" {
  type    = list(string)
  default = []
}

variable "ecs_sg_id" {
  type    = string
  default = ""
}

variable "target_group_arn" {
  type    = string
  default = ""
}
