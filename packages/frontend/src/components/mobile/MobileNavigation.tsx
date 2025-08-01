import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Home,
  CreditCard,
  ArrowUpDown,
  Settings,
  User,
  Bell,
  Menu,
  X,
  Wallet,
  TrendingUp,
  Shield,
  Plus
} from 'lucide-react';
import { useAccessibility, useScreenReader } from '../accessibility/AccessibilityProvider';
import { cn } from '../../lib/utils';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
  color?: string;
}

interface MobileNavigationProps {
  notificationCount?: number;
  onQuickAction?: () => void;
}

export function MobileNavigation({ 
  notificationCount = 0, 
  onQuickAction 
}: MobileNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, isMobile } = useAccessibility();
  const { announceNavigation } = useScreenReader();

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      path: '/dashboard',
      color: 'text-blue-600'
    },
    {
      id: 'wallets',
      label: 'Wallets',
      icon: Wallet,
      path: '/wallets',
      color: 'text-green-600'
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: ArrowUpDown,
      path: '/transactions',
      color: 'text-purple-600'
    },
    {
      id: 'invest',
      label: 'Invest',
      icon: TrendingUp,
      path: '/invest',
      color: 'text-orange-600'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      color: 'text-gray-600',
      badge: notificationCount
    }
  ];

  useEffect(() => {
    // Detect keyboard usage for enhanced focus indicators
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleNavigation = (item: NavigationItem) => {
    navigate(item.path);
    announceNavigation(item.label);
    setIsMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const getItemClassName = (item: NavigationItem, isBottomNav = false) => {
    const baseClasses = cn(
      'flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200',
      {
        'min-h-[60px]': isBottomNav,
        'min-h-[48px]': !isBottomNav,
        'bg-blue-50 text-blue-600': isActive(item.path),
        'text-gray-600 hover:text-gray-900 hover:bg-gray-50': !isActive(item.path),
        'ring-2 ring-blue-500 ring-offset-2': isKeyboardUser && settings.focusIndicators,
        'text-lg': settings.largeText,
        'motion-reduce:transition-none': settings.reduceMotion,
      }
    );

    return baseClasses;
  };

  // Mobile Bottom Navigation (iOS/Android style)
  if (isMobile) {
    return (
      <>
        {/* Bottom Navigation Bar */}
        <nav 
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-1"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            {navigationItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={getItemClassName(item, true)}
                  onClick={() => handleNavigation(item)}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  aria-label={`Navigate to ${item.label}${item.badge ? ` (${item.badge} notifications)` : ''}`}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {item.badge && item.badge > 0 && (
                      <Badge 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                        variant="destructive"
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs mt-1 font-medium">
                    {item.label}
                  </span>
                </Button>
              );
            })}
            
            {/* Menu Button for Settings */}
            <Button
              variant="ghost"
              className={getItemClassName({ id: 'menu', label: 'Menu', icon: Menu, path: '/menu' }, true)}
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs mt-1 font-medium">Menu</span>
            </Button>
          </div>
        </nav>

        {/* Floating Action Button */}
        {onQuickAction && (
          <Button
            className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
            onClick={onQuickAction}
            aria-label="Quick action"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}

        {/* Full Screen Menu Overlay */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 bg-white">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Menu Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <nav className="space-y-2" role="navigation" aria-label="Secondary navigation">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start p-4 h-auto',
                          {
                            'bg-blue-50 text-blue-600': isActive(item.path),
                            'text-lg': settings.largeText,
                          }
                        )}
                        onClick={() => handleNavigation(item)}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={cn('h-5 w-5', item.color)} />
                          <span className="font-medium">{item.label}</span>
                          {item.badge && item.badge > 0 && (
                            <Badge variant="destructive" className="ml-auto">
                              {item.badge > 99 ? '99+' : item.badge}
                            </Badge>
                          )}
                        </div>
                      </Button>
                    );
                  })}

                  {/* Additional Menu Items */}
                  <div className="border-t pt-4 mt-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start p-4 h-auto"
                      onClick={() => {
                        navigate('/profile');
                        setIsMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <User className="h-5 w-5 text-gray-600" />
                        <span className="font-medium">Profile</span>
                      </div>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start p-4 h-auto"
                      onClick={() => {
                        navigate('/security');
                        setIsMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Shield className="h-5 w-5 text-gray-600" />
                        <span className="font-medium">Security</span>
                      </div>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start p-4 h-auto"
                      onClick={() => {
                        navigate('/notifications');
                        setIsMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Bell className="h-5 w-5 text-gray-600" />
                        <span className="font-medium">Notifications</span>
                        {notificationCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {notificationCount > 99 ? '99+' : notificationCount}
                          </Badge>
                        )}
                      </div>
                    </Button>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Bottom padding to prevent content from being hidden behind nav */}
        <div className="h-16" />
      </>
    );
  }

  // Desktop/Tablet Navigation (if needed)
  return null;
}