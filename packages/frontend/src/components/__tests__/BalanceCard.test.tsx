/**
 * Comprehensive Balance Card Component Tests
 * Testing financial data display, accessibility, and security features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BalanceCard } from '../financial/BalanceCard';
import { testUtils } from '../test/setup';

// Mock currency formatter
vi.mock('../utils/currency', () => ({
  formatCurrency: vi.fn((amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }),
  formatPercentage: vi.fn((value) => `${(value * 100).toFixed(2)}%`),
}));

const defaultProps = {
  balance: 5423.67,
  currency: 'USD',
  accountType: 'checking',
  accountName: 'Primary Checking',
  lastUpdated: new Date('2024-01-15T10:30:00Z'),
  trend: {
    direction: 'up' as const,
    percentage: 0.025,
    period: '30d',
  },
  isVisible: true,
  onToggleVisibility: vi.fn(),
};

const renderBalanceCard = (props = {}) => {
  return render(<BalanceCard {...defaultProps} {...props} />);
};

describe('BalanceCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('should render balance card with all required information', () => {
      renderBalanceCard();

      expect(screen.getByText('Primary Checking')).toBeInTheDocument();
      expect(screen.getByText('$5,423.67')).toBeInTheDocument();
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('checking')).toBeInTheDocument();
    });

    it('should render trend information', () => {
      renderBalanceCard();

      expect(screen.getByText('2.50%')).toBeInTheDocument();
      expect(screen.getByText('30d')).toBeInTheDocument();
      expect(screen.getByTestId('trend-up-icon')).toBeInTheDocument();
    });

    it('should render last updated timestamp', () => {
      renderBalanceCard();

      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
      expect(screen.getByText(/jan 15, 2024/i)).toBeInTheDocument();
    });

    it('should render visibility toggle button', () => {
      renderBalanceCard();

      expect(screen.getByRole('button', { name: /hide balance/i })).toBeInTheDocument();
    });
  });

  describe('Balance Visibility', () => {
    it('should show balance when visible is true', () => {
      renderBalanceCard({ isVisible: true });

      expect(screen.getByText('$5,423.67')).toBeInTheDocument();
      expect(screen.queryByText('••••••')).not.toBeInTheDocument();
    });

    it('should hide balance when visible is false', () => {
      renderBalanceCard({ isVisible: false });

      expect(screen.getByText('••••••')).toBeInTheDocument();
      expect(screen.queryByText('$5,423.67')).not.toBeInTheDocument();
    });

    it('should toggle visibility when button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleVisibility = vi.fn();
      
      renderBalanceCard({ onToggleVisibility });

      const toggleButton = screen.getByRole('button', { name: /hide balance/i });
      await user.click(toggleButton);

      expect(onToggleVisibility).toHaveBeenCalledTimes(1);
    });

    it('should update button label based on visibility state', () => {
      const { rerender } = renderBalanceCard({ isVisible: true });
      
      expect(screen.getByRole('button', { name: /hide balance/i })).toBeInTheDocument();

      rerender(<BalanceCard {...defaultProps} isVisible={false} />);
      
      expect(screen.getByRole('button', { name: /show balance/i })).toBeInTheDocument();
    });
  });

  describe('Currency and Formatting', () => {
    it('should handle different currencies', () => {
      renderBalanceCard({ currency: 'EUR', balance: 1234.56 });

      expect(screen.getByText('€1,234.56')).toBeInTheDocument();
      expect(screen.getByText('EUR')).toBeInTheDocument();
    });

    it('should handle negative balances', () => {
      renderBalanceCard({ balance: -1234.56 });

      expect(screen.getByText('-$1,234.56')).toBeInTheDocument();
      expect(screen.getByTestId('negative-balance')).toBeInTheDocument();
    });

    it('should handle zero balance', () => {
      renderBalanceCard({ balance: 0 });

      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByTestId('zero-balance')).toBeInTheDocument();
    });

    it('should handle large balance values', () => {
      renderBalanceCard({ balance: 1234567.89 });

      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
    });

    it('should format decimal places correctly', () => {
      renderBalanceCard({ balance: 1234.5 });

      expect(screen.getByText('$1,234.50')).toBeInTheDocument();
    });

    it('should handle cryptocurrency balances', () => {
      renderBalanceCard({ 
        balance: 0.5432,
        currency: 'BTC',
        accountType: 'crypto'
      });

      expect(screen.getByText('0.5432 BTC')).toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('should show upward trend correctly', () => {
      renderBalanceCard({
        trend: {
          direction: 'up',
          percentage: 0.15,
          period: '7d',
        },
      });

      expect(screen.getByTestId('trend-up-icon')).toBeInTheDocument();
      expect(screen.getByText('15.00%')).toBeInTheDocument();
      expect(screen.getByText('7d')).toBeInTheDocument();
      expect(screen.getByTestId('trend-positive')).toBeInTheDocument();
    });

    it('should show downward trend correctly', () => {
      renderBalanceCard({
        trend: {
          direction: 'down',
          percentage: -0.08,
          period: '30d',
        },
      });

      expect(screen.getByTestId('trend-down-icon')).toBeInTheDocument();
      expect(screen.getByText('8.00%')).toBeInTheDocument();
      expect(screen.getByTestId('trend-negative')).toBeInTheDocument();
    });

    it('should show neutral trend correctly', () => {
      renderBalanceCard({
        trend: {
          direction: 'neutral',
          percentage: 0,
          period: '30d',
        },
      });

      expect(screen.getByTestId('trend-neutral-icon')).toBeInTheDocument();
      expect(screen.getByText('0.00%')).toBeInTheDocument();
      expect(screen.getByTestId('trend-neutral')).toBeInTheDocument();
    });

    it('should handle missing trend data', () => {
      renderBalanceCard({ trend: undefined });

      expect(screen.queryByTestId('trend-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Account Types', () => {
    it('should display checking account correctly', () => {
      renderBalanceCard({ accountType: 'checking' });

      expect(screen.getByText('checking')).toBeInTheDocument();
      expect(screen.getByTestId('checking-account-icon')).toBeInTheDocument();
    });

    it('should display savings account correctly', () => {
      renderBalanceCard({ accountType: 'savings' });

      expect(screen.getByText('savings')).toBeInTheDocument();
      expect(screen.getByTestId('savings-account-icon')).toBeInTheDocument();
    });

    it('should display credit account correctly', () => {
      renderBalanceCard({ accountType: 'credit' });

      expect(screen.getByText('credit')).toBeInTheDocument();
      expect(screen.getByTestId('credit-account-icon')).toBeInTheDocument();
    });

    it('should display investment account correctly', () => {
      renderBalanceCard({ accountType: 'investment' });

      expect(screen.getByText('investment')).toBeInTheDocument();
      expect(screen.getByTestId('investment-account-icon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderBalanceCard();

      const card = screen.getByRole('region');
      expect(card).toHaveAttribute('aria-label', 'Account balance information');

      const balance = screen.getByText('$5,423.67');
      expect(balance).toHaveAttribute('aria-label', '5423 dollars and 67 cents');

      const toggleButton = screen.getByRole('button', { name: /hide balance/i });
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should announce balance changes to screen readers', () => {
      const { rerender } = renderBalanceCard({ balance: 1000 });

      rerender(<BalanceCard {...defaultProps} balance={1500} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Balance updated to $1,500.00');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderBalanceCard();

      const toggleButton = screen.getByRole('button', { name: /hide balance/i });
      
      await user.tab();
      expect(toggleButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(defaultProps.onToggleVisibility).toHaveBeenCalled();
    });

    it('should provide screen reader friendly trend descriptions', () => {
      renderBalanceCard({
        trend: {
          direction: 'up',
          percentage: 0.15,
          period: '30d',
        },
      });

      expect(screen.getByLabelText(/balance increased by 15% over 30 days/i)).toBeInTheDocument();
    });

    it('should handle high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });

      renderBalanceCard();

      const card = screen.getByRole('region');
      expect(card).toHaveClass('high-contrast');
    });
  });

  describe('Security Features', () => {
    it('should mask sensitive data in screenshots', () => {
      renderBalanceCard();

      const balanceElement = screen.getByText('$5,423.67');
      expect(balanceElement).toHaveClass('screenshot-mask');
    });

    it('should prevent copy/paste of balance values', async () => {
      const user = userEvent.setup();
      renderBalanceCard();

      const balanceElement = screen.getByText('$5,423.67');
      
      // Attempt to select and copy
      await user.click(balanceElement);
      await user.keyboard('{Control>}a{/Control}');
      await user.keyboard('{Control>}c{/Control}');

      // Should prevent clipboard access
      expect(balanceElement).toHaveAttribute('user-select', 'none');
    });

    it('should clear sensitive data on component unmount', () => {
      const { unmount } = renderBalanceCard();

      unmount();

      // Verify sensitive data is cleared from memory
      expect(document.body.innerHTML).toBe('');
    });

    it('should detect potential screen recording', () => {
      // Mock screen capture detection
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getDisplayMedia: vi.fn().mockResolvedValue({}),
        },
      });

      renderBalanceCard();

      expect(screen.getByTestId('security-overlay')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state when balance is being fetched', () => {
      renderBalanceCard({ balance: null, isLoading: true });

      expect(screen.getByTestId('balance-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('$5,423.67')).not.toBeInTheDocument();
    });

    it('should show error state when balance fetch fails', () => {
      renderBalanceCard({ 
        balance: null, 
        error: 'Failed to load balance',
        isLoading: false 
      });

      expect(screen.getByText(/failed to load balance/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle stale data indicator', () => {
      const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      renderBalanceCard({ lastUpdated: staleDate });

      expect(screen.getByTestId('stale-data-warning')).toBeInTheDocument();
      expect(screen.getByText(/data may be outdated/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderBalanceCard();

      const card = screen.getByRole('region');
      expect(card).toHaveClass('mobile-layout');
    });

    it('should handle touch interactions on mobile', async () => {
      const user = userEvent.setup();
      renderBalanceCard();

      const toggleButton = screen.getByRole('button', { name: /hide balance/i });
      
      // Simulate touch event
      fireEvent.touchStart(toggleButton);
      fireEvent.touchEnd(toggleButton);

      expect(defaultProps.onToggleVisibility).toHaveBeenCalled();
    });

    it('should adjust font sizes for accessibility', () => {
      renderBalanceCard();

      const balance = screen.getByText('$5,423.67');
      const computedStyle = window.getComputedStyle(balance);
      
      expect(parseInt(computedStyle.fontSize)).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Performance', () => {
    it('should memoize expensive calculations', () => {
      const formatCurrencySpy = vi.spyOn(require('../utils/currency'), 'formatCurrency');
      
      const { rerender } = renderBalanceCard();
      rerender(<BalanceCard {...defaultProps} />);

      // Should not recalculate if props haven't changed
      expect(formatCurrencySpy).toHaveBeenCalledTimes(1);
    });

    it('should lazy load trend chart data', async () => {
      renderBalanceCard({ showTrendChart: true });

      // Chart should not load immediately
      expect(screen.queryByTestId('trend-chart')).not.toBeInTheDocument();

      // Should load when trend section is visible
      const trendSection = screen.getByTestId('trend-section');
      fireEvent.scroll(window, { target: { scrollY: 100 } });

      await waitFor(() => {
        expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
      });
    });

    it('should debounce rapid visibility toggles', async () => {
      const user = userEvent.setup();
      const onToggleVisibility = vi.fn();
      
      renderBalanceCard({ onToggleVisibility });

      const toggleButton = screen.getByRole('button', { name: /hide balance/i });
      
      // Rapid clicks
      await user.click(toggleButton);
      await user.click(toggleButton);
      await user.click(toggleButton);

      // Should debounce calls
      await waitFor(() => {
        expect(onToggleVisibility).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Data Validation', () => {
    it('should handle invalid balance values gracefully', () => {
      renderBalanceCard({ balance: NaN });

      expect(screen.getByText('Balance unavailable')).toBeInTheDocument();
    });

    it('should validate currency codes', () => {
      renderBalanceCard({ currency: 'INVALID' });

      expect(screen.getByText('USD')).toBeInTheDocument(); // Falls back to default
    });

    it('should sanitize account names', () => {
      renderBalanceCard({ 
        accountName: '<script>alert("xss")</script>Checking' 
      });

      expect(screen.getByText('Checking')).toBeInTheDocument();
      expect(screen.queryByText('<script>')).not.toBeInTheDocument();
    });
  });
});