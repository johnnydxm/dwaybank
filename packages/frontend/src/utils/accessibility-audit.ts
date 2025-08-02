// Accessibility and Mobile Audit Utilities
// These utilities help validate WCAG 2.1 AA compliance and mobile optimization

export interface AccessibilityViolation {
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagRule: string;
  element: string;
  description: string;
  recommendation: string;
}

export interface MobileOptimizationIssue {
  type: 'touch-target' | 'viewport' | 'performance' | 'interaction';
  element: string;
  issue: string;
  recommendation: string;
}

export class AccessibilityAuditor {
  private violations: AccessibilityViolation[] = [];
  private mobileIssues: MobileOptimizationIssue[] = [];

  // Check for WCAG 2.1 AA compliance issues
  auditAccessibility(): AccessibilityViolation[] {
    this.violations = [];
    
    // Check for missing alt text on images
    this.checkImageAltText();
    
    // Check for proper heading hierarchy
    this.checkHeadingHierarchy();
    
    // Check for form labels
    this.checkFormLabels();
    
    // Check for color contrast
    this.checkColorContrast();
    
    // Check for keyboard navigation
    this.checkKeyboardNavigation();
    
    // Check for ARIA attributes
    this.checkAriaAttributes();
    
    return this.violations;
  }

  // Check mobile optimization issues
  auditMobileOptimization(): MobileOptimizationIssue[] {
    this.mobileIssues = [];
    
    // Check touch target sizes
    this.checkTouchTargets();
    
    // Check viewport configuration
    this.checkViewportConfig();
    
    // Check for mobile-friendly interactions
    this.checkMobileInteractions();
    
    return this.mobileIssues;
  }

  private checkImageAltText(): void {
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        this.violations.push({
          severity: 'serious',
          wcagRule: 'WCAG 1.1.1 (Non-text Content)',
          element: `img[${index}] - ${img.src?.substring(0, 50)}...`,
          description: 'Image missing alternative text',
          recommendation: 'Add descriptive alt attribute or aria-label'
        });
      }
    });
  }

  private checkHeadingHierarchy(): void {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let previousLevel = 0;
    
    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      
      if (index === 0 && currentLevel !== 1) {
        this.violations.push({
          severity: 'serious',
          wcagRule: 'WCAG 1.3.1 (Info and Relationships)',
          element: `${heading.tagName} - "${heading.textContent?.substring(0, 30)}..."`,
          description: 'Page should start with h1 heading',
          recommendation: 'Use h1 for the main page title'
        });
      }
      
      if (currentLevel > previousLevel + 1) {
        this.violations.push({
          severity: 'moderate',
          wcagRule: 'WCAG 1.3.1 (Info and Relationships)',
          element: `${heading.tagName} - "${heading.textContent?.substring(0, 30)}..."`,
          description: 'Heading level skipped in hierarchy',
          recommendation: 'Use sequential heading levels (h1 → h2 → h3)'
        });
      }
      
      previousLevel = currentLevel;
    });
  }

  private checkFormLabels(): void {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        this.violations.push({
          severity: 'serious',
          wcagRule: 'WCAG 1.3.1 (Info and Relationships)',
          element: `${input.tagName.toLowerCase()}[${index}] - ${input.getAttribute('type') || 'text'}`,
          description: 'Form control missing accessible label',
          recommendation: 'Add label element, aria-label, or aria-labelledby attribute'
        });
      }
    });
  }

  private checkColorContrast(): void {
    // This is a simplified check - in practice, you'd want to use a library like axe-core
    const textElements = document.querySelectorAll('p, span, div, a, button, h1, h2, h3, h4, h5, h6');
    
    textElements.forEach((element, index) => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Simplified check for low contrast (this would need a proper contrast calculation)
      if (color === 'rgb(128, 128, 128)' && backgroundColor === 'rgb(255, 255, 255)') {
        this.violations.push({
          severity: 'serious',
          wcagRule: 'WCAG 1.4.3 (Contrast Minimum)',
          element: `${element.tagName.toLowerCase()}[${index}] - "${element.textContent?.substring(0, 30)}..."`,
          description: 'Text may not meet minimum contrast ratio of 4.5:1',
          recommendation: 'Use darker text colors or lighter background colors'
        });
      }
    });
  }

  private checkKeyboardNavigation(): void {
    const focusableElements = document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    focusableElements.forEach((element, index) => {
      const tabIndex = element.getAttribute('tabindex');
      
      if (tabIndex && parseInt(tabIndex) > 0) {
        this.violations.push({
          severity: 'moderate',
          wcagRule: 'WCAG 2.4.3 (Focus Order)',
          element: `${element.tagName.toLowerCase()}[${index}] - tabindex="${tabIndex}"`,
          description: 'Positive tabindex can create confusing focus order',
          recommendation: 'Use tabindex="0" or rely on natural DOM order'
        });
      }
    });
  }

  private checkAriaAttributes(): void {
    const interactiveElements = document.querySelectorAll('button, [role="button"], [role="menuitem"]');
    
    interactiveElements.forEach((element, index) => {
      const hasAriaLabel = element.getAttribute('aria-label');
      const hasAriaLabelledBy = element.getAttribute('aria-labelledby');
      const hasVisibleText = element.textContent?.trim();
      
      if (!hasAriaLabel && !hasAriaLabelledBy && !hasVisibleText) {
        this.violations.push({
          severity: 'serious',
          wcagRule: 'WCAG 4.1.2 (Name, Role, Value)',
          element: `${element.tagName.toLowerCase()}[${index}] - ${element.getAttribute('role') || 'button'}`,
          description: 'Interactive element missing accessible name',
          recommendation: 'Add visible text, aria-label, or aria-labelledby'
        });
      }
    });
  }

  private checkTouchTargets(): void {
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    
    interactiveElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const minSize = 44; // Minimum 44px as per WCAG 2.5.5
      
      if (rect.width < minSize || rect.height < minSize) {
        this.mobileIssues.push({
          type: 'touch-target',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          issue: `Touch target too small: ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
          recommendation: `Increase size to at least ${minSize}x${minSize}px`
        });
      }
    });
  }

  private checkViewportConfig(): void {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    
    if (!viewportMeta) {
      this.mobileIssues.push({
        type: 'viewport',
        element: 'head',
        issue: 'Missing viewport meta tag',
        recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">'
      });
    } else {
      const content = viewportMeta.getAttribute('content');
      if (!content?.includes('width=device-width')) {
        this.mobileIssues.push({
          type: 'viewport',
          element: 'meta[name="viewport"]',
          issue: 'Viewport not set to device width',
          recommendation: 'Include width=device-width in viewport meta tag'
        });
      }
    }
  }

  private checkMobileInteractions(): void {
    // Check for hover-only interactions
    const elementsWithHover = document.querySelectorAll('[class*="hover:"]');
    
    elementsWithHover.forEach((element, index) => {
      const hasClickHandler = element.getAttribute('onclick') || 
                            element.addEventListener || 
                            element.tagName === 'BUTTON' || 
                            element.tagName === 'A';
      
      if (!hasClickHandler) {
        this.mobileIssues.push({
          type: 'interaction',
          element: `${element.tagName.toLowerCase()}[${index}]`,
          issue: 'Hover-only interaction not accessible on touch devices',
          recommendation: 'Provide touch/click alternative for hover interactions'
        });
      }
    });
  }

  // Generate comprehensive accessibility report
  generateReport(): {
    accessibilityScore: number;
    mobileScore: number;
    violations: AccessibilityViolation[];
    mobileIssues: MobileOptimizationIssue[];
    recommendations: string[];
  } {
    const violations = this.auditAccessibility();
    const mobileIssues = this.auditMobileOptimization();
    
    // Calculate scores (simplified scoring system)
    const maxAccessibilityPoints = 100;
    const accessibilityDeductions = violations.reduce((total, violation) => {
      switch (violation.severity) {
        case 'critical': return total + 25;
        case 'serious': return total + 15;
        case 'moderate': return total + 10;
        case 'minor': return total + 5;
        default: return total;
      }
    }, 0);
    
    const maxMobilePoints = 100;
    const mobileDeductions = mobileIssues.length * 10;
    
    const accessibilityScore = Math.max(0, maxAccessibilityPoints - accessibilityDeductions);
    const mobileScore = Math.max(0, maxMobilePoints - mobileDeductions);
    
    // Generate recommendations
    const recommendations = [
      ...violations.slice(0, 5).map(v => v.recommendation),
      ...mobileIssues.slice(0, 3).map(i => i.recommendation)
    ];
    
    return {
      accessibilityScore,
      mobileScore,
      violations,
      mobileIssues,
      recommendations
    };
  }
}

// Export convenience function for quick audits
export function runAccessibilityAudit() {
  const auditor = new AccessibilityAuditor();
  return auditor.generateReport();
}