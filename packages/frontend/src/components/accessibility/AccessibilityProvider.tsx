import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  isMobile: boolean;
  hasReducedMotion: boolean;
}

const defaultSettings: AccessibilitySettings = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderOptimized: false,
  keyboardNavigation: true,
  focusIndicators: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isMobile, setIsMobile] = useState(false);
  const [hasReducedMotion, setHasReducedMotion] = useState(false);

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('dwaybank-accessibility-settings');
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch (error) {
        console.warn('Failed to load accessibility settings:', error);
      }
    }

    // Detect system preferences
    detectSystemPreferences();

    // Set up media query listeners
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleMobileChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setHasReducedMotion(e.matches);

    mobileQuery.addEventListener('change', handleMobileChange);
    motionQuery.addEventListener('change', handleMotionChange);

    setIsMobile(mobileQuery.matches);
    setHasReducedMotion(motionQuery.matches);

    return () => {
      mobileQuery.removeEventListener('change', handleMobileChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  useEffect(() => {
    // Apply settings to document
    applyAccessibilitySettings();
    
    // Save settings to localStorage
    localStorage.setItem('dwaybank-accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  const detectSystemPreferences = () => {
    // Detect system-level accessibility preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    setSettings(prev => ({
      ...prev,
      reduceMotion: prefersReducedMotion,
      highContrast: prefersHighContrast,
    }));
  };

  const applyAccessibilitySettings = () => {
    const root = document.documentElement;
    
    // Apply CSS custom properties based on settings
    root.style.setProperty('--reduce-motion', settings.reduceMotion ? '1' : '0');
    root.style.setProperty('--high-contrast', settings.highContrast ? '1' : '0');
    root.style.setProperty('--large-text', settings.largeText ? '1' : '0');
    
    // Apply CSS classes
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('large-text', settings.largeText);
    root.classList.toggle('screen-reader-optimized', settings.screenReaderOptimized);
    root.classList.toggle('keyboard-navigation', settings.keyboardNavigation);
    root.classList.toggle('focus-indicators', settings.focusIndicators);
  };

  const updateSetting = (key: keyof AccessibilitySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create or update live region for screen reader announcements
    let liveRegion = document.getElementById('accessibility-live-region');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'accessibility-live-region';
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    } else {
      liveRegion.setAttribute('aria-live', priority);
    }

    // Clear and set the message
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion!.textContent = message;
    }, 100);
  };

  const value: AccessibilityContextType = {
    settings,
    updateSetting,
    announceToScreenReader,
    isMobile,
    hasReducedMotion: hasReducedMotion || settings.reduceMotion,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

// Custom hook for focus management
export function useFocusManagement() {
  const { settings } = useAccessibility();

  const trapFocus = (element: HTMLElement) => {
    if (!settings.keyboardNavigation) return;

    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  };

  const setFocus = (element: HTMLElement | null, delay = 0) => {
    if (!element || !settings.keyboardNavigation) return;
    
    setTimeout(() => {
      element.focus();
    }, delay);
  };

  return {
    trapFocus,
    setFocus,
  };
}

// Custom hook for screen reader announcements
export function useScreenReader() {
  const { announceToScreenReader, settings } = useAccessibility();

  const announce = (message: string, priority?: 'polite' | 'assertive') => {
    if (settings.screenReaderOptimized) {
      announceToScreenReader(message, priority);
    }
  };

  const announceNavigation = (pageName: string) => {
    announce(`Navigated to ${pageName}`, 'polite');
  };

  const announceAction = (action: string) => {
    announce(action, 'assertive');
  };

  const announceError = (error: string) => {
    announce(`Error: ${error}`, 'assertive');
  };

  const announceSuccess = (message: string) => {
    announce(`Success: ${message}`, 'polite');
  };

  return {
    announce,
    announceNavigation,
    announceAction,
    announceError,
    announceSuccess,
  };
}

// Custom hook for responsive design
export function useResponsive() {
  const { isMobile } = useAccessibility();
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const tabletQuery = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');
    const desktopQuery = window.matchMedia('(min-width: 1025px)');

    const handleTabletChange = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    const handleDesktopChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

    tabletQuery.addEventListener('change', handleTabletChange);
    desktopQuery.addEventListener('change', handleDesktopChange);

    setIsTablet(tabletQuery.matches);
    setIsDesktop(desktopQuery.matches);

    return () => {
      tabletQuery.removeEventListener('change', handleTabletChange);
      desktopQuery.removeEventListener('change', handleDesktopChange);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  };
}