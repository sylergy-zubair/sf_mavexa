# HubSpot OAuth 2.0 Authorization Code Implementation

This document provides technical implementation details for HubSpot OAuth 2.0 Authorization Code flow integration, following the same patterns established for Salesforce integration.

## Overview

The HubSpot integration implements OAuth 2.0 Authorization Code flow with the following features:
- CSRF protection using state parameter validation
- Secure token storage and management
- Automatic token refresh mechanism
- Session-based authentication persistence
- Comprehensive error handling

## OAuth Configuration

### Environment Variables
```javascript
const HS_OAUTH_CONFIG = {
    clientId: process.env.HS_CLIENT_ID || '',
    clientSecret: process.env.HS_CLIENT_SECRET || '',
    redirectUri: process.env.HS_REDIRECT_URI || `http://localhost:${PORT}/api/hs/auth/callback`,
    scope: process.env.HS_SCOPE || 'crm.objects.contacts.read crm.objects.contacts.write oauth',
    apiBaseUrl: process.env.HS_API_BASE_URL || 'https://api.hubapi.com'
};
```

### Required Environment Variables
```bash
HS_CLIENT_ID=your_hubspot_client_id
HS_CLIENT_SECRET=your_hubspot_client_secret
HS_REDIRECT_URI=http://localhost:3000/api/hs/auth/callback
HS_SCOPE=crm.objects.contacts.read crm.objects.contacts.write oauth
HS_API_BASE_URL=https://api.hubapi.com
```

## OAuth Flow Implementation

### Step 1: Authorization Request

**Endpoint**: `GET /api/hs/auth/login`

```javascript
app.get('/api/hs/auth/login', async (req, res) => {
    try {
        // Validate OAuth configuration
        if (!HS_OAUTH_CONFIG.clientId || !HS_OAUTH_CONFIG.clientSecret) {
            return res.status(500).json({
                success: false,
                error: 'HubSpot OAuth configuration incomplete',
                troubleshooting: [
                    'Check your .env file contains:',
                    'HS_CLIENT_ID=your_client_id',
                    'HS_CLIENT_SECRET=your_client_secret'
                ]
            });
        }
        
        // Generate random state for CSRF protection
        const state = crypto.randomBytes(32).toString('hex');
        
        // Store state in session
        req.session.hubspotOauthState = state;
        
        const authUrl = 'https://app.hubspot.com/oauth/authorize?' + 
            new URLSearchParams({
                client_id: HS_OAUTH_CONFIG.clientId,
                redirect_uri: HS_OAUTH_CONFIG.redirectUri,
                scope: HS_OAUTH_CONFIG.scope,
                response_type: 'code',
                state: state
            });
        
        res.json({ 
            success: true, 
            authUrl: authUrl,
            message: 'Redirect user to this URL for authentication'
        });
        
    } catch (error) {
        console.error('HubSpot OAuth initiation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

### Step 2: Authorization Callback

**Endpoint**: `GET /api/hs/auth/callback`

```javascript
app.get('/api/hs/auth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        // Handle OAuth errors
        if (error) {
            console.error('HubSpot OAuth error:', error);
            return res.redirect('/?error=' + encodeURIComponent(error));
        }
        
        // Validate state parameter (CSRF protection)
        if (!state || state !== req.session.hubspotOauthState) {
            console.error('Invalid state parameter');
            return res.redirect('/?error=invalid_state');
        }
        
        // Clear stored state
        delete req.session.hubspotOauthState;
        
        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: HS_OAUTH_CONFIG.clientId,
                client_secret: HS_OAUTH_CONFIG.clientSecret,
                redirect_uri: HS_OAUTH_CONFIG.redirectUri,
                code: code
            })
        });
        
        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Token exchange failed:', errorData);
            return res.redirect('/?error=token_exchange_failed');
        }
        
        const tokenData = await tokenResponse.json();
        
        // Store tokens securely
        hubspotAccessToken = tokenData.access_token;
        hubspotRefreshToken = tokenData.refresh_token;
        hubspotTokenExpiry = Date.now() + (tokenData.expires_in * 1000);
        
        console.log('✅ HubSpot OAuth successful');
        
        res.redirect('/?hubspot_auth=success');
        
    } catch (error) {
        console.error('HubSpot OAuth callback error:', error);
        res.redirect('/?error=callback_error');
    }
});
```

### Step 3: Token Refresh

**Endpoint**: `POST /api/hs/auth/refresh`

```javascript
app.post('/api/hs/auth/refresh', async (req, res) => {
    try {
        if (!hubspotRefreshToken) {
            return res.status(401).json({
                error: {
                    code: 'NO_REFRESH_TOKEN',
                    message: 'No refresh token available'
                }
            });
        }
        
        const refreshResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: HS_OAUTH_CONFIG.clientId,
                client_secret: HS_OAUTH_CONFIG.clientSecret,
                refresh_token: hubspotRefreshToken
            })
        });
        
        if (!refreshResponse.ok) {
            const errorData = await refreshResponse.text();
            console.error('Token refresh failed:', errorData);
            return res.status(401).json({
                error: {
                    code: 'REFRESH_FAILED',
                    message: 'Failed to refresh access token'
                }
            });
        }
        
        const tokenData = await refreshResponse.json();
        
        // Update tokens
        hubspotAccessToken = tokenData.access_token;
        if (tokenData.refresh_token) {
            hubspotRefreshToken = tokenData.refresh_token;
        }
        hubspotTokenExpiry = Date.now() + (tokenData.expires_in * 1000);
        
        console.log('✅ HubSpot token refreshed successfully');
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            expiresIn: tokenData.expires_in
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});
```

## Token Management

### Token Storage Variables
```javascript
// HubSpot token storage (in production, use database or secure session storage)
let hubspotAccessToken = null;
let hubspotRefreshToken = null;
let hubspotTokenExpiry = null;
```

### Automatic Token Refresh Helper
```javascript
async function ensureValidHubSpotToken() {
    // Check if token is expired or will expire in next 5 minutes
    if (!hubspotAccessToken || !hubspotTokenExpiry || hubspotTokenExpiry <= Date.now() + 300000) {
        if (hubspotRefreshToken) {
            await refreshHubSpotToken();
        } else {
            throw new Error('No valid access token and no refresh token available');
        }
    }
}

async function refreshHubSpotToken() {
    const refreshResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: HS_OAUTH_CONFIG.clientId,
            client_secret: HS_OAUTH_CONFIG.clientSecret,
            refresh_token: hubspotRefreshToken
        })
    });
    
    if (!refreshResponse.ok) {
        throw new Error('Failed to refresh HubSpot access token');
    }
    
    const tokenData = await refreshResponse.json();
    
    hubspotAccessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
        hubspotRefreshToken = tokenData.refresh_token;
    }
    hubspotTokenExpiry = Date.now() + (tokenData.expires_in * 1000);
}
```

## Authenticated API Helper

### makeHubSpotAuthenticatedRequest Function
```javascript
async function makeHubSpotAuthenticatedRequest(url, options = {}) {
    await ensureValidHubSpotToken();
    
    if (!hubspotAccessToken) {
        throw new Error('Not authenticated with HubSpot');
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${hubspotAccessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    let data = null;
    
    // Parse response
    const responseText = await response.text();
    if (responseText && responseText.trim().length > 0) {
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.log('⚠️ HubSpot response is not JSON:', responseText);
            data = { rawResponse: responseText };
        }
    }
    
    // Handle 401 errors (token expired)
    if (response.status === 401) {
        console.log('🔄 HubSpot token expired, attempting refresh...');
        try {
            await refreshHubSpotToken();
            // Retry the original request
            return await makeHubSpotAuthenticatedRequest(url, options);
        } catch (refreshError) {
            throw new Error('Authentication failed: Unable to refresh token');
        }
    }
    
    if (!response.ok) {
        const errorMessage = data?.message || data?.rawResponse || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    
    return { response, data };
}
```

## Authentication Status Endpoint

**Endpoint**: `GET /api/hs/auth/status`

```javascript
app.get('/api/hs/auth/status', async (req, res) => {
    try {
        if (!hubspotAccessToken) {
            return res.json({
                authenticated: false,
                message: 'Not authenticated with HubSpot'
            });
        }
        
        // Test token validity by making a simple API call
        const { data } = await makeHubSpotAuthenticatedRequest(
            'https://api.hubapi.com/oauth/v1/access-tokens/' + hubspotAccessToken
        );
        
        res.json({
            authenticated: true,
            message: 'Authenticated with HubSpot',
            tokenInfo: {
                scopes: data.scopes,
                hubId: data.hub_id,
                appId: data.app_id,
                expiresAt: new Date(hubspotTokenExpiry).toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ HubSpot status check failed:', error);
        res.json({
            authenticated: false,
            message: 'Authentication invalid',
            error: error.message
        });
    }
});
```

## Logout Endpoint

**Endpoint**: `POST /api/hs/auth/logout`

```javascript
app.post('/api/hs/auth/logout', (req, res) => {
    hubspotAccessToken = null;
    hubspotRefreshToken = null;
    hubspotTokenExpiry = null;
    
    console.log('🔓 HubSpot user logged out - tokens cleared');
    
    res.json({
        success: true,
        message: 'Logged out from HubSpot successfully'
    });
});
```

## Security Considerations

### State Parameter Validation
- Always generate cryptographically secure random state values
- Store state in secure session storage
- Validate state parameter in callback to prevent CSRF attacks

### Token Security
- Store tokens securely (in production, use encrypted database storage)
- Never expose tokens in client-side code or logs
- Implement token rotation and expiry handling

### Error Handling
- Don't expose sensitive information in error messages
- Log security events for monitoring
- Implement rate limiting for authentication endpoints

## Testing OAuth Flow

### Manual Testing
1. Start the server: `npm start`
2. Navigate to `http://localhost:3000`
3. Click "Login with HubSpot" in the HubSpot section
4. Complete OAuth flow on HubSpot's authorization page
5. Verify successful redirect and token storage

### Automated Testing
See [`hubspot-api-testing-guide.md`](./hubspot-api-testing-guide.md) for comprehensive testing strategies.

## Common Issues and Solutions

### Issue: "invalid_client" Error
**Solution**: Verify client ID and secret in environment variables

### Issue: "redirect_uri_mismatch" Error
**Solution**: Ensure redirect URI in app settings matches exactly

### Issue: "insufficient_scope" Error
**Solution**: Add required scopes in HubSpot app configuration

### Issue: Token Refresh Failures
**Solution**: Check refresh token validity and client credentials

## Next Steps

1. Review [`hubspot-api-specification.md`](./hubspot-api-specification.md) for API endpoints
2. Check [`hubspot-contact-crud-specification.md`](./hubspot-contact-crud-specification.md) for contact operations
3. Follow [`hubspot-integration-plan.md`](./hubspot-integration-plan.md) for implementation roadmap