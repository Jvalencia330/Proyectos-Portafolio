output "sensor_table_name" {
  value = aws_dynamodb_table.sensor_data.name
}

output "postgres_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "postgres_host" {
  value = aws_db_instance.postgres.address
}

output "postgres_db_name" {
  value = aws_db_instance.postgres.db_name
}

output "postgres_username" {
  value = aws_db_instance.postgres.username
}

output "postgres_sg_id" {
  value = aws_security_group.postgres.id
}

output "sensor_events_table_name" {
  value = aws_dynamodb_table.sensor_events_recent.name
}
