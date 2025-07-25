# JWT Token Exchange Migration Guide

## 🎯 Overview

This guide provides step-by-step instructions for migrating from the current local Salesforce token exchange to an external JWT backend service. The migration maintains backward compatibility while introducing the new JWT-based authentication flow.

## 📋 Prerequisites

### 1. System Requirements
- Node.js v18+ with existing Salesforce API test tool
- Access to modify `salesforce-proxy.js` and related files
- External JWT backend service (see [JWT API Specification](./jwt-api-specification.md))
- Salesforce Connected App with OAuth configuration

### 2. Environment Preparation
- Backup current implementation
- Prepare staging environment for testing
- Configure external JWT backend service
- Update environment variables

## 🔧 Migration Steps

### Step 1: Environment Configuration

#### 1.1 Update `.env` File
Add the following environment variables to your `.env` file:

```bash
# JWT Backend Service Configuration
JWT_BACKEND_URL=https://your-jwt-backend.com
JWT_BACKEND_API_KEY=your_backend_api_key
JWT_BACKEND_TIMEOUT=30000

# JWT Token Configuration  
JWT_TOKEN_STORAGE=memory
JWT_REFRESH_THRESHOLD=300
JWT_VALIDATION_INTERVAL=600

# Migration Control (for phased rollout)
ENABLE_JWT_FLOW=true
ENABLE_LEGACY_OAUTH=false
JWT_MIGRATION_MODE=full

# Optional: Enhanced Logging for Migration
JWT_DEBUG_MODE=true
LOG_LEVEL=debug
```

#### 1.2 Validate JWT Backend Service
Test connectivity to your JWT backend service:

```bash
# Test basic connectivity
curl -X GET https://your-jwt-backend.com/health \
  -H "Authorization: Bearer your_backend_api_key"

# Test exchange endpoint structure
curl -X POST https://your-jwt-backend.com/oauth/exchange \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_backend_api_key" \
  -d '{"test": true}'
```

### Step 2: Code Modifications

#### 2.1 Modify Global Variables (`salesforce-proxy.js` lines 46-49)

**Current Code:**
```javascript
// Token storage (in production, use database or secure session storage)
let accessToken = null;
let instanceUrl = null;
let refreshToken = null;
```

**New Code:**
```javascript
// Token storage (in production, use database or secure session storage)
let accessToken = null;      // Legacy Salesforce access token
let instanceUrl = null;      // Legacy Salesforce instance URL  
let refreshToken = null;     // Legacy Salesforce refresh token

// JWT Token Storage
let jwtToken = null;         // JWT token from external backend
let tokenExpiry = null;      // JWT token expiration timestamp
let userProfile = null;      // User profile data from JWT
let jwtRefreshToken = null;  // JWT refresh token if provided

// Migration control
const useJWTFlow = process.env.ENABLE_JWT_FLOW === 'true';
const enableLegacy = process.env.ENABLE_LEGACY_OAUTH === 'true';
```

#### 2.2 Add JWT Utility Functions

Add these utility functions after the existing `debugLog` function (around line 27):

```javascript
// JWT Token Management Functions
function isTokenExpired() {
    if (!tokenExpiry) return true;
    const now = new Date();
    const expiryTime = new Date(tokenExpiry);
    const thresholdMs = (parseInt(process.env.JWT_REFRESH_THRESHOLD) || 300) * 1000;
    return (expiryTime.getTime() - now.getTime()) < thresholdMs;
}

function getUserContext() {
    if (!userProfile) return null;
    return {
        userId: userProfile.id,
        email: userProfile.email,
        organizationId: userProfile.organizationId,
        permissions: userProfile.permissions || []
    };
}

async function refreshJWTToken() {
    if (!jwtRefreshToken) {
        throw new Error('No JWT refresh token available');
    }
    
    try {
        console.log('\n=== JWT Token Refresh ===');
        
        const refreshResponse = await fetch(`${process.env.JWT_BACKEND_URL}/oauth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.JWT_BACKEND_API_KEY}`,
                'X-Request-Source': 'salesforce-api-test-tool'
            },
            body: JSON.stringify({
                refreshToken: jwtRefreshToken,
                grantType: 'refresh_token'
            }),
            timeout: parseInt(process.env.JWT_BACKEND_TIMEOUT) || 30000
        });
        
        const refreshData = await refreshResponse.json();
        
        if (refreshResponse.ok && refreshData.success) {
            console.log('✅ JWT token refreshed successfully');
            
            jwtToken = refreshData.token;
            tokenExpiry = new Date(Date.now() + (refreshData.expiresIn * 1000));
            
            if (refreshData.refreshToken) {
                jwtRefreshToken = refreshData.refreshToken;
            }
            
            return true;
        } else {
            console.log('❌ JWT token refresh failed:', refreshData);
            return false;
        }
    } catch (error) {
        console.error('JWT token refresh error:', error);
        return false;
    }
}

async function validateJWTToken() {
    if (!jwtToken) return false;
    
    try {
        const validateResponse = await fetch(`${process.env.JWT_BACKEND_URL}/oauth/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.JWT_BACKEND_API_KEY}`
            },
            body: JSON.stringify({
                token: jwtToken
            }),
            timeout: 10000
        });
        
        const validateData = await validateResponse.json();
        return validateResponse.ok && validateData.valid;
    } catch (error) {
        console.error('JWT token validation error:', error);
        return false;
    }
}
```

#### 2.3 Replace OAuth Callback Handler (`salesforce-proxy.js` lines 202-305)

**Replace the entire `/api/sf/auth/callback` route with:**

```javascript
// OAuth Callback - Handle authorization code with JWT backend
app.get('/api/sf/auth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        console.log('\n=== OAuth Callback Received ===');
        debugLog('OAuth callback received', { 
            code: code?.substring(0, 10) + '...', 
            state, 
            error,
            useJWTFlow
        });
        
        // Handle authorization denied
        if (error) {
            console.log('❌ OAuth authorization denied:', error);
            return res.redirect(`/?error=${encodeURIComponent(error)}`);
        }
        
        // Verify state parameter (CSRF protection)
        if (!state || state !== req.session.oauthState) {
            console.log('❌ Invalid state parameter - potential CSRF attack');
            return res.redirect('/?error=invalid_state');
        }
        
        // Get code verifier from session
        const codeVerifier = req.session.codeVerifier;
        
        // Clear used state and code verifier
        delete req.session.oauthState;
        delete req.session.codeVerifier;
        
        console.log('✅ State parameter verified');
        
        // Choose flow based on configuration
        if (useJWTFlow) {
            return await handleJWTTokenExchange(req, res, code, state);
        } else if (enableLegacy) {
            return await handleLegacySalesforceTokenExchange(req, res, code, codeVerifier);
        } else {
            console.log('❌ No authentication flow enabled');
            return res.redirect('/?error=no_auth_flow_configured');
        }
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
});

// JWT Token Exchange Handler
async function handleJWTTokenExchange(req, res, code, state) {
    try {
        console.log('🔄 Starting JWT token exchange flow...');
        
        const jwtResponse = await fetch(`${process.env.JWT_BACKEND_URL}/oauth/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.JWT_BACKEND_API_KEY}`,
                'X-Request-Source': 'salesforce-api-test-tool',
                'X-Request-ID': `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            },
            body: JSON.stringify({
                authorizationCode: code,
                state: state,
                redirectUri: OAUTH_CONFIG.redirectUri,
                clientMetadata: {
                    source: 'salesforce-api-test-tool',
                    version: '3.0.0',
                    timestamp: new Date().toISOString(),
                    userAgent: req.headers['user-agent']
                }
            }),
            timeout: parseInt(process.env.JWT_BACKEND_TIMEOUT) || 30000
        });
        
        const jwtData = await jwtResponse.json();
        
        console.log('\n=== JWT Backend Response ===');
        console.log('Response Status:', jwtResponse.status);
        
        if (jwtResponse.ok && jwtData.success) {
            console.log('✅ JWT token exchange successful');
            
            // Store JWT token and user profile
            jwtToken = jwtData.token;
            tokenExpiry = new Date(Date.now() + (jwtData.expiresIn * 1000));
            userProfile = jwtData.userProfile;
            
            // Store refresh token if provided
            if (jwtData.refreshToken) {
                jwtRefreshToken = jwtData.refreshToken;
            }
            
            console.log('🎯 JWT Token stored successfully');
            console.log('👤 User Profile:', userProfile.email);
            console.log('⏰ Token Expires:', tokenExpiry.toISOString());
            
            // Clear legacy tokens to prevent confusion
            accessToken = null;
            refreshToken = null;
            instanceUrl = jwtData.salesforceInstanceUrl || 'https://api.salesforce.com';
            
            res.redirect('/?auth=success&type=jwt');
        } else {
            console.log('❌ JWT token exchange failed');
            console.log('Error Response:', jwtData);
            
            // Fallback to legacy flow if enabled and JWT fails
            if (enableLegacy) {
                console.log('🔄 Falling back to legacy OAuth flow...');
                return await handleLegacySalesforceTokenExchange(req, res, code, req.session.codeVerifier);
            }
            
            res.redirect(`/?error=${encodeURIComponent(jwtData.error || 'JWT token exchange failed')}`);
        }
        
    } catch (error) {
        console.error('JWT token exchange error:', error);
        
        // Fallback to legacy flow if enabled and JWT backend is unreachable
        if (enableLegacy) {
            console.log('🔄 JWT backend unreachable, falling back to legacy flow...');
            return await handleLegacySalesforceTokenExchange(req, res, code, req.session.codeVerifier);
        }
        
        res.redirect(`/?error=${encodeURIComponent('JWT backend unavailable')}`);
    }
}

// Legacy Salesforce Token Exchange Handler (existing code)
async function handleLegacySalesforceTokenExchange(req, res, code, codeVerifier) {
    console.log('🔄 Using legacy Salesforce token exchange...');
    
    // [Insert existing token exchange code here - lines 235-305 from original]
    const tokenRequestBody = {
        grant_type: 'authorization_code',
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        code: code
    };
    
    // Add code verifier if it exists (for PKCE)
    if (codeVerifier) {
        tokenRequestBody.code_verifier = codeVerifier;
    }
    
    const tokenResponse = await fetch(`${OAUTH_CONFIG.instanceUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(tokenRequestBody)
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenResponse.ok) {
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        instanceUrl = tokenData.instance_url;
        
        // Clear JWT tokens to prevent confusion
        jwtToken = null;
        tokenExpiry = null;
        userProfile = null;
        
        console.log('✅ Legacy OAuth authentication successful');
        res.redirect('/?auth=success&type=legacy');
    } else {
        console.log('❌ Legacy token exchange failed:', tokenData);
        res.redirect(`/?error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`);
    }
}
```

#### 2.4 Update Authentication Helper Function (`salesforce-proxy.js` lines 419-455)

**Replace the `makeAuthenticatedRequest` function with:**

```javascript
// Helper function for making authenticated Salesforce API calls
async function makeAuthenticatedRequest(url, options = {}) {
    // Check JWT authentication first
    if (useJWTFlow && jwtToken) {
        return await makeJWTAuthenticatedRequest(url, options);
    }
    
    // Fallback to legacy authentication
    if (!accessToken) {
        throw new Error('Not authenticated with Salesforce');
    }
    
    return await makeLegacyAuthenticatedRequest(url, options);
}

// JWT-based authenticated request
async function makeJWTAuthenticatedRequest(url, options = {}) {
    // Check if token needs refresh
    if (isTokenExpired()) {
        console.log('🔄 JWT token expired, attempting refresh...');
        const refreshed = await refreshJWTToken();
        if (!refreshed) {
            throw new Error('JWT token expired and refresh failed');
        }
    }
    
    if (!jwtToken) {
        throw new Error('Not authenticated - JWT token missing');
    }
    
    const userContext = getUserContext();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'X-User-Context': userContext ? JSON.stringify(userContext) : undefined,
            'X-Auth-Type': 'jwt',
            ...options.headers
        }
    });
    
    let data = null;
    
    // Get response text first to avoid JSON parsing errors
    const responseText = await response.text();
    
    // Only try to parse JSON if there's actual content
    if (responseText && responseText.trim().length > 0) {
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.log('⚠️ Response is not JSON:', responseText);
            data = { rawResponse: responseText };
        }
    }
    
    if (!response.ok) {
        // Handle JWT-specific errors
        if (response.status === 401) {
            console.log('🔄 JWT authentication failed, attempting token refresh...');
            const refreshed = await refreshJWTToken();
            if (refreshed) {
                // Retry the request with new token
                return await makeJWTAuthenticatedRequest(url, options);
            }
        }
        
        const errorMessage = data?.[0]?.message || data?.message || data?.rawResponse || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    
    return { response, data };
}

// Legacy Salesforce authenticated request
async function makeLegacyAuthenticatedRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Auth-Type': 'legacy',
            ...options.headers
        }
    });
    
    let data = null;
    
    // Get response text first to avoid JSON parsing errors
    const responseText = await response.text();
    
    // Only try to parse JSON if there's actual content
    if (responseText && responseText.trim().length > 0) {
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.log('⚠️ Response is not JSON:', responseText);
            data = { rawResponse: responseText };
        }
    }
    
    if (!response.ok) {
        const errorMessage = data?.[0]?.message || data?.message || data?.rawResponse || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    
    return { response, data };
}
```

#### 2.5 Update Authentication Status Endpoint (`salesforce-proxy.js` lines 392-398)

**Replace the `/api/sf/auth/status` route with:**

```javascript
// OAuth Status Check
app.get('/api/sf/auth/status', (req, res) => {
    const isJWTAuthenticated = !!(jwtToken && !isTokenExpired());
    const isLegacyAuthenticated = !!accessToken;
    
    res.json({
        authenticated: isJWTAuthenticated || isLegacyAuthenticated,
        authType: isJWTAuthenticated ? 'jwt' : (isLegacyAuthenticated ? 'legacy' : 'none'),
        hasRefreshToken: !!(jwtRefreshToken || refreshToken),
        instanceUrl: instanceUrl,
        userProfile: isJWTAuthenticated ? userProfile : null,
        tokenExpiry: isJWTAuthenticated ? tokenExpiry : null,
        jwtFlow: useJWTFlow,
        legacyEnabled: enableLegacy
    });
});
```

#### 2.6 Update Logout Endpoint (`salesforce-proxy.js` lines 401-412)

**Replace the `/api/sf/auth/logout` route with:**

```javascript
// OAuth Logout
app.post('/api/sf/auth/logout', (req, res) => {
    // Clear all tokens
    accessToken = null;
    refreshToken = null;
    instanceUrl = null;
    jwtToken = null;
    tokenExpiry = null;
    userProfile = null;
    jwtRefreshToken = null;
    
    console.log('🔓 User logged out - all tokens cleared');
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});
```

### Step 3: Frontend Updates

#### 3.1 Update Authentication Status Display (`salesforce-oauth.html`)

Find the authentication status checking JavaScript and update it to handle JWT authentication:

**Add this to the JavaScript section (around line 400-500):**

```javascript
// Enhanced authentication status checking
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/sf/auth/status');
        const data = await response.json();
        
        console.log('Auth Status:', data);
        
        if (data.authenticated) {
            const authType = data.authType === 'jwt' ? 'JWT Backend' : 'Legacy OAuth';
            const userInfo = data.userProfile ? 
                `${data.userProfile.email} (${data.userProfile.organizationId})` : 
                'User authenticated';
            
            statusDiv.innerHTML = `
                <div class="status connected">
                    ✅ Connected to Salesforce via ${authType}<br>
                    👤 ${userInfo}<br>
                    ${data.tokenExpiry ? `⏰ Token expires: ${new Date(data.tokenExpiry).toLocaleString()}` : ''}
                </div>
            `;
            
            loginBtn.disabled = true;
            refreshBtn.disabled = false;
            logoutBtn.disabled = false;
            
            // Enable Contact operations
            enableContactOperations();
            
            // Auto-refresh token if using JWT and near expiry
            if (data.authType === 'jwt' && data.tokenExpiry) {
                const expiryTime = new Date(data.tokenExpiry);
                const now = new Date();
                const timeToExpiry = expiryTime.getTime() - now.getTime();
                
                // Schedule refresh 5 minutes before expiry
                if (timeToExpiry > 0 && timeToExpiry < 600000) {
                    setTimeout(checkAuthStatus, timeToExpiry - 300000);
                }
            }
            
        } else {
            statusDiv.innerHTML = '<div class="status disconnected">❌ Not connected to Salesforce</div>';
            loginBtn.disabled = false;
            refreshBtn.disabled = true;
            logoutBtn.disabled = true;
            
            // Disable Contact operations
            disableContactOperations();
        }
    } catch (error) {
        console.error('Failed to check auth status:', error);
        statusDiv.innerHTML = '<div class="status disconnected">❌ Failed to check authentication status</div>';
    }
}
```

### Step 4: Testing and Validation

#### 4.1 Create Test Scripts

Create a new file `test-jwt-migration.js`:

```javascript
// JWT Migration Test Script
const fetch = require('node-fetch');

const baseUrl = 'http://localhost:3000';
const jwtBackendUrl = process.env.JWT_BACKEND_URL;

async function testJWTBackendConnectivity() {
    console.log('🧪 Testing JWT Backend Connectivity...');
    
    try {
        const response = await fetch(`${jwtBackendUrl}/health`);
        console.log(`✅ JWT Backend health check: ${response.status}`);
        return true;
    } catch (error) {
        console.log(`❌ JWT Backend connectivity failed: ${error.message}`);
        return false;
    }
}

async function testOAuthFlow() {
    console.log('🧪 Testing OAuth Flow...');
    
    try {
        // Test OAuth initiation
        const authResponse = await fetch(`${baseUrl}/api/sf/auth/login`);
        const authData = await authResponse.json();
        
        if (authData.success && authData.authUrl) {
            console.log('✅ OAuth initiation successful');
            console.log('🔗 Auth URL generated:', authData.authUrl.substring(0, 100) + '...');
            return true;
        } else {
            console.log('❌ OAuth initiation failed:', authData);
            return false;
        }
    } catch (error) {
        console.log(`❌ OAuth flow test failed: ${error.message}`);
        return false;
    }
}

async function testAuthStatus() {
    console.log('🧪 Testing Auth Status Endpoint...');
    
    try {
        const response = await fetch(`${baseUrl}/api/sf/auth/status`);
        const data = await response.json();
        
        console.log('✅ Auth status endpoint responsive');
        console.log('📊 Current auth status:', data);
        return true;
    } catch (error) {
        console.log(`❌ Auth status test failed: ${error.message}`);
        return false;
    }
}

async function runMigrationTests() {
    console.log('\n🚀 Starting JWT Migration Tests\n');
    
    const tests = [
        { name: 'JWT Backend Connectivity', test: testJWTBackendConnectivity },
        { name: 'OAuth Flow', test: testOAuthFlow },
        { name: 'Auth Status', test: testAuthStatus }
    ];
    
    let passed = 0;
    
    for (const { name, test } of tests) {
        const result = await test();
        if (result) passed++;
        console.log('');
    }
    
    console.log(`\n📊 Test Results: ${passed}/${tests.length} tests passed`);
    
    if (passed === tests.length) {
        console.log('🎉 All tests passed! Migration appears successful.');
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.');
    }
}

// Run tests if called directly
if (require.main === module) {
    runMigrationTests();
}

module.exports = { runMigrationTests };
```

#### 4.2 Manual Testing Checklist

**Pre-Migration Testing:**
- [ ] Current OAuth flow works correctly
- [ ] Contact CRUD operations function properly
- [ ] Token refresh mechanism operates correctly
- [ ] Error handling works as expected

**Post-Migration Testing:**
- [ ] JWT backend connectivity established
- [ ] OAuth flow redirects to JWT backend
- [ ] JWT tokens are received and stored
- [ ] Contact operations work with JWT authentication
- [ ] Token refresh works with JWT backend
- [ ] Fallback to legacy flow (if enabled) functions
- [ ] Error scenarios are handled gracefully
- [ ] Frontend displays correct authentication status

### Step 5: Deployment and Monitoring

#### 5.1 Deployment Checklist

**Pre-Deployment:**
- [ ] All environment variables configured
- [ ] JWT backend service tested and operational
- [ ] Code changes thoroughly tested in staging
- [ ] Rollback plan prepared and tested
- [ ] Monitoring and alerting configured

**Deployment:**
- [ ] Deploy during low-traffic period
- [ ] Monitor authentication success rates
- [ ] Verify JWT backend response times
- [ ] Check error rates and logs
- [ ] Validate user experience

**Post-Deployment:**
- [ ] Monitor for 24 hours minimum
- [ ] Validate all authentication flows
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Document any issues encountered

#### 5.2 Monitoring Metrics

Monitor these key metrics after deployment:

```javascript
// Add monitoring to your application
const metrics = {
    authAttempts: 0,
    authSuccesses: 0,
    jwtTokenExchanges: 0,
    jwtTokenRefreshes: 0,
    legacyFallbacks: 0,
    errors: []
};

// Example: Add to OAuth callback handler
function recordMetric(type, success = true, details = {}) {
    metrics.authAttempts++;
    if (success) metrics.authSuccesses++;
    
    if (type === 'jwt_exchange') metrics.jwtTokenExchanges++;
    if (type === 'jwt_refresh') metrics.jwtTokenRefreshes++;
    if (type === 'legacy_fallback') metrics.legacyFallbacks++;
    
    if (!success) {
        metrics.errors.push({
            type,
            details,
            timestamp: new Date().toISOString()
        });
    }
    
    // Log metrics every 100 requests
    if (metrics.authAttempts % 100 === 0) {
        console.log('📊 Authentication Metrics:', {
            successRate: (metrics.authSuccesses / metrics.authAttempts * 100).toFixed(2) + '%',
            jwtExchanges: metrics.jwtTokenExchanges,
            jwtRefreshes: metrics.jwtTokenRefreshes,
            legacyFallbacks: metrics.legacyFallbacks,
            recentErrors: metrics.errors.slice(-5)
        });
    }
}
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. JWT Backend Connectivity Issues
**Symptoms:** "JWT backend unavailable" errors
**Solutions:**
- Verify `JWT_BACKEND_URL` is correct and accessible
- Check JWT backend service is running and healthy
- Validate API key configuration
- Check network connectivity and firewall rules

#### 2. Token Exchange Failures
**Symptoms:** "JWT token exchange failed" errors
**Solutions:**
- Verify authorization code is being passed correctly
- Check JWT backend logs for detailed error information
- Validate Salesforce Connected App configuration
- Ensure redirect URI matches exactly

#### 3. Token Refresh Problems
**Symptoms:** Frequent authentication failures, expired token errors
**Solutions:**
- Check JWT token expiry handling logic
- Verify refresh token is being stored and used correctly
- Monitor JWT backend refresh endpoint
- Adjust `JWT_REFRESH_THRESHOLD` if needed

#### 4. Performance Issues
**Symptoms:** Slow authentication, timeouts
**Solutions:**
- Monitor JWT backend response times
- Adjust `JWT_BACKEND_TIMEOUT` setting
- Implement connection pooling
- Consider caching strategies

## 🔄 Rollback Procedure

If issues arise, follow this rollback procedure:

### Emergency Rollback
1. Set `ENABLE_JWT_FLOW=false` in environment
2. Set `ENABLE_LEGACY_OAUTH=true` in environment
3. Restart the application
4. Verify legacy OAuth flow is working

### Full Rollback
1. Restore backup of original code
2. Remove JWT-related environment variables
3. Clear JWT token storage
4. Test original functionality
5. Document issues for future resolution

## 📝 Post-Migration Tasks

### 1. Performance Optimization
- Monitor and optimize JWT backend response times
- Implement request caching where appropriate
- Tune token refresh intervals
- Optimize error handling patterns

### 2. Security Review
- Audit JWT token storage and transmission
- Review error handling for information leakage
- Validate security of JWT backend communication
- Implement additional monitoring and alerting

### 3. Documentation Updates
- Update user documentation with new authentication flow
- Document operational procedures for JWT backend
- Create troubleshooting guides for common issues
- Update system architecture documentation

### 4. Future Enhancements
- Consider implementing JWT token caching
- Add support for multiple JWT backends
- Implement advanced error recovery patterns
- Plan for JWT backend failover scenarios

---

*This migration guide provides comprehensive instructions for implementing JWT token exchange in the Salesforce API test tool. Follow each step carefully and test thoroughly before deploying to production.*