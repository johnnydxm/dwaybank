#!/usr/bin/env ts-node

/**
 * DwayBank Database Migration Runner
 * Executes SQL migrations in order and tracks migration state
 */

import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import logger from '../src/config/logger';
import { config } from '../src/config/environment';

interface Migration {
  id: string;
  filename: string;
  filepath: string;
  sql: string;
}

interface MigrationRecord {
  id: string;
  filename: string;
  executed_at: Date;
  checksum: string;
}

class DatabaseMigrator {
  private pool: Pool;
  private migrationsPath: string;

  constructor() {
    // Create connection pool for migrations
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA || undefined,
        cert: process.env.DB_SSL_CERT || undefined,
        key: process.env.DB_SSL_KEY || undefined,
        minVersion: 'TLSv1.2',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
        secureProtocol: 'TLSv1_2_method'
      } : false,
      max: 5, // Reduced pool size for migrations
    });

    this.migrationsPath = resolve(__dirname, 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  private async initializeMigrationTable(): Promise<void> {
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
      logger.info('Migration tracking table initialized');
    } catch (error) {
      logger.error('Failed to initialize migration table', { error });
      throw error;
    }
  }

  /**
   * Load all migration files
   */
  private loadMigrations(): Migration[] {
    const migrations: Migration[] = [];

    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure proper order

      for (const filename of files) {
        const filepath = join(this.migrationsPath, filename);
        const sql = readFileSync(filepath, 'utf8');
        
        // Extract migration ID from filename (e.g., "001_create_users_table.sql" -> "001")
        const id = filename.split('_')[0];
        
        migrations.push({
          id,
          filename,
          filepath,
          sql,
        });
      }

      logger.info(`Loaded ${migrations.length} migration files`);
      return migrations;
    } catch (error) {
      logger.error('Failed to load migration files', { error });
      throw error;
    }
  }

  /**
   * Get executed migrations from database
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await this.pool.query(
        'SELECT id, filename, executed_at, checksum FROM schema_migrations ORDER BY id'
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to get executed migrations', { error });
      throw error;
    }
  }

  /**
   * Calculate SQL checksum for integrity verification
   */
  private calculateChecksum(sql: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');

      logger.info(`Executing migration: ${migration.filename}`);
      
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

      logger.info(`Migration ${migration.filename} completed successfully`, {
        executionTime: `${executionTime}ms`,
        checksum: checksum.substring(0, 8) + '...',
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration ${migration.filename} failed`, { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify migration integrity
   */
  private verifyMigrationIntegrity(
    migration: Migration, 
    executed: MigrationRecord
  ): boolean {
    const currentChecksum = this.calculateChecksum(migration.sql);
    
    if (currentChecksum !== executed.checksum) {
      logger.error(`Migration integrity check failed for ${migration.filename}`, {
        expectedChecksum: executed.checksum,
        actualChecksum: currentChecksum,
      });
      return false;
    }

    return true;
  }

  /**
   * Run all pending migrations
   */
  public async migrate(): Promise<void> {
    try {
      logger.info('Starting database migration process');

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
          logger.debug(`Migration ${migration.filename} already executed and verified`);
        } else {
          // Execute pending migration
          await this.executeMigration(migration);
          pendingCount++;
        }
      }

      // Check for orphaned migrations in database
      for (const executed of executedMigrations) {
        const migration = migrations.find(m => m.id === executed.id);
        if (!migration) {
          logger.warn(`Orphaned migration found in database: ${executed.filename}`, {
            executedAt: executed.executed_at,
          });
        }
      }

      logger.info('Database migration completed successfully', {
        totalMigrations: migrations.length,
        executed: pendingCount,
        verified: verifiedCount,
        skipped: migrations.length - pendingCount - verifiedCount,
      });

    } catch (error) {
      logger.error('Database migration failed', { error });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  public async getStatus(): Promise<void> {
    try {
      const migrations = this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      console.log('\n🗃️  Database Migration Status\n');
      console.log('Migration ID | Filename                    | Status    | Executed At');
      console.log('-------------|-----------------------------|-----------|--------------------------');

      const executedMap = new Map(
        executedMigrations.map(m => [m.id, m])
      );

      for (const migration of migrations) {
        const executed = executedMap.get(migration.id);
        const status = executed ? '✅ Applied' : '⏳ Pending';
        const executedAt = executed 
          ? executed.executed_at.toISOString().substring(0, 19).replace('T', ' ')
          : 'Not executed';

        console.log(
          `${migration.id.padEnd(12)} | ${migration.filename.padEnd(27)} | ${status.padEnd(9)} | ${executedAt}`
        );
      }

      console.log(`\nTotal migrations: ${migrations.length}`);
      console.log(`Applied: ${executedMigrations.length}`);
      console.log(`Pending: ${migrations.length - executedMigrations.length}\n`);

    } catch (error) {
      logger.error('Failed to get migration status', { error });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI interface
async function main(): Promise<void> {
  const migrator = new DatabaseMigrator();
  const command = process.argv[2] || 'migrate';

  try {
    switch (command) {
      case 'migrate':
        await migrator.migrate();
        break;
      
      case 'status':
        await migrator.getStatus();
        break;
      
      case 'help':
        console.log(`
DwayBank Database Migrator

Usage:
  npm run migrate          Run pending migrations
  npm run migrate status   Show migration status
  npm run migrate help     Show this help message

Environment Variables:
  DB_HOST     - Database host (default: localhost)
  DB_PORT     - Database port (default: 5432)
  DB_NAME     - Database name
  DB_USER     - Database user
  DB_PASSWORD - Database password
        `);
        break;
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "npm run migrate help" for usage information');
        process.exit(1);
    }

  } catch (error) {
    logger.error('Migration process failed', { error });
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

export default DatabaseMigrator;