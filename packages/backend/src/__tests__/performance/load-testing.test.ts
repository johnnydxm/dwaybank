/**
 * Comprehensive Load Testing and Performance Validation
 * Testing system performance under realistic financial operation loads
 */

import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../../app';
import { performance } from 'perf_hooks';

describe('Load Testing and Performance Validation', () => {
  let app: any;
  let server: any;
  let pool: Pool;

  const testUsers = Array(50).fill(null).map((_, index) => ({
    email: `loadtest${index}@dwaybank.com`,
    username: `loadtest${index}`,
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: `Test${index}`,
  }));

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'dwaybank_test',
      user: process.env.DB_USER || 'dwaybank_test',
      password: process.env.DB_PASSWORD || 'test_password',
      max: 20, // Increased pool size for load testing
    });

    app = await createApp();
    server = app.listen(0);
  });

  afterAll(async () => {
    // Cleanup test users
    const emails = testUsers.map(user => user.email);
    await pool.query(
      'DELETE FROM users WHERE email = ANY($1::text[])',
      [emails]
    );
    
    await pool.end();
    server.close();
  });

  describe('Authentication Performance', () => {
    it('should handle concurrent user registrations', async () => {
      const startTime = performance.now();
      
      // Register users concurrently
      const registrationPromises = testUsers.map(user =>
        request(app)
          .post('/api/auth/register')
          .send(user)
      );

      const responses = await Promise.all(registrationPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // All registrations should succeed
      const successCount = responses.filter(r => r.status === 201).length;
      expect(successCount).toBe(testUsers.length);

      // Average response time should be reasonable
      const avgResponseTime = duration / testUsers.length;
      expect(avgResponseTime).toBeLessThan(200); // Less than 200ms per request

      console.log(`Registration Load Test Results:
        - Total Time: ${duration.toFixed(2)}ms
        - Average Response Time: ${avgResponseTime.toFixed(2)}ms
        - Successful Registrations: ${successCount}/${testUsers.length}
        - Throughput: ${(testUsers.length / (duration / 1000)).toFixed(2)} requests/second`);
    });

    it('should handle concurrent login attempts', async () => {
      // First ensure users are registered
      for (const user of testUsers.slice(0, 20)) {
        await request(app)
          .post('/api/auth/register')
          .send(user);
      }

      const startTime = performance.now();
      
      // Perform concurrent logins
      const loginPromises = testUsers.slice(0, 20).map(user =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.password,
          })
      );

      const responses = await Promise.all(loginPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(20);

      const avgResponseTime = duration / 20;
      expect(avgResponseTime).toBeLessThan(250); // Less than 250ms per login

      console.log(`Login Load Test Results:
        - Total Time: ${duration.toFixed(2)}ms
        - Average Response Time: ${avgResponseTime.toFixed(2)}ms
        - Successful Logins: ${successCount}/20
        - Throughput: ${(20 / (duration / 1000)).toFixed(2)} requests/second`);
    });

    it('should maintain performance under authentication load', async () => {
      // Simulate mixed authentication traffic
      const operations = [];
      
      // 60% logins, 30% registrations, 10% token refreshes
      for (let i = 0; i < 100; i++) {
        const rand = Math.random();
        
        if (rand < 0.6) {
          // Login
          const user = testUsers[i % testUsers.length];
          operations.push({
            type: 'login',
            request: () => request(app)
              .post('/api/auth/login')
              .send({
                email: user.email,
                password: user.password,
              })
          });
        } else if (rand < 0.9) {
          // Registration
          const user = {
            email: `mixed${i}@dwaybank.com`,
            username: `mixed${i}`,
            password: 'MixedTest123!',
            firstName: 'Mixed',
            lastName: `Test${i}`,
          };
          operations.push({
            type: 'register',
            request: () => request(app)
              .post('/api/auth/register')
              .send(user)
          });
        } else {
          // Token refresh (mock for now)
          operations.push({
            type: 'refresh',
            request: () => request(app)
              .post('/api/auth/refresh')
              .send({ refreshToken: 'mock-token' })
          });
        }
      }

      const startTime = performance.now();
      
      // Execute operations in batches to simulate realistic load
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        batches.push(batch);
      }

      for (const batch of batches) {
        const batchPromises = batch.map(op => op.request());
        await Promise.all(batchPromises);
        
        // Small delay between batches to simulate realistic traffic
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`Mixed Authentication Load Results:
        - Total Operations: ${operations.length}
        - Total Time: ${duration.toFixed(2)}ms
        - Average Time per Operation: ${(duration / operations.length).toFixed(2)}ms
        - Throughput: ${(operations.length / (duration / 1000)).toFixed(2)} operations/second`);
    });
  });

  describe('Database Performance', () => {
    it('should handle concurrent database queries efficiently', async () => {
      // Create test data
      const testData = Array(100).fill(null).map((_, index) => ({
        email: `dbtest${index}@dwaybank.com`,
        username: `dbtest${index}`,
        hashedPassword: '$2b$10$test.hash.for.testing.purposes',
      }));

      const startTime = performance.now();

      // Insert test data concurrently
      const insertPromises = testData.map(data =>
        pool.query(
          'INSERT INTO users (email, username, password_hash, is_email_verified) VALUES ($1, $2, $3, true)',
          [data.email, data.username, data.hashedPassword]
        )
      );

      await Promise.all(insertPromises);

      // Query test data concurrently
      const queryPromises = testData.map(data =>
        pool.query('SELECT * FROM users WHERE email = $1', [data.email])
      );

      const queryResults = await Promise.all(queryPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(queryResults.every(result => result.rows.length === 1)).toBe(true);

      const avgQueryTime = duration / (testData.length * 2); // Insert + query
      expect(avgQueryTime).toBeLessThan(50); // Less than 50ms per operation

      console.log(`Database Performance Results:
        - Total Operations: ${testData.length * 2} (insert + query)
        - Total Time: ${duration.toFixed(2)}ms
        - Average Operation Time: ${avgQueryTime.toFixed(2)}ms
        - Database Throughput: ${((testData.length * 2) / (duration / 1000)).toFixed(2)} ops/second`);

      // Cleanup
      await pool.query(
        'DELETE FROM users WHERE email = ANY($1::text[])',
        [testData.map(d => d.email)]
      );
    });

    it('should maintain connection pool efficiency', async () => {
      const connectionTests = Array(50).fill(null).map(async (_, index) => {
        const client = await pool.connect();
        
        try {
          const startTime = performance.now();
          const result = await client.query('SELECT NOW(), $1 as test_id', [index]);
          const endTime = performance.now();
          
          return {
            testId: index,
            duration: endTime - startTime,
            success: result.rows.length === 1,
          };
        } finally {
          client.release();
        }
      });

      const results = await Promise.all(connectionTests);
      
      expect(results.every(r => r.success)).toBe(true);
      
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(100); // Less than 100ms per connection

      console.log(`Connection Pool Performance:
        - Concurrent Connections: ${results.length}
        - Average Connection Time: ${avgDuration.toFixed(2)}ms
        - All Connections Successful: ${results.every(r => r.success)}`);
    });
  });

  describe('API Endpoint Performance', () => {
    let authenticatedUser: any;

    beforeAll(async () => {
      // Create and authenticate test user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUsers[0]);
      
      authenticatedUser = {
        ...registerResponse.body.user,
        tokens: registerResponse.body.tokens,
      };
    });

    it('should handle high-frequency profile requests', async () => {
      const requestCount = 100;
      const startTime = performance.now();

      const profilePromises = Array(requestCount).fill(null).map(() =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${authenticatedUser.tokens.accessToken}`)
      );

      const responses = await Promise.all(profilePromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(requestCount);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      const avgResponseTime = duration / requestCount;
      expect(avgResponseTime).toBeLessThan(50); // Less than 50ms per request

      console.log(`Profile API Performance:
        - Total Requests: ${requestCount}
        - Successful Requests: ${successCount}
        - Total Time: ${duration.toFixed(2)}ms
        - Average Response Time: ${avgResponseTime.toFixed(2)}ms
        - Throughput: ${(requestCount / (duration / 1000)).toFixed(2)} requests/second`);
    });

    it('should maintain performance under mixed API load', async () => {
      const operations = [
        // Profile requests (40%)
        ...Array(40).fill(() => 
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${authenticatedUser.tokens.accessToken}`)
        ),
        // Password changes (20%)
        ...Array(20).fill(() =>
          request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${authenticatedUser.tokens.accessToken}`)
            .send({
              currentPassword: testUsers[0].password,
              newPassword: 'NewPassword123!',
            })
        ),
        // Session listings (20%)
        ...Array(20).fill(() =>
          request(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${authenticatedUser.tokens.accessToken}`)
        ),
        // Health checks (20%)
        ...Array(20).fill(() =>
          request(app).get('/api/health')
        ),
      ];

      const startTime = performance.now();

      // Execute in batches
      const batchSize = 20;
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchPromises = batch.map(op => op());
        await Promise.all(batchPromises);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Mixed API Load Performance:
        - Total Operations: ${operations.length}
        - Total Time: ${duration.toFixed(2)}ms
        - Average Operation Time: ${(duration / operations.length).toFixed(2)}ms
        - Throughput: ${(operations.length / (duration / 1000)).toFixed(2)} operations/second`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const operations = Array(200).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `memory${index}@dwaybank.com`,
            username: `memory${index}`,
            password: 'MemoryTest123!',
            firstName: 'Memory',
            lastName: `Test${index}`,
          })
      );

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(200); // Less than 200% increase

      console.log(`Memory Usage Analysis:
        - Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)
        - RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB
        - External: ${(finalMemory.external / 1024 / 1024).toFixed(2)} MB`);

      // Cleanup
      const emails = operations.map((_, index) => `memory${index}@dwaybank.com`);
      await pool.query(
        'DELETE FROM users WHERE email = ANY($1::text[])',
        [emails]
      );
    });

    it('should handle resource cleanup efficiently', async () => {
      const resourceTests = Array(50).fill(null).map(async (_, index) => {
        const startTime = performance.now();
        
        // Create and immediately cleanup resources
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `cleanup${index}@dwaybank.com`,
            username: `cleanup${index}`,
            password: 'CleanupTest123!',
            firstName: 'Cleanup',
            lastName: `Test${index}`,
          });

        if (response.status === 201) {
          // Immediately logout to cleanup session
          await request(app)
            .post('/api/auth/logout')
            .send({ refreshToken: response.body.tokens.refreshToken });
        }

        const endTime = performance.now();
        return endTime - startTime;
      });

      const durations = await Promise.all(resourceTests);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      
      expect(avgDuration).toBeLessThan(500); // Less than 500ms per cleanup cycle

      console.log(`Resource Cleanup Performance:
        - Test Cycles: ${durations.length}
        - Average Cycle Time: ${avgDuration.toFixed(2)}ms
        - Min Time: ${Math.min(...durations).toFixed(2)}ms
        - Max Time: ${Math.max(...durations).toFixed(2)}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain stability under extreme load', async () => {
      const extremeLoadCount = 500;
      const startTime = performance.now();

      // Create extreme load with mixed operations
      const stressOperations = [];
      
      for (let i = 0; i < extremeLoadCount; i++) {
        const operationType = i % 4;
        
        switch (operationType) {
          case 0: // Registration
            stressOperations.push(
              request(app)
                .post('/api/auth/register')
                .send({
                  email: `stress${i}@dwaybank.com`,
                  username: `stress${i}`,
                  password: 'StressTest123!',
                  firstName: 'Stress',
                  lastName: `Test${i}`,
                })
            );
            break;
          case 1: // Login attempt
            stressOperations.push(
              request(app)
                .post('/api/auth/login')
                .send({
                  email: `nonexistent${i}@dwaybank.com`,
                  password: 'password',
                })
            );
            break;
          case 2: // Health check
            stressOperations.push(
              request(app).get('/api/health')
            );
            break;
          case 3: // Invalid request
            stressOperations.push(
              request(app)
                .post('/api/auth/invalid-endpoint')
                .send({ invalid: 'data' })
            );
            break;
        }
      }

      // Execute stress test in controlled batches
      const batchSize = 50;
      const results = [];
      
      for (let i = 0; i < stressOperations.length; i += batchSize) {
        const batchStartTime = performance.now();
        const batch = stressOperations.slice(i, i + batchSize);
        
        try {
          const batchResponses = await Promise.all(batch);
          const batchEndTime = performance.now();
          const batchDuration = batchEndTime - batchStartTime;
          
          results.push({
            batchIndex: Math.floor(i / batchSize),
            duration: batchDuration,
            successCount: batchResponses.filter(r => r.status < 500).length,
            totalCount: batch.length,
          });
          
          // Brief pause between batches to allow system recovery
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Batch ${Math.floor(i / batchSize)} failed:`, error);
        }
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // System should remain stable (no complete failures)
      const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
      const totalRequests = results.reduce((sum, r) => sum + r.totalCount, 0);
      const successRate = (totalSuccess / totalRequests) * 100;

      expect(successRate).toBeGreaterThan(80); // At least 80% success rate under stress
      expect(totalDuration).toBeLessThan(60000); // Should complete within 60 seconds

      console.log(`Extreme Load Stress Test Results:
        - Total Operations: ${totalRequests}
        - Successful Operations: ${totalSuccess}
        - Success Rate: ${successRate.toFixed(2)}%
        - Total Duration: ${totalDuration.toFixed(2)}ms
        - Average Batch Time: ${(results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(2)}ms
        - Overall Throughput: ${(totalRequests / (totalDuration / 1000)).toFixed(2)} ops/second`);

      // System should still be responsive after stress test
      const healthCheck = await request(app).get('/api/health');
      expect(healthCheck.status).toBe(200);
    });
  });
});