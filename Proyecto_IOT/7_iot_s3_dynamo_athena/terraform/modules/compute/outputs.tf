output "alert_lambda_arn" {
  value = aws_lambda_function.alert_to_sqs.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
