output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "vpc_id" {
  value = data.aws_vpc.default.id
}

output "subnet_ids" {
  value = data.aws_subnets.default.ids
}

output "ecs_sg_id" {
  value = aws_security_group.ecs_tasks.id
}

output "target_group_arn" {
  value = aws_lb_target_group.api.arn
}
