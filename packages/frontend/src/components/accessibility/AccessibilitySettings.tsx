import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { 
  Settings,
  Eye,
  Type,
  Keyboard,
  Volume2,
  Smartphone,
  Monitor,
  Accessibility,
  Info,
  CheckCircle
} from 'lucide-react';
import { useAccessibility, useScreenReader } from './AccessibilityProvider';

export function AccessibilitySettings() {
  const { settings, updateSetting } = useAccessibility();
  const { announce } = useScreenReader();

  const handleSettingChange = (key: keyof typeof settings, value: boolean) => {
    updateSetting(key, value);
    announce(`${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value ? 'enabled' : 'disabled'}`);
  };

  const settingsGroups = [
    {
      title: 'Visual Accessibility',
      icon: Eye,
      description: 'Adjust visual elements for better visibility',
      settings: [
        {
          key: 'highContrast' as const,
          label: 'High Contrast Mode',
          description: 'Increase contrast between text and background colors',
          icon: Monitor,
          wcagLevel: 'AA',
        },
        {
          key: 'largeText' as const,
          label: 'Large Text',
          description: 'Increase font sizes throughout the application',
          icon: Type,
          wcagLevel: 'AA',
        },
        {
          key: 'reduceMotion' as const,
          label: 'Reduce Motion',
          description: 'Minimize animations and transitions',
          icon: Accessibility,
          wcagLevel: 'AAA',
        },
        {
          key: 'focusIndicators' as const,
          label: 'Enhanced Focus Indicators',
          description: 'Show prominent focus outlines for better keyboard navigation',
          icon: Eye,
          wcagLevel: 'AA',
        },
      ],
    },
    {
      title: 'Navigation & Interaction',
      icon: Keyboard,
      description: 'Customize how you interact with the application',
      settings: [
        {
          key: 'keyboardNavigation' as const,
          label: 'Enhanced Keyboard Navigation',
          description: 'Improved keyboard shortcuts and focus management',
          icon: Keyboard,
          wcagLevel: 'AA',
        },
        {
          key: 'screenReaderOptimized' as const,
          label: 'Screen Reader Optimization',
          description: 'Enhanced announcements and descriptions for screen readers',
          icon: Volume2,
          wcagLevel: 'AA',
        },
      ],
    },
  ];

  const getWCAGBadgeColor = (level: string) => {
    switch (level) {
      case 'AAA':
        return 'bg-green-100 text-green-800';
      case 'AA':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Accessibility Settings
          </CardTitle>
          <CardDescription>
            Customize the interface to meet your accessibility needs. All settings comply with WCAG guidelines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              These settings are saved locally and will persist across sessions. Changes take effect immediately.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {settingsGroups.map((group) => {
        const GroupIcon = group.icon;
        
        return (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <GroupIcon className="h-5 w-5 mr-2" />
                {group.title}
              </CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {group.settings.map((setting) => {
                const SettingIcon = setting.icon;
                const isEnabled = settings[setting.key];
                
                return (
                  <div
                    key={setting.key}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0 mt-1">
                        <SettingIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Label 
                            htmlFor={setting.key}
                            className="font-medium cursor-pointer"
                          >
                            {setting.label}
                          </Label>
                          <Badge className={getWCAGBadgeColor(setting.wcagLevel)}>
                            WCAG {setting.wcagLevel}
                          </Badge>
                          {isEnabled && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <Switch
                        id={setting.key}
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
                        aria-describedby={`${setting.key}-description`}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Quickly apply common accessibility configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="flex items-center justify-start p-4 h-auto"
            onClick={() => {
              updateSetting('highContrast', true);
              updateSetting('largeText', true);
              updateSetting('focusIndicators', true);
              announce('Vision accessibility preset applied');
            }}
          >
            <Eye className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Vision Assistance</div>
              <div className="text-sm text-muted-foreground">
                High contrast, large text, focus indicators
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start p-4 h-auto"
            onClick={() => {
              updateSetting('keyboardNavigation', true);
              updateSetting('screenReaderOptimized', true);
              updateSetting('focusIndicators', true);
              announce('Screen reader preset applied');
            }}
          >
            <Volume2 className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Screen Reader</div>
              <div className="text-sm text-muted-foreground">
                Optimized for screen reader users
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start p-4 h-auto"
            onClick={() => {
              updateSetting('keyboardNavigation', true);
              updateSetting('focusIndicators', true);
              updateSetting('reduceMotion', true);
              announce('Motor accessibility preset applied');
            }}
          >
            <Keyboard className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Motor Assistance</div>
              <div className="text-sm text-muted-foreground">
                Keyboard navigation, reduced motion
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start p-4 h-auto"
            onClick={() => {
              updateSetting('largeText', true);
              updateSetting('reduceMotion', true);
              announce('Mobile optimization preset applied');
            }}
          >
            <Smartphone className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Mobile Optimized</div>
              <div className="text-sm text-muted-foreground">
                Large text, reduced motion for mobile
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* WCAG Compliance Information */}
      <Card>
        <CardHeader>
          <CardTitle>WCAG Compliance</CardTitle>
          <CardDescription>
            DwayBank follows Web Content Accessibility Guidelines (WCAG) 2.1
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <Badge className="bg-blue-100 text-blue-800 mb-2">
                Level AA
              </Badge>
              <h4 className="font-medium mb-1">Standard Compliance</h4>
              <p className="text-sm text-muted-foreground">
                Meets accessibility standards for most users
              </p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <Badge className="bg-green-100 text-green-800 mb-2">
                Level AAA
              </Badge>
              <h4 className="font-medium mb-1">Enhanced Features</h4>
              <p className="text-sm text-muted-foreground">
                Additional accessibility enhancements available
              </p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-medium mb-1">Continuously Tested</h4>
              <p className="text-sm text-muted-foreground">
                Regular accessibility audits and user testing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}