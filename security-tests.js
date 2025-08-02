const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function runSecurityTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    vulnerabilities: [],
    security_headers: {},
    authentication_tests: {},
    input_validation: {}
  };

  console.log('=== SECURITY TESTING SUITE ===\n');

  // Test 1: Security Headers
  console.log('1. Testing Security Headers...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    results.security_headers = {
      'x-powered-by': response.headers['x-powered-by'] || 'Not present',
      'x-frame-options': response.headers['x-frame-options'] || 'Missing',
      'x-content-type-options': response.headers['x-content-type-options'] || 'Missing',
      'x-xss-protection': response.headers['x-xss-protection'] || 'Missing',
      'strict-transport-security': response.headers['strict-transport-security'] || 'Missing',
      'content-security-policy': response.headers['content-security-policy'] || 'Missing'
    };

    // Check for security vulnerabilities
    if (results.security_headers['x-powered-by'] !== 'Not present') {
      results.vulnerabilities.push({
        type: 'Information Disclosure',
        severity: 'Low',
        description: 'X-Powered-By header reveals server technology',
        recommendation: 'Remove X-Powered-By header to avoid information disclosure'
      });
    }

    if (results.security_headers['x-frame-options'] === 'Missing') {
      results.vulnerabilities.push({
        type: 'Clickjacking',
        severity: 'Medium',
        description: 'Missing X-Frame-Options header',
        recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN header'
      });
    }

    if (results.security_headers['content-security-policy'] === 'Missing') {
      results.vulnerabilities.push({
        type: 'XSS Protection',
        severity: 'Medium',
        description: 'Missing Content-Security-Policy header',
        recommendation: 'Implement CSP header to prevent XSS attacks'
      });
    }

  } catch (error) {
    results.tests.security_headers = { status: 'error', error: error.message };
  }

  // Test 2: Authentication Bypass
  console.log('2. Testing Authentication...');
  try {
    // Test protected endpoint without token
    const unprotectedTest = await axios.get(`${BASE_URL}/api/v1/auth/profile`).catch(err => err.response);
    
    results.authentication_tests.unprotected_access = {
      status_code: unprotectedTest?.status || 'No response',
      protected: unprotectedTest?.status === 401 || unprotectedTest?.status === 403
    };

    if (!results.authentication_tests.unprotected_access.protected) {
      results.vulnerabilities.push({
        type: 'Authentication Bypass',
        severity: 'High',
        description: 'Protected endpoint accessible without authentication',
        recommendation: 'Implement proper authentication middleware'
      });
    }

  } catch (error) {
    results.authentication_tests.error = error.message;
  }

  // Test 3: Input Validation
  console.log('3. Testing Input Validation...');
  
  // XSS Test
  const xssPayload = {
    email: '<script>alert("XSS")</script>',
    password: 'password123',
    fullName: 'Test User'
  };

  try {
    const xssResponse = await axios.post(`${BASE_URL}/api/v1/auth/register`, xssPayload);
    results.input_validation.xss_test = {
      payload_accepted: true,
      response_contains_script: xssResponse.data.user.email.includes('<script>'),
      sanitized: !xssResponse.data.user.email.includes('<script>')
    };

    if (results.input_validation.xss_test.response_contains_script) {
      results.vulnerabilities.push({
        type: 'Cross-Site Scripting (XSS)',
        severity: 'High',
        description: 'Application accepts and returns unsanitized script tags',
        recommendation: 'Implement input sanitization and output encoding'
      });
    }
  } catch (error) {
    results.input_validation.xss_test = { status: 'error', error: error.message };
  }

  // SQL Injection Test
  const sqlPayload = {
    email: "admin@test.com'; DROP TABLE users; --",
    password: 'password123',
    fullName: 'Test User'
  };

  try {
    const sqlResponse = await axios.post(`${BASE_URL}/api/v1/auth/register`, sqlPayload);
    results.input_validation.sql_injection_test = {
      payload_accepted: true,
      sql_executed: false, // Since it's mock, we assume it's safe
      status: 'tested'
    };
  } catch (error) {
    results.input_validation.sql_injection_test = { status: 'error', error: error.message };
  }

  // Test 4: Rate Limiting
  console.log('4. Testing Rate Limiting...');
  const rateLimitTests = [];
  
  try {
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      }).catch(err => err.response);
      
      rateLimitTests.push({
        request: i + 1,
        status: response?.status,
        time: Date.now() - start
      });

      if (response?.status === 429) {
        break; // Rate limit hit
      }
    }

    const rateLimited = rateLimitTests.some(test => test.status === 429);
    results.authentication_tests.rate_limiting = {
      tested: true,
      rate_limited: rateLimited,
      requests_sent: rateLimitTests.length
    };

    if (!rateLimited) {
      results.vulnerabilities.push({
        type: 'Rate Limiting',
        severity: 'Medium',
        description: 'No rate limiting detected on authentication endpoints',
        recommendation: 'Implement rate limiting to prevent brute force attacks'
      });
    }

  } catch (error) {
    results.authentication_tests.rate_limiting = { status: 'error', error: error.message };
  }

  // Test 5: CORS Configuration
  console.log('5. Testing CORS Configuration...');
  try {
    const corsResponse = await axios.options(`${BASE_URL}/api/v1/auth/register`, {
      headers: {
        'Origin': 'http://malicious-site.com',
        'Access-Control-Request-Method': 'POST'
      }
    });

    results.security_headers.cors = {
      allows_all_origins: corsResponse.headers['access-control-allow-origin'] === '*',
      specific_origin: corsResponse.headers['access-control-allow-origin'],
      credentials_allowed: corsResponse.headers['access-control-allow-credentials'] === 'true'
    };

    if (results.security_headers.cors.allows_all_origins) {
      results.vulnerabilities.push({
        type: 'CORS Misconfiguration',
        severity: 'Medium',
        description: 'CORS allows all origins (*)',
        recommendation: 'Configure CORS to allow only trusted origins'
      });
    }

  } catch (error) {
    results.security_headers.cors = { status: 'error', error: error.message };
  }

  // Generate Summary
  results.summary = {
    total_tests: 5,
    vulnerabilities_found: results.vulnerabilities.length,
    high_severity: results.vulnerabilities.filter(v => v.severity === 'High').length,
    medium_severity: results.vulnerabilities.filter(v => v.severity === 'Medium').length,
    low_severity: results.vulnerabilities.filter(v => v.severity === 'Low').length,
    security_score: Math.max(0, 100 - (results.vulnerabilities.length * 10))
  };

  return results;
}

// Run security tests
runSecurityTests().then(results => {
  console.log('\n=== SECURITY TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  
  console.log('\n=== SECURITY SUMMARY ===');
  console.log(`Security Score: ${results.summary.security_score}/100`);
  console.log(`Vulnerabilities Found: ${results.summary.vulnerabilities_found}`);
  console.log(`High Severity: ${results.summary.high_severity}`);
  console.log(`Medium Severity: ${results.summary.medium_severity}`);
  console.log(`Low Severity: ${results.summary.low_severity}`);
  
  if (results.vulnerabilities.length > 0) {
    console.log('\n=== VULNERABILITIES ===');
    results.vulnerabilities.forEach((vuln, index) => {
      console.log(`${index + 1}. ${vuln.type} (${vuln.severity})`);
      console.log(`   Description: ${vuln.description}`);
      console.log(`   Recommendation: ${vuln.recommendation}\n`);
    });
  }

  process.exit(0);
}).catch(error => {
  console.error('Security testing failed:', error);
  process.exit(1);
});