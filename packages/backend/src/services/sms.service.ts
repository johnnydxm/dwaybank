import twilio from 'twilio';
import { config } from '../config/environment';
import logger, { auditLogger } from '../config/logger';

/**
 * SMS Service for DwayBank MFA
 * Handles SMS delivery via Twilio with security controls and rate limiting
 */

export interface SMSMessage {
  to: string;
  message: string;
  type: 'verification' | 'alert' | 'notification';
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rateLimited?: boolean;
}

export interface SMSTemplate {
  verification: (code: string, serviceName: string) => string;
  loginAlert: (location: string, timestamp: string) => string;
  accountAlert: (alertType: string, action: string) => string;
}

class SMSService {
  private client: twilio.Twilio | null = null;
  private isConfigured: boolean = false;
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX = 5; // Max 5 SMS per 15 minutes per phone number

  constructor() {
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client
   */
  private initializeTwilio(): void {
    try {
      if (!config.sms.accountSid || !config.sms.authToken || !config.sms.phoneNumber) {
        logger.warn('SMS service not configured - missing Twilio credentials');
        this.isConfigured = false;
        return;
      }

      this.client = twilio(config.sms.accountSid, config.sms.authToken);
      this.isConfigured = true;
      
      logger.info('SMS service initialized successfully', {
        phoneNumber: config.sms.phoneNumber,
      });
      
    } catch (error) {
      logger.error('Failed to initialize SMS service', { error });
      this.isConfigured = false;
    }
  }

  /**
   * SMS message templates
   */
  private templates: SMSTemplate = {
    verification: (code: string, serviceName: string = 'DwayBank') => 
      `Your ${serviceName} verification code is: ${code}. This code expires in ${config.sms.expiryMinutes} minutes. Do not share this code with anyone.`,
    
    loginAlert: (location: string, timestamp: string) =>
      `DwayBank Security Alert: New login detected from ${location} at ${timestamp}. If this wasn't you, please secure your account immediately.`,
    
    accountAlert: (alertType: string, action: string) =>
      `DwayBank Alert: ${alertType} - ${action}. If you didn't initiate this action, please contact support immediately.`,
  };

  /**
   * Check rate limiting for phone number
   */
  private checkRateLimit(phoneNumber: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const rateLimitKey = `sms:${normalizedPhone}`;
    
    const existing = this.rateLimitCache.get(rateLimitKey);
    
    if (!existing || now > existing.resetTime) {
      // Reset rate limit window
      this.rateLimitCache.set(rateLimitKey, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return { allowed: true };
    }
    
    if (existing.count >= this.RATE_LIMIT_MAX) {
      const retryAfter = Math.ceil((existing.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Increment counter
    existing.count++;
    this.rateLimitCache.set(rateLimitKey, existing);
    
    return { allowed: true };
  }

  /**
   * Normalize phone number format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming US +1 for now)
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    } else if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  /**
   * Validate phone number format
   */
  private validatePhoneNumber(phoneNumber: string): { valid: boolean; error?: string } {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phoneRegex.test(normalized)) {
      return { valid: false, error: 'Invalid phone number format' };
    }
    
    // Length check (minimum 7 digits, maximum 15 digits after country code)
    const digits = normalized.replace(/^\+/, '');
    if (digits.length < 7 || digits.length > 15) {
      return { valid: false, error: 'Phone number length invalid' };
    }
    
    return { valid: true };
  }

  /**
   * Send SMS message
   */
  private async sendSMS(to: string, message: string, type: string = 'general'): Promise<SMSResult> {
    try {
      // Check if service is configured
      if (!this.isConfigured || !this.client) {
        logger.error('SMS service not configured', { to, type });
        return { success: false, error: 'SMS service not configured' };
      }

      // Validate phone number
      const validation = this.validatePhoneNumber(to);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const normalizedTo = this.normalizePhoneNumber(to);

      // Check rate limiting
      const rateLimit = this.checkRateLimit(normalizedTo);
      if (!rateLimit.allowed) {
        auditLogger.warn('SMS rate limit exceeded', {
          phoneNumber: normalizedTo,
          type,
          retryAfter: rateLimit.retryAfter,
        });
        
        return {
          success: false,
          error: 'Rate limit exceeded',
          rateLimited: true,
        };
      }

      // Send SMS via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: config.sms.phoneNumber,
        to: normalizedTo,
      });

      // Log successful send
      auditLogger.info('SMS sent successfully', {
        messageId: result.sid,
        to: normalizedTo,
        type,
        status: result.status,
      });

      return {
        success: true,
        messageId: result.sid,
      };

    } catch (error: any) {
      logger.error('Failed to send SMS', {
        error: error.message,
        code: error.code,
        to,
        type,
      });

      // Handle specific Twilio error codes
      let errorMessage = 'Failed to send SMS';
      
      if (error.code === 21211) {
        errorMessage = 'Invalid phone number';
      } else if (error.code === 21408) {
        errorMessage = 'Phone number not reachable';
      } else if (error.code === 21612) {
        errorMessage = 'Phone number is not a valid mobile number';
      } else if (error.code === 21614) {
        errorMessage = 'Phone number is blocked';
      } else if (error.code === 21617) {
        errorMessage = 'Phone number is not mobile-capable';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send MFA verification code
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<SMSResult> {
    const message = this.templates.verification(code);
    const result = await this.sendSMS(phoneNumber, message, 'verification');

    if (result.success) {
      auditLogger.info('MFA verification code sent', {
        phoneNumber: this.normalizePhoneNumber(phoneNumber),
        messageId: result.messageId,
      });
    }

    return result;
  }

  /**
   * Send login alert
   */
  async sendLoginAlert(
    phoneNumber: string,
    location: string,
    timestamp: string = new Date().toLocaleString()
  ): Promise<SMSResult> {
    const message = this.templates.loginAlert(location, timestamp);
    const result = await this.sendSMS(phoneNumber, message, 'login_alert');

    if (result.success) {
      auditLogger.info('Login alert sent', {
        phoneNumber: this.normalizePhoneNumber(phoneNumber),
        location,
        messageId: result.messageId,
      });
    }

    return result;
  }

  /**
   * Send account security alert
   */
  async sendSecurityAlert(
    phoneNumber: string,
    alertType: string,
    action: string
  ): Promise<SMSResult> {
    const message = this.templates.accountAlert(alertType, action);
    const result = await this.sendSMS(phoneNumber, message, 'security_alert');

    if (result.success) {
      auditLogger.info('Security alert sent', {
        phoneNumber: this.normalizePhoneNumber(phoneNumber),
        alertType,
        action,
        messageId: result.messageId,
      });
    }

    return result;
  }

  /**
   * Send custom SMS message
   */
  async sendCustomMessage(
    phoneNumber: string,
    message: string,
    type: string = 'custom'
  ): Promise<SMSResult> {
    // Validate message length (SMS limit is 160 characters for single message)
    if (message.length > 1600) { // Allow up to 10 segments
      return {
        success: false,
        error: 'Message too long',
      };
    }

    return await this.sendSMS(phoneNumber, message, type);
  }

  /**
   * Get SMS delivery status
   */
  async getMessageStatus(messageId: string): Promise<{
    status?: string;
    error?: string;
  }> {
    try {
      if (!this.isConfigured || !this.client) {
        return { error: 'SMS service not configured' };
      }

      const message = await this.client.messages(messageId).fetch();
      
      return {
        status: message.status,
      };

    } catch (error: any) {
      logger.error('Failed to get message status', {
        error: error.message,
        messageId,
      });

      return { error: 'Failed to get message status' };
    }
  }

  /**
   * Clean up rate limit cache
   */
  public cleanupRateLimit(): void {
    const now = Date.now();
    
    for (const [key, value] of this.rateLimitCache.entries()) {
      if (now > value.resetTime) {
        this.rateLimitCache.delete(key);
      }
    }
  }

  /**
   * Get SMS service status
   */
  public getServiceStatus(): {
    configured: boolean;
    rateLimitCacheSize: number;
    phoneNumber?: string;
  } {
    return {
      configured: this.isConfigured,
      rateLimitCacheSize: this.rateLimitCache.size,
      phoneNumber: this.isConfigured ? config.sms.phoneNumber : undefined,
    };
  }

  /**
   * Test SMS configuration
   */
  async testConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured || !this.client) {
        return { success: false, error: 'SMS service not configured' };
      }

      // Test by fetching account information
      const account = await this.client.api.accounts(config.sms.accountSid).fetch();
      
      logger.info('SMS configuration test successful', {
        accountSid: account.sid,
        status: account.status,
      });

      return { success: true };

    } catch (error: any) {
      logger.error('SMS configuration test failed', {
        error: error.message,
        code: error.code,
      });

      return {
        success: false,
        error: `Configuration test failed: ${error.message}`,
      };
    }
  }

  /**
   * Get SMS statistics
   */
  async getStatistics(days: number = 30): Promise<{
    totalSent: number;
    successRate: number;
    errorBreakdown: Record<string, number>;
    rateLimitHits: number;
  }> {
    try {
      if (!this.isConfigured || !this.client) {
        return {
          totalSent: 0,
          successRate: 0,
          errorBreakdown: {},
          rateLimitHits: 0,
        };
      }

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get messages from Twilio (this would be expensive for large volumes)
      // In production, you'd want to track this in your own database
      const messages = await this.client.messages.list({
        dateSentAfter: startDate,
        limit: 1000, // Limit to avoid large API calls
      });

      const totalSent = messages.length;
      const successful = messages.filter(m => m.status === 'delivered').length;
      const successRate = totalSent > 0 ? successful / totalSent : 0;

      const errorBreakdown: Record<string, number> = {};
      messages.forEach(message => {
        if (message.status !== 'delivered' && message.errorCode) {
          const errorKey = `${message.errorCode}: ${message.status}`;
          errorBreakdown[errorKey] = (errorBreakdown[errorKey] || 0) + 1;
        }
      });

      return {
        totalSent,
        successRate,
        errorBreakdown,
        rateLimitHits: 0, // Would need to track this separately
      };

    } catch (error) {
      logger.error('Failed to get SMS statistics', { error });
      return {
        totalSent: 0,
        successRate: 0,
        errorBreakdown: {},
        rateLimitHits: 0,
      };
    }
  }
}

// Export singleton instance
export const smsService = new SMSService();

// Set up cleanup interval for rate limit cache
setInterval(() => {
  smsService.cleanupRateLimit();
}, 5 * 60 * 1000); // Clean up every 5 minutes