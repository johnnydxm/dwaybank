// Mobile Performance Optimization Utilities
// Optimized for financial applications with real-time data

export interface PerformanceMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

export interface MobilePerformanceConfig {
  enableLazyLoading: boolean;
  enableServiceWorker: boolean;
  enableImageOptimization: boolean;
  enableCriticalCSS: boolean;
  networkAwareLoading: boolean;
}

export class MobilePerformanceOptimizer {
  private config: MobilePerformanceConfig;
  private metrics: PerformanceMetrics = {
    loadTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0,
    timeToInteractive: 0
  };

  constructor(config: Partial<MobilePerformanceConfig> = {}) {
    this.config = {
      enableLazyLoading: true,
      enableServiceWorker: true,
      enableImageOptimization: true,
      enableCriticalCSS: true,
      networkAwareLoading: true,
      ...config
    };
  }

  // Initialize performance optimizations
  init(): void {
    if (this.config.enableLazyLoading) {
      this.setupLazyLoading();
    }
    
    if (this.config.enableServiceWorker && 'serviceWorker' in navigator) {
      this.registerServiceWorker();
    }
    
    if (this.config.enableImageOptimization) {
      this.optimizeImages();
    }
    
    if (this.config.networkAwareLoading) {
      this.setupNetworkAwareLoading();
    }
    
    this.setupPerformanceMonitoring();
    this.setupCriticalResourceHints();
  }

  // Lazy loading for images and components
  private setupLazyLoading(): void {
    // Intersection Observer for lazy loading
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.classList.add('loaded');
            imageObserver.unobserve(img);
          }
        }
      });
    });

    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // Service Worker for caching and offline support
  private async registerServiceWorker(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.warn('Service Worker registration failed:', error);
    }
  }

  // Optimize images for mobile devices
  private optimizeImages(): void {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      // Add loading="lazy" for native lazy loading
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
      
      // Add decoding="async" for better performance
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
      
      // Set up responsive images if not already configured
      if (!img.hasAttribute('srcset') && img.src) {
        this.setupResponsiveImage(img);
      }
    });
  }

  private setupResponsiveImage(img: HTMLImageElement): void {
    const src = img.src;
    if (!src) return;
    
    // Create different sizes for responsive loading
    const sizes = [320, 480, 768, 1024];
    const srcset = sizes.map(size => 
      `${src}?w=${size}&q=75 ${size}w`
    ).join(', ');
    
    img.setAttribute('srcset', srcset);
    img.setAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw');
  }

  // Network-aware loading for different connection types
  private setupNetworkAwareLoading(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const adjustForConnection = () => {
        const effectiveType = connection.effectiveType;
        
        switch (effectiveType) {
          case 'slow-2g':
          case '2g':
            this.enableLowBandwidthMode();
            break;
          case '3g':
            this.enableMediumBandwidthMode();
            break;
          case '4g':
          default:
            this.enableHighBandwidthMode();
            break;
        }
      };
      
      adjustForConnection();
      connection.addEventListener('change', adjustForConnection);
    }
  }

  private enableLowBandwidthMode(): void {
    // Reduce image quality, disable animations, etc.
    document.body.classList.add('low-bandwidth');
    
    // Disable non-essential animations
    const style = document.createElement('style');
    style.textContent = `
      .low-bandwidth *,
      .low-bandwidth *::before,
      .low-bandwidth *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  }

  private enableMediumBandwidthMode(): void {
    document.body.classList.add('medium-bandwidth');
    // Reduce some animations but keep essential ones
  }

  private enableHighBandwidthMode(): void {
    document.body.classList.remove('low-bandwidth', 'medium-bandwidth');
    // Enable all features
  }

  // Critical resource hints for better loading
  private setupCriticalResourceHints(): void {
    const preloadLinks = [
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      { href: '/api/user/profile', as: 'fetch', crossorigin: 'anonymous' }
    ];
    
    preloadLinks.forEach(({ href, as, type, crossorigin }) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = href;
      link.as = as;
      if (type) link.type = type;
      if (crossorigin) link.crossOrigin = crossorigin;
      document.head.appendChild(link);
    });
  }

  // Performance monitoring and Core Web Vitals
  private setupPerformanceMonitoring(): void {
    // First Contentful Paint
    this.observePerformanceEntry('first-contentful-paint', (entry) => {
      this.metrics.firstContentfulPaint = entry.startTime;
    });
    
    // Largest Contentful Paint
    this.observeLCP();
    
    // First Input Delay
    this.observeFID();
    
    // Cumulative Layout Shift
    this.observeCLS();
    
    // Time to Interactive
    this.observeTTI();
    
    // Page Load Time
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
    });
  }

  private observePerformanceEntry(entryType: string, callback: (entry: PerformanceEntry) => void): void {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(callback);
    });
    observer.observe({ entryTypes: [entryType] });
  }

  private observeLCP(): void {
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.largestContentfulPaint = lastEntry.startTime;
    }).observe({ entryTypes: ['largest-contentful-paint'] });
  }

  private observeFID(): void {
    new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry: any) => {
        if (entry.name === 'first-input') {
          this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
        }
      });
    }).observe({ entryTypes: ['first-input'] });
  }

  private observeCLS(): void {
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.metrics.cumulativeLayoutShift = clsValue;
        }
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }

  private observeTTI(): void {
    // Simplified TTI calculation
    if ('PerformanceObserver' in window) {
      let ttiTime = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.entryType === 'measure' && entry.name === 'TTI') {
            ttiTime = entry.startTime;
            this.metrics.timeToInteractive = ttiTime;
          }
        });
      });
      observer.observe({ entryTypes: ['measure'] });
    }
  }

  // Get current performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    const { 
      firstContentfulPaint, 
      largestContentfulPaint, 
      firstInputDelay, 
      cumulativeLayoutShift 
    } = this.metrics;
    
    // Scoring based on Core Web Vitals thresholds
    let score = 100;
    
    // FCP scoring (good: <1.8s, needs improvement: 1.8s-3s, poor: >3s)
    if (firstContentfulPaint > 3000) score -= 25;
    else if (firstContentfulPaint > 1800) score -= 10;
    
    // LCP scoring (good: <2.5s, needs improvement: 2.5s-4s, poor: >4s)
    if (largestContentfulPaint > 4000) score -= 25;
    else if (largestContentfulPaint > 2500) score -= 10;
    
    // FID scoring (good: <100ms, needs improvement: 100ms-300ms, poor: >300ms)
    if (firstInputDelay > 300) score -= 25;
    else if (firstInputDelay > 100) score -= 10;
    
    // CLS scoring (good: <0.1, needs improvement: 0.1-0.25, poor: >0.25)
    if (cumulativeLayoutShift > 0.25) score -= 25;
    else if (cumulativeLayoutShift > 0.1) score -= 10;
    
    return Math.max(0, score);
  }

  // Generate performance report
  generateReport(): {
    score: number;
    metrics: PerformanceMetrics;
    recommendations: string[];
    status: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  } {
    const score = this.getPerformanceScore();
    const metrics = this.getMetrics();
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (metrics.firstContentfulPaint > 1800) {
      recommendations.push('Optimize First Contentful Paint: Reduce server response time and eliminate render-blocking resources');
    }
    
    if (metrics.largestContentfulPaint > 2500) {
      recommendations.push('Optimize Largest Contentful Paint: Optimize images and preload critical resources');
    }
    
    if (metrics.firstInputDelay > 100) {
      recommendations.push('Optimize First Input Delay: Reduce JavaScript execution time and break up long tasks');
    }
    
    if (metrics.cumulativeLayoutShift > 0.1) {
      recommendations.push('Optimize Cumulative Layout Shift: Set explicit dimensions for images and embeds');
    }
    
    const status = score >= 90 ? 'excellent' : 
                  score >= 75 ? 'good' : 
                  score >= 50 ? 'needs-improvement' : 'poor';
    
    return {
      score,
      metrics,
      recommendations,
      status
    };
  }
}

// Export convenience function
export function initMobilePerformance(config?: Partial<MobilePerformanceConfig>): MobilePerformanceOptimizer {
  const optimizer = new MobilePerformanceOptimizer(config);
  optimizer.init();
  return optimizer;
}

// Financial app specific optimizations
export function optimizeForFinancialApp(): void {
  // Preload critical financial data endpoints
  const criticalEndpoints = [
    '/api/accounts/balance',
    '/api/transactions/recent',
    '/api/user/profile'
  ];
  
  criticalEndpoints.forEach(endpoint => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = endpoint;
    document.head.appendChild(link);
  });
  
  // Optimize for financial data updates
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.active?.postMessage({
        type: 'CACHE_FINANCIAL_ENDPOINTS',
        endpoints: criticalEndpoints
      });
    });
  }
}