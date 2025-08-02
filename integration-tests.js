const { chromium } = require('playwright');
const axios = require('axios');

async function runIntegrationTests() {
  const results = {
    timestamp: new Date().toISOString(),
    backend_api_tests: {},
    frontend_backend_integration: {},
    error_handling: {},
    user_workflows: {},
    data_flow: {},
    summary: {}
  };

  console.log('=== INTEGRATION TESTING SUITE ===\n');

  // Test 1: Backend API Availability
  console.log('1. Testing Backend API Availability...');
  try {
    const healthCheck = await axios.get('http://localhost:3000/health');
    const apiInfo = await axios.get('http://localhost:3000/api');
    
    results.backend_api_tests = {
      health_endpoint: {
        status: healthCheck.status,
        response_time: healthCheck.config.timeout || 'N/A',
        data: healthCheck.data
      },
      api_info_endpoint: {
        status: apiInfo.status,
        endpoints_count: apiInfo.data.endpoints?.length || 0,
        available_endpoints: apiInfo.data.endpoints || []
      }
    };
  } catch (error) {
    results.backend_api_tests.error = error.message;
  }

  // Test 2: Frontend-Backend Communication
  console.log('2. Testing Frontend-Backend Communication...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor network requests
  const apiRequests = [];
  const apiErrors = [];
  
  page.on('request', request => {
    if (request.url().includes('localhost:3000')) {
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on('response', response => {
    if (response.url().includes('localhost:3000') && !response.ok()) {
      apiErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        timestamp: new Date().toISOString()
      });
    }
  });

  try {
    // Navigate to frontend
    console.log('   Loading frontend application...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Wait a bit to see if any API calls are made automatically
    await page.waitForTimeout(3000);

    // Check if the page loaded successfully
    const pageTitle = await page.title();
    const hasReactRoot = await page.locator('#root').count() > 0;
    
    results.frontend_backend_integration = {
      frontend_loaded: pageTitle !== '',
      react_app_mounted: hasReactRoot,
      automatic_api_calls: apiRequests.length,
      api_errors: apiErrors.length,
      api_requests: apiRequests,
      api_error_details: apiErrors
    };

    // Test 3: Manual API Integration Test
    console.log('3. Testing Manual API Integration...');
    
    // Try to trigger API calls by interacting with the page
    const buttons = await page.locator('button').count();
    const forms = await page.locator('form').count();
    const inputs = await page.locator('input').count();
    
    // If there are interactive elements, try to use them
    if (buttons > 0) {
      console.log('   Found buttons, attempting to click...');
      await page.locator('button').first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    if (forms > 0 && inputs > 0) {
      console.log('   Found forms, attempting to fill and submit...');
      await page.locator('input').first().fill('test@example.com').catch(() => {});
      await page.waitForTimeout(1000);
      
      const submitButton = page.locator('button[type="submit"], input[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // Test 4: Error Handling
    console.log('4. Testing Error Handling...');
    
    // Test with invalid data
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Try to make a request to a non-existent endpoint
    const errorTestRequest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/nonexistent');
        return {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        };
      } catch (error) {
        return {
          error: error.message,
          type: 'network_error'
        };
      }
    });

    results.error_handling = {
      console_errors: consoleErrors,
      error_endpoint_test: errorTestRequest,
      error_handling_present: consoleErrors.length === 0 || errorTestRequest.status === 404
    };

    // Test 5: User Workflow Simulation
    console.log('5. Testing User Workflows...');
    
    // Simulate user registration workflow
    let registrationTest = { attempted: false };
    
    try {
      // Look for registration form elements
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], input[type="submit"]');
      
      if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
        console.log('   Found registration form elements, testing workflow...');
        
        await emailInput.fill('testuser@example.com');
        await passwordInput.fill('password123');
        
        // Track API requests before submission
        const preSubmitRequests = apiRequests.length;
        
        await submitButton.click();
        await page.waitForTimeout(3000);
        
        registrationTest = {
          attempted: true,
          form_filled: true,
          api_request_made: apiRequests.length > preSubmitRequests,
          new_requests: apiRequests.slice(preSubmitRequests)
        };
      } else {
        registrationTest = {
          attempted: false,
          reason: 'No registration form found'
        };
      }
    } catch (error) {
      registrationTest = {
        attempted: true,
        error: error.message
      };
    }

    results.user_workflows = {
      registration_test: registrationTest,
      interactive_elements: {
        buttons: buttons,
        forms: forms,
        inputs: inputs
      }
    };

    // Test 6: Data Flow Analysis
    console.log('6. Analyzing Data Flow...');
    
    results.data_flow = {
      total_api_requests: apiRequests.length,
      unique_endpoints: [...new Set(apiRequests.map(req => req.url))],
      request_methods: [...new Set(apiRequests.map(req => req.method))],
      api_communication_working: apiRequests.length > 0 && apiErrors.length === 0
    };

  } catch (error) {
    results.frontend_backend_integration.error = error.message;
  } finally {
    await browser.close();
  }

  // Generate Summary
  results.summary = {
    backend_available: !!results.backend_api_tests.health_endpoint,
    frontend_loaded: !!results.frontend_backend_integration.frontend_loaded,
    api_integration_working: results.data_flow.api_communication_working,
    error_handling_present: results.error_handling.error_handling_present,
    user_workflows_testable: results.user_workflows.registration_test.attempted,
    total_issues: (results.backend_api_tests.error ? 1 : 0) + 
                  (results.frontend_backend_integration.error ? 1 : 0) +
                  (results.error_handling.console_errors?.length || 0),
    integration_score: calculateIntegrationScore(results)
  };

  return results;
}

function calculateIntegrationScore(results) {
  let score = 100;
  
  // Deduct points for various issues
  if (results.backend_api_tests.error) score -= 30;
  if (results.frontend_backend_integration.error) score -= 20;
  if (!results.frontend_backend_integration.react_app_mounted) score -= 15;
  if (results.frontend_backend_integration.api_errors > 0) score -= 10;
  if (results.error_handling.console_errors?.length > 0) score -= 5;
  if (!results.data_flow.api_communication_working) score -= 20;
  
  return Math.max(0, score);
}

// Run integration tests
runIntegrationTests().then(results => {
  console.log('\n=== INTEGRATION TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  
  console.log('\n=== INTEGRATION SUMMARY ===');
  console.log(`Integration Score: ${results.summary.integration_score}/100`);
  console.log(`Backend Available: ${results.summary.backend_available ? 'Yes' : 'No'}`);
  console.log(`Frontend Loaded: ${results.summary.frontend_loaded ? 'Yes' : 'No'}`);
  console.log(`API Integration Working: ${results.summary.api_integration_working ? 'Yes' : 'No'}`);
  console.log(`Error Handling Present: ${results.summary.error_handling_present ? 'Yes' : 'No'}`);
  console.log(`Total Issues: ${results.summary.total_issues}`);
  
  process.exit(0);
}).catch(error => {
  console.error('Integration testing failed:', error);
  process.exit(1);
});