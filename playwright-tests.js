const { chromium, firefox, webkit } = require('playwright');

async function runComprehensiveTests() {
  const browsers = [
    { name: 'Chromium', browser: chromium },
    { name: 'Firefox', browser: firefox },
    { name: 'WebKit', browser: webkit }
  ];

  const results = {
    timestamp: new Date().toISOString(),
    summary: {},
    detailed_results: [],
    performance_metrics: {},
    accessibility_issues: [],
    errors: []
  };

  for (const browserConfig of browsers) {
    try {
      console.log(`\n=== Testing with ${browserConfig.name} ===`);
      const browser = await browserConfig.browser.launch();
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
      const page = await context.newPage();

      // Enable console logging
      page.on('console', msg => {
        if (msg.type() === 'error') {
          results.errors.push({
            browser: browserConfig.name,
            type: 'console_error',
            message: msg.text(),
            timestamp: new Date().toISOString()
          });
        }
      });

      // Test 1: Page Load Performance
      console.log('Testing page load performance...');
      const startTime = Date.now();
      await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      results.performance_metrics[browserConfig.name] = {
        page_load_time: loadTime,
        timestamp: new Date().toISOString()
      };

      console.log(`Page loaded in ${loadTime}ms`);

      // Test 2: Core Web Vitals
      console.log('Measuring Core Web Vitals...');
      const cwv = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {};
          
          // LCP (Largest Contentful Paint)
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            vitals.lcp = entries[entries.length - 1].startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });

          // FID (First Input Delay) - simulate click
          setTimeout(() => {
            const button = document.querySelector('button');
            if (button) {
              const start = performance.now();
              button.click();
              vitals.fid = performance.now() - start;
            }
            resolve(vitals);
          }, 1000);
        });
      });

      results.performance_metrics[browserConfig.name].core_web_vitals = cwv;

      // Test 3: UI Elements and Functionality
      console.log('Testing UI elements...');
      const uiTests = {
        title_present: await page.title() !== '',
        react_root_exists: await page.locator('#root').count() > 0,
        navigation_elements: await page.locator('nav, header').count() > 0,
        interactive_elements: await page.locator('button, a, input').count() > 0
      };

      // Test 4: Accessibility
      console.log('Running accessibility checks...');
      const accessibilityIssues = await page.evaluate(() => {
        const issues = [];
        
        // Check for alt text on images
        const images = document.querySelectorAll('img');
        images.forEach((img, index) => {
          if (!img.alt) {
            issues.push(`Image ${index + 1} missing alt text`);
          }
        });

        // Check for form labels
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input, index) => {
          if (!input.labels || input.labels.length === 0) {
            issues.push(`Input ${index + 1} missing label`);
          }
        });

        // Check for heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) {
          issues.push('No heading elements found');
        }

        return issues;
      });

      if (accessibilityIssues.length > 0) {
        results.accessibility_issues.push({
          browser: browserConfig.name,
          issues: accessibilityIssues
        });
      }

      // Test 5: Mobile Responsiveness
      console.log('Testing mobile responsiveness...');
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone dimensions
      await page.waitForTimeout(1000);
      
      const mobileTest = {
        viewport_adjusted: await page.viewportSize(),
        content_visible: await page.locator('body').isVisible(),
        scrollable: await page.evaluate(() => document.body.scrollHeight > window.innerHeight)
      };

      // Test 6: API Integration
      console.log('Testing API integration...');
      let apiIntegrationTest = { status: 'pending' };
      try {
        // Check if page makes API calls
        const apiRequests = [];
        page.on('request', request => {
          if (request.url().includes('localhost:3000')) {
            apiRequests.push({
              url: request.url(),
              method: request.method(),
              timestamp: new Date().toISOString()
            });
          }
        });

        // Trigger potential API calls by interacting with the page
        await page.reload({ waitUntil: 'networkidle' });
        
        apiIntegrationTest = {
          status: 'tested',
          api_requests_made: apiRequests.length,
          requests: apiRequests
        };
      } catch (error) {
        apiIntegrationTest = {
          status: 'error',
          error: error.message
        };
      }

      const testResult = {
        browser: browserConfig.name,
        timestamp: new Date().toISOString(),
        tests: {
          page_load: { status: 'passed', load_time: loadTime },
          ui_elements: uiTests,
          mobile_responsive: mobileTest,
          api_integration: apiIntegrationTest,
          accessibility: {
            issues_count: accessibilityIssues.length,
            issues: accessibilityIssues
          }
        }
      };

      results.detailed_results.push(testResult);
      console.log(`${browserConfig.name} tests completed successfully`);

      await browser.close();
    } catch (error) {
      console.error(`Error testing ${browserConfig.name}:`, error.message);
      results.errors.push({
        browser: browserConfig.name,
        type: 'test_error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Generate summary
  results.summary = {
    browsers_tested: results.detailed_results.length,
    total_errors: results.errors.length,
    accessibility_issues_total: results.accessibility_issues.reduce((acc, curr) => acc + curr.issues.length, 0),
    average_load_time: Object.values(results.performance_metrics).reduce((acc, curr) => acc + curr.page_load_time, 0) / Object.keys(results.performance_metrics).length
  };

  return results;
}

// Run tests and output results
runComprehensiveTests().then(results => {
  console.log('\n=== COMPREHENSIVE TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Browsers tested: ${results.summary.browsers_tested}`);
  console.log(`Average load time: ${results.summary.average_load_time.toFixed(2)}ms`);
  console.log(`Total errors: ${results.summary.total_errors}`);
  console.log(`Accessibility issues: ${results.summary.accessibility_issues_total}`);
  
  process.exit(0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});