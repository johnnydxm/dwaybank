import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  Key, 
  Smartphone, 
  Mail, 
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { User, SessionInfo } from '../../types/auth';
import { SecurityAlert } from '../../types/financial';
import { formatTimeAgo } from '../../lib/utils';

interface SecurityStatusProps {
  user: User;
  onEnableMFA: () => void;
  onDisableMFA: () => void;
  onViewSessions: () => void;
  onViewAlerts: () => void;
}

interface SecurityScore {
  score: number;
  maxScore: number;
  factors: {
    mfa_enabled: boolean;
    email_verified: boolean;
    strong_password: boolean;
    recent_login: boolean;
    no_security_alerts: boolean;
  };
}

export function SecurityStatus({ 
  user, 
  onEnableMFA, 
  onDisableMFA, 
  onViewSessions,
  onViewAlerts 
}: SecurityStatusProps) {
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<SecurityAlert[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
  }, [user]);

  const loadSecurityData = async () => {
    setIsLoading(true);
    
    try {
      // In a real app, these would be actual API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock security score calculation
      const mockScore: SecurityScore = {
        score: 0,
        maxScore: 5,
        factors: {
          mfa_enabled: user.mfa_enabled,
          email_verified: user.is_verified,
          strong_password: true, // Would be determined by backend
          recent_login: user.last_login ? 
            (Date.now() - new Date(user.last_login).getTime()) < 30 * 24 * 60 * 60 * 1000 : false,
          no_security_alerts: true // Would be determined by checking actual alerts
        }
      };
      
      // Calculate score
      mockScore.score = Object.values(mockScore.factors).filter(Boolean).length;
      
      // Mock recent security alerts
      const mockAlerts: SecurityAlert[] = [
        {
          id: '1',
          user_id: user.id,
          type: 'suspicious_login',
          severity: 'medium',
          title: 'Login from new device',
          description: 'A login was attempted from a new device in New York, NY',
          resolved: true,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            ip_address: '192.168.1.100',
            location: 'New York, NY',
            device: 'Chrome on MacOS'
          }
        }
      ];
      
      // Mock active sessions
      const mockSessions: SessionInfo[] = [
        {
          id: '1',
          device_info: 'Chrome on MacOS',
          ip_address: '192.168.1.100',
          location: 'New York, NY',
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          last_active: new Date().toISOString(),
          is_current: true
        },
        {
          id: '2',
          device_info: 'Safari on iPhone',
          ip_address: '192.168.1.101',
          location: 'New York, NY',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          last_active: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          is_current: false
        }
      ];
      
      setSecurityScore(mockScore);
      setRecentAlerts(mockAlerts);
      setActiveSessions(mockSessions);
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSecurityLevel = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    
    if (percentage >= 80) return { level: 'Strong', color: 'text-green-600', icon: ShieldCheck };
    if (percentage >= 60) return { level: 'Good', color: 'text-blue-600', icon: Shield };
    if (percentage >= 40) return { level: 'Fair', color: 'text-yellow-600', icon: ShieldAlert };
    return { level: 'Weak', color: 'text-red-600', icon: ShieldX };
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading security status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!securityScore) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load security status. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const securityLevel = getSecurityLevel(securityScore.score, securityScore.maxScore);
  const SecurityIcon = securityLevel.icon;
  const progressPercentage = (securityScore.score / securityScore.maxScore) * 100;

  return (
    <div className="space-y-6">
      {/* Security Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <SecurityIcon className={`h-5 w-5 mr-2 ${securityLevel.color}`} />
              Security Status
            </span>
            <Badge variant="outline" className={securityLevel.color}>
              {securityLevel.level}
            </Badge>
          </CardTitle>
          <CardDescription>
            Your account security score is {securityScore.score} out of {securityScore.maxScore}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Security Score</span>
              <span className="font-medium">
                {securityScore.score}/{securityScore.maxScore}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Security Factors */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Security Factors</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <Smartphone className="h-4 w-4 mr-2 text-muted-foreground" />
                  Two-Factor Authentication
                </div>
                <div className="flex items-center">
                  {securityScore.factors.mfa_enabled ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  Email Verified
                </div>
                <div className="flex items-center">
                  {securityScore.factors.email_verified ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <Key className="h-4 w-4 mr-2 text-muted-foreground" />
                  Strong Password
                </div>
                <div className="flex items-center">
                  {securityScore.factors.strong_password ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                  Recent Activity
                </div>
                <div className="flex items-center">
                  {securityScore.factors.recent_login ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
                  No Security Alerts
                </div>
                <div className="flex items-center">
                  {securityScore.factors.no_security_alerts ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Security Actions</CardTitle>
          <CardDescription>
            Improve your account security with these recommended actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user.mfa_enabled && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Enable two-factor authentication for better security</span>
                <Button size="sm" onClick={onEnableMFA}>
                  Enable MFA
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {user.mfa_enabled && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Two-factor authentication is enabled</span>
                <Button variant="outline" size="sm" onClick={onDisableMFA}>
                  Manage MFA
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" onClick={onViewSessions} className="justify-start">
              <Eye className="h-4 w-4 mr-2" />
              View Active Sessions ({activeSessions.length})
            </Button>
            <Button variant="outline" onClick={onViewAlerts} className="justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Security Alerts ({recentAlerts.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Security Alerts */}
      {recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Activity</CardTitle>
            <CardDescription>
              Your latest security events and alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.slice(0, 3).map((alert) => (
                <div 
                  key={alert.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getAlertIcon(alert.severity)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={alert.resolved ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {alert.resolved ? 'Resolved' : 'Active'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(alert.created_at)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {alert.description}
                    </p>
                  </div>
                </div>
              ))}
              
              {recentAlerts.length > 3 && (
                <Button variant="outline" onClick={onViewAlerts} className="w-full">
                  View All Alerts ({recentAlerts.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}