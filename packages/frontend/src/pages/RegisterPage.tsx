import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Eye, EyeOff, Loader2, CheckCircle, Info } from 'lucide-react';
import { handleApiError } from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone_number: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [passwordStrength, setPasswordStrength] = useState('');

  // Clear errors when user starts typing
  const clearErrors = useCallback(() => {
    if (error) setError('');
    if (success) setSuccess('');
    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors({});
    }
  }, [error, success, fieldErrors]);

  // Validate individual fields
  const validateField = useCallback((name: string, value: string) => {
    const errors: {[key: string]: string} = {};
    
    switch (name) {
      case 'first_name':
        if (!value.trim()) {
          errors.first_name = 'First name is required';
        } else if (value.trim().length < 2) {
          errors.first_name = 'First name must be at least 2 characters';
        }
        break;
      case 'last_name':
        if (!value.trim()) {
          errors.last_name = 'Last name is required';
        } else if (value.trim().length < 2) {
          errors.last_name = 'Last name must be at least 2 characters';
        }
        break;
      case 'email':
        if (!value.trim()) {
          errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 'phone_number':
        if (value && !/^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s()-]/g, ''))) {
          errors.phone_number = 'Please enter a valid phone number';
        }
        break;
      case 'password':
        if (!value) {
          errors.password = 'Password is required';
        } else if (value.length < 8) {
          errors.password = 'Password must be at least 8 characters long';
        } else {
          // Check password strength
          const hasUpper = /[A-Z]/.test(value);
          const hasLower = /[a-z]/.test(value);
          const hasNumber = /\d/.test(value);
          const hasSpecial = /[!@#$%^&*]/.test(value);
          
          if (!hasUpper || !hasLower || !hasNumber) {
            errors.password = 'Password must contain uppercase, lowercase, and numbers';
          }
        }
        break;
      case 'confirmPassword':
        if (!value) {
          errors.confirmPassword = 'Please confirm your password';
        } else if (value !== formData.password) {
          errors.confirmPassword = 'Passwords do not match';
        }
        break;
    }
    
    return errors;
  }, [formData.password]);

  // Calculate password strength
  const calculatePasswordStrength = useCallback((password: string) => {
    if (!password) return '';
    
    let score = 0;
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*]/.test(password),
      password.length >= 12
    ];
    
    score = checks.filter(Boolean).length;
    
    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
  }, []);

  // Validate entire form
  const validateForm = useCallback(() => {
    const errors = {
      ...validateField('first_name', formData.first_name),
      ...validateField('last_name', formData.last_name),
      ...validateField('email', formData.email),
      ...validateField('phone_number', formData.phone_number),
      ...validateField('password', formData.password),
      ...validateField('confirmPassword', formData.confirmPassword)
    };
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, validateField]);

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
      const { confirmPassword, ...registerData } = formData;
      const result = await register(registerData);
      
      if (result.verification_required) {
        setSuccess('Registration successful! Please check your email to verify your account before logging in.');
        // Clear form after successful registration
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          first_name: '',
          last_name: '',
          phone_number: ''
        });
      } else {
        setSuccess('Registration successful! Redirecting to dashboard...');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (err: any) {
      const apiError = handleApiError(err);
      setError(apiError.message);
      
      // Handle specific error cases
      if (apiError.message.toLowerCase().includes('email')) {
        setFieldErrors({ email: 'This email address is already registered' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Clear errors when user starts typing
    clearErrors();
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Real-time validation
    const errors = validateField(name, value);
    setFieldErrors(prev => ({
      ...prev,
      [name]: errors[name] || ''
    }));
    
    // Update password strength for password field
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    
    // Re-validate confirm password when password changes
    if (name === 'password' && formData.confirmPassword) {
      const confirmErrors = validateField('confirmPassword', formData.confirmPassword);
      setFieldErrors(prev => ({
        ...prev,
        confirmPassword: confirmErrors.confirmPassword || ''
      }));
    }
  };

  // Initialize password strength
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
  }, [formData.password, calculatePasswordStrength]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">DwayBank</h1>
          <p className="mt-2 text-gray-600">Smart Wallet Platform</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Join DwayBank and start managing your digital wallets
            </CardDescription>
          </CardHeader>
          <CardContent>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    placeholder="John"
                    className={fieldErrors.first_name ? 'border-red-500 focus:border-red-500' : ''}
                    aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined}
                    aria-invalid={!!fieldErrors.first_name}
                  />
                  {fieldErrors.first_name && (
                    <p id="first_name-error" className="text-sm text-red-600" role="alert">
                      {fieldErrors.first_name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Doe"
                    className={fieldErrors.last_name ? 'border-red-500 focus:border-red-500' : ''}
                    aria-describedby={fieldErrors.last_name ? 'last_name-error' : undefined}
                    aria-invalid={!!fieldErrors.last_name}
                  />
                  {fieldErrors.last_name && (
                    <p id="last_name-error" className="text-sm text-red-600" role="alert">
                      {fieldErrors.last_name}
                    </p>
                  )}
                </div>
              </div>

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
                  placeholder="john@example.com"
                  autoComplete="email"
                  className={fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''}
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
                <Label htmlFor="phone_number">Phone number (optional)</Label>
                <Input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  inputMode="tel"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                  autoComplete="tel"
                  className={fieldErrors.phone_number ? 'border-red-500 focus:border-red-500' : ''}
                  aria-describedby={fieldErrors.phone_number ? 'phone_number-error' : undefined}
                  aria-invalid={!!fieldErrors.phone_number}
                />
                {fieldErrors.phone_number && (
                  <p id="phone_number-error" className="text-sm text-red-600" role="alert">
                    {fieldErrors.phone_number}
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
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    className={`pr-12 ${
                      fieldErrors.password ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    aria-describedby={`password-help password-strength${fieldErrors.password ? ' password-error' : ''}`}
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
                <div className="flex items-center justify-between text-xs">
                  <p id="password-help" className="text-gray-500">
                    Must be at least 8 characters with uppercase, lowercase, and numbers
                  </p>
                  {passwordStrength && formData.password && (
                    <span 
                      id="password-strength"
                      className={`font-medium ${
                        passwordStrength === 'weak' ? 'text-red-600' :
                        passwordStrength === 'medium' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}
                    >
                      {passwordStrength === 'weak' ? '⚠️ Weak' :
                       passwordStrength === 'medium' ? '⚡ Medium' :
                       '🔒 Strong'}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={`pr-12 ${
                      fieldErrors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                    aria-invalid={!!fieldErrors.confirmPassword}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px] justify-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p id="confirmPassword-error" className="text-sm text-red-600" role="alert">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full min-h-[44px] text-base sm:text-sm"
                disabled={isSubmitting || !formData.email || !formData.password || !formData.first_name || !formData.last_name}
                aria-describedby={isSubmitting ? "register_loading" : undefined}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <span id="register_loading">Creating account...</span>
                  </>
                ) : (
                  'Create account'
                )}
              </Button>

              <div className="text-center">
                <span className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Sign in
                  </Link>
                </span>
              </div>

              <div className="text-xs text-gray-500 text-center">
                By creating an account, you agree to our{' '}
                <button 
                  type="button"
                  className="text-blue-600 hover:text-blue-500 underline"
                  onClick={() => console.log('Terms of Service clicked')}
                  aria-label="View Terms of Service (opens dialog)"
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button 
                  type="button"
                  className="text-blue-600 hover:text-blue-500 underline"
                  onClick={() => console.log('Privacy Policy clicked')}
                  aria-label="View Privacy Policy (opens dialog)"
                >
                  Privacy Policy
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}