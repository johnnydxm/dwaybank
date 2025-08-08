# Bank Integration API Patterns
**DwayBank - Canadian Bank Integration API Design**

## Overview

This document defines the API patterns, data transformation strategies, and synchronization mechanisms for integrating Canadian banks (CIBC, RBC, TD, BMO) into DwayBank's financial platform.

---

## 1. API Design Patterns

### 1.1 Unified Bank Client Interface

```typescript
// Base interface that all bank clients must implement
export interface BankClient {
  // Connection Management
  establishConnection(credentials: BankCredentials, consent: ConsentData): Promise<BankConnection>;
  refreshConnection(connection: BankConnection): Promise<BankConnection>;
  validateConnection(connection: BankConnection): Promise<boolean>;
  revokeConnection(connection: BankConnection): Promise<void>;

  // Account Operations
  getAccounts(connection: BankConnection, filters?: AccountFilter[]): Promise<BankAccount[]>;
  getAccountDetails(connection: BankConnection, accountId: string): Promise<BankAccountDetails>;
  getAccountBalance(connection: BankConnection, accountId: string): Promise<AccountBalance>;

  // Transaction Operations
  getTransactions(connection: BankConnection, accountId: string, options: TransactionOptions): Promise<BankTransaction[]>;
  getRecentTransactions(connection: BankConnection, accountId: string, options: TransactionOptions): Promise<BankTransaction[]>;
  getTransactionDetails(connection: BankConnection, transactionId: string): Promise<BankTransactionDetails>;

  // Transfer Operations (if supported)
  initiateTransfer(connection: BankConnection, request: TransferRequest): Promise<TransferResult>;
  getTransferStatus(connection: BankConnection, transferId: string): Promise<TransferStatus>;
  cancelTransfer(connection: BankConnection, transferId: string): Promise<CancelResult>;

  // Utility Methods
  supportsFeature(feature: BankFeature): boolean;
  getConnectionMetadata(connection: BankConnection): Promise<ConnectionMetadata>;
  healthCheck(): Promise<HealthStatus>;
}
```

### 1.2 Bank-Specific Implementations

```typescript
// RBC-specific implementation
export class RBCApiClient implements BankClient {
  private readonly endpoints = {
    accounts: '/v2/accounts',
    transactions: '/v2/accounts/{accountId}/transactions',
    payments: '/v2/domestic-payments',
    oauth: '/oauth2/token'
  };

  // OAuth 2.0 with PKCE for RBC Open API
  async establishConnection(
    credentials: RBCCredentials,
    consent: ConsentData
  ): Promise<BankConnection> {
    const tokenRequest = {
      grant_type: 'authorization_code',
      code: credentials.authorizationCode,
      client_id: this.config.clientId,
      code_verifier: credentials.codeVerifier,
      redirect_uri: this.config.redirectUri
    };

    const response = await this.httpClient.post(this.endpoints.oauth, tokenRequest);
    
    return {
      bankId: 'rbc',
      type: 'oauth',
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      scopes: consent.scopes,
      metadata: await this.getConnectionMetadata(response.data.access_token)
    };
  }

  // Data transformation for RBC-specific format
  private transformRBCAccount = (rbcAccount: any): BankAccount => ({
    id: rbcAccount.AccountId,
    externalAccountId: rbcAccount.AccountId,
    accountNumber: rbcAccount.Account[0]?.Identification,
    sortCode: rbcAccount.Account[0]?.SecondaryIdentification,
    accountType: this.mapAccountType(rbcAccount.AccountType),
    accountSubType: rbcAccount.AccountSubType,
    accountName: rbcAccount.Nickname || rbcAccount.Account[0]?.Name,
    balance: this.parseBalance(rbcAccount.Balance),
    availableBalance: this.parseAvailableBalance(rbcAccount.Balance),
    currency: rbcAccount.Balance[0]?.Amount?.Currency || 'CAD',
    status: rbcAccount.Status === 'Enabled' ? 'active' : 'inactive',
    openingDate: rbcAccount.OpeningDate ? new Date(rbcAccount.OpeningDate) : undefined,
    maturityDate: rbcAccount.MaturityDate ? new Date(rbcAccount.MaturityDate) : undefined,
    branchInfo: {
      branchCode: rbcAccount.ServicerSchemeIdentification,
      branchName: rbcAccount.ServicerIdentification,
      institutionNumber: '003' // RBC
    },
    accountMetadata: {
      productName: rbcAccount.Product,
      accountSubType: rbcAccount.AccountSubType,
      overdraftLimit: rbcAccount.OverdraftLimit
    }
  });
}

// TD-specific implementation
export class TDApiClient implements BankClient {
  private readonly endpoints = {
    accounts: '/v1/accounts',
    transactions: '/v1/accounts/{accountId}/transactions',
    token: '/token'
  };

  // Client credentials flow for TD API Platform
  async establishConnection(
    credentials: TDCredentials,
    consent: ConsentData
  ): Promise<BankConnection> {
    const tokenRequest = {
      grant_type: 'client_credentials',
      scope: consent.scopes.join(' '),
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    };

    const response = await this.httpClient.post(this.endpoints.token, tokenRequest);
    
    return {
      bankId: 'td',
      type: 'client_credentials',
      accessToken: response.data.access_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      scopes: consent.scopes,
      metadata: { grantType: 'client_credentials' }
    };
  }

  private transformTDAccount = (tdAccount: any): BankAccount => ({
    id: tdAccount.id,
    externalAccountId: tdAccount.id,
    accountNumber: tdAccount.attributes.accountNumber,
    accountType: this.mapAccountType(tdAccount.attributes.productType),
    accountName: tdAccount.attributes.nickname || tdAccount.attributes.productName,
    balance: parseFloat(tdAccount.attributes.currentBalance),
    availableBalance: parseFloat(tdAccount.attributes.availableBalance),
    currency: tdAccount.attributes.currencyCode,
    status: tdAccount.attributes.accountStatus === 'ACTIVE' ? 'active' : 'inactive',
    branchInfo: {
      branchCode: tdAccount.attributes.transitNumber,
      institutionNumber: '004' // TD
    },
    accountMetadata: {
      productType: tdAccount.attributes.productType,
      interestRate: tdAccount.attributes.interestRate
    }
  });
}
```

### 1.3 Aggregation Service Adapter Pattern

```typescript
// Unified adapter for aggregation services (Yodlee, Plaid, MX)
export class AggregationServiceAdapter implements BankClient {
  private aggregationClient: YodleeClient | PlaidClient | MXClient;
  private bankMapping: BankMappingService;

  constructor(
    private provider: 'yodlee' | 'plaid' | 'mx',
    private config: AggregationConfig
  ) {
    this.aggregationClient = this.createClient(provider, config);
    this.bankMapping = new BankMappingService();
  }

  async establishConnection(
    credentials: AggregationCredentials,
    consent: ConsentData
  ): Promise<BankConnection> {
    switch (this.provider) {
      case 'yodlee':
        return this.establishYodleeConnection(credentials, consent);
      case 'plaid':
        return this.establishPlaidConnection(credentials, consent);
      case 'mx':
        return this.establishMXConnection(credentials, consent);
      default:
        throw new Error(`Unsupported aggregation provider: ${this.provider}`);
    }
  }

  async getAccounts(connection: BankConnection): Promise<BankAccount[]> {
    const rawAccounts = await this.aggregationClient.getAccounts(connection);
    
    // Transform aggregation service data to unified format
    return rawAccounts.map(account => this.transformToUnifiedAccount(account));
  }

  private transformToUnifiedAccount(rawAccount: any): BankAccount {
    // Map provider-specific account data to unified BankAccount interface
    const mapping = this.bankMapping.getAccountMapping(this.provider, rawAccount.institutionId);
    
    return {
      id: rawAccount.id,
      externalAccountId: rawAccount.id,
      accountNumber: rawAccount.accountNumber || rawAccount.mask,
      accountType: mapping.mapAccountType(rawAccount.accountType),
      accountName: rawAccount.name || rawAccount.officialName,
      balance: parseFloat(rawAccount.balances.current),
      availableBalance: parseFloat(rawAccount.balances.available || rawAccount.balances.current),
      currency: rawAccount.balances.isoCurrencyCode || 'CAD',
      status: 'active',
      branchInfo: {
        institutionNumber: mapping.getInstitutionNumber(rawAccount.institutionId)
      },
      accountMetadata: {
        aggregationProvider: this.provider,
        institutionId: rawAccount.institutionId,
        accountSubtype: rawAccount.subtype
      }
    };
  }
}
```

---

## 2. Data Transformation Strategies

### 2.1 Account Data Transformation

```typescript
export class AccountDataTransformer {
  /**
   * Transform external bank account to DwayBank account format
   */
  async transformBankAccount(
    bankAccount: BankAccount,
    bankId: string,
    userId: string
  ): Promise<CreateAccountData> {
    return {
      account_type: this.mapToInternalAccountType(bankAccount.accountType),
      account_name: this.sanitizeAccountName(bankAccount.accountName),
      institution_name: this.getInstitutionName(bankId),
      currency: bankAccount.currency || 'CAD',
      is_external: true,
      external_bank_name: this.getInstitutionName(bankId),
      external_account_id: bankAccount.id,
      routing_number: this.buildRoutingNumber(bankAccount.branchInfo),
      account_metadata: {
        originalData: bankAccount,
        bankId,
        importDate: new Date().toISOString(),
        syncEnabled: true,
        lastSyncDate: new Date().toISOString()
      }
    };
  }

  /**
   * Map external account types to internal types
   */
  private mapToInternalAccountType(externalType: string): 'checking' | 'savings' | 'investment' | 'credit' {
    const typeMapping: Record<string, 'checking' | 'savings' | 'investment' | 'credit'> = {
      // RBC mappings
      'Current': 'checking',
      'Savings': 'savings',
      'CreditCard': 'credit',
      'Investment': 'investment',
      'TFSA': 'savings',
      'RRSP': 'investment',
      
      // TD mappings
      'CHECKING': 'checking',
      'SAVINGS': 'savings',
      'CREDIT_CARD': 'credit',
      'INVESTMENT': 'investment',
      'PERSONAL_LOAN': 'credit',
      
      // BMO mappings
      'TRANSACTION': 'checking',
      'DEPOSIT': 'savings',
      'CREDIT': 'credit',
      'INVESTMENT': 'investment',
      
      // CIBC mappings
      'CurrentAccount': 'checking',
      'SavingsAccount': 'savings',
      'CreditCardAccount': 'credit',
      'InvestmentAccount': 'investment',
      
      // Aggregation service mappings
      'depository': 'checking',
      'savings': 'savings',
      'credit': 'credit',
      'investment': 'investment',
      'loan': 'credit'
    };

    return typeMapping[externalType] || 'checking';
  }

  /**
   * Build routing number from branch information
   */
  private buildRoutingNumber(branchInfo: any): string {
    const institutionNumber = branchInfo.institutionNumber;
    const branchCode = branchInfo.branchCode || branchInfo.transitNumber;
    
    if (institutionNumber && branchCode) {
      // Canadian routing number format: 0XXXYYYYY (institution + branch)
      return `0${institutionNumber}${branchCode.padStart(5, '0')}`;
    }
    
    return '';
  }
}
```

### 2.2 Transaction Data Transformation

```typescript
export class TransactionDataTransformer {
  private categoryMapper: TransactionCategoryMapper;
  private merchantEnricher: MerchantDataEnricher;

  constructor() {
    this.categoryMapper = new TransactionCategoryMapper();
    this.merchantEnricher = new MerchantDataEnricher();
  }

  /**
   * Transform bank transaction to DwayBank transaction format
   */
  async transformBankTransaction(
    bankTransaction: BankTransaction,
    dwayAccountId: string,
    bankId: string
  ): Promise<TransactionData> {
    const baseTransaction = {
      account_id: dwayAccountId,
      external_transaction_id: bankTransaction.id,
      amount: Math.abs(bankTransaction.amount),
      transaction_type: this.determineTransactionType(bankTransaction),
      description: this.cleanDescription(bankTransaction.description),
      transaction_date: bankTransaction.date,
      posted_date: bankTransaction.valueDate || bankTransaction.date,
      currency: bankTransaction.currency || 'CAD',
      status: this.mapTransactionStatus(bankTransaction.status),
      reference_number: bankTransaction.reference,
      category: await this.categorizeTransaction(bankTransaction),
      merchant_info: await this.enrichMerchantData(bankTransaction),
      location: this.extractLocation(bankTransaction),
      transaction_metadata: {
        bankId,
        originalData: bankTransaction,
        importSource: 'bank_api',
        importDate: new Date().toISOString(),
        transactionCode: bankTransaction.metadata?.transactionCode
      }
    };

    return baseTransaction;
  }

  /**
   * Determine transaction type (debit/credit) consistently
   */
  private determineTransactionType(transaction: BankTransaction): 'debit' | 'credit' {
    // Check explicit type from bank
    if (transaction.transactionType) {
      return transaction.transactionType;
    }

    // Check amount sign
    if (transaction.amount > 0) {
      return 'credit';
    } else if (transaction.amount < 0) {
      return 'debit';
    }

    // Check description for indicators
    const description = transaction.description?.toLowerCase() || '';
    const creditIndicators = ['deposit', 'credit', 'refund', 'salary', 'payment received'];
    const debitIndicators = ['withdrawal', 'purchase', 'payment', 'fee', 'charge'];

    for (const indicator of creditIndicators) {
      if (description.includes(indicator)) {
        return 'credit';
      }
    }

    for (const indicator of debitIndicators) {
      if (description.includes(indicator)) {
        return 'debit';
      }
    }

    // Default to debit for unknown transactions
    return 'debit';
  }

  /**
   * Categorize transaction using ML and rule-based approaches
   */
  private async categorizeTransaction(transaction: BankTransaction): Promise<string> {
    const categoryData = {
      description: transaction.description,
      amount: transaction.amount,
      merchantInfo: transaction.merchantInfo,
      transactionCode: transaction.metadata?.transactionCode,
      location: transaction.metadata?.location
    };

    // Use category mapper to determine category
    const category = await this.categoryMapper.categorize(categoryData);
    
    return category || 'other';
  }

  /**
   * Enrich merchant data with additional information
   */
  private async enrichMerchantData(transaction: BankTransaction): Promise<MerchantInfo | null> {
    if (!transaction.merchantInfo && !transaction.description) {
      return null;
    }

    const merchantData = transaction.merchantInfo || {
      name: this.extractMerchantName(transaction.description)
    };

    // Enrich with additional data if available
    return this.merchantEnricher.enrich(merchantData);
  }

  /**
   * Extract merchant name from transaction description
   */
  private extractMerchantName(description: string): string {
    if (!description) return '';

    // Clean up common bank formatting
    let merchantName = description
      .replace(/^\*+/, '') // Remove leading asterisks
      .replace(/\s+\d{4}$/, '') // Remove trailing 4-digit codes
      .replace(/\s+[A-Z]{2}$/, '') // Remove state/province codes
      .replace(/POS\s+/, '') // Remove POS prefix
      .replace(/PREAUTH\s+/, '') // Remove PREAUTH prefix
      .trim();

    // Capitalize properly
    merchantName = merchantName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return merchantName;
  }
}
```

### 2.3 Balance Synchronization Strategy

```typescript
export class BalanceSynchronizationStrategy {
  constructor(
    private db: Pool,
    private conflictResolver: ConflictResolver,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Synchronize account balance with bank data
   */
  async synchronizeBalance(
    accountId: string,
    bankBalance: BankAccountBalance,
    bankId: string
  ): Promise<BalanceSyncResult> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get current DwayBank balance
      const { rows: currentRows } = await client.query(
        'SELECT balance, available_balance, updated_at FROM accounts WHERE id = $1',
        [accountId]
      );

      if (currentRows.length === 0) {
        throw new Error('Account not found');
      }

      const current = currentRows[0];
      const currentBalance = parseFloat(current.balance);
      const bankBalanceAmount = parseFloat(bankBalance.current);
      const discrepancy = Math.abs(currentBalance - bankBalanceAmount);

      // Determine sync strategy based on discrepancy
      let syncResult: BalanceSyncResult;

      if (discrepancy < 0.01) {
        // Balances match (within penny tolerance)
        syncResult = {
          status: 'synchronized',
          currentBalance: currentBalance,
          bankBalance: bankBalanceAmount,
          discrepancy: discrepancy,
          action: 'none'
        };
      } else if (discrepancy <= this.getToleranceThreshold(accountId)) {
        // Small discrepancy - update to bank balance
        await this.updateAccountBalance(client, accountId, bankBalance);
        
        syncResult = {
          status: 'updated',
          currentBalance: currentBalance,
          bankBalance: bankBalanceAmount,
          discrepancy: discrepancy,
          action: 'balance_updated'
        };
      } else {
        // Large discrepancy - requires conflict resolution
        const resolution = await this.conflictResolver.resolveBalanceConflict({
          accountId,
          dwayBankBalance: currentBalance,
          bankBalance: bankBalanceAmount,
          discrepancy,
          lastUpdated: current.updated_at
        });

        await this.applyBalanceResolution(client, accountId, resolution);

        syncResult = {
          status: 'conflict_resolved',
          currentBalance: currentBalance,
          bankBalance: bankBalanceAmount,
          discrepancy: discrepancy,
          action: resolution.action,
          resolution: resolution
        };
      }

      // Log synchronization event
      await this.auditLogger.logBalanceSync({
        accountId,
        bankId,
        syncResult,
        timestamp: new Date()
      });

      await client.query('COMMIT');
      return syncResult;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update account balance in database
   */
  private async updateAccountBalance(
    client: any,
    accountId: string,
    balance: BankAccountBalance
  ): Promise<void> {
    await client.query(`
      UPDATE accounts 
      SET 
        balance = $1,
        available_balance = $2,
        updated_at = CURRENT_TIMESTAMP,
        last_sync_date = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      balance.current,
      balance.available || balance.current,
      accountId
    ]);
  }

  /**
   * Get tolerance threshold based on account type and balance
   */
  private getToleranceThreshold(accountId: string): number {
    // Base tolerance of $1.00 for most accounts
    // Higher tolerance for investment accounts due to market fluctuations
    // Lower tolerance for credit cards and loans
    return 1.00;
  }
}
```

---

## 3. Real-Time Synchronization Patterns

### 3.1 Event-Driven Sync Architecture

```typescript
export class EventDrivenSyncOrchestrator {
  private eventBus: EventBus;
  private syncQueues: Map<string, Queue>;
  private webhookHandlers: Map<string, WebhookHandler>;

  constructor(
    private redis: Redis,
    private db: Pool,
    private config: SyncConfig
  ) {
    this.eventBus = new EventBus(redis);
    this.initializeSyncQueues();
    this.setupWebhookHandlers();
  }

  /**
   * Handle real-time bank webhooks
   */
  async handleBankWebhook(
    bankId: string,
    webhookData: BankWebhookData
  ): Promise<void> {
    const handler = this.webhookHandlers.get(bankId);
    if (!handler) {
      throw new Error(`No webhook handler for bank: ${bankId}`);
    }

    // Validate webhook signature
    await handler.validateSignature(webhookData);

    // Process webhook based on event type
    switch (webhookData.eventType) {
      case 'account.balance.updated':
        await this.handleBalanceUpdate(bankId, webhookData);
        break;
      case 'account.transaction.created':
        await this.handleNewTransaction(bankId, webhookData);
        break;
      case 'account.status.changed':
        await this.handleAccountStatusChange(bankId, webhookData);
        break;
      default:
        logger.warn('Unknown webhook event type', { 
          bankId, 
          eventType: webhookData.eventType 
        });
    }
  }

  /**
   * Handle balance update events
   */
  private async handleBalanceUpdate(
    bankId: string,
    webhookData: BankWebhookData
  ): Promise<void> {
    const { accountId, newBalance } = webhookData.data;

    // Find corresponding DwayBank account
    const dwayAccount = await this.findDwayBankAccount(bankId, accountId);
    if (!dwayAccount) {
      logger.warn('Account not found for balance update', { bankId, accountId });
      return;
    }

    // Sync balance
    const syncResult = await this.balanceSyncStrategy.synchronizeBalance(
      dwayAccount.id,
      newBalance,
      bankId
    );

    // Emit real-time event to frontend
    await this.eventBus.emit('balance.updated', {
      userId: dwayAccount.user_id,
      accountId: dwayAccount.id,
      syncResult,
      timestamp: new Date()
    });
  }

  /**
   * Handle new transaction events
   */
  private async handleNewTransaction(
    bankId: string,
    webhookData: BankWebhookData
  ): Promise<void> {
    const { accountId, transaction } = webhookData.data;

    // Find corresponding DwayBank account
    const dwayAccount = await this.findDwayBankAccount(bankId, accountId);
    if (!dwayAccount) {
      logger.warn('Account not found for transaction', { bankId, accountId });
      return;
    }

    // Check if transaction already exists
    const existingTransaction = await this.findExistingTransaction(
      dwayAccount.id,
      transaction.id,
      bankId
    );

    if (existingTransaction) {
      logger.debug('Transaction already exists', { 
        dwayAccountId: dwayAccount.id,
        transactionId: transaction.id 
      });
      return;
    }

    // Transform and store transaction
    const transformedTransaction = await this.transactionTransformer.transformBankTransaction(
      transaction,
      dwayAccount.id,
      bankId
    );

    await this.storeTransaction(transformedTransaction);

    // Update account balance
    await this.updateAccountBalance(
      dwayAccount.id,
      transaction.amount,
      transaction.type
    );

    // Emit real-time event
    await this.eventBus.emit('transaction.created', {
      userId: dwayAccount.user_id,
      accountId: dwayAccount.id,
      transaction: transformedTransaction,
      timestamp: new Date()
    });
  }

  /**
   * Fallback polling sync for banks without webhooks
   */
  async schedulePollingSync(
    userId: string,
    connectionId: string,
    bankId: string
  ): Promise<void> {
    const syncQueue = this.syncQueues.get('polling-sync');
    
    await syncQueue.add(
      'poll-account-updates',
      {
        userId,
        connectionId,
        bankId,
        syncType: 'polling'
      },
      {
        repeat: {
          cron: this.config.pollingSyncSchedule, // '0 */4 * * *' - every 4 hours
          jobId: `poll-sync-${userId}-${connectionId}`
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );

    logger.info('Polling sync scheduled', { 
      userId, 
      connectionId, 
      bankId,
      schedule: this.config.pollingSyncSchedule
    });
  }

  /**
   * Process polling sync job
   */
  async processPollingSync(job: Job): Promise<void> {
    const { userId, connectionId, bankId } = job.data;

    try {
      // Get bank connection
      const connection = await this.getBankConnection(connectionId, userId);
      const bankClient = this.getBankClient(bankId);

      // Get all accounts for this connection
      const accounts = await this.getAccountsByConnection(connectionId);

      for (const account of accounts) {
        try {
          // Sync account balance
          const bankBalance = await bankClient.getAccountBalance(
            connection,
            account.external_account_id
          );

          await this.balanceSyncStrategy.synchronizeBalance(
            account.id,
            bankBalance,
            bankId
          );

          // Sync recent transactions (last 24 hours)
          const recentTransactions = await bankClient.getRecentTransactions(
            connection,
            account.external_account_id,
            { days: 1 }
          );

          await this.syncTransactions(account.id, recentTransactions, bankId);

        } catch (accountError) {
          logger.error('Account polling sync failed', { 
            accountId: account.id, 
            error: accountError 
          });
        }
      }

      // Update last sync timestamp
      await this.updateConnectionLastSync(connectionId);

    } catch (error) {
      logger.error('Polling sync job failed', { 
        userId, 
        connectionId, 
        bankId, 
        error 
      });
      throw error;
    }
  }
}
```

### 3.2 Conflict Resolution Strategy

```typescript
export class ConflictResolver {
  constructor(
    private db: Pool,
    private config: ConflictResolutionConfig,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Resolve balance conflicts between DwayBank and bank data
   */
  async resolveBalanceConflict(conflict: BalanceConflict): Promise<ConflictResolution> {
    const resolution: ConflictResolution = {
      conflictId: uuidv4(),
      accountId: conflict.accountId,
      conflictType: 'balance_discrepancy',
      detectedAt: new Date(),
      resolvedAt: new Date(),
      action: 'pending',
      confidence: 0
    };

    // Analyze conflict characteristics
    const analysis = await this.analyzeBalanceConflict(conflict);
    
    if (analysis.discrepancyPercentage < 0.1) {
      // Less than 0.1% discrepancy - trust bank data
      resolution.action = 'accept_bank_balance';
      resolution.resolvedBalance = conflict.bankBalance;
      resolution.confidence = 0.95;
      resolution.reasoning = 'Minor discrepancy, accepting bank balance';
      
    } else if (analysis.hasRecentTransactions) {
      // Recent transactions might explain discrepancy
      resolution.action = 'investigate_transactions';
      resolution.confidence = 0.7;
      resolution.reasoning = 'Recent transactions detected, requires investigation';
      
      // Trigger transaction resync
      await this.triggerTransactionResync(conflict.accountId);
      
    } else if (analysis.timeSinceLastSync > this.config.staleDataThreshold) {
      // Data might be stale - trust bank data
      resolution.action = 'accept_bank_balance';
      resolution.resolvedBalance = conflict.bankBalance;
      resolution.confidence = 0.8;
      resolution.reasoning = 'Stale local data, accepting bank balance';
      
    } else {
      // Significant unexplained discrepancy - manual review
      resolution.action = 'manual_review_required';
      resolution.confidence = 0.3;
      resolution.reasoning = 'Significant unexplained discrepancy';
      
      await this.createManualReviewTicket(conflict);
    }

    // Log resolution
    await this.auditLogger.logConflictResolution(resolution);

    return resolution;
  }

  /**
   * Resolve duplicate transaction conflicts
   */
  async resolveDuplicateTransaction(
    existingTransaction: Transaction,
    newTransaction: BankTransaction,
    bankId: string
  ): Promise<DuplicateResolution> {
    const similarity = this.calculateTransactionSimilarity(existingTransaction, newTransaction);
    
    if (similarity > 0.95) {
      // High similarity - likely duplicate
      return {
        action: 'ignore_new_transaction',
        reasoning: 'High similarity with existing transaction',
        confidence: similarity
      };
    } else if (similarity > 0.7) {
      // Moderate similarity - might be legitimate duplicate (e.g., refund/reversal)
      return {
        action: 'flag_for_review',
        reasoning: 'Moderate similarity, possible legitimate duplicate',
        confidence: similarity
      };
    } else {
      // Low similarity - likely different transaction
      return {
        action: 'create_new_transaction',
        reasoning: 'Low similarity, treating as new transaction',
        confidence: 1 - similarity
      };
    }
  }

  /**
   * Calculate similarity between transactions
   */
  private calculateTransactionSimilarity(
    existing: Transaction,
    new_: BankTransaction
  ): number {
    let similarityScore = 0;
    let totalWeight = 0;

    // Amount similarity (40% weight)
    const amountWeight = 0.4;
    const amountSimilarity = existing.amount === Math.abs(new_.amount) ? 1 : 0;
    similarityScore += amountSimilarity * amountWeight;
    totalWeight += amountWeight;

    // Date similarity (30% weight)
    const dateWeight = 0.3;
    const daysDiff = Math.abs(
      (existing.transaction_date.getTime() - new_.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dateSimilarity = Math.max(0, 1 - daysDiff / 7); // Similar if within 7 days
    similarityScore += dateSimilarity * dateWeight;
    totalWeight += dateWeight;

    // Description similarity (30% weight)
    const descWeight = 0.3;
    const descSimilarity = this.calculateStringSimilarity(
      existing.description || '',
      new_.description || ''
    );
    similarityScore += descSimilarity * descWeight;
    totalWeight += descWeight;

    return totalWeight > 0 ? similarityScore / totalWeight : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Create matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }
}
```

---

## 4. Error Handling and Circuit Breaker Patterns

### 4.1 Comprehensive Error Handling Strategy

```typescript
export class BankIntegrationErrorHandler {
  private circuitBreakers: Map<string, CircuitBreaker>;
  private retryPolicies: Map<string, RetryPolicy>;
  private errorClassifier: ErrorClassifier;

  constructor(
    private config: ErrorHandlingConfig,
    private alertingService: AlertingService
  ) {
    this.initializeCircuitBreakers();
    this.initializeRetryPolicies();
    this.errorClassifier = new ErrorClassifier();
  }

  /**
   * Handle bank API errors with appropriate retry and fallback logic
   */
  async handleBankApiError(
    error: any,
    operation: BankOperation,
    context: OperationContext
  ): Promise<ErrorHandlingResult> {
    // Classify the error
    const errorType = this.errorClassifier.classify(error);
    
    // Get circuit breaker for this bank
    const circuitBreaker = this.circuitBreakers.get(context.bankId);
    
    // Check if circuit breaker is open
    if (circuitBreaker && circuitBreaker.isOpen()) {
      return this.handleCircuitBreakerOpen(operation, context);
    }

    // Get retry policy for this operation
    const retryPolicy = this.retryPolicies.get(operation);
    
    switch (errorType) {
      case ErrorType.AUTHENTICATION:
        return this.handleAuthenticationError(error, operation, context);
        
      case ErrorType.RATE_LIMITED:
        return this.handleRateLimitError(error, operation, context, retryPolicy);
        
      case ErrorType.NETWORK_TIMEOUT:
        return this.handleTimeoutError(error, operation, context, retryPolicy);
        
      case ErrorType.SERVER_ERROR:
        return this.handleServerError(error, operation, context, retryPolicy);
        
      case ErrorType.BANK_MAINTENANCE:
        return this.handleMaintenanceError(error, operation, context);
        
      case ErrorType.INVALID_REQUEST:
        return this.handleInvalidRequestError(error, operation, context);
        
      default:
        return this.handleUnknownError(error, operation, context);
    }
  }

  /**
   * Handle authentication errors (token expired, invalid credentials)
   */
  private async handleAuthenticationError(
    error: any,
    operation: BankOperation,
    context: OperationContext
  ): Promise<ErrorHandlingResult> {
    if (this.isTokenExpiredError(error)) {
      try {
        // Attempt token refresh
        const refreshedConnection = await this.refreshBankConnection(context.connectionId);
        
        // Retry operation with new token
        return {
          action: 'retry_with_refresh',
          retryDelay: 1000,
          newConnection: refreshedConnection,
          maxRetries: 1
        };
      } catch (refreshError) {
        // Token refresh failed - require re-authentication
        return {
          action: 'require_reauth',
          errorCode: 'AUTHENTICATION_EXPIRED',
          userMessage: 'Please reconnect your bank account to continue syncing data.'
        };
      }
    } else {
      // Invalid credentials - cannot recover automatically
      return {
        action: 'disable_connection',
        errorCode: 'INVALID_CREDENTIALS',
        userMessage: 'Invalid bank credentials. Please reconnect your account.'
      };
    }
  }

  /**
   * Handle rate limiting errors
   */
  private async handleRateLimitError(
    error: any,
    operation: BankOperation,
    context: OperationContext,
    retryPolicy: RetryPolicy
  ): Promise<ErrorHandlingResult> {
    // Extract rate limit information from error
    const rateLimitInfo = this.extractRateLimitInfo(error);
    
    // Calculate retry delay based on rate limit reset time
    const retryDelay = rateLimitInfo.resetTime 
      ? Math.max(rateLimitInfo.resetTime - Date.now(), retryPolicy.baseDelay)
      : retryPolicy.baseDelay * Math.pow(2, context.attemptNumber);

    // Check if we should use circuit breaker
    if (rateLimitInfo.isGlobal && retryDelay > this.config.maxRetryDelay) {
      this.circuitBreakers.get(context.bankId)?.recordFailure();
      
      return {
        action: 'circuit_breaker_open',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryDelay
      };
    }

    return {
      action: 'retry_with_delay',
      retryDelay,
      maxRetries: retryPolicy.maxRetries,
      errorCode: 'RATE_LIMITED'
    };
  }

  /**
   * Handle network timeout errors
   */
  private async handleTimeoutError(
    error: any,
    operation: BankOperation,
    context: OperationContext,
    retryPolicy: RetryPolicy
  ): Promise<ErrorHandlingResult> {
    // Check if we've exceeded max retries
    if (context.attemptNumber >= retryPolicy.maxRetries) {
      // Try fallback method if available
      const fallbackResult = await this.attemptFallback(operation, context);
      if (fallbackResult.success) {
        return fallbackResult;
      }

      // No fallback available or failed
      this.circuitBreakers.get(context.bankId)?.recordFailure();
      
      return {
        action: 'operation_failed',
        errorCode: 'TIMEOUT_EXCEEDED',
        userMessage: 'Bank connection timed out. Please try again later.'
      };
    }

    // Calculate exponential backoff delay
    const retryDelay = retryPolicy.baseDelay * Math.pow(2, context.attemptNumber);

    return {
      action: 'retry_with_delay',
      retryDelay,
      maxRetries: retryPolicy.maxRetries,
      errorCode: 'NETWORK_TIMEOUT'
    };
  }

  /**
   * Attempt fallback integration method
   */
  private async attemptFallback(
    operation: BankOperation,
    context: OperationContext
  ): Promise<FallbackResult> {
    const fallbackStrategies = this.config.fallbackStrategies[context.bankId];
    
    if (!fallbackStrategies || fallbackStrategies.length === 0) {
      return { success: false, reason: 'No fallback available' };
    }

    for (const strategy of fallbackStrategies) {
      try {
        switch (strategy) {
          case 'aggregation_service':
            return await this.tryAggregationService(operation, context);
            
          case 'screen_scraping':
            return await this.tryScreenScraping(operation, context);
            
          case 'cached_data':
            return await this.useCachedData(operation, context);
            
          default:
            continue;
        }
      } catch (fallbackError) {
        logger.warn('Fallback strategy failed', { 
          strategy, 
          error: fallbackError,
          context 
        });
        continue;
      }
    }

    return { success: false, reason: 'All fallback strategies failed' };
  }

  /**
   * Initialize circuit breakers for each bank
   */
  private initializeCircuitBreakers(): void {
    this.circuitBreakers = new Map();

    const banks = ['rbc', 'td', 'bmo', 'cibc'];
    
    banks.forEach(bankId => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.circuitBreaker.failureThreshold,
        resetTimeout: this.config.circuitBreaker.resetTimeout,
        monitoringPeriod: this.config.circuitBreaker.monitoringPeriod,
        onOpen: () => {
          logger.error('Circuit breaker opened', { bankId });
          this.alertingService.sendAlert({
            type: 'CIRCUIT_BREAKER_OPEN',
            bankId,
            timestamp: new Date(),
            message: `Circuit breaker opened for ${bankId} due to repeated failures`
          });
        },
        onClose: () => {
          logger.info('Circuit breaker closed', { bankId });
          this.alertingService.sendAlert({
            type: 'CIRCUIT_BREAKER_CLOSED',
            bankId,
            timestamp: new Date(),
            message: `Circuit breaker closed for ${bankId} - service recovered`
          });
        }
      });

      this.circuitBreakers.set(bankId, circuitBreaker);
    });
  }
}
```

This comprehensive API design provides the foundation for secure, scalable, and resilient integration with Canadian banks, ensuring data consistency, regulatory compliance, and excellent user experience through robust error handling and real-time synchronization.