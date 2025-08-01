import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { 
  ArrowRight,
  DollarSign,
  Calendar,
  Shield,
  AlertTriangle,
  Check,
  CreditCard,
  Building,
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { Account, TransferRequest, PaymentMethod } from '../../types/financial';
import { formatCurrency, isValidCurrencyAmount, parseCurrency } from '../../utils/currency';
import { isValidEmail } from '../../lib/utils';

interface PaymentFormProps {
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  onSubmit: (transferData: TransferRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const transferSchema = z.object({
  from_account_id: z.string().min(1, 'Please select a source account'),
  to_account_id: z.string().optional(),
  to_external_account: z.object({
    routing_number: z.string().optional(),
    account_number: z.string().optional(),
    account_name: z.string().optional(),
    bank_name: z.string().optional(),
  }).optional(),
  recipient_email: z.string().email('Invalid email address').optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string().min(1, 'Currency is required'),
  description: z.string().max(255, 'Description must be less than 255 characters').optional(),
  scheduled_date: z.string().optional(),
  recurring: z.object({
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
    end_date: z.string().optional(),
    occurrences: z.number().optional(),
  }).optional(),
});

type TransferFormData = z.infer<typeof transferSchema>;

type TransferType = 'internal' | 'external' | 'email';

export function PaymentForm({ 
  accounts, 
  paymentMethods, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: PaymentFormProps) {
  const [transferType, setTransferType] = useState<TransferType>('internal');
  const [step, setStep] = useState<'details' | 'review' | 'confirm'>('details');
  const [showBalance, setShowBalance] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
    reset
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      currency: 'USD',
      amount: 0
    }
  });

  const watchedFromAccount = watch('from_account_id');
  const watchedAmount = watch('amount');
  const watchedCurrency = watch('currency');

  const selectedAccount = accounts.find(a => a.id === watchedFromAccount);

  useEffect(() => {
    if (selectedAccount) {
      setValue('currency', selectedAccount.currency);
    }
  }, [selectedAccount, setValue]);

  const handleFormSubmit = async (data: TransferFormData) => {
    if (step === 'details') {
      setStep('review');
      return;
    }

    if (step === 'review') {
      setStep('confirm');
      return;
    }

    // Final submission
    try {
      const transferRequest: TransferRequest = {
        from_account_id: data.from_account_id,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        scheduled_date: data.scheduled_date,
        recurring: isRecurring ? data.recurring : undefined,
      };

      if (transferType === 'internal' && data.to_account_id) {
        transferRequest.to_account_id = data.to_account_id;
      } else if (transferType === 'external' && data.to_external_account) {
        transferRequest.to_external_account = {
          routing_number: data.to_external_account.routing_number!,
          account_number: data.to_external_account.account_number!,
          account_name: data.to_external_account.account_name!,
          bank_name: data.to_external_account.bank_name!,
        };
      }

      await onSubmit(transferRequest);
      reset();
      setStep('details');
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const canAffordTransfer = () => {
    if (!selectedAccount || !watchedAmount) return false;
    return selectedAccount.available_balance >= watchedAmount;
  };

  const getInternalAccounts = () => {
    return accounts.filter(a => a.id !== watchedFromAccount);
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'details', label: 'Details', icon: DollarSign },
      { key: 'review', label: 'Review', icon: Eye },
      { key: 'confirm', label: 'Confirm', icon: Shield }
    ];

    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center justify-center space-x-4 mb-6">
        {steps.map((stepInfo, index) => {
          const Icon = stepInfo.icon;
          const isActive = stepInfo.key === step;
          const isCompleted = index < currentIndex;
          
          return (
            <div key={stepInfo.key} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                isActive 
                  ? 'border-blue-500 bg-blue-500 text-white' 
                  : isCompleted
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-300 bg-gray-100 text-gray-500'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`ml-2 text-sm font-medium ${
                isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
              }`}>
                {stepInfo.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-8 h-px mx-4 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div className="space-y-6">
      {/* Transfer Type Selection */}
      <div className="space-y-3">
        <Label>Transfer Type</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTransferType('internal')}
            className={`p-4 border rounded-lg text-left transition-colors ${
              transferType === 'internal' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ArrowRight className="h-4 w-4" />
              <span className="font-medium">Between My Accounts</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Transfer between your DwayBank accounts
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTransferType('external')}
            className={`p-4 border rounded-lg text-left transition-colors ${
              transferType === 'external' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span className="font-medium">To External Bank</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Transfer to another bank account
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTransferType('email')}
            className={`p-4 border rounded-lg text-left transition-colors ${
              transferType === 'email' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span className="font-medium">Send by Email</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Send money using email address
            </p>
          </button>
        </div>
      </div>

      {/* From Account */}
      <div className="space-y-2">
        <Label htmlFor="from_account_id">From Account *</Label>
        <Select onValueChange={(value) => setValue('from_account_id', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select source account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(account => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{account.account_name}</span>
                  <span className="text-muted-foreground ml-4">
                    {formatCurrency(account.available_balance, account.currency)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.from_account_id && (
          <p className="text-sm text-red-600">{errors.from_account_id.message}</p>
        )}
        {selectedAccount && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Available Balance:</span>
            <div className="flex items-center space-x-2">
              <span>
                {showBalance 
                  ? formatCurrency(selectedAccount.available_balance, selectedAccount.currency)
                  : '••••••'
                }
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowBalance(!showBalance)}
              >
                {showBalance ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* To Account/Details */}
      {transferType === 'internal' && (
        <div className="space-y-2">
          <Label htmlFor="to_account_id">To Account *</Label>
          <Select onValueChange={(value) => setValue('to_account_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination account" />
            </SelectTrigger>
            <SelectContent>
              {getInternalAccounts().map(account => (
                <SelectItem key={account.id} value={account.id}>
                  <span>{account.account_name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.to_account_id && (
            <p className="text-sm text-red-600">{errors.to_account_id.message}</p>
          )}
        </div>
      )}

      {transferType === 'external' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input
                {...register('to_external_account.bank_name')}
                placeholder="Chase Bank"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Holder Name *</Label>
              <Input
                {...register('to_external_account.account_name')}
                placeholder="John Doe"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Routing Number *</Label>
              <Input
                {...register('to_external_account.routing_number')}
                placeholder="123456789"
                maxLength={9}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input
                {...register('to_external_account.account_number')}
                placeholder="1234567890"
              />
            </div>
          </div>
        </div>
      )}

      {transferType === 'email' && (
        <div className="space-y-2">
          <Label htmlFor="recipient_email">Recipient Email *</Label>
          <Input
            {...register('recipient_email')}
            type="email"
            placeholder="recipient@example.com"
          />
          {errors.recipient_email && (
            <p className="text-sm text-red-600">{errors.recipient_email.message}</p>
          )}
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount *</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            {...register('amount', { 
              valueAsNumber: true,
              validate: value => isValidCurrencyAmount(value) || 'Invalid amount'
            })}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="pl-10"
          />
        </div>
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
        {selectedAccount && watchedAmount && !canAffordTransfer() && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Insufficient funds. Available balance: {formatCurrency(selectedAccount.available_balance, selectedAccount.currency)}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          {...register('description')}
          placeholder="What's this transfer for?"
          maxLength={255}
        />
      </div>

      {/* Scheduling Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Schedule Transfer</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsRecurring(!isRecurring)}
          >
            {isRecurring ? 'Make One-Time' : 'Make Recurring'}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduled_date">Send Date (Optional)</Label>
          <Input
            {...register('scheduled_date')}
            type="date"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {isRecurring && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select onValueChange={(value: any) => setValue('recurring.frequency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>End Date (Optional)</Label>
              <Input
                {...register('recurring.end_date')}
                type="date"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderReviewStep = () => {
    const data = getValues();
    const fromAccount = accounts.find(a => a.id === data.from_account_id);
    const toAccount = data.to_account_id ? accounts.find(a => a.id === data.to_account_id) : null;

    return (
      <div className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Please review your transfer details carefully before confirming.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">From</CardTitle>
            </CardHeader>
            <CardContent>
              {fromAccount && (
                <div className="space-y-2">
                  <p className="font-medium">{fromAccount.account_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fromAccount.institution_name}
                  </p>
                  <p className="text-sm">
                    Available: {formatCurrency(fromAccount.available_balance, fromAccount.currency)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">To</CardTitle>
            </CardHeader>
            <CardContent>
              {transferType === 'internal' && toAccount && (
                <div className="space-y-2">
                  <p className="font-medium">{toAccount.account_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {toAccount.institution_name}
                  </p>
                </div>
              )}
              {transferType === 'external' && data.to_external_account && (
                <div className="space-y-2">
                  <p className="font-medium">{data.to_external_account.account_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.to_external_account.bank_name}
                  </p>
                  <p className="text-sm">
                    ••••{data.to_external_account.account_number?.slice(-4)}
                  </p>
                </div>
              )}
              {transferType === 'email' && (
                <div className="space-y-2">
                  <p className="font-medium">{data.recipient_email}</p>
                  <p className="text-sm text-muted-foreground">
                    Email Transfer
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="font-medium">Amount</span>
            <span className="text-lg font-bold">
              {formatCurrency(data.amount, data.currency)}
            </span>
          </div>

          {data.description && (
            <div className="flex items-center justify-between py-2">
              <span>Description</span>
              <span>{data.description}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <span>Transfer Date</span>
            <span>
              {data.scheduled_date 
                ? new Date(data.scheduled_date).toLocaleDateString()
                : 'Immediately'
              }
            </span>
          </div>

          {isRecurring && data.recurring && (
            <div className="flex items-center justify-between py-2">
              <span>Frequency</span>
              <span className="capitalize">{data.recurring.frequency}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-b">
            <span>Transfer Fee</span>
            <span>$0.00</span>
          </div>

          <div className="flex items-center justify-between py-2 font-medium text-lg">
            <span>Total</span>
            <span>{formatCurrency(data.amount, data.currency)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-medium">Confirm Transfer</h3>
        <p className="text-muted-foreground">
          By clicking "Send Transfer" you authorize this payment.
        </p>
      </div>
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          This action cannot be undone. Please ensure all details are correct.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Send Money</CardTitle>
        <CardDescription>
          Transfer money securely between accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {renderStepIndicator()}

          {step === 'details' && renderDetailsStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'confirm' && renderConfirmStep()}

          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (step === 'details') {
                  onCancel();
                } else if (step === 'review') {
                  setStep('details');
                } else {
                  setStep('review');
                }
              }}
            >
              {step === 'details' ? 'Cancel' : 'Back'}
            </Button>

            <Button
              type="submit"
              disabled={isLoading || (step === 'details' && (!isValid || !canAffordTransfer()))}
            >
              {isLoading 
                ? 'Processing...' 
                : step === 'confirm' 
                ? 'Send Transfer' 
                : step === 'review'
                ? 'Confirm'
                : 'Review Transfer'
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}