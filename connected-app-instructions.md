# Create New Salesforce Connected App for API Access

## Step 1: Create Connected App
1. **Login to Salesforce**: https://orgfarm-da56a057fc-dev-ed.develop.my.salesforce.com
2. **Setup** → **App Manager** → **New Connected App**

## Step 2: Basic Information
```
Connected App Name: API Test App
API Name: API_Test_App
Contact Email: sfsb01822@agentforce.com
Description: Test app for API access
```

## Step 3: API (Enable OAuth Settings)
✅ **Check "Enable OAuth Settings"**

**Callback URL:** 
```
http://localhost:3000
```

**Selected OAuth Scopes** (Add these):
- ✅ Access and manage your data (api)
- ✅ Access your basic information (id, profile, email, address, phone)  
- ✅ Perform requests on your behalf at any time (refresh_token, offline_access)

## Step 4: Save First
**Save** the Connected App (don't configure policies yet)

## Step 5: Edit Policies (CRITICAL - Wait 2 minutes after saving)
1. **App Manager** → Find your new app → **View**
2. **Edit Policies**
3. **Set these EXACT values:**

```
OAuth Policies:
├── Permitted Users: "All users may self-authorize"
├── IP Relaxation: "Relax IP restrictions" ⭐ MUST BE THIS
├── Refresh Token Policy: "Refresh token is valid until revoked"
├── Require Secret for Web Server Flow: ✅ Checked
└── Require Secret for Refresh Token Rotation: ✅ Checked
```

## Step 6: Get Credentials
1. **Manage Consumer Details** → **View**
2. Copy the **Consumer Key** (Client ID)
3. Copy the **Consumer Secret** (Client Secret)

## Step 7: Test
Update your test script with the new credentials:
```javascript
clientId: 'NEW_CONSUMER_KEY',
clientSecret: 'NEW_CONSUMER_SECRET',
```

Run: `node test-sf-auth.js`

## ⚠️ Common Mistakes That Cause "invalid_grant"
- ❌ IP Relaxation set to "Enforce IP restrictions"
- ❌ Missing "Access and manage your data (api)" scope
- ❌ Permitted Users set to "Admin approved users" without proper profile setup
- ❌ Not waiting for changes to propagate (5-10 minutes)

## 🎯 Success Indicators
When working, you should see:
```
✅ SUCCESS! Authentication worked!
🎯 Access Token (first 20 chars): 00D5j00000BQ...
🏢 Instance URL: https://orgfarm-da56a057fc-dev-ed.develop.my.salesforce.com
``` 