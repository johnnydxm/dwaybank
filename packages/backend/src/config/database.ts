import { Pool, PoolConfig } from 'pg';
import { RedisClientType, createClient } from 'redis';
import logger from './logger';

/**
 * Database Configuration
 * PostgreSQL connection pool and Redis client setup
 */

// PostgreSQL Configuration
const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dwaybank_dev',
  user: process.env.DB_USER || 'dwaybank',
  password: process.env.DB_PASSWORD || 'dwaybank_secure_2024',
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum pool size
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum pool size
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA || undefined,
    cert: process.env.DB_SSL_CERT || undefined,
    key: process.env.DB_SSL_KEY || undefined,
    minVersion: 'TLSv1.2',
    ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
    secureProtocol: 'TLSv1_2_method'
  } : false,
};

// Create PostgreSQL connection pool
export const pool = new Pool(dbConfig);

// Handle PostgreSQL connection events
pool.on('connect', (client) => {
  logger.info('PostgreSQL client connected', { 
    database: dbConfig.database 
  });
});

pool.on('error', (err, client) => {
  logger.error('PostgreSQL client error', { 
    error: err.message
  });
});

// Redis Configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'dwaybank_redis_2024',
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 5000,
  commandTimeout: 5000,
};

// Create Redis client
export const redis: RedisClientType = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
    connectTimeout: redisConfig.connectTimeout,
    keepAlive: redisConfig.keepAlive,
  },
  password: redisConfig.password,
  database: redisConfig.db,
});

// Handle Redis connection events
redis.on('connect', () => {
  logger.info('Redis client connecting', { 
    host: redisConfig.host,
    port: redisConfig.port,
    database: redisConfig.db 
  });
});

redis.on('ready', () => {
  logger.info('Redis client ready', { 
    host: redisConfig.host,
    port: redisConfig.port 
  });
});

redis.on('error', (err) => {
  logger.error('Redis client error', { 
    error: err.message,
    host: redisConfig.host,
    port: redisConfig.port 
  });
});

redis.on('reconnecting', () => {
  logger.warn('Redis client reconnecting', { 
    host: redisConfig.host,
    port: redisConfig.port 
  });
});

/**
 * Initialize database connections
 */
export const initializeDatabases = async (): Promise<{ postgres: Pool; redis: RedisClientType }> => {
  try {
    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection established successfully');

    // Connect to Redis
    if (!redis.isOpen) {
      await redis.connect();
      logger.info('Redis connection established successfully');
    }

    // Return the database instances
    return { postgres: pool, redis };

  } catch (error) {
    logger.error('Database initialization failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
};

/**
 * Close database connections gracefully
 */
export const closeDatabases = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('PostgreSQL pool closed');

    if (redis.isOpen) {
      await redis.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing databases', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Health check functions
export const checkDatabaseHealth = async (): Promise<{ postgres: boolean; redis: boolean }> => {
  let postgresHealth = false;
  let redisHealth = false;

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    postgresHealth = true;
  } catch (error) {
    logger.error('PostgreSQL health check failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }

  try {
    if (redis.isOpen) {
      await redis.ping();
      redisHealth = true;
    }
  } catch (error) {
    logger.error('Redis health check failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }

  return { postgres: postgresHealth, redis: redisHealth };
};