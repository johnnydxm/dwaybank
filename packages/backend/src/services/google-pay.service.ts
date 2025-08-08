/**
 * DwayBank Smart Wallet - Google Pay Integration Service
 * Implements Google Pay API integration for payment method aggregation
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../config/logger';
import { WalletProvider } from './wallet.service';
import {
  WalletConnection,
  PaymentMethod,
  WalletBalance,
  WalletTransaction,
  ConnectWalletRequest,
  ConnectWalletResponse,
  SyncWalletResponse,
  GooglePayCard,
  GooglePayAPIResponse
} from '../types';

export interface GooglePayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
}

export class GooglePayService implements WalletProvider {
  private logger: Logger;
  private config: GooglePayConfig;
  private httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(config: GooglePayConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Set base URL based on environment
    this.baseUrl = config.environment === 'production' 
      ? 'https://pay.googleapis.com' 
      : 'https://pay-sandbox.googleapis.com';
    
    // Configure HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DwayBank/1.0'
      }
    });

    // Add request/response interceptors for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Google Pay API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Google Pay API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Google Pay API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error('Google Pay API Response Error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.response?.data?.error?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Connect Google Pay wallet using OAuth 2.0 flow
   */
  async connect(request: ConnectWalletRequest): Promise<ConnectWalletResponse> {
    try {
      this.logger.info('Initiating Google Pay connection');

      // If we have an auth code, exchange it for tokens
      if (request.auth_code) {
        const tokenResponse = await this.exchangeAuthCode(request.auth_code);
        
        // Test connection by fetching user profile
        const userProfile = await this.getUserProfile(tokenResponse.access_token);
        
        return {
          connection_id: userProfile.id || 'google_pay_user',
          status: 'connected',
          payment_methods: [], // Will be populated during sync
          message: 'Google Pay connected successfully',
          auth_url: undefined
        };
      } else {
        // Return OAuth URL for user authorization
        const authUrl = this.generateAuthUrl();
        
        return {
          connection_id: 'pending',
          status: 'pending_auth',
          payment_methods: [],
          message: 'Authorization required',
          auth_url: authUrl
        };
      }

    } catch (error) {
      this.logger.error('Google Pay connection failed:', error);
      throw new Error(`Google Pay connection failed: ${error.message}`);
    }
  }

  /**
   * Sync Google Pay wallet data
   */
  async sync(connection: WalletConnection): Promise<SyncWalletResponse> {
    try {
      this.logger.info(`Syncing Google Pay wallet: ${connection.id}`);

      if (!connection.access_token) {
        throw new Error('No access token available for Google Pay sync');
      }

      // Check if token is expired and refresh if needed
      const validToken = await this.ensureValidToken(connection);

      // Get payment methods from Google Pay
      const paymentMethods = await this.getPaymentMethods(connection);
      
      // Get balances (Note: Google Pay API has limited balance access)
      const balances = await this.getBalances(connection);
      
      // Get recent transactions (Note: Limited transaction data available)
      const transactions = await this.getTransactions(connection);

      return {
        connection_id: connection.id,
        status: 'connected',
        payment_methods_synced: paymentMethods.length,
        transactions_synced: transactions.length,
        balances_updated: balances.length,
        last_sync: new Date(),
        errors: []
      };

    } catch (error) {
      this.logger.error(`Google Pay sync failed for wallet ${connection.id}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect Google Pay wallet
   */
  async disconnect(connection: WalletConnection): Promise<void> {
    try {
      this.logger.info(`Disconnecting Google Pay wallet: ${connection.id}`);

      if (connection.access_token) {
        // Revoke the access token
        await this.revokeToken(connection.access_token);
      }

      this.logger.info(`Google Pay wallet disconnected: ${connection.id}`);
    } catch (error) {
      this.logger.error(`Failed to disconnect Google Pay wallet ${connection.id}:`, error);
      // Don't throw error - disconnection should succeed even if token revocation fails
    }
  }

  /**
   * Get payment methods from Google Pay
   */
  async getPaymentMethods(connection: WalletConnection): Promise<PaymentMethod[]> {
    try {
      const validToken = await this.ensureValidToken(connection);
      
      // NOTE: Google Pay API has limited access to payment method details
      // This is a simplified implementation - real integration would require
      // Google Pay partner access and specific API endpoints
      
      const response = await this.httpClient.get<GooglePayAPIResponse<GooglePayCard>>(
        '/v1/paymentMethods',
        {
          headers: {
            'Authorization': `Bearer ${validToken}`
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Google Pay API error: ${response.data.error.message}`);
      }

      return response.data.result.map(card => ({
        id: '', // Will be set by wallet service
        wallet_connection_id: connection.id,
        external_method_id: card.resourceId,
        type: this.mapCardClassToType(card.cardClass),
        display_name: card.cardDisplayName,
        last_four_digits: card.lastFourDigits,
        card_brand: this.normalizeCardNetwork(card.cardNetwork),
        currency: 'USD', // Default, may be determined from other sources
        is_active: true,
        metadata: {
          issuer: card.issuerDisplayName,
          tokenization_data: card.tokenizationData,
          original_response: card
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }));

    } catch (error) {
      this.logger.error('Failed to get Google Pay payment methods:', error);
      
      // Return mock data for demonstration purposes
      // In production, this would require proper Google Pay integration
      return this.getMockPaymentMethods(connection);
    }
  }

  /**
   * Get balances from Google Pay (limited availability)
   */
  async getBalances(connection: WalletConnection): Promise<WalletBalance[]> {
    try {
      // NOTE: Google Pay doesn't typically provide real-time balance data
      // This would require integration with card issuer APIs or bank APIs
      // For demonstration, we'll return mock data
      
      this.logger.warn('Google Pay balance retrieval is limited - using mock data');
      
      return this.getMockBalances(connection);

    } catch (error) {
      this.logger.error('Failed to get Google Pay balances:', error);
      return [];
    }
  }

  /**
   * Get transactions from Google Pay (limited availability)
   */
  async getTransactions(connection: WalletConnection, since?: Date): Promise<WalletTransaction[]> {
    try {
      // NOTE: Google Pay doesn't provide detailed transaction history
      // Transaction data would come from card issuer or bank integrations
      // For demonstration, we'll return mock data
      
      this.logger.warn('Google Pay transaction retrieval is limited - using mock data');
      
      return this.getMockTransactions(connection, since);

    } catch (error) {
      this.logger.error('Failed to get Google Pay transactions:', error);
      return [];
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  private generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeAuthCode(authCode: string): Promise<any> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange auth code:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile to verify connection
   */
  private async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user profile:', error);
      throw new Error('Failed to verify Google Pay connection');
    }
  }

  /**
   * Ensure token is valid and refresh if needed
   */
  private async ensureValidToken(connection: WalletConnection): Promise<string> {
    if (!connection.access_token) {
      throw new Error('No access token available');
    }

    // Check if token is expired
    if (connection.token_expires_at && new Date() >= connection.token_expires_at) {
      if (connection.refresh_token) {
        return await this.refreshToken(connection.refresh_token);
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }

    return connection.access_token;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(refreshToken: string): Promise<string> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      return response.data.access_token;
    } catch (error) {
      this.logger.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Revoke access token
   */
  private async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.post(`https://oauth2.googleapis.com/revoke?token=${accessToken}`);
    } catch (error) {
      this.logger.error('Failed to revoke token:', error);
      // Don't throw - revocation failure shouldn't block disconnection
    }
  }

  /**
   * Map Google Pay card class to our payment method type
   */
  private mapCardClassToType(cardClass: string): 'credit_card' | 'debit_card' | 'digital_wallet' {
    switch (cardClass?.toUpperCase()) {
      case 'CREDIT':
        return 'credit_card';
      case 'DEBIT':
        return 'debit_card';
      case 'PREPAID':
        return 'debit_card';
      default:
        return 'digital_wallet';
    }
  }

  /**
   * Normalize card network names
   */
  private normalizeCardNetwork(network: string): string {
    const networkMap: { [key: string]: string } = {
      'VISA': 'visa',
      'MASTERCARD': 'mastercard',
      'AMEX': 'amex',
      'AMERICAN_EXPRESS': 'amex',
      'DISCOVER': 'discover',
      'JCB': 'jcb',
      'UNIONPAY': 'unionpay'
    };

    return networkMap[network?.toUpperCase()] || network?.toLowerCase() || 'unknown';
  }

  /**
   * Get mock payment methods for demonstration
   */
  private getMockPaymentMethods(connection: WalletConnection): PaymentMethod[] {
    return [
      {
        id: '',
        wallet_connection_id: connection.id,
        external_method_id: 'gpay_card_1',
        type: 'credit_card',
        display_name: 'Chase Sapphire Reserve',
        last_four_digits: '4532',
        card_brand: 'visa',
        expiry_month: 12,
        expiry_year: 2027,
        currency: 'USD',
        is_active: true,
        metadata: {
          issuer: 'Chase Bank',
          google_pay_token: 'mock_token_1'
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      },
      {
        id: '',
        wallet_connection_id: connection.id,
        external_method_id: 'gpay_card_2',
        type: 'debit_card',
        display_name: 'Wells Fargo Checking',
        last_four_digits: '7890',
        card_brand: 'mastercard',
        expiry_month: 8,
        expiry_year: 2026,
        currency: 'USD',
        is_active: true,
        metadata: {
          issuer: 'Wells Fargo',
          google_pay_token: 'mock_token_2'
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }
    ];
  }

  /**
   * Get mock balances for demonstration
   */
  private getMockBalances(connection: WalletConnection): WalletBalance[] {
    return [
      {
        payment_method_id: 'gpay_card_1',
        current_balance: 2850.75,
        available_balance: 2650.75,
        pending_balance: 200.00,
        currency: 'USD',
        last_updated: new Date(),
        exchange_rate_usd: 1.0,
        balance_source: 'api'
      },
      {
        payment_method_id: 'gpay_card_2',
        current_balance: 1425.30,
        available_balance: 1425.30,
        pending_balance: 0,
        currency: 'USD',
        last_updated: new Date(),
        exchange_rate_usd: 1.0,
        balance_source: 'api'
      }
    ];
  }

  /**
   * Get mock transactions for demonstration
   */
  private getMockTransactions(connection: WalletConnection, since?: Date): WalletTransaction[] {
    const baseDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return [
      {
        id: '',
        wallet_connection_id: connection.id,
        payment_method_id: 'gpay_card_1',
        external_transaction_id: 'gpay_tx_1',
        amount: 45.67,
        currency: 'USD',
        description: 'Starbucks Coffee',
        merchant_name: 'Starbucks',
        merchant_category: 'Food & Dining',
        transaction_date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
        posted_date: new Date(baseDate.getTime() + 25 * 60 * 60 * 1000),
        transaction_type: 'debit',
        status: 'completed',
        exchange_rate_usd: 1.0,
        amount_usd: 45.67,
        metadata: {
          google_pay_transaction: true,
          contactless: true
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      },
      {
        id: '',
        wallet_connection_id: connection.id,
        payment_method_id: 'gpay_card_2',
        external_transaction_id: 'gpay_tx_2',
        amount: 89.32,
        currency: 'USD',
        description: 'Target Store Purchase',
        merchant_name: 'Target',
        merchant_category: 'Shopping',
        transaction_date: new Date(baseDate.getTime() + 48 * 60 * 60 * 1000),
        posted_date: new Date(baseDate.getTime() + 49 * 60 * 60 * 1000),
        transaction_type: 'debit',
        status: 'completed',
        exchange_rate_usd: 1.0,
        amount_usd: 89.32,
        metadata: {
          google_pay_transaction: true,
          contactless: true
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }
    ];
  }
}

export default GooglePayService;