# Salesforce Setup Guide

## Quick Start Guide for Salesforce OAuth Implementation

This guide will help you set up and test the Salesforce OAuth 2.0 Authorization Code flow implementation in the CRM integration tool.

## Prerequisites

1. **Salesforce Developer Org** (or any Salesforce org with admin access)
2. **Node.js** installed (version 14 or higher)
3. **Basic understanding** of Salesforce Connected Apps

---

## Step 1: Salesforce Connected App Configuration

### 1.1 Create Connected App (if not already done)

1. **Login to Salesforce** as an administrator
2. **Navigate to Setup** → App Manager
3. **Click "New Connected App"**
4. **Fill Basic Information**:
   - Connected App Name: `Salesforce API Test Tool`
   - API Name: `Salesforce_API_Test_Tool`
   - Contact Email: Your email
   - Description: `OAuth test application for API validation`

### 1.2 Configure OAuth Settings

**Enable OAuth Settings**: ✅ Check this box

**Callback URL**: 
```
http://localhost:3000/api/sf/auth/callback
```

**Selected OAuth Scopes** (move from Available to Selected):
- ✅ Access and manage your data (api)
- ✅ Perform requests on your behalf at any time (refresh_token, offline_access)
- ✅ Access your basic information (id)

**Additional Settings**:
- ✅ **Require Secret for Web Server Flow** (Important!)
- ❌ **Require Secret for Refresh Token Flow** (Uncheck for better UX)
- **Permitted Users**: `Admin approved users are pre-authorized` (recommended for testing)
- **IP Relaxation**: `Relax IP restrictions` (for development)

### 1.3 Get Credentials

After saving, you'll get:
- **Consumer Key** (Client ID)
- **Consumer Secret** (Client Secret)

**⚠️ Important**: Click "Manage Consumer Details" to see the Consumer Secret.

---

## Step 2: Environment Configuration

### 2.1 Create Environment File

1. **Copy the template**:
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file**:
   ```bash
   # Salesforce OAuth Configuration
   SF_CLIENT_ID=your_consumer_key_from_connected_app
   SF_CLIENT_SECRET=your_consumer_secret_from_connected_app
   SF_REDIRECT_URI=http://localhost:3000/api/sf/auth/callback
   SF_INSTANCE_URL=https://login.salesforce.com
   
   # Session Configuration
   SESSION_SECRET=your_random_secret_here_32_chars_min
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   USE_OAUTH=false
   ```

### 2.2 Generate Session Secret

**Option 1 - Node.js**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2 - Online Generator**:
Visit a secure password generator and create a 64-character random string.

**Option 3 - Manual**:
```bash
# Linux/Mac
openssl rand -hex 32
```

### 2.3 Instance URL Configuration

| Org Type | Instance URL |
|----------|--------------|
| **Production/Developer** | `https://login.salesforce.com` |
| **Sandbox** | `https://test.salesforce.com` |
| **Custom Domain** | `https://yourdomain.my.salesforce.com` |

---

## Step 3: Application Setup

### 3.1 Install Dependencies

```bash
npm install
```

### 3.2 Start the Server

```bash
npm start
```

You should see:
```
Salesforce Proxy Server running at http://localhost:3000
Open your browser to: http://localhost:3000
```

---

## Step 4: Testing OAuth Flow

### 4.1 Access OAuth Interface

**Option 1 - Direct URL**:
```
http://localhost:3000/oauth
```

**Option 2 - From Password Flow**:
1. Go to `http://localhost:3000`
2. Click "Try OAuth Flow →" link

### 4.2 Initiate OAuth Flow

1. **Click "🚀 Login with Salesforce"**
2. **You'll be redirected** to Salesforce login page
3. **Enter your Salesforce credentials**
4. **Approve the application** (if prompted)
5. **You'll be redirected back** to the application

### 4.3 Verify Success

After successful authentication, you should see:
- ✅ **Status: Connected (OAuth)**
- 🎉 **"OAuth authentication successful!" message**
- **Enabled API testing buttons**

### 4.4 Test API Operations

Try the following operations:
1. **Create Lead**: Fill form and submit
2. **Get Recent Leads**: Click to retrieve leads
3. **Get Recent Accounts**: Click to retrieve accounts
4. **Refresh Token**: Test token refresh functionality

---

## Step 5: Troubleshooting

### Common Issues and Solutions

#### 5.1 "redirect_uri_mismatch" Error

**Problem**: The callback URL doesn't match Connected App configuration.

**Solution**:
1. Check Connected App callback URL exactly matches: `http://localhost:3000/api/sf/auth/callback`
2. Ensure no trailing slashes or extra characters
3. Verify the port number matches your server (default: 3000)

#### 5.2 "invalid_client_id" Error

**Problem**: Consumer Key is incorrect or missing.

**Solution**:
1. Copy Consumer Key exactly from Connected App
2. Ensure no extra spaces in `.env` file
3. Restart server after changing environment variables

#### 5.3 "invalid_client" Error

**Problem**: Consumer Secret is incorrect or missing.

**Solution**:
1. Click "Manage Consumer Details" in Connected App to see secret
2. Copy Consumer Secret exactly
3. Ensure "Require Secret for Web Server Flow" is enabled

#### 5.4 "State Parameter Mismatch" Error

**Problem**: Session issues or CSRF attack detection.

**Solution**:
1. Clear browser cookies/cache
2. Check SESSION_SECRET is set in `.env`
3. Restart the server
4. Try authentication again

#### 5.5 Authentication Loop/Redirect Issues

**Problem**: Continuous redirects or login loops.

**Solution**:
1. Check Connected App "Permitted Users" setting
2. Ensure user has proper permissions
3. Try different browser or incognito mode
4. Check Salesforce user profile for API access

### 5.6 Debug Mode

Enable debug logging by adding to `.env`:
```bash
NODE_ENV=development
```

This will show detailed logs in the server console for troubleshooting.

---

## Step 6: Production Considerations

### 6.1 Security Checklist

- [ ] **HTTPS**: Use HTTPS in production (set `NODE_ENV=production`)
- [ ] **Secure Secrets**: Use proper secret management
- [ ] **IP Restrictions**: Configure in Connected App if needed
- [ ] **User Permissions**: Set appropriate "Permitted Users"
- [ ] **Token Storage**: Consider database storage for production

### 6.2 Environment Variables for Production

```bash
# Production environment
NODE_ENV=production
SF_INSTANCE_URL=https://yourdomain.my.salesforce.com
SF_REDIRECT_URI=https://yourdomain.com/api/sf/auth/callback
SESSION_SECRET=use_proper_secret_management_service
PORT=443  # or 80, depending on setup
```

### 6.3 Connected App Production Settings

- **IP Restrictions**: Configure if needed
- **Permitted Users**: `Admin approved users are pre-authorized`
- **Session Policies**: Configure appropriate session timeout
- **Refresh Token Policy**: Set based on security requirements

---

## Step 7: Feature Comparison

### OAuth vs Password Flow

| Feature | OAuth Flow | Password Flow |
|---------|------------|---------------|
| **Security** | ✅ High (credentials never exposed) | ⚠️ Medium (credentials pass through app) |
| **User Experience** | ✅ Standard OAuth flow | ❌ Custom credential form |
| **Token Management** | ✅ Access + Refresh tokens | ❌ Access token only |
| **Production Ready** | ✅ Yes | ⚠️ Limited use cases |
| **Setup Complexity** | ⚠️ Connected App configuration | ✅ Simple |
| **Maintenance** | ✅ Automatic token refresh | ❌ Manual re-authentication |

---

## Step 8: Next Steps

After successful OAuth setup:

1. **Explore API Operations**: Test all available endpoints
2. **Review Documentation**: Check `oauth-authorization-code-implementation.md`
3. **Customize for Your Needs**: Modify scopes, endpoints as needed
4. **Deploy to Production**: Follow production security guidelines
5. **Monitor Usage**: Check Salesforce setup → Login History

---

## Support and Resources

### Documentation Files:
- `docs/oauth-authorization-code-implementation.md` - Technical implementation details
- `docs/oauth-implementation-status.md` - Current implementation status
- `docs/implementation-plan.md` - Overall project plan

### Salesforce Resources:
- [Connected Apps Documentation](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)
- [OAuth 2.0 Web Server Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [OAuth Scopes](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_tokens_scopes.htm)

### Quick Commands:
```bash
# Start server
npm start

# Start with OAuth as default
USE_OAUTH=true npm start

# Check environment configuration
node -e "require('dotenv').config(); console.log(process.env.SF_CLIENT_ID ? 'Configured' : 'Missing Config')"
```

---

## Success Checklist

- [ ] Connected App created and configured
- [ ] Environment file configured with correct credentials
- [ ] Server starts without errors
- [ ] OAuth login redirects to Salesforce
- [ ] Authentication completes successfully
- [ ] API operations work (Create Lead, Get Leads, etc.)
- [ ] Token refresh works
- [ ] Logout clears authentication

**🎉 Congratulations!** Your OAuth implementation is now ready for use.

---

*For technical support or questions, refer to the implementation documentation or check the server logs for detailed error information.*