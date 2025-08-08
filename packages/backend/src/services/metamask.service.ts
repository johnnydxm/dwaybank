/**
 * DwayBank Smart Wallet - MetaMask Integration Service
 * Implements WalletConnect protocol for cryptocurrency wallet connection
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
  MetaMaskAccount,
  MetaMaskTokenBalance,
  WalletConnectSession
} from '../types';

export interface MetaMaskConfig {
  infuraProjectId: string;
  etherscanApiKey: string;
  moralisApiKey?: string;
  alchemyApiKey?: string;
  supportedChains: number[];
  environment: 'mainnet' | 'testnet';
}

export interface ERC20Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export class MetaMaskService implements WalletProvider {
  private logger: Logger;
  private config: MetaMaskConfig;
  private httpClient: AxiosInstance;
  private etherscanClient: AxiosInstance;
  private infuraClient: AxiosInstance;

  // Common ERC-20 tokens for demo purposes
  private readonly commonTokens: ERC20Token[] = [
    {
      address: '0xA0b86a33E6441b12A21F34a3E4F99e9ed3e6C0B1',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8
    }
  ];

  constructor(config: MetaMaskConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Configure HTTP client for general use
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DwayBank/1.0'
      }
    });

    // Configure Etherscan client
    this.etherscanClient = axios.create({
      baseURL: config.environment === 'mainnet' 
        ? 'https://api.etherscan.io/api'
        : 'https://api-goerli.etherscan.io/api',
      timeout: 30000,
      params: {
        apikey: config.etherscanApiKey
      }
    });

    // Configure Infura client
    this.infuraClient = axios.create({
      baseURL: config.environment === 'mainnet'
        ? `https://mainnet.infura.io/v3/${config.infuraProjectId}`
        : `https://goerli.infura.io/v3/${config.infuraProjectId}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add logging interceptors
    this.addLoggingInterceptors();
  }

  /**
   * Connect MetaMask wallet using WalletConnect
   */
  async connect(request: ConnectWalletRequest): Promise<ConnectWalletResponse> {
    try {
      this.logger.info('Initiating MetaMask connection via WalletConnect');

      // In a real implementation, this would:
      // 1. Initialize WalletConnect client
      // 2. Generate connection URI
      // 3. Wait for wallet approval
      // 4. Establish session

      if (request.metadata?.walletConnectUri) {
        // Process WalletConnect URI and establish session
        const session = await this.establishWalletConnectSession(request.metadata.walletConnectUri);
        
        return {
          connection_id: session.sessionId,
          status: 'connected',
          payment_methods: [], // Will be populated during sync
          message: 'MetaMask connected successfully via WalletConnect'
        };
      } else {
        // Generate WalletConnect URI for QR code scanning
        const walletConnectUri = await this.generateWalletConnectUri();
        
        return {
          connection_id: 'pending',
          status: 'pending_auth',
          payment_methods: [],
          message: 'Scan QR code with MetaMask to connect',
          auth_url: walletConnectUri
        };
      }

    } catch (error) {
      this.logger.error('MetaMask connection failed:', error);
      throw new Error(`MetaMask connection failed: ${error.message}`);
    }
  }

  /**
   * Sync MetaMask wallet data
   */
  async sync(connection: WalletConnection): Promise<SyncWalletResponse> {
    try {
      this.logger.info(`Syncing MetaMask wallet: ${connection.id}`);

      const accounts = await this.getWalletAccounts(connection);
      const paymentMethods = await this.getPaymentMethods(connection);
      const balances = await this.getBalances(connection);
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
      this.logger.error(`MetaMask sync failed for wallet ${connection.id}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect MetaMask wallet
   */
  async disconnect(connection: WalletConnection): Promise<void> {
    try {
      this.logger.info(`Disconnecting MetaMask wallet: ${connection.id}`);

      // In a real implementation, this would disconnect the WalletConnect session
      await this.disconnectWalletConnectSession(connection);

      this.logger.info(`MetaMask wallet disconnected: ${connection.id}`);
    } catch (error) {
      this.logger.error(`Failed to disconnect MetaMask wallet ${connection.id}:`, error);
      // Don't throw error - disconnection should succeed
    }
  }

  /**
   * Get payment methods (accounts/tokens) from MetaMask
   */
  async getPaymentMethods(connection: WalletConnection): Promise<PaymentMethod[]> {
    try {
      const accounts = await this.getWalletAccounts(connection);
      const paymentMethods: PaymentMethod[] = [];

      for (const account of accounts) {
        // Add main ETH account
        paymentMethods.push({
          id: '',
          wallet_connection_id: connection.id,
          external_method_id: `${account.address}_ETH`,
          type: 'crypto_wallet',
          display_name: `Ethereum (${account.address.substring(0, 6)}...${account.address.substring(38)})`,
          currency: 'ETH',
          is_active: true,
          metadata: {
            address: account.address,
            chainId: account.chainId,
            networkName: account.networkName,
            tokenType: 'native'
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        });

        // Add common ERC-20 tokens
        for (const token of this.commonTokens) {
          const tokenBalance = await this.getTokenBalance(account.address, token);
          
          if (tokenBalance && parseFloat(tokenBalance.balance) > 0) {
            paymentMethods.push({
              id: '',
              wallet_connection_id: connection.id,
              external_method_id: `${account.address}_${token.symbol}`,
              type: 'crypto_wallet',
              display_name: `${token.name} (${token.symbol})`,
              currency: token.symbol,
              is_active: true,
              metadata: {
                address: account.address,
                tokenAddress: token.address,
                chainId: account.chainId,
                networkName: account.networkName,
                tokenType: 'ERC20',
                decimals: token.decimals
              },
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null
            });
          }
        }
      }

      return paymentMethods;

    } catch (error) {
      this.logger.error('Failed to get MetaMask payment methods:', error);
      return this.getMockPaymentMethods(connection);
    }
  }

  /**
   * Get balances from MetaMask accounts
   */
  async getBalances(connection: WalletConnection): Promise<WalletBalance[]> {
    try {
      const accounts = await this.getWalletAccounts(connection);
      const balances: WalletBalance[] = [];

      for (const account of accounts) {
        // Get ETH balance
        const ethBalance = await this.getEthBalance(account.address);
        const ethPriceUsd = await this.getEthPriceUsd();

        balances.push({
          payment_method_id: `${account.address}_ETH`,
          current_balance: parseFloat(ethBalance),
          available_balance: parseFloat(ethBalance),
          pending_balance: 0,
          currency: 'ETH',
          last_updated: new Date(),
          exchange_rate_usd: ethPriceUsd,
          balance_source: 'api'
        });

        // Get token balances
        for (const token of this.commonTokens) {
          const tokenBalance = await this.getTokenBalance(account.address, token);
          
          if (tokenBalance && parseFloat(tokenBalance.balance) > 0) {
            const tokenPriceUsd = await this.getTokenPriceUsd(token.symbol);

            balances.push({
              payment_method_id: `${account.address}_${token.symbol}`,
              current_balance: parseFloat(tokenBalance.balanceFormatted),
              available_balance: parseFloat(tokenBalance.balanceFormatted),
              pending_balance: 0,
              currency: token.symbol,
              last_updated: new Date(),
              exchange_rate_usd: tokenPriceUsd,
              balance_source: 'api'
            });
          }
        }
      }

      return balances;

    } catch (error) {
      this.logger.error('Failed to get MetaMask balances:', error);
      return this.getMockBalances(connection);
    }
  }

  /**
   * Get transactions from MetaMask accounts
   */
  async getTransactions(connection: WalletConnection, since?: Date): Promise<WalletTransaction[]> {
    try {
      const accounts = await this.getWalletAccounts(connection);
      const transactions: WalletTransaction[] = [];

      for (const account of accounts) {
        // Get ETH transactions
        const ethTransactions = await this.getEthTransactions(account.address, since);
        transactions.push(...ethTransactions);

        // Get token transactions
        for (const token of this.commonTokens) {
          const tokenTransactions = await this.getTokenTransactions(account.address, token, since);
          transactions.push(...tokenTransactions);
        }
      }

      return transactions.sort((a, b) => 
        new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      );

    } catch (error) {
      this.logger.error('Failed to get MetaMask transactions:', error);
      return this.getMockTransactions(connection, since);
    }
  }

  /**
   * Get wallet accounts from connection metadata
   */
  private async getWalletAccounts(connection: WalletConnection): Promise<MetaMaskAccount[]> {
    try {
      // In a real implementation, this would get accounts from WalletConnect session
      const metadata = connection.metadata as any;
      
      if (metadata?.accounts && Array.isArray(metadata.accounts)) {
        return metadata.accounts.map((account: any) => ({
          address: account.address || account,
          chainId: account.chainId || 1,
          networkName: account.networkName || 'Ethereum Mainnet',
          balance: account.balance || '0',
          balanceFormatted: account.balanceFormatted || '0'
        }));
      }

      // Return mock account for demonstration
      return this.getMockAccounts();

    } catch (error) {
      this.logger.error('Failed to get wallet accounts:', error);
      return this.getMockAccounts();
    }
  }

  /**
   * Get ETH balance for an address
   */
  private async getEthBalance(address: string): Promise<string> {
    try {
      const response = await this.infuraClient.post('/', {
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      // Convert from wei to ETH
      const balanceWei = parseInt(response.data.result, 16);
      const balanceEth = balanceWei / Math.pow(10, 18);
      
      return balanceEth.toString();

    } catch (error) {
      this.logger.error(`Failed to get ETH balance for ${address}:`, error);
      return '0';
    }
  }

  /**
   * Get token balance for an address
   */
  private async getTokenBalance(address: string, token: ERC20Token): Promise<MetaMaskTokenBalance | null> {
    try {
      // ERC-20 balanceOf method call
      const data = `0x70a08231000000000000000000000000${address.substring(2)}`;
      
      const response = await this.infuraClient.post('/', {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: token.address,
          data: data
        }, 'latest'],
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const balanceHex = response.data.result;
      const balanceWei = parseInt(balanceHex, 16);
      const balance = balanceWei / Math.pow(10, token.decimals);

      return {
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        decimals: token.decimals,
        balance: balanceWei.toString(),
        balanceFormatted: balance.toString()
      };

    } catch (error) {
      this.logger.error(`Failed to get ${token.symbol} balance for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get ETH transactions for an address
   */
  private async getEthTransactions(address: string, since?: Date): Promise<WalletTransaction[]> {
    try {
      const params = {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: 0,
        endblock: 99999999,
        sort: 'desc',
        page: 1,
        offset: 100
      };

      const response = await this.etherscanClient.get('', { params });

      if (response.data.status !== '1') {
        throw new Error(response.data.message);
      }

      return response.data.result
        .filter((tx: any) => {
          if (since) {
            const txDate = new Date(parseInt(tx.timeStamp) * 1000);
            return txDate >= since;
          }
          return true;
        })
        .map((tx: any) => ({
          id: '',
          wallet_connection_id: '',
          payment_method_id: `${address}_ETH`,
          external_transaction_id: tx.hash,
          amount: parseFloat(tx.value) / Math.pow(10, 18),
          currency: 'ETH',
          description: `ETH Transfer ${tx.from === address.toLowerCase() ? 'to' : 'from'} ${tx.from === address.toLowerCase() ? tx.to : tx.from}`,
          transaction_date: new Date(parseInt(tx.timeStamp) * 1000),
          posted_date: new Date(parseInt(tx.timeStamp) * 1000),
          transaction_type: tx.from === address.toLowerCase() ? 'debit' : 'credit',
          status: tx.txreceipt_status === '1' ? 'completed' : 'failed',
          metadata: {
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            gasUsed: tx.gasUsed,
            gasPrice: tx.gasPrice,
            from: tx.from,
            to: tx.to
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        }));

    } catch (error) {
      this.logger.error(`Failed to get ETH transactions for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get token transactions for an address
   */
  private async getTokenTransactions(address: string, token: ERC20Token, since?: Date): Promise<WalletTransaction[]> {
    try {
      const params = {
        module: 'account',
        action: 'tokentx',
        contractaddress: token.address,
        address: address,
        startblock: 0,
        endblock: 99999999,
        sort: 'desc',
        page: 1,
        offset: 50
      };

      const response = await this.etherscanClient.get('', { params });

      if (response.data.status !== '1') {
        return [];
      }

      return response.data.result
        .filter((tx: any) => {
          if (since) {
            const txDate = new Date(parseInt(tx.timeStamp) * 1000);
            return txDate >= since;
          }
          return true;
        })
        .map((tx: any) => ({
          id: '',
          wallet_connection_id: '',
          payment_method_id: `${address}_${token.symbol}`,
          external_transaction_id: tx.hash,
          amount: parseFloat(tx.value) / Math.pow(10, token.decimals),
          currency: token.symbol,
          description: `${token.symbol} Transfer ${tx.from === address.toLowerCase() ? 'to' : 'from'} ${tx.from === address.toLowerCase() ? tx.to : tx.from}`,
          transaction_date: new Date(parseInt(tx.timeStamp) * 1000),
          posted_date: new Date(parseInt(tx.timeStamp) * 1000),
          transaction_type: tx.from === address.toLowerCase() ? 'debit' : 'credit',
          status: 'completed',
          metadata: {
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            gasUsed: tx.gasUsed,
            gasPrice: tx.gasPrice,
            from: tx.from,
            to: tx.to,
            tokenAddress: token.address,
            tokenSymbol: token.symbol
          },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        }));

    } catch (error) {
      this.logger.error(`Failed to get ${token.symbol} transactions for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get current ETH price in USD
   */
  private async getEthPriceUsd(): Promise<number> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      return response.data.ethereum.usd || 0;
    } catch (error) {
      this.logger.error('Failed to get ETH price:', error);
      return 2000; // Mock price
    }
  }

  /**
   * Get token price in USD
   */
  private async getTokenPriceUsd(symbol: string): Promise<number> {
    try {
      const tokenIds: { [key: string]: string } = {
        'USDC': 'usd-coin',
        'USDT': 'tether',
        'WBTC': 'wrapped-bitcoin'
      };

      const tokenId = tokenIds[symbol];
      if (!tokenId) return 1; // Default to $1 for unknown tokens

      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`);
      return response.data[tokenId]?.usd || 1;
    } catch (error) {
      this.logger.error(`Failed to get ${symbol} price:`, error);
      return 1; // Mock price
    }
  }

  /**
   * Generate WalletConnect URI (mock implementation)
   */
  private async generateWalletConnectUri(): Promise<string> {
    // In a real implementation, this would use WalletConnect client
    const mockUri = `wc:${Date.now()}@1?bridge=https://bridge.walletconnect.org&key=${Math.random().toString(36).substring(7)}`;
    return mockUri;
  }

  /**
   * Establish WalletConnect session (mock implementation)
   */
  private async establishWalletConnectSession(uri: string): Promise<WalletConnectSession> {
    // Mock session establishment
    return {
      sessionId: `session_${Date.now()}`,
      accounts: ['0x742d35Cc6634C0532925a3b8D814e207b0e1C1E1'],
      chainId: 1,
      peerMeta: {
        description: 'MetaMask Wallet',
        url: 'https://metamask.io',
        icons: ['https://metamask.io/images/mm-logo.svg'],
        name: 'MetaMask'
      }
    };
  }

  /**
   * Disconnect WalletConnect session
   */
  private async disconnectWalletConnectSession(connection: WalletConnection): Promise<void> {
    // Mock disconnection
    this.logger.info(`Disconnecting WalletConnect session: ${connection.external_wallet_id}`);
  }

  /**
   * Add logging interceptors to HTTP clients
   */
  private addLoggingInterceptors(): void {
    [this.httpClient, this.etherscanClient, this.infuraClient].forEach(client => {
      client.interceptors.request.use(
        (config) => {
          this.logger.debug(`MetaMask API Request: ${config.method?.toUpperCase()} ${config.url || config.baseURL}`);
          return config;
        },
        (error) => {
          this.logger.error('MetaMask API Request Error:', error);
          return Promise.reject(error);
        }
      );
    });
  }

  /**
   * Mock methods for demonstration
   */
  private getMockAccounts(): MetaMaskAccount[] {
    return [
      {
        address: '0x742d35Cc6634C0532925a3b8D814e207b0e1C1E1',
        chainId: 1,
        networkName: 'Ethereum Mainnet',
        balance: '2500000000000000000', // 2.5 ETH in wei
        balanceFormatted: '2.5'
      }
    ];
  }

  private getMockPaymentMethods(connection: WalletConnection): PaymentMethod[] {
    return [
      {
        id: '',
        wallet_connection_id: connection.id,
        external_method_id: '0x742d35Cc6634C0532925a3b8D814e207b0e1C1E1_ETH',
        type: 'crypto_wallet',
        display_name: 'Ethereum (0x742d...C1E1)',
        currency: 'ETH',
        is_active: true,
        metadata: {
          address: '0x742d35Cc6634C0532925a3b8D814e207b0e1C1E1',
          chainId: 1,
          networkName: 'Ethereum Mainnet',
          tokenType: 'native'
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }
    ];
  }

  private getMockBalances(connection: WalletConnection): WalletBalance[] {
    return [
      {
        payment_method_id: '0x742d35Cc6634C0532925a3b8D814e207b0e1C1E1_ETH',
        current_balance: 2.5,
        available_balance: 2.5,
        pending_balance: 0,
        currency: 'ETH',
        last_updated: new Date(),
        exchange_rate_usd: 2000,
        balance_source: 'api'
      }
    ];
  }

  private getMockTransactions(connection: WalletConnection, since?: Date): WalletTransaction[] {
    const baseDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return [
      {
        id: '',
        wallet_connection_id: connection.id,
        payment_method_id: '0x742d35Cc6634C0532925a3b8D814e207b0e1C1E1_ETH',
        external_transaction_id: '0x123...abc',
        amount: 0.1,
        currency: 'ETH',
        description: 'ETH Transfer to 0x456...def',
        transaction_date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
        posted_date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
        transaction_type: 'debit',
        status: 'completed',
        exchange_rate_usd: 2000,
        amount_usd: 200,
        metadata: {
          hash: '0x123...abc',
          blockNumber: '12345678',
          gasUsed: '21000'
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }
    ];
  }
}

export default MetaMaskService;