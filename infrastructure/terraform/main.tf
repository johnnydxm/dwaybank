# DwayBank Infrastructure - Main Terraform Configuration
# Financial-grade AWS infrastructure with multi-AZ deployment

terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  backend "s3" {
    bucket         = "dwaybank-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "dwaybank-terraform-locks"
  }
}

# ================================
# PROVIDER CONFIGURATION
# ================================
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "DwayBank"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
      CostCenter  = "Engineering"
      Compliance  = "PCI-DSS"
    }
  }
}

# ================================
# DATA SOURCES
# ================================
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ================================
# LOCAL VALUES
# ================================
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Multi-AZ configuration for high availability
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  
  # Security groups
  database_port = 5432
  redis_port    = 6379
  app_port      = 3000
  frontend_port = 80
  https_port    = 443
}

# ================================
# NETWORKING MODULE
# ================================
module "networking" {
  source = "./modules/networking"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.availability_zones
  
  # Subnet configurations
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = local.common_tags
}

# ================================
# SECURITY MODULE
# ================================
module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  
  # Application ports
  database_port = local.database_port
  redis_port    = local.redis_port
  app_port      = local.app_port
  frontend_port = local.frontend_port
  https_port    = local.https_port

  # CIDR blocks
  vpc_cidr = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs

  tags = local.common_tags
}

# ================================
# DATABASE MODULE
# ================================
module "database" {
  source = "./modules/database"

  name_prefix = local.name_prefix
  
  # Database configuration
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  
  # Database credentials
  database_name = var.db_name
  master_username = var.db_username
  
  # Network configuration
  db_subnet_group_name = module.networking.database_subnet_group_name
  security_group_ids = [module.security.database_security_group_id]
  
  # Backup and maintenance
  backup_retention_period = var.db_backup_retention_period
  backup_window = var.db_backup_window
  maintenance_window = var.db_maintenance_window
  
  # High availability
  multi_az = var.environment == "production" ? true : false
  
  # Monitoring and performance
  monitoring_interval = 60
  performance_insights_enabled = true
  
  # Security
  storage_encrypted = true
  deletion_protection = var.environment == "production" ? true : false

  tags = local.common_tags
}

# ================================
# CACHE MODULE (REDIS)
# ================================
module "cache" {
  source = "./modules/cache"

  name_prefix = local.name_prefix
  
  # Redis configuration
  node_type = var.redis_node_type
  num_cache_nodes = var.redis_num_nodes
  parameter_group_name = var.redis_parameter_group
  engine_version = var.redis_engine_version
  port = local.redis_port
  
  # Network configuration
  subnet_group_name = module.networking.cache_subnet_group_name
  security_group_ids = [module.security.cache_security_group_id]
  
  # Backup and maintenance
  snapshot_retention_limit = var.redis_snapshot_retention
  snapshot_window = var.redis_snapshot_window
  maintenance_window = var.redis_maintenance_window
  
  # Security
  auth_token_enabled = true
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true

  tags = local.common_tags
}

# ================================
# APPLICATION LOAD BALANCER
# ================================
module "load_balancer" {
  source = "./modules/load_balancer"

  name_prefix = local.name_prefix
  vpc_id = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  
  # Security groups
  security_group_ids = [module.security.alb_security_group_id]
  
  # SSL Certificate
  certificate_arn = var.ssl_certificate_arn
  domain_name = var.domain_name
  
  # Health check configuration
  health_check_path = "/api/health"
  health_check_port = local.app_port

  tags = local.common_tags
}

# ================================
# ECS CLUSTER MODULE
# ================================
module "ecs" {
  source = "./modules/ecs"

  name_prefix = local.name_prefix
  vpc_id = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  # Load balancer
  target_group_arn = module.load_balancer.target_group_arn
  alb_security_group_id = module.security.alb_security_group_id
  
  # Application configuration
  app_image = var.app_image
  app_port = local.app_port
  
  # Scaling configuration
  min_capacity = var.ecs_min_capacity
  max_capacity = var.ecs_max_capacity
  desired_capacity = var.ecs_desired_capacity
  
  # Task configuration
  cpu = var.ecs_cpu
  memory = var.ecs_memory
  
  # Environment variables
  database_endpoint = module.database.endpoint
  database_name = var.db_name
  redis_endpoint = module.cache.endpoint
  
  # Security
  task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  task_role_arn = module.iam.ecs_task_role_arn

  tags = local.common_tags
}

# ================================
# IAM MODULE
# ================================
module "iam" {
  source = "./modules/iam"

  name_prefix = local.name_prefix
  
  # AWS account information
  account_id = data.aws_caller_identity.current.account_id
  region = data.aws_region.current.name
  
  # S3 buckets for application access
  s3_bucket_arns = [
    module.storage.uploads_bucket_arn,
    module.storage.backups_bucket_arn
  ]

  tags = local.common_tags
}

# ================================
# STORAGE MODULE (S3)
# ================================
module "storage" {
  source = "./modules/storage"

  name_prefix = local.name_prefix
  environment = var.environment
  
  # Backup configuration
  backup_retention_days = var.backup_retention_days
  
  # Compliance requirements
  enable_encryption = true
  enable_versioning = true
  enable_logging = true

  tags = local.common_tags
}

# ================================
# MONITORING MODULE
# ================================
module "monitoring" {
  source = "./modules/monitoring"

  name_prefix = local.name_prefix
  
  # ECS cluster
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  
  # Database
  db_instance_identifier = module.database.identifier
  
  # Load balancer
  alb_arn_suffix = module.load_balancer.arn_suffix
  target_group_arn_suffix = module.load_balancer.target_group_arn_suffix
  
  # Notification
  sns_topic_arn = var.sns_topic_arn

  tags = local.common_tags
}

# ================================
# SECURITY SCANNING MODULE
# ================================
module "security_scanning" {
  source = "./modules/security_scanning"

  name_prefix = local.name_prefix
  
  # Inspector configuration
  enable_inspector = true
  assessment_duration = 3600
  
  # GuardDuty configuration
  enable_guardduty = true
  
  # Config rules
  enable_config = true

  tags = local.common_tags
}

# ================================
# OUTPUTS
# ================================
output "vpc_id" {
  description = "VPC ID"
  value = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value = module.networking.private_subnet_ids
}

output "database_endpoint" {
  description = "Database endpoint"
  value = module.database.endpoint
  sensitive = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value = module.cache.endpoint
  sensitive = true
}

output "load_balancer_dns" {
  description = "Load balancer DNS name"
  value = module.load_balancer.dns_name
}

output "load_balancer_zone_id" {
  description = "Load balancer zone ID"
  value = module.load_balancer.zone_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value = module.ecs.cluster_name
}

output "uploads_bucket_name" {
  description = "S3 uploads bucket name"
  value = module.storage.uploads_bucket_name
}

output "backups_bucket_name" {
  description = "S3 backups bucket name"
  value = module.storage.backups_bucket_name
}