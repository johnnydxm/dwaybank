import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { handleApiError } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMFA } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember_me: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSessionData, setMfaSessionData] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [isValidating, setIsValidating] = useState(false);

  // Clear errors when user starts typing
  const clearErrors = useCallback(() => {
    if (error) setError('');
    if (success) setSuccess('');
    if (fieldErrors.email || fieldErrors.password) {
      setFieldErrors({});
    }
  }, [error, success, fieldErrors]);

  // Validate individual fields
  const validateField = useCallback((name: string, value: string) => {
    const errors: {[key: string]: string} = {};
    
    switch (name) {
      case 'email':
        if (!value.trim()) {
          errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 'password':
        if (!value) {
          errors.password = 'Password is required';
        } else if (value.length < 8) {
          errors.password = 'Password must be at least 8 characters long';
        }
        break;
    }
    
    return errors;
  }, []);

  // Validate entire form
  const validateForm = useCallback(() => {
    const emailErrors = validateField('email', formData.email);
    const passwordErrors = validateField('password', formData.password);
    const allErrors = { ...emailErrors, ...passwordErrors };
    
    setFieldErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  }, [formData.email, formData.password, validateField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous states
    setError('');
    setSuccess('');
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);

    try {
      const result = await login(formData);
      
      if (result.mfa_required) {
        setMfaRequired(true);
        setMfaSessionData(result);
        setSuccess('Please enter your two-factor authentication code.');
      } else if (result.verification_required) {
        setError('Please verify your email address before logging in.');
      } else {
        setSuccess('Login successful! Redirecting to dashboard...');
        // Small delay to show success message
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err: any) {
      const apiError = handleApiError(err);
      setError(apiError.message);
      
      // Don't clear form on certain error types
      if (apiError.code === 'RATE_LIMITED' || apiError.code === 'NETWORK_ERROR') {
        // Keep form data for retry
      } else if (apiError.code === 'INVALID_CREDENTIALS') {
        // Clear password but keep email
        setFormData(prev => ({ ...prev, password: '' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      if (mfaSessionData?.user?.id) {
        await verifyMFA(mfaCode, mfaSessionData.user.id, mfaSessionData.session_id || 'session-id');
        setSuccess('Two-factor authentication successful! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err: any) {
      const apiError = handleApiError(err);
      setError(apiError.message);
      // Clear MFA code on error to allow retry
      setMfaCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    // Clear errors when user starts typing
    clearErrors();
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Real-time validation for email and password
    if (name === 'email' || name === 'password') {
      const errors = validateField(name, type === 'checkbox' ? (checked ? 'true' : 'false') : value);
      setFieldErrors(prev => ({
        ...prev,
        [name]: errors[name] || ''
      }));
    }
  };

  const handleMFAInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      setMfaCode(value);
      clearErrors();
    }
  };

  // Auto-focus and handle back button
  useEffect(() => {
    if (mfaRequired) {
      // Focus MFA input when it becomes visible
      const mfaInput = document.getElementById('mfaCode');
      if (mfaInput) {
        setTimeout(() => mfaInput.focus(), 100);
      }
    }
  }, [mfaRequired]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">DwayBank</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Smart Wallet Platform</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mfaRequired ? 'Two-Factor Authentication' : 'Sign in to your account'}</CardTitle>
            <CardDescription>
              {mfaRequired 
                ? 'Enter the verification code from your authenticator app'
                : 'Enter your email and password to access your wallet'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mfaRequired ? (
              <form onSubmit={handleMFASubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {success && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Verification Code</Label>
                  <Input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    value={mfaCode}
                    onChange={handleMFAInputChange}
                    required
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="text-center text-lg tracking-widest sm:text-base"
                    aria-describedby="mfa_help"
                    autoFocus
                  />
                  <p id="mfa_help" className="text-xs text-gray-500">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full min-h-[44px] text-base sm:text-sm" 
                  disabled={isSubmitting || mfaCode.length !== 6}
                  aria-describedby={isSubmitting ? "mfa_loading" : undefined}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      <span id="mfa_loading">Verifying...</span>
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-[44px] text-base sm:text-sm"
                  onClick={() => {
                    setMfaRequired(false);
                    setMfaCode('');
                    setError('');
                  }}
                >
                  Back to Login
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email"
                  autoComplete="email"
                  className={`text-base sm:text-sm ${
                    fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''
                  }`}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-sm text-red-600" role="alert">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`text-base sm:text-sm pr-12 ${
                      fieldErrors.password ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    aria-invalid={!!fieldErrors.password}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px] justify-center"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="text-sm text-red-600" role="alert">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember_me"
                    name="remember_me"
                    type="checkbox"
                    checked={formData.remember_me}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    aria-describedby="remember_me_description"
                  />
                  <Label htmlFor="remember_me" className="ml-3 text-sm cursor-pointer">
                    Remember me
                  </Label>
                  <span id="remember_me_description" className="sr-only">
                    Keep me signed in on this device
                  </span>
                </div>

                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full min-h-[44px] text-base sm:text-sm"
                disabled={isSubmitting || !formData.email || !formData.password || isValidating}
                aria-describedby={isSubmitting ? "login_loading" : undefined}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <span id="login_loading">Signing in...</span>
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>

              <div className="text-center">
                <span className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Sign up
                  </Link>
                </span>
              </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}