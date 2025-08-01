import { useState, useRef, TouchEvent, MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAccessibility } from '../accessibility/AccessibilityProvider';

interface TouchOptimizedCardProps {
  title?: string;
  children: React.ReactNode;
  onTap?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function TouchOptimizedCard({
  title,
  children,
  onTap,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  swipeThreshold = 50,
  longPressDelay = 500,
  className,
  disabled = false,
  'aria-label': ariaLabel,
}: TouchOptimizedCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const { settings, isMobile, hasReducedMotion } = useAccessibility();

  const clearLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
    setHasMoved(false);
    setIsPressed(true);

    // Start long press timer
    if (onLongPress) {
      const timer = setTimeout(() => {
        if (!hasMoved) {
          onLongPress();
          navigator.vibrate?.(50); // Haptic feedback if available
        }
      }, longPressDelay);
      setLongPressTimer(timer);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled || !touchStart) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // If user has moved significantly, cancel long press
    if (deltaX > 10 || deltaY > 10) {
      setHasMoved(true);
      clearLongPressTimer();
    }
    
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (disabled) return;
    
    setIsPressed(false);
    clearLongPressTimer();

    if (!touchStart || !touchEnd || hasMoved) return;

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if it's a swipe or tap
    if (absDeltaX > swipeThreshold && absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
        navigator.vibrate?.(30); // Light haptic feedback
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
        navigator.vibrate?.(30); // Light haptic feedback
      }
    } else if (absDeltaX < 10 && absDeltaY < 10) {
      // Tap
      if (onTap) {
        onTap();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (disabled || isMobile) return;
    setIsPressed(true);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (disabled || isMobile) return;
    setIsPressed(false);
    if (onTap) {
      onTap();
    }
  };

  const handleMouseLeave = () => {
    if (disabled || isMobile) return;
    setIsPressed(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onTap) {
        onTap();
      }
    }
  };

  const cardClasses = cn(
    'transition-all duration-150 cursor-pointer select-none',
    {
      'transform scale-95 shadow-sm': isPressed && !hasReducedMotion,
      'shadow-md hover:shadow-lg': !isPressed && !disabled,
      'opacity-50 cursor-not-allowed': disabled,
      'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2': settings.focusIndicators,
      'motion-reduce:transition-none motion-reduce:transform-none': settings.reduceMotion,
    },
    className
  );

  return (
    <Card
      ref={cardRef}
      className={cardClasses}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={ariaLabel || title}
      aria-disabled={disabled}
    >
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className={cn({ 'text-lg': settings.largeText })}>
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

// Quick action variants for financial operations
export function QuickBalanceCard({
  balance,
  currency = 'USD',
  accountName,
  onViewDetails,
  onQuickTransfer,
  isHidden = false,
  className,
}: {
  balance: number;
  currency?: string;
  accountName: string;
  onViewDetails?: () => void;
  onQuickTransfer?: () => void;
  isHidden?: boolean;
  className?: string;
}) {
  const { settings } = useAccessibility();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <TouchOptimizedCard
      onTap={onViewDetails}
      onSwipeLeft={onQuickTransfer}
      className={cn('bg-gradient-to-r from-blue-500 to-blue-600 text-white', className)}
      aria-label={`${accountName} balance ${isHidden ? 'hidden' : formatCurrency(balance)}`}
    >
      <div className="space-y-2">
        <p className={cn('text-blue-100', { 'text-sm': !settings.largeText })}>
          {accountName}
        </p>
        <p className={cn('font-bold', { 'text-2xl': !settings.largeText, 'text-3xl': settings.largeText })}>
          {isHidden ? '••••••' : formatCurrency(balance)}
        </p>
        {onQuickTransfer && (
          <p className="text-xs text-blue-100 opacity-80">
            Swipe left to transfer
          </p>
        )}
      </div>
    </TouchOptimizedCard>
  );
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  onAction,
  color = 'blue',
  badge,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onAction: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  badge?: string | number;
  className?: string;
}) {
  const { settings } = useAccessibility();

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <TouchOptimizedCard
      onTap={onAction}
      className={cn('border-2', colorClasses[color], className)}
      aria-label={title}
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={cn('font-medium', { 'text-base': settings.largeText })}>
              {title}
            </p>
            {badge && (
              <span className="ml-2 bg-white px-2 py-1 rounded-full text-xs font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className={cn('text-sm opacity-80', { 'text-base': settings.largeText })}>
            {description}
          </p>
        </div>
      </div>
    </TouchOptimizedCard>
  );
}