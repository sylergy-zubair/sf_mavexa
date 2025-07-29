# HubSpot Setup Guide

This guide walks you through setting up HubSpot integration for the Salesforce API Test Tool, following the same OAuth 2.0 patterns used for Salesforce integration.

## Prerequisites

- Node.js (v14 or higher)
- HubSpot Developer Account
- HubSpot App with OAuth 2.0 enabled
- Basic understanding of OAuth 2.0 Authorization Code flow

## HubSpot App Setup

### Step 1: Create HubSpot Developer Account

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Sign up for a developer account or log in with existing HubSpot credentials
3. Navigate to "Apps" section in your developer dashboard

### Step 2: Create a New App

1. **Create App**:
   - Click "Create app" in your developer dashboard
   - Fill in app details:
     - **App name**: `Salesforce API Test Tool - HubSpot Integration`
     - **Description**: `OAuth 2.0 integration for contact management testing`
     - **App type**: Public or Private (choose based on your needs)

2. **Configure App Info**:
   - Add app logo (optional)
   - Set app website URL (if applicable)
   - Fill in app description and terms of service

### Step 3: OAuth Configuration

1. **Navigate to Auth tab** in your app settings

2. **Set Redirect URLs**:
   ```
   http://localhost:3000/api/hs/auth/callback
   ```
   
   For production, add your production domain:
   ```
   https://yourdomain.com/api/hs/auth/callback
   ```

3. **Configure Scopes**:
   Select the following scopes for contact management:
   ```
   crm.objects.contacts.read
   crm.objects.contacts.write
   crm.schemas.contacts.read
   crm.schemas.contacts.write
   oauth
   ```

4. **Copy credentials**:
   - **Client ID**: Copy this value (you'll need it for `.env`)
   - **Client Secret**: Copy this value (you'll need it for `.env`)

### Step 4: Environment Configuration

Add the following variables to your `.env` file:

```bash
# HubSpot OAuth Configuration
HS_CLIENT_ID=your_hubspot_client_id_here
HS_CLIENT_SECRET=your_hubspot_client_secret_here
HS_REDIRECT_URI=http://localhost:3000/api/hs/auth/callback
HS_SCOPE=crm.objects.contacts.read crm.objects.contacts.write oauth

# Optional: HubSpot API Base URL (default is https://api.hubapi.com)
HS_API_BASE_URL=https://api.hubapi.com
```

## Testing Your Setup

### Step 1: Verify App Configuration

1. **Test redirect URL accessibility**:
   ```bash
   # Start your server
   npm start
   
   # The callback URL should be accessible at:
   # http://localhost:3000/api/hs/auth/callback
   ```

2. **Verify OAuth URL format**:
   The OAuth authorization URL should follow this pattern:
   ```
   https://app.hubspot.com/oauth/authorize?
     client_id=YOUR_CLIENT_ID&
     redirect_uri=http://localhost:3000/api/hs/auth/callback&
     scope=crm.objects.contacts.read crm.objects.contacts.write oauth&
     response_type=code&
     state=RANDOM_STATE_VALUE
   ```

### Step 2: Test OAuth Flow

1. Navigate to `http://localhost:3000` in your browser
2. Scroll down to the HubSpot section
3. Click "🚀 Login with HubSpot"
4. You should be redirected to HubSpot's authorization page
5. Grant permissions to your app
6. You should be redirected back with successful authentication

## Common Setup Issues

### Issue: "redirect_uri_mismatch" Error

**Cause**: The redirect URI in your app settings doesn't match the one sent in the OAuth request.

**Solution**:
1. Check your app's Auth settings in HubSpot developer dashboard
2. Ensure the redirect URI exactly matches: `http://localhost:3000/api/hs/auth/callback`
3. No trailing slashes or extra parameters

### Issue: "invalid_client" Error

**Cause**: Client ID or Client Secret is incorrect.

**Solution**:
1. Double-check your `.env` file values
2. Regenerate Client Secret in HubSpot app settings if needed
3. Ensure no extra spaces in environment variables

### Issue: "insufficient_scope" Error

**Cause**: Your app doesn't have the required scopes.

**Solution**:
1. Go to your HubSpot app's Auth settings
2. Add required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `oauth`
3. Save changes and try again

### Issue: App Not Found in HubSpot

**Cause**: App may not be properly configured or activated.

**Solution**:
1. Check app status in HubSpot developer dashboard
2. Ensure app is not in draft mode
3. Verify all required fields are completed

## Security Considerations

### Production Setup

1. **Use HTTPS**: Always use HTTPS in production
   ```bash
   HS_REDIRECT_URI=https://yourdomain.com/api/hs/auth/callback
   ```

2. **Secure Environment Variables**: Never commit `.env` files to version control

3. **Rotate Secrets**: Regularly rotate client secrets in production

4. **Scope Minimization**: Only request scopes your app actually needs

## Next Steps

After completing this setup:

1. Review [`hubspot-authorization-code-implementation.md`](./hubspot-authorization-code-implementation.md) for technical implementation details
2. Check [`hubspot-api-specification.md`](./hubspot-api-specification.md) for API endpoint documentation
3. Follow [`hubspot-integration-plan.md`](./hubspot-integration-plan.md) for TDD implementation approach

## Support Resources

- [HubSpot Developer Documentation](https://developers.hubspot.com/docs)
- [HubSpot OAuth 2.0 Guide](https://developers.hubspot.com/docs/api/working-with-oauth)
- [HubSpot API Reference](https://developers.hubspot.com/docs/api/overview)
- [HubSpot Community](https://community.hubspot.com/t5/HubSpot-Developers/ct-p/developers)

## Troubleshooting Checklist

- [ ] HubSpot developer account created
- [ ] App created and configured
- [ ] Redirect URI set correctly
- [ ] Required scopes selected
- [ ] Client ID and Secret copied to `.env`
- [ ] Environment variables loaded correctly
- [ ] Server running on correct port (3000)
- [ ] OAuth flow tested successfully