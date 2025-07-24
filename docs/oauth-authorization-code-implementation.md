# OAuth Authorization Code Flow Implementation Guide

## Overview

This document provides a comprehensive guide for implementing Salesforce OAuth Authorization Code flow as an alternative to the current Username/Password flow in the Salesforce API test tool.

### Current vs Proposed Authentication

| Aspect | Current (Password Flow) | Proposed (Authorization Code Flow) |
|--------|------------------------|-----------------------------------|
| **User Experience** | Enter credentials in app | Redirect to Salesforce login |
| **Security** | Credentials pass through server | Credentials stay on Salesforce |
| **Grant Type** | `password` | `authorization_code` |
| **Required Data** | username, password, client_id, client_secret | code, client_id, client_secret, redirect_uri |
| **Redirect URI** | Not needed | Required |
| **User Interaction** | One-time setup | Login on each session |
| **Token Type** | Access token only | Access + Refresh tokens |

### Benefits of Authorization Code Flow

1. **Enhanced Security**: User credentials never pass through your application
2. **Better User Experience**: Standard OAuth flow familiar to users
3. **Refresh Tokens**: Automatic token renewal without re-authentication
4. **Audit Trail**: Better tracking of authentication events in Salesforce
5. **Production Ready**: More suitable for production applications

---

## Implementation Guide

### Phase 1: Server-Side Implementation

#### 1.1 Add OAuth Initiation Endpoint

Add this endpoint to `salesforce-proxy.js`:

```javascript
// OAuth configuration (add at top of file)
const OAUTH_CONFIG = {
    clientId: process.env.SF_CLIENT_ID || '', // Set via environment variable
    clientSecret: process.env.SF_CLIENT_SECRET || '',
    redirectUri: process.env.SF_REDIRECT_URI || 'http://localhost:3000/api/sf/auth/callback',
    instanceUrl: process.env.SF_INSTANCE_URL || 'https://login.salesforce.com'
};

// Initiate OAuth flow
app.get('/api/sf/auth/login', (req, res) => {
    // Generate random state for CSRF protection
    const state = require('crypto').randomBytes(32).toString('hex');
    
    // Store state in session (you'll need session middleware)
    req.session.oauthState = state;
    
    const authUrl = `${OAUTH_CONFIG.instanceUrl}/services/oauth2/authorize?` + 
        new URLSearchParams({
            response_type: 'code',
            client_id: OAUTH_CONFIG.clientId,
            redirect_uri: OAUTH_CONFIG.redirectUri,
            scope: 'api refresh_token id',
            state: state
        });
    
    res.json({ 
        success: true, 
        authUrl: authUrl,
        message: 'Redirect user to this URL for authentication'
    });
});
```

#### 1.2 Add OAuth Callback Endpoint

```javascript
// Handle OAuth callback
app.get('/api/sf/auth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        // Handle authorization denied
        if (error) {
            return res.redirect(`/?error=${encodeURIComponent(error)}`);
        }
        
        // Verify state parameter (CSRF protection)
        if (!state || state !== req.session.oauthState) {
            return res.redirect('/?error=invalid_state');
        }
        
        // Clear used state
        delete req.session.oauthState;
        
        // Exchange authorization code for access token
        const tokenResponse = await fetch(`${OAUTH_CONFIG.instanceUrl}/services/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: OAUTH_CONFIG.clientId,
                client_secret: OAUTH_CONFIG.clientSecret,
                redirect_uri: OAUTH_CONFIG.redirectUri,
                code: code
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenResponse.ok) {
            // Store tokens (consider using secure session storage)
            accessToken = tokenData.access_token;
            refreshToken = tokenData.refresh_token;
            instanceUrl = tokenData.instance_url;
            
            console.log('✅ OAuth authentication successful!');
            res.redirect('/?auth=success');
        } else {
            console.log('❌ Token exchange failed:', tokenData);
            res.redirect(`/?error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`);
        }
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
});
```

#### 1.3 Add Token Refresh Endpoint

```javascript
// Refresh access token using refresh token
app.post('/api/sf/auth/refresh', async (req, res) => {
    try {
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: 'No refresh token available'
            });
        }
        
        const refreshResponse = await fetch(`${instanceUrl}/services/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: OAUTH_CONFIG.clientId,
                client_secret: OAUTH_CONFIG.clientSecret,
                refresh_token: refreshToken
            })
        });
        
        const tokenData = await refreshResponse.json();
        
        if (refreshResponse.ok) {
            accessToken = tokenData.access_token;
            // Note: Salesforce may or may not return a new refresh token
            if (tokenData.refresh_token) {
                refreshToken = tokenData.refresh_token;
            }
            
            res.json({
                success: true,
                message: 'Token refreshed successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: tokenData.error_description || 'Token refresh failed'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

#### 1.4 Add Session Middleware

You'll need to add session support. Install express-session:

```bash
npm install express-session
```

Then add to your server:

```javascript
const session = require('express-session');

// Add session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
}));
```

### Phase 2: Client-Side Implementation

#### 2.1 Update HTML Interface

Replace the credential form in `salesforce-test-proxy.html`:

```html
<!-- Replace existing connection form with OAuth flow -->
<div class="card">
    <h3>OAuth Authentication</h3>
    
    <div class="proxy-info">
        <strong>🔐 OAuth Authorization Code Flow</strong><br>
        Secure authentication via Salesforce login page.
    </div>
    
    <div id="connectionStatus" class="status disconnected">
        Status: Disconnected
    </div>

    <!-- OAuth Login Button -->
    <button id="oauthLoginBtn" type="button">
        <span id="oauthSpinner" class="loading hidden"></span>
        Login with Salesforce
    </button>
    
    <!-- Manual Token Refresh -->
    <button id="refreshTokenBtn" type="button" disabled>
        <span id="refreshSpinner" class="loading hidden"></span>
        Refresh Token
    </button>
    
    <!-- Logout -->
    <button id="logoutBtn" type="button" disabled>
        Logout
    </button>
</div>
```

#### 2.2 Update JavaScript Authentication Logic

```javascript
// OAuth Login
document.getElementById('oauthLoginBtn').addEventListener('click', async () => {
    const oauthLoginBtn = document.getElementById('oauthLoginBtn');
    const oauthSpinner = document.getElementById('oauthSpinner');
    
    showLoading(oauthSpinner, oauthLoginBtn);
    
    try {
        const response = await fetch('/api/sf/auth/login');
        const data = await response.json();
        
        if (data.success) {
            // Redirect to Salesforce for authentication
            window.location.href = data.authUrl;
        } else {
            throw new Error(data.error || 'Failed to initiate OAuth flow');
        }
    } catch (error) {
        displayResult({ error: error.message }, false);
        hideLoading(oauthSpinner, oauthLoginBtn);
    }
});

// Handle OAuth callback result
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    const error = urlParams.get('error');
    
    if (authResult === 'success') {
        updateConnectionStatus(true);
        displayResult({ message: 'OAuth authentication successful!' });
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
        displayResult({ error: decodeURIComponent(error) }, false);
        updateConnectionStatus(false);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// Token Refresh
document.getElementById('refreshTokenBtn').addEventListener('click', async () => {
    const refreshTokenBtn = document.getElementById('refreshTokenBtn');
    const refreshSpinner = document.getElementById('refreshSpinner');
    
    showLoading(refreshSpinner, refreshTokenBtn);
    
    try {
        const response = await fetch('/api/sf/auth/refresh', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            displayResult(data);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        displayResult({ error: error.message }, false);
    } finally {
        hideLoading(refreshSpinner, refreshTokenBtn);
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    updateConnectionStatus(false);
    displayResult({ message: 'Logged out successfully' });
});
```

### Phase 3: Connected App Configuration

#### 3.1 Salesforce Connected App Settings

1. **Navigate to Setup** → App Manager → Your Connected App → Edit
2. **OAuth Settings**:
   - ✅ Enable OAuth Settings
   - **Callback URL**: `http://localhost:3000/api/sf/auth/callback`
   - **Selected OAuth Scopes**:
     - Access and manage your data (api)
     - Perform requests on your behalf at any time (refresh_token, offline_access)
     - Access your basic information (id)
   - ✅ Require Secret for Web Server Flow
   - ⚠️ **Disable** "Require Secret for Refresh Token Flow" (optional, for better UX)

3. **Additional Settings**:
   - **Permitted Users**: Admin approved users are pre-authorized (recommended for testing)
   - **IP Relaxation**: Relax IP restrictions (for development)

#### 3.2 Environment Variables

Create a `.env` file (don't commit to git):

```bash
SF_CLIENT_ID=your_consumer_key_here
SF_CLIENT_SECRET=your_consumer_secret_here
SF_REDIRECT_URI=http://localhost:3000/api/sf/auth/callback
SF_INSTANCE_URL=https://login.salesforce.com
SESSION_SECRET=your_random_session_secret_here
```

Update your `package.json` to load environment variables:

```json
{
  "scripts": {
    "start": "node -r dotenv/config salesforce-proxy.js"
  },
  "dependencies": {
    "dotenv": "^16.0.0"
  }
}
```

---

## Security Considerations

### 1. CSRF Protection

- Always use the `state` parameter to prevent CSRF attacks
- Generate a cryptographically secure random state value
- Verify the state parameter matches in the callback

### 2. Secure Token Storage

```javascript
// Production considerations for token storage
const tokenStorage = {
    // Option 1: Encrypted session storage
    storeTokens: (userId, tokens) => {
        req.session.tokens = encrypt(JSON.stringify(tokens));
    },
    
    // Option 2: Database storage (recommended for production)
    storeTokens: async (userId, tokens) => {
        await db.tokens.upsert({
            userId: userId,
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token),
            expiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
        });
    }
};
```

### 3. HTTPS Requirements

For production deployment:

```javascript
// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// Update session cookie settings for production
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
```

---

## Error Handling and Troubleshooting

### Common Issues

#### 1. "redirect_uri_mismatch"
**Cause**: Callback URL in Connected App doesn't match the one in your code
**Solution**: Ensure exact match including protocol, domain, and path

#### 2. "invalid_client_id"
**Cause**: Incorrect Consumer Key
**Solution**: Copy Consumer Key exactly from Connected App

#### 3. "invalid_grant" (during token exchange)
**Cause**: Authorization code expired or already used
**Solution**: Authorization codes expire quickly (~10 minutes), ensure immediate exchange

#### 4. State parameter mismatch
**Cause**: Session issues or CSRF attack
**Solution**: Check session middleware configuration

### Debug Logging

Add comprehensive logging for troubleshooting:

```javascript
// Add debug logging
const DEBUG = process.env.NODE_ENV !== 'production';

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}

// Use in endpoints
debugLog('OAuth initiation', { state, authUrl });
debugLog('OAuth callback received', { code: code?.substring(0, 10) + '...', state });
debugLog('Token exchange response', { status: tokenResponse.status });
```

### Testing Checklist

- [ ] OAuth initiation redirects to Salesforce login
- [ ] Successful login redirects back to callback URL
- [ ] Authorization code exchanges for access token
- [ ] State parameter validation works
- [ ] Access token works for API calls
- [ ] Refresh token functionality works
- [ ] Error scenarios handled gracefully
- [ ] HTTPS works in production environment
- [ ] Session security configured properly

---

## Migration Strategy

### Step 1: Parallel Implementation
- Keep existing password flow functional
- Add OAuth endpoints alongside
- Test OAuth flow thoroughly

### Step 2: Feature Flag
```javascript
const USE_OAUTH = process.env.USE_OAUTH === 'true';

app.get('/', (req, res) => {
    const htmlFile = USE_OAUTH ? 'salesforce-oauth.html' : 'salesforce-test-proxy.html';
    res.sendFile(path.join(__dirname, htmlFile));
});
```

### Step 3: Gradual Migration
- Test with development environment
- Deploy to staging with OAuth enabled
- Monitor for issues
- Switch production after validation

### Step 4: Cleanup
- Remove password flow code
- Update documentation
- Remove unused dependencies

---

## Next Steps

1. **Implement basic OAuth flow** following Phase 1-2
2. **Test with development Connected App**
3. **Add refresh token handling**
4. **Implement proper session management**
5. **Add comprehensive error handling**
6. **Prepare for production deployment**

This implementation provides a solid foundation for OAuth Authorization Code flow while maintaining security best practices and production readiness.