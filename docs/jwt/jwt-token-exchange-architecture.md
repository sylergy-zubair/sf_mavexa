# JWT Token Exchange Architecture

## 🎯 Overview

This document outlines the architectural modification to the existing Salesforce OAuth 2.0 implementation to support external JWT token exchange. Instead of exchanging the Salesforce authorization code locally for Salesforce access tokens, the system will forward the authorization code to an external backend service that returns JWT tokens for authentication.

## 🔄 Current vs New Architecture

### Current OAuth Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  User Browser   │    │ Express Server  │    │   Salesforce    │
│                 │    │  (Port 3000)    │    │  OAuth Server   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ ①  OAuth Login        │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │ ②  Salesforce OAuth URL                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │ ③  User Authorization │                       │
         │◄──────────────────────┼──────────────────────►│
         │                       │                       │
         │ ④  Callback with Code │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │                       │ ⑤  Token Exchange    │
         │                       ├──────────────────────►│
         │                       │                       │
         │                       │ ⑥  Access Token      │
         │                       │◄──────────────────────┤
         │                       │                       │
         │ ⑦  Success Response   │                       │
         │◄──────────────────────┤                       │
```

### New JWT-Based Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │    │                 │
│  User Browser   │    │ Express Server  │    │  JWT Backend    │    │   Salesforce    │
│                 │    │  (Port 3000)    │    │   Service       │    │  OAuth Server   │
│                 │    │                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         │ ①  OAuth Login        │                       │                       │
         ├──────────────────────►│                       │                       │
         │                       │                       │                       │
         │ ②  Salesforce OAuth URL                       │                       │
         │◄──────────────────────┤                       │                       │
         │                       │                       │                       │
         │ ③  User Authorization │                       │                       │
         │◄──────────────────────┼───────────────────────────────────────────────►│
         │                       │                       │                       │
         │ ④  Callback with Code │                       │                       │
         ├──────────────────────►│                       │                       │
         │                       │                       │                       │
         │                       │ ⑤  Forward Auth Code │                       │
         │                       ├──────────────────────►│                       │
         │                       │                       │                       │
         │                       │                       │ ⑥  Exchange for Token│
         │                       │                       ├──────────────────────►│
         │                       │                       │                       │
         │                       │                       │ ⑦  Salesforce Tokens │
         │                       │                       │◄──────────────────────┤
         │                       │                       │                       │
         │                       │ ⑧  JWT Token          │                       │
         │                       │◄──────────────────────┤                       │
         │                       │                       │                       │
         │ ⑨  Success Response   │                       │                       │
         │◄──────────────────────┤                       │                       │
```

## 🏗️ Key Architectural Changes

### 1. OAuth Callback Handler Modification
**File:** `salesforce-proxy.js` (lines 202-305)

**Current Behavior:**
- Receives authorization code from Salesforce
- Exchanges code directly with Salesforce for access tokens
- Stores Salesforce tokens in local memory

**New Behavior:**
- Receives authorization code from Salesforce
- Forwards code to external JWT backend service
- Receives JWT token from backend
- Stores JWT token for subsequent API calls

### 2. Token Storage Strategy
**Current Storage:**
```javascript
// Global variables in salesforce-proxy.js
let accessToken = null;      // Salesforce access token
let instanceUrl = null;      // Salesforce instance URL
let refreshToken = null;     // Salesforce refresh token
```

**New Storage:**
```javascript
// Modified storage for JWT tokens
let jwtToken = null;         // JWT token from external backend
let tokenExpiry = null;      // JWT token expiration timestamp
let userProfile = null;      // User profile data from JWT
```

### 3. Authentication Middleware Changes
**Current Implementation:**
```javascript
// salesforce-proxy.js:419-455
async function makeAuthenticatedRequest(url, options = {}) {
    if (!accessToken) {
        throw new Error('Not authenticated with Salesforce');
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    // ... rest of implementation
}
```

**New Implementation:**
```javascript
async function makeAuthenticatedRequest(url, options = {}) {
    if (!jwtToken || isTokenExpired()) {
        throw new Error('Not authenticated - JWT token missing or expired');
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'X-User-Context': getUserContext(),
            ...options.headers
        }
    });
    // ... enhanced error handling for JWT
}
```

## 🔧 Technical Implementation Details

### 1. External JWT Backend Service Specification

The external JWT backend service must provide the following capabilities:

#### Required Endpoints:

##### POST /oauth/exchange
**Purpose:** Exchange Salesforce authorization code for JWT token
**Request:**
```json
{
    "authorizationCode": "aPrx...",
    "state": "csrf_state_value",
    "redirectUri": "http://localhost:3000/api/sf/auth/callback",
    "clientMetadata": {
        "source": "salesforce-api-test-tool",
        "version": "3.0.0",
        "timestamp": "2025-01-25T10:30:00Z"
    }
}
```

**Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "refreshToken": "refresh_token_if_needed",
    "userProfile": {
        "id": "user_id",
        "email": "user@example.com",
        "organizationId": "salesforce_org_id",
        "permissions": ["api", "contact_crud"]
    }
}
```

##### POST /oauth/refresh
**Purpose:** Refresh JWT token using refresh token
**Request:**
```json
{
    "refreshToken": "refresh_token_value",
    "grantType": "refresh_token"
}
```

##### POST /oauth/validate
**Purpose:** Validate JWT token and get user context
**Request:**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
    "valid": true,
    "expiresAt": "2025-01-25T11:30:00Z",
    "userProfile": {
        "id": "user_id",
        "email": "user@example.com",
        "organizationId": "salesforce_org_id",
        "permissions": ["api", "contact_crud"]
    }
}
```

### 2. Environment Configuration

**New Environment Variables:**
```bash
# JWT Backend Service Configuration
JWT_BACKEND_URL=https://your-jwt-backend.com
JWT_BACKEND_API_KEY=your_backend_api_key
JWT_BACKEND_TIMEOUT=30000

# JWT Token Configuration
JWT_TOKEN_STORAGE=memory  # Options: memory, redis, database
JWT_REFRESH_THRESHOLD=300  # Refresh token 5 minutes before expiry

# Backward Compatibility (optional)
ENABLE_LEGACY_OAUTH=false  # Set to true for gradual migration
```

### 3. Modified OAuth Callback Implementation

**New Callback Handler:**
```javascript
// Enhanced callback handler in salesforce-proxy.js
app.get('/api/sf/auth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        console.log('\n=== JWT OAuth Callback Received ===');
        
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
        
        // Clear used state
        delete req.session.oauthState;
        delete req.session.codeVerifier;
        
        console.log('✅ State parameter verified');
        console.log('🔄 Forwarding authorization code to JWT backend...');
        
        // Forward authorization code to JWT backend
        const jwtResponse = await fetch(`${process.env.JWT_BACKEND_URL}/oauth/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.JWT_BACKEND_API_KEY}`,
                'X-Request-Source': 'salesforce-api-test-tool'
            },
            body: JSON.stringify({
                authorizationCode: code,
                state: state,
                redirectUri: OAUTH_CONFIG.redirectUri,
                clientMetadata: {
                    source: 'salesforce-api-test-tool',
                    version: '3.0.0',
                    timestamp: new Date().toISOString()
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
                refreshToken = jwtData.refreshToken;
            }
            
            console.log('🎯 JWT Token stored successfully');
            console.log('👤 User Profile:', userProfile.email);
            console.log('⏰ Token Expires:', tokenExpiry.toISOString());
            
            res.redirect('/?auth=success&type=jwt');
        } else {
            console.log('❌ JWT token exchange failed');
            console.log('Error Response:', jwtData);
            res.redirect(`/?error=${encodeURIComponent(jwtData.error || 'JWT token exchange failed')}`);
        }
        
    } catch (error) {
        console.error('JWT OAuth callback error:', error);
        res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
});
```

## 🔒 Security Considerations

### 1. JWT Token Security
- **Token Storage:** Store JWT tokens securely (consider HTTP-only cookies for production)
- **Token Validation:** Implement regular token validation with the JWT backend
- **Token Rotation:** Support automatic token refresh before expiration
- **Secure Communication:** All communications with JWT backend must use HTTPS

### 2. External Backend Security
- **API Authentication:** Use secure API keys for backend communication
- **Request Signing:** Consider implementing request signing for additional security
- **Rate Limiting:** Implement rate limiting for backend service calls
- **Audit Logging:** Log all token exchange operations for security monitoring

### 3. Error Handling
- **Graceful Degradation:** Handle JWT backend unavailability gracefully
- **Fallback Mechanisms:** Consider fallback to local token exchange during outages
- **Security Logging:** Log all authentication failures and suspicious activities

## 📊 Performance Considerations

### 1. Latency Impact
- **Additional Network Call:** JWT backend adds ~50-200ms latency to OAuth flow
- **Token Validation:** Periodic validation calls may impact performance
- **Caching Strategy:** Implement local JWT token caching with proper expiration

### 2. Scalability
- **Backend Capacity:** Ensure JWT backend can handle expected load
- **Connection Pooling:** Use connection pooling for backend service calls
- **Circuit Breaker:** Implement circuit breaker pattern for backend failures

### 3. Monitoring
- **Response Times:** Monitor JWT backend response times
- **Error Rates:** Track authentication failure rates
- **Token Refresh Patterns:** Monitor token refresh frequency and success rates

## 🧪 Testing Strategy

### 1. Unit Tests
- Test JWT token validation logic
- Test error handling for backend failures
- Test token refresh mechanisms

### 2. Integration Tests
- End-to-end OAuth flow with JWT backend
- Backend service unavailability scenarios
- Token expiration and refresh scenarios

### 3. Performance Tests
- Load testing with JWT backend integration
- Latency measurement for token operations
- Stress testing backend service integration

## 🚀 Migration Strategy

### Phase 1: Preparation
1. Set up JWT backend service
2. Configure environment variables
3. Implement JWT token handling code
4. Create comprehensive tests

### Phase 2: Parallel Testing
1. Deploy changes to staging environment
2. Test with limited user base
3. Monitor performance and error rates
4. Validate security measures

### Phase 3: Production Deployment
1. Deploy to production during low-traffic period
2. Monitor authentication metrics closely
3. Have rollback plan ready
4. Gradually increase traffic to new flow

### Phase 4: Legacy Cleanup
1. Monitor usage patterns
2. Remove legacy OAuth code after validation
3. Update documentation
4. Archive old configuration

## 📋 Success Metrics

### Technical Metrics
- **Authentication Success Rate:** >99.5%
- **JWT Backend Response Time:** <200ms 95th percentile
- **Token Refresh Success Rate:** >99%
- **System Availability:** >99.9%

### Operational Metrics
- **Error Rate:** <0.5% for authentication operations
- **User Experience:** No degradation in login experience
- **Security Incidents:** Zero security-related incidents
- **Performance Impact:** <10% increase in total authentication time

---

## 🔗 Related Documentation

- [JWT Migration Guide](./jwt-migration-guide.md) - Step-by-step implementation guide
- [JWT API Specification](./jwt-api-specification.md) - External backend API requirements
- [JWT Implementation Comparison](./jwt-implementation-comparison.md) - Detailed analysis
- [OAuth Authorization Code Implementation](./oauth-authorization-code-implementation.md) - Current implementation details

---

*This document provides the foundational architecture for implementing JWT token exchange in the Salesforce API test tool. For implementation details, refer to the migration guide and API specification documents.*