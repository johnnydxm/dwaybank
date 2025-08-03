/**
 * Database Setup Script for DwayBank Development
 * Creates database, runs migrations, and sets up initial data
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import logger from '../config/logger';

const setupDatabase = async () => {
  console.log('🔧 Setting up DwayBank database...');

  // Database configuration for initial connection (to postgres db)
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres', // Connect to default postgres db first
    user: process.env.DB_USER || 'dwaybank',
    password: process.env.DB_PASSWORD || 'dwaybank_secure_2024',
  });

  // Target database configuration
  const dbName = process.env.DB_NAME || 'dwaybank_dev';
  const dbUser = process.env.DB_USER || 'dwaybank';

  try {
    // Step 1: Create database if it doesn't exist
    console.log(`📊 Creating database: ${dbName}`);
    
    const checkDbResult = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (checkDbResult.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}" OWNER "${dbUser}"`);
      console.log(`✅ Database "${dbName}" created successfully`);
    } else {
      console.log(`ℹ️  Database "${dbName}" already exists`);
    }

    await adminPool.end();

    // Step 2: Connect to the target database and run migrations
    const targetPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: dbName,
      user: dbUser,
      password: process.env.DB_PASSWORD || 'dwaybank_secure_2024',
    });

    // Step 3: Create migrations table if it doesn't exist
    await targetPool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 4: Run migrations in order
    const migrationFiles = [
      '000_setup_database.sql',
      '001_create_users_table.sql',
      '002_create_sessions_table.sql',
      '003_create_mfa_table.sql',
      '004_create_kyc_table.sql',
      '005_create_token_tables.sql',
      '006_create_financial_tables.sql',
    ];

    for (const filename of migrationFiles) {
      try {
        // Check if migration already executed
        const executed = await targetPool.query(
          'SELECT 1 FROM migrations WHERE filename = $1',
          [filename]
        );

        if (executed.rows.length > 0) {
          console.log(`⏭️  Migration ${filename} already executed`);
          continue;
        }

        // Read and execute migration
        const migrationPath = join(__dirname, '../../database/migrations', filename);
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        console.log(`🔄 Running migration: ${filename}`);
        
        await targetPool.query('BEGIN');
        await targetPool.query(migrationSQL);
        await targetPool.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
        await targetPool.query('COMMIT');

        console.log(`✅ Migration ${filename} completed successfully`);

      } catch (migrationError) {
        await targetPool.query('ROLLBACK');
        console.error(`❌ Migration ${filename} failed:`, migrationError);
        throw migrationError;
      }
    }

    // Step 5: Verify database setup
    console.log('🔍 Verifying database setup...');
    
    const tables = await targetPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📋 Created tables:');
    tables.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    await targetPool.end();

    console.log('🎉 Database setup completed successfully!');
    console.log(`📊 Database: ${dbName}`);
    console.log(`👤 User: ${dbUser}`);
    console.log(`🌐 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

export default setupDatabase;