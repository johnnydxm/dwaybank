# DwayBank Infrastructure - Variables Configuration

# ================================
# PROJECT CONFIGURATION
# ================================
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "dwaybank"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "app_version" {
  description = "Application version for deployment"
  type        = string
  default     = "latest"
}

# ================================
# AWS CONFIGURATION
# ================================
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

# ================================
# NETWORKING CONFIGURATION
# ================================
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

# ================================
# DATABASE CONFIGURATION
# ================================
variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "Database instance class"
  type        = string
  default     = "db.t3.micro"
  validation {
    condition = can(regex("^db\\.", var.db_instance_class))
    error_message = "Database instance class must start with 'db.'."
  }
}

variable "db_allocated_storage" {
  description = "Initial database storage in GB"
  type        = number
  default     = 20
  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 65536
    error_message = "Database storage must be between 20 and 65536 GB."
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum database storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "dwaybank"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "dwaybank_admin"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,15}$", var.db_username))
    error_message = "Database username must start with a letter and be 1-16 characters long."
  }
}

variable "db_backup_retention_period" {
  description = "Database backup retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_retention_period >= 1 && var.db_backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

variable "db_backup_window" {
  description = "Database backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Database maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# ================================
# REDIS CONFIGURATION
# ================================
variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1
  validation {
    condition     = var.redis_num_nodes >= 1 && var.redis_num_nodes <= 6
    error_message = "Redis node count must be between 1 and 6."
  }
}

variable "redis_parameter_group" {
  description = "Redis parameter group"
  type        = string
  default     = "default.redis7"
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_snapshot_retention" {
  description = "Redis snapshot retention limit in days"
  type        = number
  default     = 5
  validation {
    condition     = var.redis_snapshot_retention >= 0 && var.redis_snapshot_retention <= 35
    error_message = "Redis snapshot retention must be between 0 and 35 days."
  }
}

variable "redis_snapshot_window" {
  description = "Redis snapshot window"
  type        = string
  default     = "03:00-05:00"
}

variable "redis_maintenance_window" {
  description = "Redis maintenance window"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

# ================================
# ECS CONFIGURATION
# ================================
variable "ecs_min_capacity" {
  description = "Minimum ECS service capacity"
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum ECS service capacity"
  type        = number
  default     = 10
}

variable "ecs_desired_capacity" {
  description = "Desired ECS service capacity"
  type        = number
  default     = 2
}

variable "ecs_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 512
  validation {
    condition = contains([256, 512, 1024, 2048, 4096], var.ecs_cpu)
    error_message = "ECS CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "ecs_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 1024
  validation {
    condition = var.ecs_memory >= 512 && var.ecs_memory <= 30720
    error_message = "ECS memory must be between 512 and 30720 MB."
  }
}

variable "app_image" {
  description = "Docker image for the application"
  type        = string
  default     = "dwaybank/smart-wallet:latest"
}

# ================================
# LOAD BALANCER CONFIGURATION
# ================================
variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "app.dwaybank.com"
}

# ================================
# STORAGE CONFIGURATION
# ================================
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 1 and 365 days."
  }
}

# ================================
# MONITORING CONFIGURATION
# ================================
variable "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  type        = string
  default     = ""
}

# ================================
# SECURITY CONFIGURATION
# ================================
variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "enable_inspector" {
  description = "Enable AWS Inspector"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = true
}

# ================================
# COMPLIANCE CONFIGURATION
# ================================
variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable encryption for all services"
  type        = bool
  default     = true
}

variable "compliance_standard" {
  description = "Compliance standard to follow"
  type        = string
  default     = "PCI-DSS"
  validation {
    condition = contains(["PCI-DSS", "SOC2", "GDPR"], var.compliance_standard)
    error_message = "Compliance standard must be one of: PCI-DSS, SOC2, GDPR."
  }
}

# ================================
# COST OPTIMIZATION
# ================================
variable "enable_cost_optimization" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "enable_reserved_instances" {
  description = "Use reserved instances for cost savings"
  type        = bool
  default     = false
}

# ================================
# ENVIRONMENT-SPECIFIC OVERRIDES
# ================================
variable "production_overrides" {
  description = "Production-specific configuration overrides"
  type = object({
    db_instance_class = optional(string, "db.r5.large")
    redis_node_type  = optional(string, "cache.r5.large")
    ecs_min_capacity = optional(number, 2)
    ecs_max_capacity = optional(number, 20)
    multi_az_enabled = optional(bool, true)
  })
  default = {}
}

variable "staging_overrides" {
  description = "Staging-specific configuration overrides"
  type = object({
    db_instance_class = optional(string, "db.t3.small")
    redis_node_type  = optional(string, "cache.t3.small")
    ecs_min_capacity = optional(number, 1)
    ecs_max_capacity = optional(number, 5)
    multi_az_enabled = optional(bool, false)
  })
  default = {}
}

# ================================
# FEATURE FLAGS
# ================================
variable "feature_flags" {
  description = "Feature flags for conditional resource creation"
  type = object({
    enable_waf             = optional(bool, true)
    enable_cdn             = optional(bool, true)
    enable_elasticsearch   = optional(bool, false)
    enable_backup_automation = optional(bool, true)
    enable_disaster_recovery = optional(bool, false)
  })
  default = {}
}