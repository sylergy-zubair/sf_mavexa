# OAuth 2.0 Authorization Code Flow - Visual Guide

## 🎯 Overview

This document provides a comprehensive visual guide to the OAuth 2.0 Authorization Code flow implementation in the Salesforce API test tool, including detailed diagrams, request/response examples, and UI state demonstrations.

---

## 🔄 Complete OAuth Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  User Browser   │    │ Express Server  │    │   Salesforce    │
│                 │    │  (Port 3000)    │    │  OAuth Server   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ ①  Click "Login"      │                       │
         │    Button             │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │                       │ ②  Generate Security  │
         │                       │     Parameters:       │
         │                       │     • State (CSRF)    │
         │                       │     • PKCE Challenge  │
         │                       │     • Store in Session│
         │                       │                       │
         │ ③  OAuth URL Response │                       │
         │    JSON with authUrl  │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │ ④  Browser Redirect to Salesforce OAuth      │
         │    https://login.salesforce.com/...          │
         ├───────────────────────────────────────────────►│
         │                       │                       │
         │ ⑤  Salesforce Login Page (HTML)              │
         │◄───────────────────────────────────────────────┤
         │                       │                       │
         │ ⑥  User Enters Credentials                    │
         │    Username + Password                        │
         ├───────────────────────────────────────────────►│
         │                       │                       │
         │ ⑦  Authorization Grant                        │
         │    User Approves App                          │
         ├───────────────────────────────────────────────►│
         │                       │                       │
         │ ⑧  Callback with Authorization Code           │
         │    GET /api/sf/auth/callback?code=...&state=..│
         │◄───────────────────────────────────────────────┤
         │                       │                       │
         │ ⑨  Process Callback   │                       │
         │    Forward to Server  │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │                       │ ⑩  Validate Security │
         │                       │     • Check State     │
         │                       │     • Verify Session  │
         │                       │                       │
         │                       │ ⑪  Exchange Auth Code│
         │                       │     for Access Token │
         │                       ├──────────────────────►│
         │                       │                       │
         │                       │ ⑫  Token Response    │
         │                       │     • Access Token   │
         │                       │     • Refresh Token  │
         │                       │     • Instance URL   │
         │                       │◄──────────────────────┤
         │                       │                       │
         │                       │ ⑬  Store Tokens      │
         │                       │     in Memory         │
         │                       │                       │
         │ ⑭  Success Redirect   │                       │
         │    /?auth=success     │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │ ⑮  Update UI State    │                       │
         │    Show "Connected"   │                       │
         │                       │                       │
```

---

## 📋 Detailed Step-by-Step Breakdown

### **Step ① - User Initiates OAuth Flow**

**User Action:** Clicks "🚀 Login with Salesforce" button

**UI State Before:**
```
Status: ❌ Disconnected
Button: [🚀 Login with Salesforce] (enabled)
Refresh: [🔄 Refresh Token] (disabled)
Logout: [🔓 Logout] (disabled)
```

**JavaScript Event:**
```javascript
oauthLoginBtn.addEventListener('click', async () => {
    showLoading(oauthSpinner, oauthLoginBtn);
    
    const response = await fetch('/api/sf/auth/login');
    const data = await response.json();
    
    if (data.success) {
        window.location.href = data.authUrl;
    }
});
```

**UI State During Loading:**
```
Status: ❌ Disconnected  
Button: [⟳ Login with Salesforce] (disabled, spinning)
```

---

### **Step ② - Server Generates Security Parameters**

**HTTP Request:**
```http
GET /api/sf/auth/login HTTP/1.1
Host: localhost:3000
Accept: application/json
Cookie: connect.sid=s%3A...
```

**Server Processing:**
```javascript
app.get('/api/sf/auth/login', (req, res) => {
    // Generate CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    // Example: "a1b2c3d4e5f6789012345678901234567890abcdef..."
    
    // Generate PKCE parameters
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    // Example: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    
    const codeChallenge = crypto.createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    // Example: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    
    // Store in session
    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;
    
    // Build OAuth URL...
});
```

**Session Storage:**
```json
{
  "oauthState": "a1b2c3d4e5f6789012345678901234567890abcdef...",
  "codeVerifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

---

### **Step ③ - Server Returns OAuth URL**

**HTTP Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=YOUR_CONSUMER_KEY_HERE&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fsf%2Fauth%2Fcallback&scope=api+refresh_token+id&state=a1b2c3d4e5f6789012345678901234567890abcdef&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256",
  "message": "Redirect user to this URL for authentication"
}
```

**Decoded OAuth URL Parameters:**
```
Base URL: https://login.salesforce.com/services/oauth2/authorize
Parameters:
├── response_type: code
├── client_id: YOUR_CONSUMER_KEY_HERE
├── redirect_uri: http://localhost:3000/api/sf/auth/callback
├── scope: api refresh_token id
├── state: a1b2c3d4e5f6789012345678901234567890abcdef
├── code_challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
└── code_challenge_method: S256
```

---

### **Step ④ - Browser Redirects to Salesforce**

**JavaScript Execution:**
```javascript
// Browser receives JSON response
if (data.success) {
    displayResult({
        message: 'Redirecting to Salesforce for authentication...',
        authUrl: data.authUrl
    });
    
    // Redirect to Salesforce
    window.location.href = data.authUrl;
}
```

**UI State During Redirect:**
```
Results Display:
┌─────────────────────────────────────────────┐
│ [16:45:23] ✅ SUCCESS:                      │
│ {                                           │
│   "message": "Redirecting to Salesforce    │
│               for authentication...",       │
│   "authUrl": "https://login.salesforce..." │
│ }                                           │
└─────────────────────────────────────────────┘

Status: ❌ Disconnected (transitioning...)
```

---

### **Step ⑤ - Salesforce Login Page**

**User sees Salesforce Login Interface:**

```
┌─────────────────────────────────────────────────────────┐
│  🏢 Salesforce                                          │
│                                                         │
│  Sign In                                                │
│                                                         │
│  Username: [________________________]                  │
│                                                         │
│  Password: [________________________]                  │
│                                                         │
│  [  Log In to Sandbox  ]                               │
│                                                         │
│  ────────────────────────────────────────               │
│                                                         │
│  App wants to access:                                   │
│  ✓ Access and manage your data (api)                   │
│  ✓ Perform requests at any time (refresh_token)        │
│  ✓ Access your basic information (id)                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**URL in Browser:**
```
https://login.salesforce.com/services/oauth2/authorize?
response_type=code&
client_id=YOUR_CONSUMER_KEY_HERE&
redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fsf%2Fauth%2Fcallback&
scope=api+refresh_token+id&
state=a1b2c3d4e5f6789012345678901234567890abcdef&
code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
code_challenge_method=S256
```

---

### **Step ⑥ - User Enters Credentials**

**User Action:** Enters Salesforce username and password

**Form Data Submitted to Salesforce:**
```http
POST https://login.salesforce.com/services/oauth2/authorize HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=user%40example.com&
password=userpassword123&
// ... other Salesforce form parameters
```

**Salesforce Internal Processing:**
- Validates username/password
- Checks user permissions
- Verifies Connected App settings
- Generates authorization code

---

### **Step ⑦ - Authorization Grant**

**If credentials are valid, Salesforce may show:**

```
┌─────────────────────────────────────────────────────────┐
│  🏢 Salesforce - Allow Access                          │
│                                                         │
│  "Salesforce API Test Tool" wants to:                  │
│                                                         │
│  ✓ Access and manage your data (api)                   │
│  ✓ Perform requests on your behalf at any time         │
│    (refresh_token, offline_access)                     │
│  ✓ Access your basic information (id)                  │
│                                                         │
│  [  Allow  ]  [  Deny  ]                               │
│                                                         │
│  By allowing access, you agree to the Terms of Service │
└─────────────────────────────────────────────────────────┘
```

**User Action:** Clicks "Allow" button

---

### **Step ⑧ - Callback with Authorization Code**

**Salesforce redirects browser to:**
```
http://localhost:3000/api/sf/auth/callback?
code=aPrxdWyH_VFBmXGBCa5xUZyGEcJBNzGFwl-TdwGnKb8&
state=a1b2c3d4e5f6789012345678901234567890abcdef
```

**URL Components:**
```
Base: http://localhost:3000/api/sf/auth/callback
Parameters:
├── code: aPrxdWyH_VFBmXGBCa5xUZyGEcJBNzGFwl-TdwGnKb8 (Authorization Code)
└── state: a1b2c3d4e5f6789012345678901234567890abcdef (CSRF Token)
```

---

### **Step ⑨ - Process Callback**

**HTTP Request to Server:**
```http
GET /api/sf/auth/callback?code=aPrxdWyH_VFBmXGBCa5xUZyGEcJBNzGFwl-TdwGnKb8&state=a1b2c3d4e5f6789012345678901234567890abcdef HTTP/1.1
Host: localhost:3000
Cookie: connect.sid=s%3A...
```

**Server Processing Begins:**
```javascript
app.get('/api/sf/auth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    
    console.log('\n=== OAuth Callback Received ===');
    console.log('Code:', code?.substring(0, 10) + '...');
    console.log('State:', state);
    console.log('Error:', error);
    
    // Continue processing...
});
```

**Server Console Output:**
```
=== OAuth Callback Received ===
Code: aPrxdWyH_V...
State: a1b2c3d4e5f6789012345678901234567890abcdef
Error: undefined
```

---

### **Step ⑩ - Validate Security Parameters**

**State Parameter Validation:**
```javascript
// Check for authorization errors
if (error) {
    console.log('❌ OAuth authorization denied:', error);
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
}

// Verify state parameter (CSRF protection)
if (!state || state !== req.session.oauthState) {
    console.log('❌ Invalid state parameter - potential CSRF attack');
    return res.redirect('/?error=invalid_state');
}

console.log('✅ State parameter verified');
```

**Session Retrieval:**
```javascript
// Get stored PKCE code verifier
const codeVerifier = req.session.codeVerifier;
// Example: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

// Clear used security parameters
delete req.session.oauthState;
delete req.session.codeVerifier;
```

**Server Console Output:**
```
✅ State parameter verified
🔄 Exchanging authorization code for access token...
```

---

### **Step ⑪ - Exchange Authorization Code for Access Token**

**HTTP Request to Salesforce:**
```http
POST https://login.salesforce.com/services/oauth2/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
client_id=YOUR_CONSUMER_KEY_HERE&
client_secret=YOUR_CONSUMER_SECRET_HERE&
redirect_uri=http://localhost:3000/api/sf/auth/callback&
code=aPrxdWyH_VFBmXGBCa5xUZyGEcJBNzGFwl-TdwGnKb8&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**Request Parameters Breakdown:**
```
Token Exchange Request Parameters:
├── grant_type: authorization_code (OAuth 2.0 flow type)
├── client_id: [Connected App Consumer Key]
├── client_secret: [Connected App Consumer Secret]  
├── redirect_uri: http://localhost:3000/api/sf/auth/callback
├── code: aPrxdWyH_VFBmXGBCa5xUZyGEcJBNzGFwl-TdwGnKb8
└── code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk (PKCE)
```

---

### **Step ⑫ - Token Response from Salesforce**

**HTTP Response from Salesforce:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "00D5g00000123456!ARYAQHckD3EM6zKBcyJAuoWo_SomsIKwKg2qT2Y6Z8qP.WwlXCfJJQf5VmdKg5gA8Crf6fXLOsD1GJ5JzHKyFnKmQKzD4_",
  "refresh_token": "5Aep861KA_Yct3L8ZUt1wJvBN_6CdcyUJP4WL0J1Ak.KlcKG.d_Q2Qh1Xf_p3LQhzLcE9LL6Y5C9vVtlGQqJ",
  "instance_url": "https://na139.salesforce.com",
  "id": "https://login.salesforce.com/id/00D5g00000123456EAA/0055g00000123456AAQ",
  "token_type": "Bearer",
  "issued_at": "1642781234567",
  "signature": "a8b7c9d2e4f5g6h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

**Token Response Breakdown:**
```
Salesforce Token Response:
├── access_token: 00D5g00000123456!ARYAQHckD3EM... (Bearer token for API calls)
├── refresh_token: 5Aep861KA_Yct3L8ZUt1wJvBN_6... (Token for renewal)
├── instance_url: https://na139.salesforce.com (Org-specific API endpoint)
├── id: https://login.salesforce.com/id/... (User identity URL)
├── token_type: Bearer (Authorization header format)
├── issued_at: 1642781234567 (Unix timestamp)
└── signature: a8b7c9d2e4f5g6h8i9j0k1l2m3n4o5p6... (Security signature)
```

---

### **Step ⑬ - Store Tokens in Server**

**Server Token Storage:**
```javascript
if (tokenResponse.ok) {
    // Store tokens in server memory
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    instanceUrl = tokenData.instance_url;
    
    console.log('✅ OAuth authentication successful!');
    console.log('📍 Instance URL:', instanceUrl);
    console.log('🎯 Access Token (first 20 chars):', 
                accessToken.substring(0, 20) + '...');
    console.log('🔄 Refresh Token available:', !!refreshToken);
    
    res.redirect('/?auth=success');
}
```

**Server Console Output:**
```
✅ OAuth authentication successful!
📍 Instance URL: https://na139.salesforce.com
🎯 Access Token (first 20 chars): 00D5g00000123456!ARY...
🔄 Refresh Token available: true
```

**Server Memory State:**
```javascript
// Global variables updated:
accessToken = "00D5g00000123456!ARYAQHckD3EM6zKBcyJAuoWo_SomsIKwKg2qT2Y6Z8qP.WwlXCfJJQf5VmdKg5gA8Crf6fXLOsD1GJ5JzHKyFnKmQKzD4_";
refreshToken = "5Aep861KA_Yct3L8ZUt1wJvBN_6CdcyUJP4WL0J1Ak.KlcKG.d_Q2Qh1Xf_p3LQhzLcE9LL6Y5C9vVtlGQqJ";
instanceUrl = "https://na139.salesforce.com";
```

---

### **Step ⑭ - Success Redirect**

**HTTP Response from Server:**
```http
HTTP/1.1 302 Found
Location: /?auth=success
Set-Cookie: connect.sid=s%3A...; Path=/; HttpOnly
```

**Browser navigates to:**
```
http://localhost:3000/?auth=success
```

---

### **Step ⑮ - Update UI State**

**JavaScript Detection:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    const error = urlParams.get('error');
    
    if (authResult === 'success') {
        updateConnectionStatus(true);
        displayResult({ 
            message: '🎉 OAuth authentication successful!',
            flow: 'Authorization Code',
            timestamp: new Date().toISOString()
        });
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
```

**Final UI State:**
```
Status: ✅ Connected (OAuth)
Button: [🚀 Login with Salesforce] (enabled)
Refresh: [🔄 Refresh Token] (enabled)
Status: [📊 Check Status] (enabled)
Logout: [🔓 Logout] (enabled)

Results Display:
┌─────────────────────────────────────────────┐
│ [16:45:45] ✅ SUCCESS:                      │
│ {                                           │
│   "message": "🎉 OAuth authentication      │
│               successful!",                 │
│   "flow": "Authorization Code",             │
│   "timestamp": "2025-07-24T11:45:45.123Z"  │
│ }                                           │
└─────────────────────────────────────────────┘
```

---

## 🔒 Security Features Visualization

### **CSRF Protection (State Parameter)**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 1. Generate     │    │ 2. Store in     │    │ 3. Include in   │
│    Random State │───▶│    Session      │───▶│    OAuth URL    │
│    a1b2c3d4...  │    │    Server-side  │    │    URL param    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                                              │
         │                                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 6. Validated    │    │ 5. Compare with │    │ 4. Returned by  │
│    ✅ or ❌     │◄───│    Session      │◄───│    Salesforce   │
│                 │    │    Value        │    │    in callback  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **PKCE Protection (Code Challenge)**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 1. Generate     │    │ 2. Create SHA256│    │ 3. Send Challenge│
│    Code Verifier│───▶│    Hash         │───▶│    to Salesforce│
│    Random 32    │    │    (Challenge)  │    │    OAuth URL    │
│    bytes        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │                                              ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │ 6. Salesforce   │    │ 4. Salesforce   │
         │              │    Validates    │    │    Associates   │
         │              │    Verifier     │    │    Challenge    │
         │              │    matches      │    │    with Code    │
         │              │    Challenge    │    │                 │
         │              └─────────────────┘    └─────────────────┘
         │                       ▲                       │
         │                       │                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │ 5. Send Verifier│    │ 4b. Return      │
         └──────────────▶│    with Token   │◄───│     Auth Code   │
                        │    Exchange     │    │                 │
                        └─────────────────┘    └─────────────────┘
```

---

## 🔄 Token Refresh Flow

### **Automatic Token Refresh Process**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  User Browser   │    │ Express Server  │    │   Salesforce    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ ① Click "Refresh"     │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │                       │ ② POST Token Refresh │
         │                       ├──────────────────────►│
         │                       │   grant_type=         │
         │                       │   refresh_token       │
         │                       │   refresh_token=...   │
         │                       │                       │
         │      ③ New Tokens     │ ③ New Access Token   │
         │◄──────────────────────┤◄──────────────────────┤
         │      JSON Response    │   (+ maybe new        │
         │                       │    refresh token)     │
         │                       │                       │
```

**Refresh Token Request:**
```http
POST https://na139.salesforce.com/services/oauth2/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
client_id=YOUR_CONSUMER_KEY_HERE&
client_secret=YOUR_CONSUMER_SECRET_HERE&
refresh_token=5Aep861KA_Yct3L8ZUt1wJvBN_6CdcyUJP4WL0J1Ak.KlcKG.d_Q2Qh1Xf_p3LQhzLcE9LL6Y5C9vVtlGQqJ
```

**Refresh Token Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "00D5g00000789012!ARYAQNew_Access_Token_Here...",
  "instance_url": "https://na139.salesforce.com",
  "id": "https://login.salesforce.com/id/00D5g00000123456EAA/0055g00000123456AAQ",
  "token_type": "Bearer",
  "issued_at": "1642781456789",
  "signature": "new_signature_here..."
}
```

---

## 🚨 Error Scenarios & Handling

### **Common Error Flows**

#### **Error 1: User Denies Authorization**

```
Salesforce Callback:
http://localhost:3000/api/sf/auth/callback?error=access_denied&error_description=end-user+denied+authorization

Server Processing:
if (error) {
    console.log('❌ OAuth authorization denied:', error);
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
}

Final URL: http://localhost:3000/?error=access_denied

UI State:
┌─────────────────────────────────────────────┐
│ [16:45:23] ❌ ERROR:                        │
│ {                                           │
│   "error": "access_denied",                 │
│   "troubleshooting": "Check your Connected │
│                      App configuration..." │
│ }                                           │
└─────────────────────────────────────────────┘
Status: ❌ Disconnected
```

#### **Error 2: Invalid State (CSRF Attack)**

```
Potential Attack:
http://localhost:3000/api/sf/auth/callback?code=malicious_code&state=wrong_state

Server Validation:
if (!state || state !== req.session.oauthState) {
    console.log('❌ Invalid state parameter - potential CSRF attack');
    return res.redirect('/?error=invalid_state');
}

Final URL: http://localhost:3000/?error=invalid_state

UI State:
┌─────────────────────────────────────────────┐
│ [16:45:23] ❌ ERROR:                        │
│ {                                           │
│   "error": "invalid_state",                 │
│   "troubleshooting": "Security error.      │
│                      Please try again."    │
│ }                                           │
└─────────────────────────────────────────────┘
```

#### **Error 3: Token Exchange Failure**

```
Token Request Fails:
HTTP/1.1 400 Bad Request
{
  "error": "invalid_grant",
  "error_description": "authentication failure"
}

Server Processing:
console.log('❌ Token exchange failed:', tokenData);
res.redirect(`/?error=${encodeURIComponent(tokenData.error_description)}`);

UI Display:
┌─────────────────────────────────────────────┐
│ [16:45:23] ❌ ERROR:                        │
│ {                                           │
│   "error": "authentication failure",       │
│   "troubleshooting": "Check Connected App  │
│                      configuration..."     │
│ }                                           │
└─────────────────────────────────────────────┘
```

---

## 📊 Token Lifecycle

### **Token States and Transitions**

```
┌─────────────────┐
│                 │
│  No Tokens      │
│  (Initial)      │
│                 │
└─────────────────┘
         │
         │ OAuth Flow
         ▼
┌─────────────────┐
│                 │      Token Refresh
│  Valid Tokens   │◄─────────────────┐
│  (Active)       │                  │
│                 │                  │
└─────────────────┘                  │
         │                           │
         │ Expire/Invalid             │
         ▼                           │
┌─────────────────┐                  │
│                 │                  │
│  Expired Tokens │──────────────────┘
│  (Refresh Req.) │   Refresh Success
│                 │
└─────────────────┘
         │
         │ Refresh Fails
         ▼
┌─────────────────┐
│                 │
│  No Tokens      │
│  (Re-auth Req.) │
│                 │
└─────────────────┘
```

### **Token Storage Visualization**

```
Server Memory State:
┌─────────────────────────────────────────────┐
│ Global Variables:                           │
│                                             │
│ accessToken = "00D5g00000123456!ARY..."     │
│ │                                           │
│ │ Purpose: API Authentication               │
│ │ Lifetime: ~2 hours (Salesforce default)  │
│ │ Format: Bearer token                      │
│ │ Usage: Authorization: Bearer {token}      │
│                                             │
│ refreshToken = "5Aep861KA_Yct3L8..."        │
│ │                                           │
│ │ Purpose: Token Renewal                    │
│ │ Lifetime: Until revoked                   │
│ │ Format: Opaque string                     │
│ │ Usage: grant_type=refresh_token           │
│                                             │
│ instanceUrl = "https://na139.salesforce..."  │
│ │                                           │
│ │ Purpose: API Endpoint                     │
│ │ Format: HTTPS URL                         │
│ │ Usage: Base URL for API calls             │
└─────────────────────────────────────────────┘
```

---

## 🔍 Debug Information

### **Server Console Output (Complete Flow)**

```bash
$ npm start

> salesforce-api-test@2.0.0 start
> node salesforce-proxy.js

[dotenv@17.2.0] injecting env (7) from .env
Salesforce Proxy Server running at http://localhost:3000
Open your browser to: http://localhost:3000

# User clicks "Login with Salesforce"
=== OAuth Authorization Flow Initiated ===
Auth URL generated: https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=YOUR_CONSUMER_KEY_HERE&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fsf%2Fauth%2Fcallback&scope=api+refresh_token+id&state=a1b2c3d4e5f6789012345678901234567890abcdef&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256
State parameter: a1b2c3d4e5f6789012345678901234567890abcdef

# User completes Salesforce authentication
=== OAuth Callback Received ===
[DEBUG] OAuth callback received {
  "code": "aPrxdWyH_V...",
  "state": "a1b2c3d4e5f6789012345678901234567890abcdef",
  "error": null
}
✅ State parameter verified
🔄 Exchanging authorization code for access token...
[DEBUG] Token exchange response {
  "status": 200,
  "hasAccessToken": true,
  "hasRefreshToken": true
}
✅ OAuth authentication successful!
📍 Instance URL: https://na139.salesforce.com
🎯 Access Token (first 20 chars): 00D5g00000123456!ARY...
🔄 Refresh Token available: true
```

### **Browser Network Tab (Key Requests)**

```
Request 1: Initiate OAuth
GET /api/sf/auth/login
Status: 200 OK
Response: {"success":true,"authUrl":"https://login.salesforce.com/..."}

Request 2: OAuth Callback
GET /api/sf/auth/callback?code=aPrx...&state=a1b2...
Status: 302 Found
Location: /?auth=success

Request 3: Success Page
GET /?auth=success
Status: 200 OK
Response: [HTML content]
```

---

## 🎯 Testing Checklist

### **Pre-Flight Checks**
- [ ] `.env` file configured with correct credentials
- [ ] Salesforce Connected App configured with correct callback URL
- [ ] Server running on http://localhost:3000
- [ ] Browser can access OAuth interface at `/oauth`

### **OAuth Flow Testing**
- [ ] Click "Login with Salesforce" initiates flow
- [ ] Redirects to Salesforce login page
- [ ] Can enter credentials and login
- [ ] Shows app permission approval (if configured)
- [ ] Redirects back to application
- [ ] Shows "Connected (OAuth)" status
- [ ] Results display shows success message
- [ ] Refresh Token button is enabled
- [ ] Logout button is enabled

### **Security Testing**
- [ ] State parameter is generated and validated
- [ ] PKCE challenge/verifier implemented
- [ ] Session security configured
- [ ] Tokens stored securely in server memory
- [ ] Error scenarios handled gracefully

### **Token Management Testing**
- [ ] Refresh token functionality works
- [ ] Status check shows correct authentication state
- [ ] Logout clears authentication properly
- [ ] Tokens are cleared from memory on logout

---

## 🚀 Next Steps

This visual guide provides a complete overview of the OAuth implementation. To experience the flow:

1. **Start the server**: `npm start`
2. **Navigate to OAuth interface**: `http://localhost:3000/oauth`
3. **Follow the flow**: Click through each step
4. **Monitor server logs**: Watch the console output
5. **Use browser DevTools**: Observe network requests and responses

The implementation is production-ready with proper security measures and comprehensive error handling.

---

*This guide represents the complete OAuth 2.0 Authorization Code flow with PKCE implementation as built for the Salesforce API test tool.*