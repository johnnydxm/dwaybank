import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import TransactionService, { transactionSchema, transferSchema, transactionQuerySchema } from '../services/transaction.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import logger from '../config/logger';

const router = Router();
const transactionService = new TransactionService(pool);

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * @route GET /api/v1/transactions
 * @desc Get transactions with filtering and pagination
 * @access Private
 */
router.get('/', validateRequest({ query: transactionQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const queryParams = req.query as any;
    
    const result = await transactionService.getTransactions(userId, queryParams);
    
    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: result.transactions,
      pagination: {
        total: result.total,
        limit: queryParams.limit || 20,
        offset: queryParams.offset || 0,
        has_more: result.total > (queryParams.offset || 0) + (queryParams.limit || 20)
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/transactions/:transactionId
 * @desc Get a specific transaction by ID
 * @access Private
 */
router.get('/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { transactionId } = req.params;
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedTransactionId = uuidSchema.parse(transactionId);
    
    const transaction = await transactionService.getTransactionById(validatedTransactionId, userId);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
        error: 'TRANSACTION_NOT_FOUND',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    
    res.json({
      success: true,
      message: 'Transaction retrieved successfully',
      data: transaction,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID format',
        error: 'VALIDATION_ERROR',
        details: error.errors,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    next(error);
  }
});

/**
 * @route POST /api/v1/transactions
 * @desc Create a new transaction
 * @access Private
 */
router.post('/', validateRequest({ body: transactionSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const transactionData = req.body;
    
    const transaction = await transactionService.createTransaction(userId, transactionData, userId);
    
    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Account not found or access denied') {
        return res.status(404).json({
          success: false,
          message: 'Account not found',
          error: 'ACCOUNT_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
      if (error.message === 'Insufficient funds') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds for this transaction',
          error: 'INSUFFICIENT_FUNDS',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
    }
    next(error);
  }
});

/**
 * @route POST /api/v1/transactions/transfer
 * @desc Create a transfer between accounts
 * @access Private
 */
router.post('/transfer', validateRequest({ body: transferSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const transferData = req.body;
    
    const transaction = await transactionService.createTransfer(userId, transferData, userId);
    
    res.status(201).json({
      success: true,
      message: 'Transfer created successfully',
      data: transaction,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Source account not found or access denied') {
        return res.status(404).json({
          success: false,
          message: 'Source account not found',
          error: 'SOURCE_ACCOUNT_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
      if (error.message === 'Destination account not found or access denied') {
        return res.status(404).json({
          success: false,
          message: 'Destination account not found',
          error: 'DESTINATION_ACCOUNT_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
      if (error.message === 'Insufficient funds') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds for this transfer',
          error: 'INSUFFICIENT_FUNDS',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
    }
    next(error);
  }
});

/**
 * @route PUT /api/v1/transactions/:transactionId/category
 * @desc Update transaction category
 * @access Private
 */
router.put('/:transactionId/category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { transactionId } = req.params;
    const { category_id } = req.body;
    
    // Validate input
    const uuidSchema = z.string().uuid();
    const validatedTransactionId = uuidSchema.parse(transactionId);
    const validatedCategoryId = uuidSchema.parse(category_id);
    
    const transaction = await transactionService.updateTransactionCategory(
      validatedTransactionId,
      validatedCategoryId,
      userId
    );
    
    res.json({
      success: true,
      message: 'Transaction category updated successfully',
      data: transaction,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Transaction not found or access denied') {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found',
          error: 'TRANSACTION_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
      if (error.message === 'Invalid category') {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID',
          error: 'INVALID_CATEGORY',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        error: 'VALIDATION_ERROR',
        details: error.errors,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    next(error);
  }
});

/**
 * @route GET /api/v1/transactions/categories
 * @desc Get all transaction categories
 * @access Private
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await transactionService.getTransactionCategories();
    
    res.json({
      success: true,
      message: 'Transaction categories retrieved successfully',
      data: categories,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/transactions/spending/:year/:month
 * @desc Get monthly spending summary
 * @access Private
 */
router.get('/spending/:year/:month', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { year, month } = req.params;
    
    // Validate input
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month format',
        error: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    
    const spending = await transactionService.getMonthlySpending(userId, yearNum, monthNum);
    
    res.json({
      success: true,
      message: 'Monthly spending retrieved successfully',
      data: spending,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/transactions/export
 * @desc Export transactions to CSV or PDF
 * @access Private
 */
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { format, start_date, end_date, account_id } = req.query;
    
    // Validate format
    if (!format || !['csv', 'pdf'].includes(format as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Must be csv or pdf',
        error: 'INVALID_FORMAT',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    
    // Build query parameters
    const queryParams: any = {
      limit: 10000 // Large limit for export
    };
    
    if (start_date) queryParams.start_date = start_date;
    if (end_date) queryParams.end_date = end_date;
    if (account_id) queryParams.account_id = account_id;
    
    // Get transactions
    const result = await transactionService.getTransactions(userId, queryParams);
    
    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Date,Description,Amount,Type,Category,Account,Reference ID\n';
      const csvData = result.transactions.map(t => 
        `"${t.transaction_date}","${t.description}",${t.amount},"${t.type}","${t.category?.name || 'Uncategorized'}","${t.account_id}","${t.reference_id}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvHeader + csvData);
      
    } else {
      // For PDF, return transaction data for frontend to generate PDF
      res.json({
        success: true,
        message: 'Transaction data for PDF export',
        data: {
          transactions: result.transactions,
          export_info: {
            generated_at: new Date().toISOString(),
            user_id: userId,
            total_transactions: result.total,
            date_range: {
              start: start_date,
              end: end_date
            }
          }
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    
  } catch (error) {
    next(error);
  }
});

// Error handling middleware specific to transaction routes
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Transaction route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    requestId: req.headers['x-request-id']
  });

  // Handle specific database errors
  if (error.code === '23505') { // Unique violation
    return res.status(409).json({
      success: false,
      message: 'Transaction with this reference already exists',
      error: 'DUPLICATE_TRANSACTION',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Referenced resource does not exist',
      error: 'INVALID_REFERENCE',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  if (error.code === '23514') { // Check constraint violation
    return res.status(400).json({
      success: false,
      message: 'Transaction data violates business rules',
      error: 'CONSTRAINT_VIOLATION',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred while processing your transaction request',
    error: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
});

export default router;