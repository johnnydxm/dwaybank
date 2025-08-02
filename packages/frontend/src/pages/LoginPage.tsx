import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSessionData, setMfaSessionData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(formData);
      
      if (result.mfa_required) {
        setMfaRequired(true);
        setMfaSessionData(result);
      } else if (result.verification_required) {
        setError('Please verify your email address before logging in.');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mfaSessionData?.user?.id) {
        await verifyMFA(mfaCode, mfaSessionData.user.id, 'session-id'); // Note: session ID should come from login response
        navigate('/dashboard');
      }
    } catch (err: any) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

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

                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Verification Code</Label>
                  <Input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    required
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="text-center text-lg tracking-widest sm:text-base"
                    aria-describedby="mfa_help"
                  />
                  <p id="mfa_help" className="text-xs text-gray-500">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full min-h-[44px] text-base sm:text-sm" 
                  disabled={isLoading}
                  aria-describedby={isLoading ? "mfa_loading" : undefined}
                >
                  {isLoading ? (
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
                  className="text-base sm:text-sm"
                />
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
                    className="text-base sm:text-sm pr-12"
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
                disabled={isLoading}
                aria-describedby={isLoading ? "login_loading" : undefined}
              >
                {isLoading ? (
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