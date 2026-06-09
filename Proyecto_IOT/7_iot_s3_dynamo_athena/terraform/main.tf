module "storage" {
  source       = "./modules/storage"
  project_name = var.project_name
  environment  = var.environment
}

module "database" {
  source       = "./modules/database"
  project_name = var.project_name
  environment  = var.environment
}

module "networking" {
  source       = "./modules/networking"
  project_name = var.project_name
  environment  = var.environment
}

module "compute" {
  source             = "./modules/compute"
  project_name       = var.project_name
  environment        = var.environment
  lab_role_arn       = data.aws_iam_role.lab_role.arn
  lambda_bucket_name = module.storage.athena_results_bucket_name
  sensor_bucket_arn  = module.storage.sensor_bucket_arn
  sensor_bucket_id   = module.storage.sensor_bucket_id
  postgres_host      = module.database.postgres_host
  postgres_db_name   = module.database.postgres_db_name
  postgres_username  = module.database.postgres_username
  db_password        = "SensorPass2024!"
  ecr_repository_url = module.compute.ecr_repository_url
  aws_region         = data.aws_region.current.name
  dynamo_table_shadow = module.database.sensor_table_name
  dynamo_table_events = module.database.sensor_events_table_name
  subnet_ids         = module.networking.subnet_ids
  ecs_sg_id          = module.networking.ecs_sg_id
  target_group_arn   = module.networking.target_group_arn
}

module "iot" {
  source                   = "./modules/iot"
  project_name             = var.project_name
  environment              = var.environment
  lab_role_arn             = data.aws_iam_role.lab_role.arn
  account_id               = data.aws_caller_identity.current.account_id
  region                   = data.aws_region.current.name
  iot_endpoint             = data.aws_iot_endpoint.iot_endpoint.endpoint_address
  root_ca_pem              = data.http.root_ca.response_body
  sensor_bucket_name       = module.storage.sensor_bucket_name
  sensor_table_name        = module.database.sensor_table_name
  alert_lambda_arn         = module.compute.alert_lambda_arn
  sensor_events_table_name = module.database.sensor_events_table_name
}
