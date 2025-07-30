import nodemailer from 'nodemailer';
import { config } from '../config/environment';
import logger, { auditLogger } from '../config/logger';

/**
 * Email Service for DwayBank MFA and Notifications
 * Handles email delivery with templates, security controls, and rate limiting
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: 'verification' | 'alert' | 'notification' | 'welcome' | 'reset';
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rateLimited?: boolean;
}

export interface EmailTemplate {
  mfaVerification: (code: string, expiryMinutes: number) => { subject: string; html: string; text: string };
  loginAlert: (location: string, timestamp: string, ipAddress: string) => { subject: string; html: string; text: string };
  accountAlert: (alertType: string, action: string, timestamp: string) => { subject: string; html: string; text: string };
  welcome: (firstName: string, email: string) => { subject: string; html: string; text: string };
  passwordReset: (resetLink: string, expiryMinutes: number) => { subject: string; html: string; text: string };
  accountLocked: (unlockTime: string, reason: string) => { subject: string; html: string; text: string };
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX = 10; // Max 10 emails per 15 minutes per email address

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    try {
      if (!config.email.user || !config.email.password) {
        logger.warn('Email service not configured - missing credentials');
        this.isConfigured = false;
        return;
      }

      // Configure transporter based on service type
      let transporterConfig: any = {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465, // true for 465, false for other ports
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      };

      // Service-specific configurations
      if (config.email.service === 'gmail') {
        transporterConfig = {
          service: 'gmail',
          auth: {
            user: config.email.user,
            pass: config.email.password,
          },
        };
      } else if (config.email.service === 'outlook') {
        transporterConfig = {
          service: 'hotmail',
          auth: {
            user: config.email.user,
            pass: config.email.password,
          },
        };
      }

      this.transporter = nodemailer.createTransporter(transporterConfig);
      this.isConfigured = true;

      logger.info('Email service initialized successfully', {
        service: config.email.service,
        from: config.email.from,
      });

    } catch (error) {
      logger.error('Failed to initialize email service', { error });
      this.isConfigured = false;
    }
  }

  /**
   * Check rate limiting for email address
   */
  private checkRateLimit(emailAddress: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const normalizedEmail = emailAddress.toLowerCase();
    const rateLimitKey = `email:${normalizedEmail}`;

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
   * Validate email address format
   */
  private validateEmail(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    if (email.length > 254) {
      return { valid: false, error: 'Email address too long' };
    }

    return { valid: true };
  }

  /**
   * Email templates with professional styling
   */
  private templates: EmailTemplate = {
    mfaVerification: (code: string, expiryMinutes: number) => ({
      subject: 'DwayBank - Multi-Factor Authentication Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>DwayBank MFA Verification</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .verification-code { background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 DwayBank Security</h1>
              <p>Multi-Factor Authentication</p>
            </div>
            <div class="content">
              <h2>Verification Code Required</h2>
              <p>You are attempting to access your DwayBank account. Please use the verification code below to complete your login:</p>
              
              <div class="verification-code">
                <div class="code">${code}</div>
                <p><strong>This code expires in ${expiryMinutes} minutes</strong></p>
              </div>
              
              <div class="warning">
                <strong>Security Notice:</strong> Never share this code with anyone. DwayBank will never ask for this code via phone or email.
              </div>
              
              <p>If you didn't request this code, please secure your account immediately by changing your password.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} DwayBank. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `DwayBank Multi-Factor Authentication

Your verification code is: ${code}

This code expires in ${expiryMinutes} minutes.

Security Notice: Never share this code with anyone. DwayBank will never ask for this code via phone or email.

If you didn't request this code, please secure your account immediately.

© ${new Date().getFullYear()} DwayBank. All rights reserved.`,
    }),

    loginAlert: (location: string, timestamp: string, ipAddress: string) => ({
      subject: 'DwayBank - New Login Detected',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>DwayBank Login Alert</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
            .details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Security Alert</h1>
              <p>New Login Detected</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <strong>A new login to your DwayBank account has been detected.</strong>
              </div>
              
              <div class="details">
                <h3>Login Details:</h3>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>IP Address:</strong> ${ipAddress}</p>
              </div>
              
              <p>If this was you, no action is needed. If you don't recognize this login, please secure your account immediately.</p>
              
              <a href="#" class="button">Secure My Account</a>
              
              <p><small>If you're unable to click the button, please log into your account and review your security settings.</small></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} DwayBank. All rights reserved.</p>
              <p>This is an automated security alert.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `DwayBank Security Alert - New Login Detected

A new login to your DwayBank account has been detected:

Location: ${location}
Time: ${timestamp}
IP Address: ${ipAddress}

If this was you, no action is needed. If you don't recognize this login, please secure your account immediately by logging in and reviewing your security settings.

© ${new Date().getFullYear()} DwayBank. All rights reserved.`,
    }),

    accountAlert: (alertType: string, action: string, timestamp: string) => ({
      subject: `DwayBank - Account Alert: ${alertType}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>DwayBank Account Alert</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Account Alert</h1>
              <p>DwayBank Security</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <h3>${alertType}</h3>
                <p><strong>Action:</strong> ${action}</p>
                <p><strong>Time:</strong> ${timestamp}</p>
              </div>
              
              <p>This is an automated alert regarding your DwayBank account activity.</p>
              
              <p>If you didn't initiate this action, please contact our support team immediately.</p>
              
              <p><strong>Support:</strong> support@dwaybank.com</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} DwayBank. All rights reserved.</p>
              <p>This is an automated account alert.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `DwayBank Account Alert - ${alertType}

Action: ${action}
Time: ${timestamp}

This is an automated alert regarding your DwayBank account activity.

If you didn't initiate this action, please contact our support team immediately at support@dwaybank.com.

© ${new Date().getFullYear()} DwayBank. All rights reserved.`,
    }),

    welcome: (firstName: string, email: string) => ({
      subject: 'Welcome to DwayBank - Account Created Successfully',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to DwayBank</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .welcome-box { background-color: #e8f5e8; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to DwayBank!</h1>
              <p>Your Smart Wallet Journey Begins</p>
            </div>
            <div class="content">
              <div class="welcome-box">
                <h2>Hello ${firstName}!</h2>
                <p>Your DwayBank account has been created successfully.</p>
              </div>
              
              <p>Thank you for choosing DwayBank as your smart wallet solution. Here's what you can do next:</p>
              
              <ul>
                <li>✅ Complete your profile setup</li>
                <li>🔐 Enable two-factor authentication for added security</li>
                <li>💰 Connect your first financial account</li>
                <li>📱 Download our mobile app</li>
              </ul>
              
              <a href="#" class="button">Complete Setup</a>
              
              <p>If you have any questions, our support team is here to help at support@dwaybank.com</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} DwayBank. All rights reserved.</p>
              <p>Account: ${email}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to DwayBank!

Hello ${firstName}!

Your DwayBank account has been created successfully. Thank you for choosing DwayBank as your smart wallet solution.

Next steps:
- Complete your profile setup
- Enable two-factor authentication for added security
- Connect your first financial account
- Download our mobile app

If you have any questions, our support team is here to help at support@dwaybank.com

Account: ${email}
© ${new Date().getFullYear()} DwayBank. All rights reserved.`,
    }),

    passwordReset: (resetLink: string, expiryMinutes: number) => ({
      subject: 'DwayBank - Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>DwayBank Password Reset</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .button { display: inline-block; background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔑 Password Reset</h1>
              <p>DwayBank Security</p>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>We received a request to reset your DwayBank account password. Click the button below to set a new password:</p>
              
              <a href="${resetLink}" class="button">Reset Password</a>
              
              <p><strong>This link expires in ${expiryMinutes} minutes.</strong></p>
              
              <div class="warning">
                <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </div>
              
              <p><small>If you're unable to click the button, copy and paste this link into your browser:<br>${resetLink}</small></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} DwayBank. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `DwayBank Password Reset

We received a request to reset your DwayBank account password.

To reset your password, visit this link: ${resetLink}

This link expires in ${expiryMinutes} minutes.

Security Notice: If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} DwayBank. All rights reserved.`,
    }),

    accountLocked: (unlockTime: string, reason: string) => ({
      subject: 'DwayBank - Account Locked for Security',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>DwayBank Account Locked</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .alert-box { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Account Locked</h1>
              <p>DwayBank Security</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <h3>Your account has been temporarily locked</h3>
                <p><strong>Reason:</strong> ${reason}</p>
                <p><strong>Unlock Time:</strong> ${unlockTime}</p>
              </div>
              
              <p>Your DwayBank account has been temporarily locked for security reasons. This is a precautionary measure to protect your account.</p>
              
              <p>Your account will automatically unlock at the time specified above. If you believe this was done in error or need immediate assistance, please contact our support team.</p>
              
              <p><strong>Support:</strong> support@dwaybank.com</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} DwayBank. All rights reserved.</p>
              <p>This is an automated security alert.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `DwayBank Account Locked

Your account has been temporarily locked for security reasons.

Reason: ${reason}
Unlock Time: ${unlockTime}

This is a precautionary measure to protect your account. Your account will automatically unlock at the time specified above.

If you believe this was done in error or need immediate assistance, please contact our support team at support@dwaybank.com.

© ${new Date().getFullYear()} DwayBank. All rights reserved.`,
    }),
  };

  /**
   * Send email message
   */
  private async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      // Check if service is configured
      if (!this.isConfigured || !this.transporter) {
        logger.error('Email service not configured', { to: message.to, type: message.type });
        return { success: false, error: 'Email service not configured' };
      }

      // Validate email address
      const validation = this.validateEmail(message.to);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check rate limiting
      const rateLimit = this.checkRateLimit(message.to);
      if (!rateLimit.allowed) {
        auditLogger.warn('Email rate limit exceeded', {
          email: message.to,
          type: message.type,
          retryAfter: rateLimit.retryAfter,
        });

        return {
          success: false,
          error: 'Rate limit exceeded',
          rateLimited: true,
        };
      }

      // Send email
      const result = await this.transporter.sendMail({
        from: config.email.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      // Log successful send
      auditLogger.info('Email sent successfully', {
        messageId: result.messageId,
        to: message.to,
        subject: message.subject,
        type: message.type,
      });

      return {
        success: true,
        messageId: result.messageId,
      };

    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: message.to,
        type: message.type,
      });

      return {
        success: false,
        error: 'Failed to send email',
      };
    }
  }

  /**
   * Send MFA verification code email
   */
  async sendMFAVerificationCode(email: string, code: string): Promise<EmailResult> {
    const template = this.templates.mfaVerification(code, config.email.expiryMinutes);
    
    const message: EmailMessage = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'verification',
    };

    const result = await this.sendEmail(message);

    if (result.success) {
      auditLogger.info('MFA verification email sent', {
        email,
        messageId: result.messageId,
      });
    }

    return result;
  }

  /**
   * Send login alert email
   */
  async sendLoginAlert(
    email: string,
    location: string,
    ipAddress: string,
    timestamp: string = new Date().toLocaleString()
  ): Promise<EmailResult> {
    const template = this.templates.loginAlert(location, timestamp, ipAddress);
    
    const message: EmailMessage = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'alert',
    };

    const result = await this.sendEmail(message);

    if (result.success) {
      auditLogger.info('Login alert email sent', {
        email,
        location,
        ipAddress,
        messageId: result.messageId,
      });
    }

    return result;
  }

  /**
   * Send account alert email
   */
  async sendAccountAlert(
    email: string,
    alertType: string,
    action: string,
    timestamp: string = new Date().toLocaleString()
  ): Promise<EmailResult> {
    const template = this.templates.accountAlert(alertType, action, timestamp);
    
    const message: EmailMessage = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'alert',
    };

    return await this.sendEmail(message);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<EmailResult> {
    const template = this.templates.welcome(firstName, email);
    
    const message: EmailMessage = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'welcome',
    };

    return await this.sendEmail(message);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetLink: string): Promise<EmailResult> {
    const template = this.templates.passwordReset(resetLink, 30); // 30 minutes expiry
    
    const message: EmailMessage = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'reset',
    };

    return await this.sendEmail(message);
  }

  /**
   * Send account locked notification
   */
  async sendAccountLockedEmail(
    email: string,
    unlockTime: string,
    reason: string
  ): Promise<EmailResult> {
    const template = this.templates.accountLocked(unlockTime, reason);
    
    const message: EmailMessage = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'alert',
    };

    return await this.sendEmail(message);
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
   * Get email service status
   */
  public getServiceStatus(): {
    configured: boolean;
    rateLimitCacheSize: number;
    fromAddress?: string;
  } {
    return {
      configured: this.isConfigured,
      rateLimitCacheSize: this.rateLimitCache.size,
      fromAddress: this.isConfigured ? config.email.from : undefined,
    };
  }

  /**
   * Test email configuration
   */
  async testConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      // Test connection
      await this.transporter.verify();
      
      logger.info('Email configuration test successful');
      return { success: true };

    } catch (error: any) {
      logger.error('Email configuration test failed', {
        error: error.message,
      });

      return {
        success: false,
        error: `Configuration test failed: ${error.message}`,
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Set up cleanup interval for rate limit cache
setInterval(() => {
  emailService.cleanupRateLimit();
}, 5 * 60 * 1000); // Clean up every 5 minutes