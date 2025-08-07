'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { walletAPI, handleApiError } from '@/lib/api';
import { WalletType, ConnectWalletRequest, ConnectWalletResponse } from '@/types/financial';

interface WalletConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWalletConnected: () => void;
}

interface WalletProvider {
  type: WalletType;
  name: string;
  description: string;
  icon: string;
  authType: 'oauth' | 'api_key' | 'manual';
  isAvailable: boolean;
}

const WALLET_PROVIDERS: WalletProvider[] = [
  {
    type: 'apple_pay',
    name: 'Apple Pay',
    description: 'Connect your Apple Pay account for seamless transactions',
    icon: '🍎',
    authType: 'oauth',
    isAvailable: true,
  },
  {
    type: 'google_pay',
    name: 'Google Pay',
    description: 'Link your Google Pay for quick payments',
    icon: '🎨',
    authType: 'oauth',
    isAvailable: true,
  },
  {
    type: 'metamask',
    name: 'MetaMask',
    description: 'Connect your crypto wallet for DeFi transactions',
    icon: '🦊',
    authType: 'manual',
    isAvailable: true,
  },
  {
    type: 'samsung_pay',
    name: 'Samsung Pay',
    description: 'Connect Samsung Pay for mobile payments',
    icon: '📱',
    authType: 'oauth',
    isAvailable: false,
  },
  {
    type: 'paypal',
    name: 'PayPal',
    description: 'Link your PayPal account',
    icon: '💙',
    authType: 'oauth',
    isAvailable: false,
  },
];

export function WalletConnectionDialog({ open, onOpenChange, onWalletConnected }: WalletConnectionDialogProps) {
  const [selectedWallet, setSelectedWallet] = useState<WalletProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectWalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [authCode, setAuthCode] = useState('');

  const handleSelectWallet = (wallet: WalletProvider) => {
    setSelectedWallet(wallet);
    setConnectionResult(null);
    setError(null);
    setDisplayName(wallet.name);
    setAuthCode('');
  };

  const handleConnect = async () => {
    if (!selectedWallet) return;

    try {
      setIsConnecting(true);
      setError(null);

      const request: ConnectWalletRequest = {
        wallet_type: selectedWallet.type,
        display_name: displayName.trim() || selectedWallet.name,
      };

      // Add auth code for manual auth types
      if (selectedWallet.authType === 'manual' && authCode.trim()) {
        request.auth_code = authCode.trim();
      }

      const response = await walletAPI.connectWallet(request);
      setConnectionResult(response.data);

      // If connection is successful and doesn't require additional auth, close dialog
      if (response.data.status === 'connected' && !response.data.requires_additional_auth) {
        setTimeout(() => {
          onWalletConnected();
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      const apiError = handleApiError(error);
      setError(apiError.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    setSelectedWallet(null);
    setConnectionResult(null);
    setError(null);
    setDisplayName('');
    setAuthCode('');
    onOpenChange(false);
  };

  const handleAuthComplete = () => {
    onWalletConnected();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet provider to connect to your DwayBank account
          </DialogDescription>
        </DialogHeader>

        {!selectedWallet ? (
          // Wallet selection screen
          <div className="grid gap-4 py-4">
            {WALLET_PROVIDERS.map((wallet) => (
              <Card 
                key={wallet.type}
                className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                  !wallet.isAvailable ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => wallet.isAvailable && handleSelectWallet(wallet)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{wallet.icon}</div>
                      <div>
                        <h3 className="font-medium">{wallet.name}</h3>
                        <p className="text-sm text-gray-500">{wallet.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!wallet.isAvailable && (
                        <Badge variant="secondary">Coming Soon</Badge>
                      )}
                      {wallet.authType === 'oauth' && (
                        <Badge variant="outline">OAuth</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Connection setup screen
          <div className="space-y-6 py-4">
            {/* Selected wallet info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{selectedWallet.icon}</div>
                  <div>
                    <h3 className="font-medium">{selectedWallet.name}</h3>
                    <p className="text-sm text-gray-500">{selectedWallet.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={`My ${selectedWallet.name}`}
                  disabled={isConnecting}
                />
              </div>

              {selectedWallet.authType === 'manual' && (
                <div>
                  <Label htmlFor="auth-code">
                    {selectedWallet.type === 'metamask' ? 'Wallet Address' : 'Authorization Code'}
                  </Label>
                  <Input
                    id="auth-code"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder={
                      selectedWallet.type === 'metamask' 
                        ? '0x...' 
                        : 'Enter authorization code'
                    }
                    disabled={isConnecting}
                  />
                </div>
              )}
            </div>

            {/* Connection result */}
            {connectionResult && (
              <Card className={`${
                connectionResult.status === 'connected' 
                  ? 'border-green-200 bg-green-50' 
                  : connectionResult.status === 'error'
                  ? 'border-red-200 bg-red-50'
                  : 'border-blue-200 bg-blue-50'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    {connectionResult.status === 'connected' ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : connectionResult.status === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-blue-600 mt-0.5 animate-spin" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {connectionResult.status === 'connected' 
                          ? 'Successfully Connected!' 
                          : connectionResult.status === 'error'
                          ? 'Connection Failed'
                          : 'Connection Pending'
                        }
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {connectionResult.message}
                      </p>
                      
                      {connectionResult.auth_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            window.open(connectionResult.auth_url, '_blank');
                            // Note: In a real implementation, you'd want to handle the OAuth callback
                            setTimeout(handleAuthComplete, 3000);
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Complete Authorization
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error display */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Connection Error</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setSelectedWallet(null)}
                disabled={isConnecting}
              >
                Back
              </Button>
              <div className="space-x-2">
                <Button variant="outline" onClick={handleClose} disabled={isConnecting}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleConnect} 
                  disabled={
                    isConnecting || 
                    !displayName.trim() ||
                    (selectedWallet.authType === 'manual' && !authCode.trim()) ||
                    connectionResult?.status === 'connected'
                  }
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Wallet'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}