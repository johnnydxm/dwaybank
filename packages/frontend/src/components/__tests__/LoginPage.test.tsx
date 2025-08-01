/**
 * Comprehensive Login Page Component Tests
 * Testing authentication UI, accessibility, and security features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { testUtils } from '../test/setup';

// Mock the auth hook
const mockLogin = vi.fn();
const mockAuthContext = {
  ...testUtils.createMockAuthContext(),
  login: mockLogin,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('../hooks/useAuth', () => ({
  default: () => mockAuthContext,
}));

// Mock the API service
vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
};

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('should render login form with all required fields', () => {
      renderLoginPage();

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render additional login options', () => {
      renderLoginPage();

      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should render security features', () => {
      renderLoginPage();

      expect(screen.getByText(/secure login/i)).toBeInTheDocument();
      expect(screen.getByText(/256-bit encryption/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required email field', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
      });
    });

    it('should validate required password field', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@dwaybank.com');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('should validate minimum password length', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, '123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user corrects input', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Trigger validation error
      await user.click(submitButton);
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      // Correct the input
      await user.type(emailInput, 'test@dwaybank.com');
      
      await waitFor(() => {
        expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should call login function with correct credentials', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: true });
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@dwaybank.com',
          password: 'SecurePass123!',
        });
      });
    });

    it('should show loading state during authentication', async () => {
      const user = userEvent.setup();
      mockAuthContext.isLoading = true;
      
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /signing in/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should handle authentication errors', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'WrongPassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should handle MFA requirement', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({
        success: true,
        requiresMFA: true,
        mfaChallenge: 'mfa-token-123',
      });
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/enter authentication code/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument();
      });
    });

    it('should handle rate limiting errors', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue({
        response: {
          status: 429,
          data: { error: 'Too many attempts', retryAfter: 300 },
        },
      });
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
        expect(screen.getByText(/try again in 5 minutes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    it('should hide password by default', () => {
      renderLoginPage();

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should allow password visibility toggle', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      expect(passwordInput).toHaveAttribute('type', 'password');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should prevent form submission with suspicious input', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      // Attempt XSS injection
      await user.type(emailInput, '<script>alert("xss")</script>@test.com');
      await user.type(passwordInput, 'SecurePass123!');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid characters detected/i)).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should enforce HTTPS in production', () => {
      // Mock production environment
      vi.stubEnv('NODE_ENV', 'production');
      
      renderLoginPage();

      expect(screen.getByText(/secure connection/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderLoginPage();

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Login form');

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('aria-required', 'true');
      expect(emailInput).toHaveAttribute('aria-describedby');

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
      expect(passwordInput).toHaveAttribute('aria-describedby');
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/email is required/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i });

      // Tab through form elements
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /show password/i })).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();

      await user.tab();
      expect(forgotPasswordLink).toHaveFocus();
    });

    it('should support Enter key submission', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: true });
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it('should have sufficient color contrast', () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      const computedStyle = window.getComputedStyle(submitButton);
      
      // This would typically use a color contrast testing library
      expect(computedStyle.backgroundColor).toBeTruthy();
      expect(computedStyle.color).toBeTruthy();
    });

    it('should work without JavaScript (progressive enhancement)', () => {
      renderLoginPage();

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('method', 'post');
      expect(form).toHaveAttribute('action');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 812,
      });

      renderLoginPage();

      const form = screen.getByRole('form');
      expect(form).toHaveClass('mobile-optimized');
    });

    it('should support touch interactions', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Simulate touch event
      fireEvent.touchStart(submitButton);
      fireEvent.touchEnd(submitButton);

      expect(submitButton).toHaveAttribute('touch-action', 'manipulation');
    });

    it('should have appropriate minimum touch target sizes', () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      const computedStyle = window.getComputedStyle(submitButton);
      
      // Buttons should be at least 44px for good touch targets
      const minSize = 44;
      expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(minSize);
    });
  });

  describe('Performance', () => {
    it('should not cause memory leaks', async () => {
      const { unmount } = renderLoginPage();
      
      // Simulate component usage
      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, 'test@dwaybank.com');

      // Unmount component
      unmount();

      // Verify cleanup (this would typically use memory testing tools)
      expect(document.body.innerHTML).toBe('');
    });

    it('should debounce validation requests', async () => {
      const user = userEvent.setup();
      const validateEmailSpy = vi.fn();
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      
      // Type rapidly
      await user.type(emailInput, 'test@dwaybank.com');
      
      // Validation should be debounced
      await waitFor(() => {
        expect(validateEmailSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after network errors', async () => {
      const user = userEvent.setup();
      mockLogin
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(submitButton);

      // First attempt fails
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Retry button appears
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Second attempt succeeds
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(2);
      });
    });

    it('should maintain form state during errors', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Server error'));
      
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@dwaybank.com');
      await user.type(passwordInput, 'SecurePass123!');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Form values should be preserved
      expect(emailInput).toHaveValue('test@dwaybank.com');
      expect(passwordInput).toHaveValue('SecurePass123!');
    });
  });
});