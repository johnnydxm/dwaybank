/**
 * DwayBank Smart Wallet - Wallet Integration Configuration
 * Configuration for wallet service providers
 */

import { GooglePayConfig } from '../services/google-pay.service';
import { ApplePayConfig } from '../services/apple-pay.service';
import { MetaMaskConfig } from '../services/metamask.service';

export interface WalletConfiguration {
  googlePay?: GooglePayConfig;
  applePay?: ApplePayConfig;
  metaMask?: MetaMaskConfig;
}

export function getWalletConfig(): WalletConfiguration {
  const config: WalletConfiguration = {};

  // Google Pay Configuration
  if (process.env.GOOGLE_PAY_CLIENT_ID && process.env.GOOGLE_PAY_CLIENT_SECRET) {
    config.googlePay = {
      clientId: process.env.GOOGLE_PAY_CLIENT_ID,
      clientSecret: process.env.GOOGLE_PAY_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_PAY_REDIRECT_URI || 'http://localhost:3000/auth/google-pay/callback',
      environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
      scopes: [
        'https://www.googleapis.com/auth/wallet_object.issuer',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };
  }

  // Apple Pay Configuration
  if (process.env.APPLE_PAY_TEAM_ID && process.env.APPLE_PAY_MERCHANT_ID) {
    config.applePay = {
      teamId: process.env.APPLE_PAY_TEAM_ID,
      merchantId: process.env.APPLE_PAY_MERCHANT_ID,
      keyId: process.env.APPLE_PAY_KEY_ID || '',
      privateKey: process.env.APPLE_PAY_PRIVATE_KEY || '',
      environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
      passTypeIdentifier: process.env.APPLE_PAY_PASS_TYPE_ID || 'pass.com.dwaybank.wallet'
    };
  }

  // MetaMask Configuration
  if (process.env.INFURA_PROJECT_ID && process.env.ETHERSCAN_API_KEY) {
    config.metaMask = {
      infuraProjectId: process.env.INFURA_PROJECT_ID,
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
      moralisApiKey: process.env.MORALIS_API_KEY,
      alchemyApiKey: process.env.ALCHEMY_API_KEY,
      supportedChains: [1, 5, 137, 80001], // Ethereum Mainnet, Goerli, Polygon, Mumbai
      environment: (process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
    };
  }

  return config;
}

export default getWalletConfig;