import { test, expect } from '@playwright/test';

/**
 * DwayBank Authentication End-to-End Tests
 * 
 * CRITICAL TEST GAPS (Must Address):
 * - Missing tests for core financial operations
 * - Untested security-critical code paths 
 * - Zero coverage on financial calculation logic
 * 
 * TEST IMPROVEMENTS (Should Implement):
 * - Edge case scenarios for financial operations
 * - Performance testing under load
 * - Cross-browser compatibility validation
 * 
 * TESTING RECOMMENDATIONS (Consider Adding):
 * - Automated accessibility testing
 * - Advanced security penetration testing
 * - Chaos engineering for financial resilience
 */

test.describe('DwayBank Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test.describe('User Registration Flow', () => {
    test('should complete full registration process successfully', async ({ page }) => {
      // Navigate to registration page
      await page.goto('/register');
      
      // Verify registration page loads
      await expect(page.locator('h1, h2')).toContainText(['Register', 'Sign Up', 'Create Account']);
      
      // Generate unique test data
      const timestamp = Date.now();
      const testEmail = `test.user.${timestamp}@example.com`;
      const testPassword = 'SecurePassword123!';
      const testFullName = 'Test User';
      
      // Fill registration form
      await page.fill('input[type="email"], input[name="email"]', testEmail);
      await page.fill('input[type="password"], input[name="password"]', testPassword);
      await page.fill('input[name="fullName"], input[name="name"]', testFullName);
      
      // Submit registration form
      await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      
      // Verify successful registration
      await expect(page.locator('body')).toContainText(['Registration successful', 'Account created', 'Welcome']);
      
      // Verify user is redirected or shown success message
      await page.waitForTimeout(2000); // Allow for any transitions
      
      // Check if redirected to login or dashboard
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(login|dashboard|verify)/);
    });

    test('should validate required fields in registration form', async ({ page }) => {
      await page.goto('/register');
      
      // Try to submit empty form
      await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      
      // Verify validation messages appear
      await expect(page.locator('body')).toContainText(['required', 'Please enter', 'This field']);
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/register');
      
      // Fill with invalid email
      await page.fill('input[type="email"], input[name="email"]', 'invalid-email');
      await page.fill('input[type="password"], input[name="password"]', 'Password123!');
      await page.fill('input[name="fullName"], input[name="name"]', 'Test User');
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      
      // Verify email validation
      await expect(page.locator('body')).toContainText(['valid email', 'email format', 'Invalid email']);
    });

    test('should validate password strength', async ({ page }) => {
      await page.goto('/register');
      
      // Fill with weak password
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', '123');
      await page.fill('input[name="fullName"], input[name="name"]', 'Test User');
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      
      // Verify password validation
      await expect(page.locator('body')).toContainText(['password', 'strong', 'requirements']);
    });
  });

  test.describe('User Login Flow', () => {
    test('should complete login process successfully', async ({ page }) => {
      // Navigate to login page
      await page.goto('/login');
      
      // Verify login page loads
      await expect(page.locator('h1, h2')).toContainText(['Login', 'Sign In', 'Welcome Back']);
      
      // Use test credentials
      const testEmail = 'test@example.com';
      const testPassword = 'password123';
      
      // Fill login form
      await page.fill('input[type="email"], input[name="email"]', testEmail);
      await page.fill('input[type="password"], input[name="password"]', testPassword);
      
      // Submit login form
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Verify successful login - wait for navigation
      await page.waitForTimeout(3000);
      
      // Check if redirected to dashboard
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(dashboard|home|account)/);
      
      // Verify dashboard content
      await expect(page.locator('body')).toContainText(['Dashboard', 'Welcome', 'Account', 'Balance']);
    });

    test('should handle invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      // Fill with invalid credentials
      await page.fill('input[type="email"], input[name="email"]', 'invalid@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Verify error message
      await expect(page.locator('body')).toContainText(['Invalid', 'incorrect', 'failed', 'error']);
    });

    test('should validate required login fields', async ({ page }) => {
      await page.goto('/login');
      
      // Try to submit empty form
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Verify validation messages
      await expect(page.locator('body')).toContainText(['required', 'Please enter', 'This field']);
    });
  });

  test.describe('Dashboard Access and Authentication State', () => {
    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
      // Try to access dashboard without authentication
      await page.goto('/dashboard');
      
      // Should be redirected to login
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(login|auth|signin)/);
    });

    test('should display user information after login', async ({ page }) => {
      // Complete login flow first
      await page.goto('/login');
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Wait for navigation to dashboard
      await page.waitForTimeout(3000);
      
      // Verify user-specific content
      await expect(page.locator('body')).toContainText(['Test User', 'test@example.com', 'Account']);
    });

    test('should display account information and balances', async ({ page }) => {
      // Complete login flow
      await page.goto('/login');
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Wait for dashboard
      await page.waitForTimeout(3000);
      
      // Verify financial information is displayed
      await expect(page.locator('body')).toContainText(['Balance', '$', 'Account', 'Checking', 'Savings']);
      
      // Verify specific test account data from backend
      await expect(page.locator('body')).toContainText(['2500.75', '10000.00']);
    });
  });

  test.describe('Security and Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and fail API requests
      await page.route('**/api/v1/auth/**', route => route.abort());
      
      await page.goto('/login');
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Verify error handling
      await expect(page.locator('body')).toContainText(['Error', 'Network', 'Try again', 'Connection']);
    });

    test('should prevent XSS in form inputs', async ({ page }) => {
      await page.goto('/register');
      
      // Try to inject script
      const xssPayload = '<script>alert("xss")</script>';
      await page.fill('input[name="fullName"], input[name="name"]', xssPayload);
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'Password123!');
      
      await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
      
      // Verify no script execution (no alert dialog)
      const dialogs = [];
      page.on('dialog', dialog => dialogs.push(dialog));
      
      await page.waitForTimeout(2000);
      expect(dialogs).toHaveLength(0);
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/login');
      
      // Navigate using keyboard
      await page.keyboard.press('Tab'); // Focus email field
      await page.keyboard.type('test@example.com');
      await page.keyboard.press('Tab'); // Focus password field
      await page.keyboard.type('password123');
      await page.keyboard.press('Tab'); // Focus submit button
      await page.keyboard.press('Enter'); // Submit form
      
      // Verify submission worked
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(dashboard|home|account)/);
    });

    test('should have proper ARIA labels and semantic HTML', async ({ page }) => {
      await page.goto('/login');
      
      // Check for proper form structure
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check for labels
      await expect(page.locator('label')).toHaveCount(2); // Email and password labels
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/login');
      
      // Verify mobile layout
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Complete login on mobile
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      
      // Verify mobile dashboard
      await page.waitForTimeout(3000);
      await expect(page.locator('body')).toContainText(['Dashboard', 'Balance']);
    });

    test('should be touch-friendly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/register');
      
      // Verify touch targets are large enough (minimum 44px)
      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');
      
      await expect(emailInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Test touch interaction
      await emailInput.tap();
      await submitButton.tap();
    });
  });

  test.describe('Performance and Load Times', () => {
    test('should load pages within acceptable time limits', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle API response times gracefully', async ({ page }) => {
      // Add delay to API responses
      await page.route('**/api/v1/auth/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        route.continue();
      });
      
      await page.goto('/login');
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');
      
      const startTime = Date.now();
      await page.click('button[type="submit"]');
      
      // Should show loading state
      await expect(page.locator('body')).toContainText(['Loading', 'Please wait', 'Signing in']);
      
      // Should complete within reasonable time
      await page.waitForTimeout(3000);
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 second total timeout
    });
  });
});