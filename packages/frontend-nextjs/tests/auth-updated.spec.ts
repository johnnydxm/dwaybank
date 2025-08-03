import { test, expect } from '@playwright/test';

/**
 * DwayBank Authentication End-to-End Tests - Updated for Real Implementation
 * 
 * CRITICAL TEST GAPS (Must Address):
 * - Missing tests for core financial operations
 * - Untested security-critical code paths 
 * - Zero coverage on financial calculation logic
 * 
 * Quality Standards for Financial Testing:
 * - Accuracy First: All financial calculations must have 100% test coverage
 * - Security Focus: Authentication and authorization thoroughly validated
 * - Compliance Ready: Regulatory requirements completely tested
 * - Performance Validated: System performance under realistic financial loads
 * - Edge Case Covered: Boundary conditions and error scenarios tested
 */

test.describe('DwayBank Authentication Flow - Updated', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test.describe('User Registration Flow', () => {
    test('should complete full registration process successfully', async ({ page }) => {
      // Navigate to registration page
      await page.goto('/register');
      
      // Verify registration page loads with correct heading
      await expect(page.locator('h1')).toContainText('DwayBank');
      await expect(page.locator('text=Create your account')).toBeVisible();
      
      // Generate unique test data
      const timestamp = Date.now();
      const testEmail = `test.user.${timestamp}@example.com`;
      const testPassword = 'SecurePassword123!';
      
      // Fill registration form
      await page.fill('input[name="first_name"]', 'Test');
      await page.fill('input[name="last_name"]', 'User');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="phone_number"]', '+1 (555) 123-4567');
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      
      // Submit registration form
      await page.click('button[type="submit"]');
      
      // Verify successful registration
      await expect(page.locator('text=Registration successful')).toBeVisible();
      await expect(page.locator('text=check your email')).toBeVisible();
    });

    test('should validate required fields in registration form', async ({ page }) => {
      await page.goto('/register');
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Verify HTML5 validation prevents submission
      const firstNameField = page.locator('input[name="first_name"]');
      await expect(firstNameField).toBeInvalid();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/register');
      
      // Fill with invalid email
      await page.fill('input[name="first_name"]', 'Test');
      await page.fill('input[name="last_name"]', 'User');
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'Password123!');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify email validation
      const emailField = page.locator('input[name="email"]');
      await expect(emailField).toBeInvalid();
    });

    test('should validate password confirmation match', async ({ page }) => {
      await page.goto('/register');
      
      // Fill with mismatched passwords
      await page.fill('input[name="first_name"]', 'Test');
      await page.fill('input[name="last_name"]', 'User');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify password validation error
      await expect(page.locator('text=Passwords do not match')).toBeVisible();
    });

    test('should validate minimum password length', async ({ page }) => {
      await page.goto('/register');
      
      // Fill with short password
      await page.fill('input[name="first_name"]', 'Test');
      await page.fill('input[name="last_name"]', 'User');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123');
      await page.fill('input[name="confirmPassword"]', '123');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify password length validation
      await expect(page.locator('text=Password must be at least 8 characters long')).toBeVisible();
    });
  });

  test.describe('User Login Flow', () => {
    test('should complete login process successfully', async ({ page }) => {
      // Navigate to login page
      await page.goto('/login');
      
      // Verify login page loads with correct heading
      await expect(page.locator('h1')).toContainText('DwayBank');
      await expect(page.locator('text=Sign in to your account')).toBeVisible();
      
      // Use test credentials
      const testEmail = 'test@example.com';
      const testPassword = 'password123';
      
      // Fill login form
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      
      // Submit login form
      await page.click('button[type="submit"]');
      
      // Verify successful login - wait for navigation
      await page.waitForTimeout(3000);
      
      // Check if redirected to dashboard
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(dashboard|home|account)/);
    });

    test('should handle invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      // Fill with invalid credentials
      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify error message appears
      await expect(page.locator('[role="alert"], .alert')).toBeVisible();
    });

    test('should validate required login fields', async ({ page }) => {
      await page.goto('/login');
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Verify HTML5 validation prevents submission
      const emailField = page.locator('input[name="email"]');
      await expect(emailField).toBeInvalid();
    });

    test('should toggle password visibility', async ({ page }) => {
      await page.goto('/login');
      
      // Fill password field
      await page.fill('input[name="password"]', 'testpassword');
      
      // Click show password button
      await page.click('button[aria-label*="Show password"]');
      
      // Verify password is now visible
      const passwordField = page.locator('input[name="password"]');
      await expect(passwordField).toHaveAttribute('type', 'text');
      
      // Click hide password button
      await page.click('button[aria-label*="Hide password"]');
      
      // Verify password is hidden again
      await expect(passwordField).toHaveAttribute('type', 'password');
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
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForTimeout(3000);
      
      // Verify user-specific content (based on mock backend response)
      await expect(page.locator('body')).toContainText(['Test User', 'user@example.com']);
    });

    test('should display account information and balances', async ({ page }) => {
      // Complete login flow
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Wait for dashboard
      await page.waitForTimeout(3000);
      
      // Verify financial information is displayed
      await expect(page.locator('body')).toContainText(['Balance', '$', 'Account']);
      
      // Verify specific test account data from backend
      await expect(page.locator('body')).toContainText(['2500.75', '10000.00']);
    });
  });

  test.describe('Security and Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and fail API requests
      await page.route('**/api/v1/auth/**', route => route.abort());
      
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Verify error handling
      await expect(page.locator('[role="alert"], .alert')).toBeVisible();
    });

    test('should prevent XSS in form inputs', async ({ page }) => {
      await page.goto('/register');
      
      // Try to inject script
      const xssPayload = '<script>alert("xss")</script>';
      await page.fill('input[name="first_name"]', xssPayload);
      await page.fill('input[name="last_name"]', 'User');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'Password123!');
      
      await page.click('button[type="submit"]');
      
      // Verify no script execution (no alert dialog)
      const dialogs = [];
      page.on('dialog', dialog => dialogs.push(dialog));
      
      await page.waitForTimeout(2000);
      expect(dialogs).toHaveLength(0);
    });

    test('should protect form inputs with proper attributes', async ({ page }) => {
      await page.goto('/login');
      
      // Verify email field has proper attributes
      const emailField = page.locator('input[name="email"]');
      await expect(emailField).toHaveAttribute('type', 'email');
      await expect(emailField).toHaveAttribute('autoComplete', 'email');
      
      // Verify password field has proper attributes
      const passwordField = page.locator('input[name="password"]');
      await expect(passwordField).toHaveAttribute('type', 'password');
      await expect(passwordField).toHaveAttribute('autoComplete', 'current-password');
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
      await page.keyboard.press('Tab'); // Focus remember me
      await page.keyboard.press('Tab'); // Focus forgot password
      await page.keyboard.press('Tab'); // Focus submit button
      await page.keyboard.press('Enter'); // Submit form
      
      // Verify submission worked
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(dashboard|home|account)/);
    });

    test('should have proper ARIA labels and semantic HTML', async ({ page }) => {
      await page.goto('/login');
      
      // Check for proper form structure
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check for labels
      await expect(page.locator('label[for="email"]')).toBeVisible();
      await expect(page.locator('label[for="password"]')).toBeVisible();
      
      // Check password toggle button has aria-label
      await expect(page.locator('button[aria-label*="password"]')).toBeVisible();
    });

    test('should provide proper screen reader support', async ({ page }) => {
      await page.goto('/register');
      
      // Check for screen reader text
      await expect(page.locator('.sr-only')).toBeVisible();
      
      // Check for aria-describedby attributes
      await expect(page.locator('input[aria-describedby]')).toHaveCount(1); // Remember me checkbox
      
      // Check for helper text
      await expect(page.locator('text=Must be at least 8 characters long')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/login');
      
      // Verify mobile layout
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Complete login on mobile
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Verify mobile dashboard
      await page.waitForTimeout(3000);
      await expect(page.locator('body')).toContainText(['Balance', '$']);
    });

    test('should be touch-friendly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/register');
      
      // Verify touch targets are accessible
      const emailInput = page.locator('input[name="email"]');
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
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      
      const startTime = Date.now();
      await page.click('button[type="submit"]');
      
      // Should show loading state
      await expect(page.locator('text=Signing in...')).toBeVisible();
      
      // Should complete within reasonable time
      await page.waitForTimeout(3000);
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 second total timeout
    });
  });

  test.describe('Form Validation and User Experience', () => {
    test('should show loading states during form submission', async ({ page }) => {
      await page.goto('/login');
      
      // Fill form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      
      // Submit and check for loading state
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Signing in...')).toBeVisible();
    });

    test('should prevent double submission', async ({ page }) => {
      await page.goto('/login');
      
      // Fill form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify button is disabled during submission
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeDisabled();
    });

    test('should maintain form state during errors', async ({ page }) => {
      await page.goto('/login');
      
      // Fill form with invalid credentials
      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for error
      await page.waitForTimeout(2000);
      
      // Verify form values are preserved
      await expect(page.locator('input[name="email"]')).toHaveValue('invalid@example.com');
      await expect(page.locator('input[name="password"]')).toHaveValue('wrongpassword');
    });
  });
});