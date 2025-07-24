# Salesforce API Test Tool

A comprehensive Node.js application for testing Salesforce API integration with support for both OAuth 2.0 Authorization Code flow and Username/Password authentication.

## 🚀 Features

### Authentication Methods
- **OAuth 2.0 Authorization Code Flow** (Recommended) - Secure, production-ready authentication
- **Username/Password Flow** (Legacy) - Simple authentication for testing

### API Operations
- Create, Read, Update, Delete operations on Salesforce objects
- Lead management
- Account management
- Custom object support

### Security Features
- CSRF protection with state parameter validation
- Secure session management
- Token refresh mechanism
- Environment-based configuration

## 🏗️ Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Salesforce Developer Org or Sandbox
- Salesforce Connected App

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sylergy-zubair/sf_mavexa.git
   cd sf_mavexa
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Salesforce credentials
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open your browser**:
   ```
   http://localhost:3000
   ```

## 🔐 Authentication Setup

### OAuth 2.0 Setup (Recommended)

1. **Create Salesforce Connected App**:
   - Go to Setup → App Manager → New Connected App
   - Enable OAuth Settings
   - Set Callback URL: `http://localhost:3000/api/sf/auth/callback`
   - Select OAuth Scopes: `api`, `refresh_token`, `id`

2. **Configure Environment**:
   ```bash
   SF_CLIENT_ID=your_consumer_key
   SF_CLIENT_SECRET=your_consumer_secret
   SF_REDIRECT_URI=http://localhost:3000/api/sf/auth/callback
   SF_INSTANCE_URL=https://login.salesforce.com
   SESSION_SECRET=your_random_session_secret
   ```

3. **Test OAuth Flow**:
   - Go to `http://localhost:3000/oauth`
   - Click "Login with Salesforce"
   - Complete authentication on Salesforce
   - You'll be redirected back with authentication success

### Username/Password Setup (Legacy)

1. **Configure Connected App**:
   - Enable Username/Password flow
   - Set appropriate OAuth policies

2. **Get User Security Token**:
   - Go to Personal Settings → Reset My Security Token
   - Check your email for the security token

3. **Test Password Flow**:
   - Go to `http://localhost:3000/password`
   - Enter credentials (password + security token)
   - Click "Connect to Salesforce"

## 📱 User Interface

### OAuth Interface (`/oauth`)
- Modern OAuth 2.0 authentication flow
- Token refresh functionality
- Authentication status checking
- Security comparison table

### Password Interface (`/password`)
- Traditional credential form
- Direct username/password authentication
- Link to try OAuth flow

## 🔧 API Endpoints

### OAuth Endpoints
- `GET /api/sf/auth/login` - Initiate OAuth flow
- `GET /api/sf/auth/callback` - OAuth callback handler
- `POST /api/sf/auth/refresh` - Refresh access token
- `GET /api/sf/auth/status` - Check authentication status
- `POST /api/sf/auth/logout` - Clear authentication

### Legacy Endpoints
- `POST /api/sf/authenticate` - Username/Password authentication

### Salesforce API Endpoints
- `POST /api/sf/leads` - Create lead
- `GET /api/sf/leads` - Get recent leads
- `GET /api/sf/accounts` - Get recent accounts

## 🔒 Security Features

### OAuth Flow Security
- **CSRF Protection**: State parameter validation
- **Secure Sessions**: HTTP-only cookies, secure flags
- **Token Management**: Automatic refresh token handling
- **No Credential Exposure**: Credentials never pass through application

### Environment Security
- **Secret Management**: Environment-based configuration
- **Session Security**: Configurable session settings
- **Production Ready**: HTTPS enforcement in production

## 📚 Documentation

### Setup Guides
- [`docs/oauth-setup-guide.md`](docs/oauth-setup-guide.md) - Complete OAuth setup walkthrough
- [`docs/oauth-authorization-code-implementation.md`](docs/oauth-authorization-code-implementation.md) - Technical implementation details

### API Documentation
- [`docs/api-documentation.md`](docs/api-documentation.md) - Complete API reference
- [`docs/oauth-implementation-status.md`](docs/oauth-implementation-status.md) - Implementation progress

### Project Documentation
- [`docs/implementation-plan.md`](docs/implementation-plan.md) - Overall project roadmap
- [`docs/technical-specifications.md`](docs/technical-specifications.md) - Technical specifications

## 🧪 Testing

### Manual Testing
1. **OAuth Flow**:
   ```bash
   # Start server and navigate to OAuth interface
   npm start
   # Open http://localhost:3000/oauth
   ```

2. **Password Flow**:
   ```bash
   # Start server and navigate to password interface
   npm start
   # Open http://localhost:3000/password
   ```

### Environment Testing
```bash
# Test with OAuth as default
USE_OAUTH=true npm start

# Test with debug logging
NODE_ENV=development npm start
```

## 🔧 Configuration

### Environment Variables
```bash
# Salesforce OAuth Configuration
SF_CLIENT_ID=your_consumer_key_here
SF_CLIENT_SECRET=your_consumer_secret_here
SF_REDIRECT_URI=http://localhost:3000/api/sf/auth/callback
SF_INSTANCE_URL=https://login.salesforce.com

# Session Configuration
SESSION_SECRET=generate_a_random_secret_here

# Server Configuration
PORT=3000
NODE_ENV=development
USE_OAUTH=false  # Set to true to make OAuth the default flow
```

### Production Configuration
```bash
NODE_ENV=production
SF_INSTANCE_URL=https://yourdomain.my.salesforce.com
SF_REDIRECT_URI=https://yourdomain.com/api/sf/auth/callback
```

## 🚀 Deployment

### Local Development
```bash
npm start
```

### Production
1. Set environment variables for production
2. Use process manager like PM2
3. Configure reverse proxy (nginx)
4. Enable HTTPS
5. Set secure session configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📋 Troubleshooting

### Common Issues

#### OAuth Issues
- **redirect_uri_mismatch**: Check Connected App callback URL
- **invalid_client_id**: Verify Consumer Key in `.env`
- **state parameter mismatch**: Clear browser cache, check session config

#### Password Flow Issues
- **invalid_grant**: Check security token is appended to password
- **invalid_client**: Verify Consumer Secret
- **unsupported_grant_type**: Enable Password flow in Connected App

### Debug Mode
Enable detailed logging:
```bash
NODE_ENV=development npm start
```

## 📞 Support

- **Documentation**: Check `docs/` directory for detailed guides
- **Issues**: Report bugs via GitHub issues
- **Setup Help**: Follow `docs/oauth-setup-guide.md`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Resources

- [Salesforce OAuth Documentation](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [Connected Apps Guide](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)
- [Salesforce API Reference](https://developer.salesforce.com/docs/api-explorer)

---

## 📊 Implementation Status

- ✅ OAuth 2.0 Authorization Code Flow
- ✅ Username/Password Flow (Legacy)
- ✅ Token Refresh Mechanism
- ✅ CSRF Protection
- ✅ Session Management
- ✅ Comprehensive Documentation
- ⏳ Production Deployment Guide
- ⏳ Automated Testing Suite

**Current Version**: 2.0.0 (OAuth Implementation)  
**Last Updated**: [Current Date]