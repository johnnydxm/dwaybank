/**
 * Currency formatting utilities for DwayBank
 */

export interface CurrencyFormatOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
  compactNotation?: boolean;
}

/**
 * Format currency with proper localization
 */
export function formatCurrency(
  amount: number, 
  currency: string = 'USD',
  options: CurrencyFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
    compactNotation = false
  } = options;

  if (compactNotation && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat(locale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: showSymbol ? currency : undefined,
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: showSymbol ? currency : undefined,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(amount);
}

/**
 * Format percentage with proper localization
 */
export function formatPercentage(
  value: number,
  locale: string = 'en-US',
  minimumFractionDigits: number = 1,
  maximumFractionDigits: number = 2
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value / 100);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(currencyString: string): number {
  // Remove all non-numeric characters except decimal points and minus signs
  const cleaned = currencyString.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currency: string, locale: string = 'en-US'): string {
  try {
    return (0).toLocaleString(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).replace(/\d/g, '').trim();
  } catch {
    return currency;
  }
}

/**
 * Determine if amount should be displayed as positive or negative
 */
export function getAmountColor(amount: number, type?: 'credit' | 'debit'): string {
  if (type === 'credit' || amount > 0) {
    return 'text-green-600';
  } else if (type === 'debit' || amount < 0) {
    return 'text-red-600';
  }
  return 'text-gray-900';
}

/**
 * Format amount with appropriate sign and color class
 */
export function formatAmountWithSign(
  amount: number,
  currency: string = 'USD',
  type?: 'credit' | 'debit'
): {
  formatted: string;
  colorClass: string;
  sign: '+' | '-' | '';
} {
  const absAmount = Math.abs(amount);
  const formatted = formatCurrency(absAmount, currency);
  const colorClass = getAmountColor(amount, type);
  
  let sign: '+' | '-' | '' = '';
  if (type === 'credit' || amount > 0) {
    sign = '+';
  } else if (type === 'debit' || amount < 0) {
    sign = '-';
  }

  return {
    formatted,
    colorClass,
    sign
  };
}

/**
 * Check if two currency amounts are equal (accounting for floating point precision)
 */
export function currencyEquals(amount1: number, amount2: number, precision: number = 2): boolean {
  const factor = Math.pow(10, precision);
  return Math.round(amount1 * factor) === Math.round(amount2 * factor);
}

/**
 * Convert between currencies (placeholder for real currency conversion)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate?: number
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // In a real app, this would use live exchange rates
  // For now, return the amount as-is if no exchange rate provided
  if (exchangeRate) {
    return amount * exchangeRate;
  }
  
  return amount;
}

/**
 * Validate currency amount
 */
export function isValidCurrencyAmount(amount: string | number): boolean {
  const numAmount = typeof amount === 'string' ? parseCurrency(amount) : amount;
  return !isNaN(numAmount) && isFinite(numAmount) && numAmount >= 0;
}

/**
 * Format large numbers with appropriate units (K, M, B)
 */
export function formatLargeNumber(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount, currency, { locale });
  }

  return formatCurrency(amount, currency, { 
    locale, 
    compactNotation: true 
  });
}