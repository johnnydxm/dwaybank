import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AccessibilitySettings } from '../components/accessibility/AccessibilitySettings';
import { SecurityStatus } from '../components/auth/SecurityStatus';
import { MFASetup } from '../components/auth/MFASetup';
import { MobileNavigation } from '../components/mobile/MobileNavigation';
import { useAccessibility, useScreenReader } from '../components/accessibility/AccessibilityProvider';
import { useAuth } from '../hooks/useAuth';
import { 
  Settings, 
  Shield, 
  Accessibility, 
  Bell, 
  User, 
  CreditCard, 
  HelpCircle,
  LogOut,
  ChevronRight
} from 'lucide-react';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string>('general');
  const [showMFASetup, setShowMFASetup] = useState(false);
  const { user, logout } = useAuth();
  const { isMobile } = useAccessibility();
  const { announceNavigation } = useScreenReader();

  useEffect(() => {
    announceNavigation('Settings page');
  }, []);

  const settingsSections = [
    {
      id: 'general',
      title: 'General',
      icon: Settings,
      description: 'Basic account settings'
    },
    {
      id: 'security',
      title: 'Security',
      icon: Shield,
      description: 'Security and privacy settings'
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      icon: Accessibility,
      description: 'Accessibility preferences'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      description: 'Notification preferences'
    },
    {
      id: 'payment',
      title: 'Payment Methods',
      icon: CreditCard,
      description: 'Manage payment methods'
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: HelpCircle,
      description: 'Get help and support'
    }
  ];

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const handleEnableMFA = () => {
    setShowMFASetup(true);
  };

  const handleDisableMFA = () => {
    console.log('Disable MFA');
  };

  const handleViewSessions = () => {
    console.log('View sessions');
  };

  const handleViewAlerts = () => {
    console.log('View alerts');
  };

  const handleMFASetupComplete = (backupCodes: string[]) => {
    setShowMFASetup(false);
    console.log('MFA setup complete with backup codes:', backupCodes);
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <input 
                type="text" 
                defaultValue={user?.first_name}
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input 
                type="text" 
                defaultValue={user?.last_name}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input 
              type="email" 
              defaultValue={user?.email}
              className="w-full p-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input 
              type="tel" 
              defaultValue={user?.phone_number}
              className="w-full p-2 border rounded-md"
            />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'security':
        return (
          <SecurityStatus
            user={user!}
            onEnableMFA={handleEnableMFA}
            onDisableMFA={handleDisableMFA}
            onViewSessions={handleViewSessions}
            onViewAlerts={handleViewAlerts}
          />
        );
      case 'accessibility':
        return <AccessibilitySettings />;
      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage your notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Notification settings coming soon...</p>
            </CardContent>
          </Card>
        );
      case 'payment':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Payment method management coming soon...</p>
            </CardContent>
          </Card>
        );
      case 'help':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Help & Support</CardTitle>
                <CardDescription>Get help with your DwayBank account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
                <Button variant="outline" onClick={logout} className="w-full justify-start text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return renderGeneralSettings();
    }
  };

  if (showMFASetup) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <MFASetup
            onSetupComplete={handleMFASetupComplete}
            onCancel={() => setShowMFASetup(false)}
          />
        </div>
        {isMobile && <MobileNavigation />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and preferences
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {settingsSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => handleSectionChange(section.id)}
                        className={`w-full flex items-center justify-between p-3 text-left rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="h-4 w-4" />
                          <div>
                            <p className="font-medium text-sm">{section.title}</p>
                            {!isMobile && (
                              <p className="text-xs text-muted-foreground">
                                {section.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            {renderActiveSection()}
          </div>
        </div>
      </main>

      {isMobile && <MobileNavigation />}
    </div>
  );
}