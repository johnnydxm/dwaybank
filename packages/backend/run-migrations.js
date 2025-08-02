#!/usr/bin/env node

/**
 * Simple migration runner for DwayBank
 * Runs SQL migration files directly without compilation
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dwaybank_dev',
  user: process.env.DB_USER || 'dwaybank',
  password: process.env.DB_PASSWORD || 'dwaybank_secure_2024',
  max: 5
};

class SimpleMigrator {
  constructor() {
    this.pool = new Pool(dbConfig);
    this.migrationsPath = path.join(__dirname, 'database', 'migrations');
  }

  async initializeMigrationTable() {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER NOT NULL DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
      ON schema_migrations(executed_at);
    `;

    try {
      await this.pool.query(createTableSql);
      console.log('✅ Migration tracking table initialized');
    } catch (error) {
      console.error('❌ Failed to initialize migration table:', error.message);
      throw error;
    }
  }

  loadMigrations() {
    const migrations = [];

    try {
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const filename of files) {
        const filepath = path.join(this.migrationsPath, filename);
        const sql = fs.readFileSync(filepath, 'utf8');
        
        // Extract migration ID from filename
        const id = filename.split('_')[0];
        
        migrations.push({
          id,
          filename,
          filepath,
          sql,
        });
      }

      console.log(`📁 Loaded ${migrations.length} migration files`);
      return migrations;
    } catch (error) {
      console.error('❌ Failed to load migration files:', error.message);
      throw error;
    }
  }

  async getExecutedMigrations() {
    try {
      const result = await this.pool.query(
        'SELECT id, filename, executed_at, checksum FROM schema_migrations ORDER BY id'
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get executed migrations:', error.message);
      throw error;
    }
  }

  calculateChecksum(sql) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  async executeMigration(migration) {
    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');

      console.log(`🔄 Executing migration: ${migration.filename}`);
      
      // Execute migration SQL
      await client.query(migration.sql);

      // Record migration execution
      const checksum = this.calculateChecksum(migration.sql);
      const executionTime = Date.now() - startTime;

      await client.query(
        `INSERT INTO schema_migrations (id, filename, checksum, execution_time_ms) 
         VALUES ($1, $2, $3, $4)`,
        [migration.id, migration.filename, checksum, executionTime]
      );

      await client.query('COMMIT');

      console.log(`✅ Migration ${migration.filename} completed (${executionTime}ms)`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Migration ${migration.filename} failed:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  verifyMigrationIntegrity(migration, executed) {
    const currentChecksum = this.calculateChecksum(migration.sql);
    
    if (currentChecksum !== executed.checksum) {
      console.error(`❌ Migration integrity check failed for ${migration.filename}`);
      return false;
    }

    return true;
  }

  async migrate() {
    try {
      console.log('🚀 Starting database migration process');

      // Initialize migration tracking
      await this.initializeMigrationTable();

      // Load migrations
      const migrations = this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      // Create a map of executed migrations for quick lookup
      const executedMap = new Map(
        executedMigrations.map(m => [m.id, m])
      );

      let pendingCount = 0;
      let verifiedCount = 0;

      for (const migration of migrations) {
        const executed = executedMap.get(migration.id);

        if (executed) {
          // Verify integrity of already executed migration
          if (!this.verifyMigrationIntegrity(migration, executed)) {
            throw new Error(`Migration integrity verification failed for ${migration.filename}`);
          }
          verifiedCount++;
          console.log(`✓ Migration ${migration.filename} already executed and verified`);
        } else {
          // Execute pending migration
          await this.executeMigration(migration);
          pendingCount++;
        }
      }

      console.log('\n🎉 Database migration completed successfully!');
      console.log(`📊 Total migrations: ${migrations.length}`);
      console.log(`▶️  Executed: ${pendingCount}`);
      console.log(`✅ Verified: ${verifiedCount}`);

    } catch (error) {
      console.error('💥 Database migration failed:', error.message);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

// Run migrations
async function main() {
  const migrator = new SimpleMigrator();

  try {
    await migrator.migrate();
  } catch (error) {
    console.error('Migration process failed:', error.message);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = SimpleMigrator;