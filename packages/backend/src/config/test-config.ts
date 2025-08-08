import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Test configuration with fallback values
export const testConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'test-jwt-secret-32-characters-minimum-for-testing',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-32-characters-minimum-for-testing',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: process.env.JWT_ALGORITHM || 'HS384',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'dwaybank_test',
    user: process.env.DB_USER || 'dwaybank_user',
    password: process.env.DB_PASSWORD || 'test_password',
    poolMax: parseInt(process.env.DB_POOL_MAX || '5'),
    poolMin: parseInt(process.env.DB_POOL_MIN || '1'),
    ssl: process.env.DB_SSL === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'test_redis_password',
    db: parseInt(process.env.REDIS_DB || '1'), // Use different DB for tests
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || 'test-encryption-key-32-bytes-for-testing-only',
    encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
  },
};
