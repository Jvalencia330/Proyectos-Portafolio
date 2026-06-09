output "iot_endpoint" {
  value = data.aws_iot_endpoint.iot_endpoint.endpoint_address
}

output "postgres_endpoint" {
  value = module.database.postgres_endpoint
}

output "ecr_repository_url" {
  value = module.compute.ecr_repository_url
}

output "api_url" {
  value = "http://${module.networking.alb_dns_name}"
}
