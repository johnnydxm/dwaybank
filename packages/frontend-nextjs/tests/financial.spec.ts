import { test, expect } from '@playwright/test';

/**
 * DwayBank Financial Operations End-to-End Tests
 * 
 * CRITICAL FINANCIAL SYSTEM FOCUS AREAS:
 * - Authentication & Authorization: Multi-factor authentication, session management, role-based access
 * - Payment Processing: Transaction validation, balance calculations, fraud detection
 * - Account Management: Account lifecycle, balance updates, interest calculations
 * - Compliance & Audit: Regulatory reporting, audit trails, data protection
 * - Security Controls: Encryption, tokenization, secure communication
 * 
 * FINANCIAL TESTING PRIORITY:
 * 1. Critical Financial Paths: Payment processing, account operations, balance calculations
 * 2. Security Components: Authentication, authorization, data protection
 * 3. API Endpoints: All REST endpoints with comprehensive scenario coverage
 * 4. Database Operations: Transaction integrity, data consistency, rollback scenarios
 * 5. User Interfaces: Accessibility, usability, cross-browser compatibility
 */

test.describe('DwayBank Financial Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Complete authentication before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForTimeout(3000); // Wait for login to complete
  });

  test.describe('Account Information Display', () => {
    test('should display accurate account balances', async ({ page }) => {
      // Verify we're on dashboard
      await expect(page.locator('body')).toContainText(['Dashboard', 'Account']);
      
      // Verify primary checking account
      await expect(page.locator('body')).toContainText(['Primary Checking']);
      await expect(page.locator('body')).toContainText(['2500.75', '2,500.75']);
      
      // Verify savings account
      await expect(page.locator('body')).toContainText(['Emergency Savings', 'Savings']);
      await expect(page.locator('body')).toContainText(['10000.00', '10,000.00']);
      
      // Verify account numbers are masked
      await expect(page.locator('body')).toContainText(['****1234', '****5678']);
      
      // Verify currency display
      await expect(page.locator('body')).toContainText(['USD', '$']);
    });

    test('should show account status correctly', async ({ page }) => {
      // Verify accounts are marked as active
      await expect(page.locator('body')).toContainText(['active', 'Active']);
      
      // Verify primary account designation
      await expect(page.locator('body')).toContainText(['Primary', 'primary']);
    });

    test('should calculate total portfolio value', async ({ page }) => {
      // Total should be $12,500.75 (2500.75 + 10000.00)
      const expectedTotal = 12500.75;
      
      // Look for total balance display
      await expect(page.locator('body')).toContainText(['Total', 'Portfolio', 'Net Worth']);
      
      // Verify the calculated total appears somewhere
      await expect(page.locator('body')).toContainText(['12500.75', '12,500.75']);
    });
  });

  test.describe('Financial Data Accuracy', () => {
    test('should display precise decimal calculations', async ({ page }) => {
      // Verify exact amounts with proper decimal precision
      const checkingBalance = page.locator('text=2500.75, text=2,500.75');
      const savingsBalance = page.locator('text=10000.00, text=10,000.00');
      
      await expect(checkingBalance).toBeVisible();
      await expect(savingsBalance).toBeVisible();
    });

    test('should handle currency formatting correctly', async ({ page }) => {
      // Verify proper currency formatting
      await expect(page.locator('body')).toContainText(['$2,500.75', '$10,000.00']);
      
      // Verify no invalid currency displays
      const invalidCurrency = page.locator('text=NaN, text=undefined, text=null');
      await expect(invalidCurrency).toHaveCount(0);
    });

    test('should validate available balance calculations', async ({ page }) => {
      // Available balance should match actual balance for active accounts
      await expect(page.locator('body')).toContainText(['Available']);
      
      // Verify available balance matches current balance
      await expect(page.locator('body')).toContainText(['2500.75']);
      await expect(page.locator('body')).toContainText(['10000.00']);
    });
  });

  test.describe('Security and Data Protection', () => {
    test('should mask sensitive account information', async ({ page }) => {
      // Verify account numbers are properly masked
      await expect(page.locator('body')).toContainText(['****1234']);
      await expect(page.locator('body')).toContainText(['****5678']);
      
      // Verify full account numbers are not exposed
      const fullAccountNumbers = page.locator('text=12345678, text=87654321');
      await expect(fullAccountNumbers).toHaveCount(0);
    });

    test('should require authentication for financial data', async ({ page }) => {
      // Clear authentication
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Try to access financial data
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);
      
      // Should be redirected to login
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(login|auth|signin)/);
    });

    test('should protect against unauthorized access', async ({ page }) => {
      // Attempt to access protected financial endpoints directly
      const response = await page.request.get('/api/v1/accounts');
      
      // Should require authentication
      expect(response.status()).toBe(401);
    });
  });

  test.describe('API Integration and Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept and fail API requests
      await page.route('**/api/v1/accounts', route => route.abort());
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should show error state
      await expect(page.locator('body')).toContainText(['Error', 'Unable to load', 'Try again']);
    });

    test('should retry failed requests', async ({ page }) => {
      let requestCount = 0;
      
      // Intercept and fail first request, succeed on retry
      await page.route('**/api/v1/accounts', route => {
        requestCount++;
        if (requestCount === 1) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Should eventually show data after retry
      await expect(page.locator('body')).toContainText(['2500.75']);
    });

    test('should validate API response structure', async ({ page }) => {
      // Intercept API request to verify structure
      let apiResponse = null;
      
      await page.route('**/api/v1/accounts', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              accounts: [
                {
                  id: 'test_acc_1',
                  account_number: '****9999',
                  account_type: 'checking',
                  account_name: 'Test Account',
                  balance: 1000.00,
                  available_balance: 1000.00,
                  currency: 'USD',
                  status: 'active',
                  is_primary: true
                }
              ]
            },
            timestamp: new Date().toISOString()
          })
        });
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should display the test account data
      await expect(page.locator('body')).toContainText(['Test Account']);
      await expect(page.locator('body')).toContainText(['1000.00', '1,000.00']);
    });
  });

  test.describe('Financial Calculations and Validation', () => {
    test('should handle zero balance accounts', async ({ page }) => {
      // Mock account with zero balance
      await page.route('**/api/v1/accounts', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              accounts: [
                {
                  id: 'zero_balance',
                  account_number: '****0000',
                  account_type: 'checking',
                  account_name: 'Zero Balance Account',
                  balance: 0.00,
                  available_balance: 0.00,
                  currency: 'USD',
                  status: 'active',
                  is_primary: true
                }
              ]
            }
          })
        });
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should display zero balance correctly
      await expect(page.locator('body')).toContainText(['0.00']);
      await expect(page.locator('body')).toContainText(['Zero Balance Account']);
    });

    test('should handle large balance amounts', async ({ page }) => {
      // Mock account with large balance
      await page.route('**/api/v1/accounts', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              accounts: [
                {
                  id: 'large_balance',
                  account_number: '****7777',
                  account_type: 'savings',
                  account_name: 'High Value Account',
                  balance: 1234567.89,
                  available_balance: 1234567.89,
                  currency: 'USD',
                  status: 'active',
                  is_primary: false
                }
              ]
            }
          })
        });
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should format large numbers correctly
      await expect(page.locator('body')).toContainText(['1,234,567.89']);
      await expect(page.locator('body')).toContainText(['High Value Account']);
    });

    test('should handle negative balances appropriately', async ({ page }) => {
      // Mock account with negative balance (overdraft)
      await page.route('**/api/v1/accounts', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              accounts: [
                {
                  id: 'negative_balance',
                  account_number: '****9999',
                  account_type: 'checking',
                  account_name: 'Overdraft Account',
                  balance: -150.50,
                  available_balance: -150.50,
                  currency: 'USD',
                  status: 'active',
                  is_primary: true
                }
              ]
            }
          })
        });
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should display negative balance with proper formatting
      await expect(page.locator('body')).toContainText(['-150.50', '($150.50)', '-$150.50']);
      await expect(page.locator('body')).toContainText(['Overdraft']);
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should load financial data within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/dashboard');
      await page.waitForSelector('text=2500.75, text=2,500.75'); // Wait for balance to load
      
      const loadTime = Date.now() - startTime;
      
      // Financial data should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle concurrent financial data requests', async ({ page }) => {
      // Simulate multiple rapid navigation
      await page.goto('/dashboard');
      await page.goto('/');
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);
      
      // Should still display correct financial data
      await expect(page.locator('body')).toContainText(['2500.75']);
      await expect(page.locator('body')).toContainText(['10000.00']);
    });

    test('should maintain data consistency across page refreshes', async ({ page }) => {
      // Load initial data
      await expect(page.locator('body')).toContainText(['2500.75']);
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Should still show same data
      await expect(page.locator('body')).toContainText(['2500.75']);
      await expect(page.locator('body')).toContainText(['10000.00']);
    });
  });

  test.describe('Accessibility for Financial Information', () => {
    test('should provide screen reader accessible financial data', async ({ page }) => {
      // Check for proper ARIA labels on financial information
      const balanceElements = page.locator('[aria-label*="balance"], [aria-label*="Balance"]');
      await expect(balanceElements.first()).toBeVisible();
      
      // Check for semantic structure
      await expect(page.locator('table, [role="table"]')).toBeVisible();
    });

    test('should support keyboard navigation of financial data', async ({ page }) => {
      // Use tab to navigate through financial information
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to access all interactive elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});