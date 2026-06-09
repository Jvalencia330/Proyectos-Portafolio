variable "project_name" { type = string }
variable "environment"  { type = string }

variable "db_password" {
  description = "Password para PostgreSQL"
  type        = string
  sensitive   = true
  default     = "SensorPass2024!"
}