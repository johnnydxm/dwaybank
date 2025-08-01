import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { 
  Shield, 
  Smartphone, 
  Key, 
  Copy, 
  Check, 
  AlertTriangle,
  Download,
  QrCode
} from 'lucide-react';
import { MFASetupResponse, MFAVerificationRequest } from '../../types/auth';
import { copyToClipboard } from '../../lib/utils';

interface MFASetupProps {
  onSetupComplete: (backupCodes: string[]) => void;
  onCancel: () => void;
}

type SetupStep = 'app' | 'verify' | 'backup' | 'complete';

export function MFASetup({ onSetupComplete, onCancel }: MFASetupProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('app');
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Initialize MFA setup when component mounts
    initializeMFASetup();
  }, []);

  const initializeMFASetup = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // In a real app, this would call the actual API
      // For now, simulate the response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockSetupData: MFASetupResponse = {
        secret: 'JBSW2YTCNQXD45KTOBZTOY3FO5QXG2LO',
        qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        backup_codes: [
          '123456',
          '789012',
          '345678',
          '901234',
          '567890',
          '012345',
          '678901',
          '234567'
        ]
      };
      
      setSetupData(mockSetupData);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const verificationRequest: MFAVerificationRequest = {
        token: verificationCode.replace(/\s/g, '') // Remove spaces
      };

      // In a real app, this would call the actual API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success/failure
      if (verificationCode.trim() === '123456') {
        setCurrentStep('backup');
      } else {
        throw new Error('Invalid verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = async (text: string, key: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!setupData) return;

    const content = [
      'DwayBank Multi-Factor Authentication Backup Codes',
      '=' .repeat(50),
      '',
      'These codes can be used to access your account if you lose your authenticator device.',
      'Each code can only be used once. Store them in a safe place.',
      '',
      'Backup Codes:',
      ...setupData.backup_codes.map((code, index) => `${index + 1}. ${code}`),
      '',
      'Generated on: ' + new Date().toLocaleString(),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dwaybank-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    if (setupData) {
      onSetupComplete(setupData.backup_codes);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'app', label: 'Setup App', icon: Smartphone },
      { key: 'verify', label: 'Verify', icon: Shield },
      { key: 'backup', label: 'Backup Codes', icon: Key },
      { key: 'complete', label: 'Complete', icon: Check }
    ];

    const currentIndex = steps.findIndex(step => step.key === currentStep);

    return (
      <div className="flex items-center justify-center space-x-4 mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isCompleted = index < currentIndex;
          
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                isActive 
                  ? 'border-blue-500 bg-blue-500 text-white' 
                  : isCompleted
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-300 bg-gray-100 text-gray-500'
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${
                isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
              }`}>
                {step.label}
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

  if (isLoading && !setupData) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Initializing MFA setup...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {renderStepIndicator()}
      
      {currentStep === 'app' && setupData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Smartphone className="h-5 w-5 mr-2" />
              Setup Authenticator App
            </CardTitle>
            <CardDescription>
              Install an authenticator app and scan the QR code below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                <img 
                  src={setupData.qr_code} 
                  alt="MFA QR Code"
                  className="w-48 h-48"
                />
              </div>
              <Badge variant="outline" className="flex items-center">
                <QrCode className="h-4 w-4 mr-1" />
                Scan with your authenticator app
              </Badge>
            </div>

            {/* Manual entry option */}
            <div className="space-y-3">
              <Label>Can't scan? Enter this code manually:</Label>
              <div className="flex items-center space-x-2">
                <Input 
                  value={setupData.secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyText(setupData.secret, 'secret')}
                >
                  {copiedStates.secret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Recommended apps */}
            <div className="space-y-2">
              <Label>Recommended authenticator apps:</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• Google Authenticator</div>
                <div>• Microsoft Authenticator</div>
                <div>• Authy</div>
                <div>• 1Password</div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button onClick={() => setCurrentStep('verify')} className="flex-1">
                I've Added the Account
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'verify' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Verify Your Setup
            </CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(value);
                  setError('');
                }}
                className="text-center text-lg font-mono tracking-widest"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('app')}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'backup' && setupData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Save Your Backup Codes
            </CardTitle>
            <CardDescription>
              These codes can be used to access your account if you lose your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Save these codes in a secure location. 
                Each code can only be used once, and you won't be able to see them again.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3">
              {setupData.backup_codes.map((code, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <span className="font-mono text-sm">
                    {index + 1}. {code}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(code, `backup-${index}`)}
                  >
                    {copiedStates[`backup-${index}`] ? 
                      <Check className="h-4 w-4 text-green-600" /> : 
                      <Copy className="h-4 w-4" />
                    }
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={handleDownloadBackupCodes}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Codes
              </Button>
              <Button
                onClick={() => setCurrentStep('complete')}
                className="flex-1"
              >
                I've Saved My Codes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <Check className="h-5 w-5 mr-2" />
              MFA Setup Complete!
            </CardTitle>
            <CardDescription>
              Your account is now protected with multi-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Multi-factor authentication has been successfully enabled for your account.
                You'll now need to provide a code from your authenticator app when signing in.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• You'll need your authenticator app to sign in</li>
                <li>• Keep your backup codes in a safe place</li>
                <li>• You can disable MFA in your security settings if needed</li>
              </ul>
            </div>

            <Button onClick={handleComplete} className="w-full">
              Finish Setup
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}