import dotenv from 'dotenv';
import Joi from 'joi';
import logger from './logger';

// Load environment variables
dotenv.config();

/**
 * Environment Configuration with Validation
 * Centralized configuration management with type safety and validation
 */

// Environment validation schema
const envSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  API_VERSION: Joi.string().default('v1'),
  
  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MAX: Joi.number().min(1).max(50).default(20),
  DB_POOL_MIN: Joi.number().min(1).max(20).default(5),
  DB_SSL: Joi.boolean().default(false),
  DB_SSL_CA: Joi.string().allow(''),
  DB_SSL_CERT: Joi.string().allow(''),
  DB_SSL_KEY: Joi.string().allow(''),
  
  // Redis Configuration
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().required(),
  REDIS_DB: Joi.number().min(0).max(15).default(0),
  
  // JWT Configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_ALGORITHM: Joi.string().valid('HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512').default('HS384'),
  
  // Security Configuration
  BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
  SESSION_SECRET: Joi.string().min(32).default('dwaybank_session_secret_change_in_production'),
  CORS_ORIGIN: Joi.alternatives().try(
    Joi.string().uri(),
    Joi.array().items(Joi.string().uri()),
    Joi.boolean()
  ).default('http://localhost:3001'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().positive().default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL: Joi.boolean().default(true),
  
  // MFA Configuration
  MFA_ISSUER: Joi.string().default('DwayBank'),
  MFA_WINDOW: Joi.number().min(1).max(5).default(2),
  MFA_BACKUP_CODES_COUNT: Joi.number().min(5).max(20).default(10),
  
  // SMS Configuration (Twilio)
  TWILIO_ACCOUNT_SID: Joi.string().allow(''),
  TWILIO_AUTH_TOKEN: Joi.string().allow(''),
  TWILIO_PHONE_NUMBER: Joi.string().allow(''),
  SMS_EXPIRY_MINUTES: Joi.number().min(1).max(30).default(10),
  
  // Email Configuration
  EMAIL_SERVICE: Joi.string().valid('gmail', 'outlook', 'sendgrid', 'aws-ses').default('gmail'),
  EMAIL_HOST: Joi.string().allow(''),
  EMAIL_PORT: Joi.number().port().allow(''),
  EMAIL_USER: Joi.string().email().allow(''),
  EMAIL_PASSWORD: Joi.string().allow(''),
  EMAIL_FROM: Joi.string().email().default('noreply@dwaybank.com'),
  EMAIL_EXPIRY_MINUTES: Joi.number().min(1).max(60).default(30),
  
  // KYC Configuration
  KYC_PROVIDER: Joi.string().valid('jumio', 'onfido', 'mock').default('mock'),
  JUMIO_API_TOKEN: Joi.string().allow(''),
  JUMIO_API_SECRET: Joi.string().allow(''),
  JUMIO_BASE_URL: Joi.string().uri().default('https://netverify.com'),
  ONFIDO_API_TOKEN: Joi.string().allow(''),
  ONFIDO_REGION: Joi.string().valid('us', 'eu', 'ca').default('us'),
  
  // File Upload Configuration
  UPLOAD_MAX_SIZE: Joi.number().positive().default(10485760), // 10MB
  UPLOAD_ALLOWED_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  UPLOAD_DESTINATION: Joi.string().default('./uploads'),
  
  // Monitoring & Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
  ENABLE_REQUEST_LOGGING: Joi.boolean().default(true),
  ENABLE_PERFORMANCE_MONITORING: Joi.boolean().default(true),
  
  // External API Configuration
  ENCRYPTION_KEY: Joi.string().length(64).required(), // 32 bytes in hex
  ENCRYPTION_ALGORITHM: Joi.string().default('aes-256-gcm'),
  
  // Development & Testing
  ENABLE_SWAGGER: Joi.boolean().default(true),
  ENABLE_SEED_DATA: Joi.boolean().default(false),
  TEST_DATABASE_URL: Joi.string().allow(''),
});

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true,
});

if (error) {
  logger.error('Environment validation failed', { 
    error: error.details.map(detail => detail.message) 
  });
  throw new Error(`Environment validation error: ${error.message}`);
}

// Type-safe environment configuration
export interface EnvironmentConfig {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  API_VERSION: string;
  
  // Database
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMax: number;
    poolMin: number;
    ssl: boolean;
  };
  
  // Redis
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
  
  // JWT
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    algorithm: string;
  };
  
  // Security
  security: {
    bcryptRounds: number;
    sessionSecret: string;
    corsOrigin: string | string[] | boolean;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
      skipSuccessful: boolean;
    };
    encryptionKey: string;
    encryptionAlgorithm: string;
  };
  
  // MFA
  mfa: {
    issuer: string;
    window: number;
    backupCodesCount: number;
  };
  
  // SMS
  sms: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    expiryMinutes: number;
  };
  
  // Email
  email: {
    service: string;
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
    expiryMinutes: number;
  };
  
  // KYC
  kyc: {
    provider: 'jumio' | 'onfido' | 'mock';
    jumio: {
      apiToken: string;
      apiSecret: string;
      baseUrl: string;
    };
    onfido: {
      apiToken: string;
      region: string;
    };
  };
  
  // File Upload
  upload: {
    maxSize: number;
    allowedTypes: string[];
    destination: string;
  };
  
  // Monitoring
  monitoring: {
    logLevel: string;
    enableRequestLogging: boolean;
    enablePerformanceMonitoring: boolean;
  };
  
  // Development
  development: {
    enableSwagger: boolean;
    enableSeedData: boolean;
    testDatabaseUrl: string;
  };
}

// Export typed configuration
export const config: EnvironmentConfig = {
  NODE_ENV: envVars.NODE_ENV,
  PORT: envVars.PORT,
  API_VERSION: envVars.API_VERSION,
  
  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    poolMax: envVars.DB_POOL_MAX,
    poolMin: envVars.DB_POOL_MIN,
    ssl: envVars.DB_SSL,
  },
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
    algorithm: envVars.JWT_ALGORITHM,
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionSecret: envVars.SESSION_SECRET,
    corsOrigin: envVars.CORS_ORIGIN,
    rateLimit: {
      windowMs: envVars.RATE_LIMIT_WINDOW_MS,
      maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
      skipSuccessful: envVars.RATE_LIMIT_SKIP_SUCCESSFUL,
    },
    encryptionKey: envVars.ENCRYPTION_KEY,
    encryptionAlgorithm: envVars.ENCRYPTION_ALGORITHM,
  },
  
  mfa: {
    issuer: envVars.MFA_ISSUER,
    window: envVars.MFA_WINDOW,
    backupCodesCount: envVars.MFA_BACKUP_CODES_COUNT,
  },
  
  sms: {
    accountSid: envVars.TWILIO_ACCOUNT_SID || '',
    authToken: envVars.TWILIO_AUTH_TOKEN || '',
    phoneNumber: envVars.TWILIO_PHONE_NUMBER || '',
    expiryMinutes: envVars.SMS_EXPIRY_MINUTES,
  },
  
  email: {
    service: envVars.EMAIL_SERVICE,
    host: envVars.EMAIL_HOST || '',
    port: envVars.EMAIL_PORT || 587,
    user: envVars.EMAIL_USER || '',
    password: envVars.EMAIL_PASSWORD || '',
    from: envVars.EMAIL_FROM,
    expiryMinutes: envVars.EMAIL_EXPIRY_MINUTES,
  },
  
  kyc: {
    provider: envVars.KYC_PROVIDER,
    jumio: {
      apiToken: envVars.JUMIO_API_TOKEN || '',
      apiSecret: envVars.JUMIO_API_SECRET || '',
      baseUrl: envVars.JUMIO_BASE_URL,
    },
    onfido: {
      apiToken: envVars.ONFIDO_API_TOKEN || '',
      region: envVars.ONFIDO_REGION,
    },
  },
  
  upload: {
    maxSize: envVars.UPLOAD_MAX_SIZE,
    allowedTypes: envVars.UPLOAD_ALLOWED_TYPES.split(','),
    destination: envVars.UPLOAD_DESTINATION,
  },
  
  monitoring: {
    logLevel: envVars.LOG_LEVEL,
    enableRequestLogging: envVars.ENABLE_REQUEST_LOGGING,
    enablePerformanceMonitoring: envVars.ENABLE_PERFORMANCE_MONITORING,
  },
  
  development: {
    enableSwagger: envVars.ENABLE_SWAGGER,
    enableSeedData: envVars.ENABLE_SEED_DATA,
    testDatabaseUrl: envVars.TEST_DATABASE_URL || '',
  },
};

// Validate critical configurations on startup
export const validateCriticalConfig = (): void => {
  const criticalChecks = [
    { name: 'JWT_SECRET', value: config.jwt.secret, minLength: 32 },
    { name: 'JWT_REFRESH_SECRET', value: config.jwt.refreshSecret, minLength: 32 },
    { name: 'ENCRYPTION_KEY', value: config.security.encryptionKey, exactLength: 64 },
    { name: 'DB_PASSWORD', value: config.database.password, minLength: 8 },
    { name: 'REDIS_PASSWORD', value: config.redis.password, minLength: 8 },
  ];

  const errors: string[] = [];

  criticalChecks.forEach(({ name, value, minLength, exactLength }) => {
    if (!value || value.length === 0) {
      errors.push(`${name} is required but not provided`);
    } else if (minLength && value.length < minLength) {
      errors.push(`${name} must be at least ${minLength} characters long`);
    } else if (exactLength && value.length !== exactLength) {
      errors.push(`${name} must be exactly ${exactLength} characters long`);
    }
  });

  if (errors.length > 0) {
    logger.error('Critical configuration validation failed', { errors });
    throw new Error(`Critical configuration errors: ${errors.join(', ')}`);
  }

  logger.info('Critical configuration validation passed');
};

export default config;