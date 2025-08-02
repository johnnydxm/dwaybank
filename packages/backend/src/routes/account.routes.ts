import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import AccountService, { createAccountSchema, updateAccountSchema, accountQuerySchema } from '../services/account.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import logger from '../config/logger';

const router = Router();
const accountService = new AccountService(pool);

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * @route GET /api/v1/accounts
 * @desc Get all accounts for the authenticated user
 * @access Private
 */
router.get('/', validateRequest({ query: accountQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const queryParams = req.query as any;
    
    const result = await accountService.getUserAccounts(userId, queryParams);
    
    res.json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: result.accounts,
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
 * @route GET /api/v1/accounts/:accountId
 * @desc Get a specific account by ID
 * @access Private
 */
router.get('/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedAccountId = uuidSchema.parse(accountId);
    
    const account = await accountService.getAccountById(validatedAccountId, userId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
        error: 'ACCOUNT_NOT_FOUND',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    
    res.json({
      success: true,
      message: 'Account retrieved successfully',
      data: account,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format',
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
 * @route POST /api/v1/accounts
 * @desc Create a new account
 * @access Private
 */
router.post('/', validateRequest({ body: createAccountSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const accountData = req.body;
    
    const account = await accountService.createAccount(userId, accountData, userId);
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        message: 'Account with this number already exists',
        error: 'DUPLICATE_ACCOUNT',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    next(error);
  }
});

/**
 * @route PUT /api/v1/accounts/:accountId
 * @desc Update an account
 * @access Private
 */
router.put('/:accountId', validateRequest({ body: updateAccountSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    const updateData = req.body;
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedAccountId = uuidSchema.parse(accountId);
    
    const account = await accountService.updateAccount(validatedAccountId, userId, updateData, userId);
    
    res.json({
      success: true,
      message: 'Account updated successfully',
      data: account,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found or access denied') {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
        error: 'ACCOUNT_NOT_FOUND',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format',
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
 * @route DELETE /api/v1/accounts/:accountId
 * @desc Soft delete an account
 * @access Private
 */
router.delete('/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedAccountId = uuidSchema.parse(accountId);
    
    await accountService.deleteAccount(validatedAccountId, userId, userId);
    
    res.json({
      success: true,
      message: 'Account deleted successfully',
      data: { accountId: validatedAccountId },
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
      if (error.message === 'Cannot delete account with non-zero balance') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete account with non-zero balance',
          error: 'ACCOUNT_HAS_BALANCE',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        });
      }
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format',
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
 * @route GET /api/v1/accounts/:accountId/balance
 * @desc Get account balance information
 * @access Private
 */
router.get('/:accountId/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedAccountId = uuidSchema.parse(accountId);
    
    const balance = await accountService.getAccountBalance(validatedAccountId, userId);
    
    res.json({
      success: true,
      message: 'Account balance retrieved successfully',
      data: balance,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found or access denied') {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
        error: 'ACCOUNT_NOT_FOUND',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format',
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
 * @route PUT /api/v1/accounts/:accountId/primary
 * @desc Set account as primary
 * @access Private
 */
router.put('/:accountId/primary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validatedAccountId = uuidSchema.parse(accountId);
    
    await accountService.setPrimaryAccount(validatedAccountId, userId);
    
    res.json({
      success: true,
      message: 'Primary account updated successfully',
      data: { accountId: validatedAccountId },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found or access denied') {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
        error: 'ACCOUNT_NOT_FOUND',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format',
        error: 'VALIDATION_ERROR',
        details: error.errors,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
    }
    next(error);
  }
});

// Error handling middleware specific to account routes
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Account route error', {
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
      message: 'Account with this information already exists',
      error: 'DUPLICATE_ACCOUNT',
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

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred while processing your account request',
    error: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
});

export default router;