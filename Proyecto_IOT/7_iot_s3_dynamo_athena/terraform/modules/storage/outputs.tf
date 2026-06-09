output "sensor_bucket_name" {
  value = aws_s3_bucket.sensor_data.bucket
}

output "athena_results_bucket_name" {
  value = aws_s3_bucket.athena_results.bucket
}

output "sensor_bucket_arn" {
  value = aws_s3_bucket.sensor_data.arn
}

output "sensor_bucket_id" {
  value = aws_s3_bucket.sensor_data.id
}
