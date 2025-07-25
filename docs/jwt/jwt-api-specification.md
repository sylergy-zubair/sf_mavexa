# JWT Backend API Specification

## 🎯 Overview

This document defines the complete API specification for the external JWT backend service that will handle Salesforce authorization code exchange and JWT token management. The backend service must implement these endpoints to support the JWT token exchange architecture.

## 🏗️ Service Architecture Requirements

### Base Requirements
- **Protocol:** HTTPS only (TLS 1.2 or higher)
- **Authentication:** API Key based authentication
- **Content-Type:** `application/json` for all requests and responses
- **Rate Limiting:** Minimum 1000 requests per minute per API key
- **Availability:** 99.9% uptime SLA
- **Response Time:** <500ms 95th percentile for all endpoints

### Security Requirements
- API key validation for all endpoints
- Request origin validation
- Rate limiting and DDoS protection
- Comprehensive audit logging
- Secure Salesforce credential storage
- JWT token signing with strong algorithms (RS256 recommended)

## 📡 API Endpoints

### 1. Health Check Endpoint

#### `GET /health`
**Purpose:** Service health and availability check

**Request Headers:**
```http
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Response (200 OK):**
```json
{
    "status": "healthy",
    "timestamp": "2025-01-25T10:30:00Z",
    "version": "1.0.0",
    "salesforce_connectivity": "healthy",
    "database_connectivity": "healthy",
    "jwt_service": "operational"
}
```

**Response (503 Service Unavailable):**
```json
{
    "status": "unhealthy",
    "timestamp": "2025-01-25T10:30:00Z",
    "errors": [
        "salesforce_connectivity_failed",
        "database_timeout"
    ]
}
```

---

### 2. OAuth Authorization Code Exchange

#### `POST /oauth/exchange`
**Purpose:** Exchange Salesforce authorization code for JWT token

**Request Headers:**
```http
Authorization: Bearer {api_key}
Content-Type: application/json
X-Request-Source: salesforce-api-test-tool
X-Request-ID: auth-{timestamp}-{random_id}
```

**Request Body:**
```json
{
    "authorizationCode": "aPrxdMKdWSJg2nLVh.zKqOqTLQS_0lJkFpNxWKgdqSr8J8Y.zF9qOCJdPJE6.vM",
    "state": "csrf_state_value_32_chars_random",
    "redirectUri": "http://localhost:3000/api/sf/auth/callback",
    "clientMetadata": {
        "source": "salesforce-api-test-tool",
        "version": "3.0.0",
        "timestamp": "2025-01-25T10:30:00Z",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "ipAddress": "192.168.1.100",
        "sessionId": "optional_session_identifier"
    }
}
```

**Success Response (200 OK):**
```json
{
    "success": true,
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEyMzQ1In0.eyJzdWIiOiIwMDVVMDAwMDAwMUFCQ0QiLCJpc3MiOiJqd3QtYmFja2VuZC1zZXJ2aWNlIiwiYXVkIjoic2FsZXNmb3JjZS1hcGktdGVzdC10b29sIiwiaWF0IjoxNjQzMTAxMjAwLCJleHAiOjE2NDMxMDQ4MDAsInNmX2luc3RhbmNlX3VybCI6Imh0dHBzOi8vbXlvcmcubXkuc2FsZXNmb3JjZS5jb20iLCJzZl9hY2Nlc3NfdG9rZW4iOiIwMEQzMTAwMDAwMGVOUWIhQVEwQVFKLjRZZlZ5UWNnVnVkVWJhQWJVcXNJbVhGUWJhLmVOUUZwaDYuUE5nOF9xeFkyN0FEYnFrIiwic2Zfb3JnX2lkIjoiMDEyMzQ1Njc4OTEyMzQ1IiwidXNlcl9wcm9maWxlIjp7ImlkIjoiMDA1VTAwMDAwMDFBQkNEIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwibmFtZSI6IkpvaG4gRG9lIiwicm9sZSI6IlN5c3RlbSBBZG1pbmlzdHJhdG9yIn0sInBlcm1pc3Npb25zIjpbImFwaSIsImNvbnRhY3RfY3J1ZCIsImxlYWRfY3J1ZCJdfQ.signature_here",
    "expiresIn": 3600,
    "refreshToken": "refresh_token_value_if_supported",
    "tokenType": "Bearer",
    "issuedAt": "2025-01-25T10:30:00Z",
    "expiresAt": "2025-01-25T11:30:00Z",
    "userProfile": {
        "id": "005U0000001ABCD",
        "email": "user@example.com",
        "name": "John Doe",
        "organizationId": "012345678912345",
        "organizationName": "My Company",
        "role": "System Administrator",
        "profileId": "00e12345678",
        "permissions": ["api", "contact_crud", "lead_crud"],
        "lastLoginDate": "2025-01-25T09:15:00Z",
        "locale": "en_US",
        "timezone": "America/New_York"
    },
    "salesforceMetadata": {
        "instanceUrl": "https://myorg.my.salesforce.com",
        "organizationId": "012345678912345",
        "apiVersion": "v58.0",
        "sandboxName": null
    }
}
```

**Error Response (400 Bad Request):**
```json
{
    "success": false,
    "error": "invalid_authorization_code",
    "errorDescription": "The provided authorization code is invalid or has expired",
    "errorCode": "SF_AUTH_4001",
    "timestamp": "2025-01-25T10:30:00Z",
    "requestId": "auth-1643101200-abc123",
    "troubleshooting": [
        "Verify the authorization code was received correctly",
        "Check that the code hasn't been used previously",
        "Ensure the redirect URI matches exactly",
        "Verify the Salesforce Connected App configuration"
    ]
}
```

**Error Response (500 Internal Server Error):**
```json
{
    "success": false,
    "error": "salesforce_exchange_failed",
    "errorDescription": "Failed to exchange authorization code with Salesforce",
    "errorCode": "SF_BACKEND_5001",
    "timestamp": "2025-01-25T10:30:00Z",
    "requestId": "auth-1643101200-abc123",
    "troubleshooting": [
        "Check Salesforce service status",
        "Verify Connected App credentials",
        "Check network connectivity to Salesforce",
        "Review Salesforce API rate limits"
    ]
}
```

---

### 3. JWT Token Refresh

#### `POST /oauth/refresh`
**Purpose:** Refresh an expired or soon-to-expire JWT token

**Request Headers:**
```http
Authorization: Bearer {api_key}
Content-Type: application/json
X-Request-Source: salesforce-api-test-tool
```

**Request Body:**
```json
{
    "refreshToken": "refresh_token_value_from_initial_exchange",
    "grantType": "refresh_token",
    "clientMetadata": {
        "source": "salesforce-api-test-tool",
        "timestamp": "2025-01-25T11:25:00Z"
    }
}
```

**Success Response (200 OK):**
```json
{
    "success": true,
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "refreshToken": "new_refresh_token_if_rotated",
    "tokenType": "Bearer",
    "issuedAt": "2025-01-25T11:25:00Z",
    "expiresAt": "2025-01-25T12:25:00Z"
}
```

**Error Response (401 Unauthorized):**
```json
{
    "success": false,
    "error": "invalid_refresh_token",
    "errorDescription": "The provided refresh token is invalid or has expired",
    "errorCode": "JWT_REFRESH_4001",
    "timestamp": "2025-01-25T11:25:00Z"
}
```

---

### 4. JWT Token Validation

#### `POST /oauth/validate`
**Purpose:** Validate a JWT token and retrieve user context

**Request Headers:**
```http
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**
```json
{
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "includeUserProfile": true,
    "validatePermissions": ["api", "contact_crud"]
}
```

**Success Response (200 OK):**
```json
{
    "valid": true,
    "expiresAt": "2025-01-25T11:30:00Z",
    "timeToExpiry": 1800,
    "userProfile": {
        "id": "005U0000001ABCD",
        "email": "user@example.com",
        "name": "John Doe",
        "organizationId": "012345678912345",
        "permissions": ["api", "contact_crud", "lead_crud"]
    },
    "tokenMetadata": {
        "issuedAt": "2025-01-25T10:30:00Z",
        "issuer": "jwt-backend-service",
        "audience": "salesforce-api-test-tool"
    }
}
```

**Error Response (401 Unauthorized):**
```json
{
    "valid": false,
    "error": "token_expired",
    "errorDescription": "The JWT token has expired",
    "errorCode": "JWT_VALIDATE_4001",
    "expiresAt": "2025-01-25T10:30:00Z",
    "timestamp": "2025-01-25T11:35:00Z"
}
```

---

### 5. User Session Management

#### `POST /oauth/logout`
**Purpose:** Invalidate JWT token and clear session

**Request Headers:**
```http
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**
```json
{
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "revokeRefreshToken": true,
    "logoutFromSalesforce": false
}
```

**Success Response (200 OK):**
```json
{
    "success": true,
    "message": "Token successfully invalidated",
    "timestamp": "2025-01-25T12:00:00Z"
}
```

---

### 6. Service Configuration

#### `GET /config`
**Purpose:** Retrieve service configuration and capabilities

**Request Headers:**
```http
Authorization: Bearer {api_key}
```

**Response (200 OK):**
```json
{
    "service": {
        "name": "JWT Backend Service",
        "version": "1.0.0",
        "capabilities": [
            "oauth_exchange",
            "token_refresh",
            "token_validation",
            "session_management"
        ]
    },
    "jwt": {
        "algorithm": "RS256",
        "defaultExpiryMinutes": 60,
        "maxExpiryMinutes": 1440,
        "refreshTokenSupported": true,
        "refreshTokenRotation": true
    },
    "salesforce": {
        "supportedFlows": ["authorization_code"],
        "apiVersion": "v58.0",
        "rateLimits": {
            "requestsPerMinute": 1000,
            "burstLimit": 100
        }
    }
}
```

## 🔐 JWT Token Structure

### JWT Header
```json
{
    "alg": "RS256",
    "typ": "JWT",
    "kid": "12345"
}
```

### JWT Payload
```json
{
    "sub": "005U0000001ABCD",
    "iss": "jwt-backend-service", 
    "aud": "salesforce-api-test-tool",
    "iat": 1643101200,
    "exp": 1643104800,
    "jti": "unique_token_identifier",
    
    "sf_instance_url": "https://myorg.my.salesforce.com",
    "sf_access_token": "00D31000000eNQb!AQ0AQJ.4YfVyQcgVudUbaAbUqsImXFQba.eNQFph6.PNg8_qxY27ADbqk",
    "sf_refresh_token": "5Aep861TSESvWeug_xvFHRBTTbf_YrTWgEyjBJAuKFhSjHh7D8ejGJlF0A==",
    "sf_org_id": "012345678912345",
    
    "user_profile": {
        "id": "005U0000001ABCD",
        "email": "user@example.com",
        "name": "John Doe",
        "role": "System Administrator",
        "profile_id": "00e12345678",
        "organization_id": "012345678912345"
    },
    
    "permissions": ["api", "contact_crud", "lead_crud"],
    "session_data": {
        "login_timestamp": "2025-01-25T10:30:00Z",
        "ip_address": "192.168.1.100",
        "user_agent_hash": "sha256_hash"
    }
}
```

## 🔧 Configuration Requirements

### Environment Variables
```bash
# Service Configuration
JWT_SERVICE_PORT=8080
JWT_SERVICE_HOST=0.0.0.0
JWT_LOG_LEVEL=info

# JWT Configuration
JWT_PRIVATE_KEY_PATH=/path/to/private.pem
JWT_PUBLIC_KEY_PATH=/path/to/public.pem
JWT_ALGORITHM=RS256
JWT_DEFAULT_EXPIRY_MINUTES=60
JWT_MAX_EXPIRY_MINUTES=1440

# Salesforce Configuration
SALESFORCE_CLIENT_ID=salesforce_connected_app_client_id
SALESFORCE_CLIENT_SECRET=salesforce_connected_app_client_secret
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_API_VERSION=v58.0

# Database Configuration (for token storage)
DATABASE_URL=postgresql://user:pass@localhost:5432/jwt_service
REDIS_URL=redis://localhost:6379/0

# Security Configuration
API_KEY_VALIDATION=strict
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
RATE_LIMIT_BURST=100
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_AUDIT_EVENTS=true
```

### Database Schema Requirements

#### API Keys Table
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    rate_limit_override INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);
```

#### JWT Tokens Table (for revocation tracking)
```sql
CREATE TABLE jwt_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    api_key_id UUID REFERENCES api_keys(id),
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    refresh_token_hash VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

#### Audit Log Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(255),
    api_key_id UUID REFERENCES api_keys(id),
    request_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📊 Error Codes Reference

| Error Code | HTTP Status | Description | Resolution |
|------------|-------------|-------------|------------|
| SF_AUTH_4001 | 400 | Invalid authorization code | Verify code format and expiration |
| SF_AUTH_4002 | 400 | Missing required parameters | Check request body completeness |
| SF_AUTH_4003 | 400 | Invalid redirect URI | Verify URI matches Connected App |
| SF_BACKEND_5001 | 500 | Salesforce exchange failed | Check SF connectivity and credentials |
| SF_BACKEND_5002 | 500 | Database connection failed | Verify database connectivity |
| JWT_REFRESH_4001 | 401 | Invalid refresh token | Re-authenticate user |
| JWT_REFRESH_4002 | 401 | Refresh token expired | Re-authenticate user |
| JWT_VALIDATE_4001 | 401 | Token expired | Refresh token or re-authenticate |
| JWT_VALIDATE_4002 | 401 | Invalid token signature | Check JWT key configuration |
| API_KEY_4001 | 401 | Invalid API key | Verify API key configuration |
| API_KEY_4003 | 403 | API key lacks permissions | Check API key permissions |
| RATE_LIMIT_4290 | 429 | Rate limit exceeded | Implement backoff strategy |

## 🧪 Testing Requirements

### Unit Tests
- JWT token generation and validation
- Salesforce API integration
- Error handling scenarios
- Rate limiting functionality

### Integration Tests
- End-to-end OAuth flow
- Token refresh scenarios
- Database operations
- API key validation

### Performance Tests
- Load testing with 1000+ req/min
- Token validation performance
- Database query optimization
- Memory usage under load

### Security Tests
- JWT token security validation
- API key brute force protection
- SQL injection prevention
- CORS policy validation

## 📝 Implementation Examples

### Sample Node.js Implementation Skeleton

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const app = express();

// JWT Token Exchange
app.post('/oauth/exchange', async (req, res) => {
    try {
        const { authorizationCode, redirectUri } = req.body;
        
        // Exchange with Salesforce
        const sfResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: authorizationCode,
                client_id: process.env.SALESFORCE_CLIENT_ID,
                client_secret: process.env.SALESFORCE_CLIENT_SECRET,
                redirect_uri: redirectUri
            })
        });
        
        const sfData = await sfResponse.json();
        
        if (!sfResponse.ok) {
            return res.status(400).json({
                success: false,
                error: 'salesforce_exchange_failed',
                errorDescription: sfData.error_description
            });
        }
        
        // Generate JWT token
        const jwtPayload = {
            sub: sfData.id,
            sf_access_token: sfData.access_token,
            sf_instance_url: sfData.instance_url,
            // ... other claims
        };
        
        const jwtToken = jwt.sign(jwtPayload, process.env.JWT_PRIVATE_KEY, {
            algorithm: 'RS256',
            expiresIn: '1h',
            issuer: 'jwt-backend-service',
            audience: 'salesforce-api-test-tool'
        });
        
        res.json({
            success: true,
            token: jwtToken,
            expiresIn: 3600,
            // ... other response fields
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'internal_server_error',
            errorDescription: error.message
        });
    }
});
```

### Sample Python Implementation Skeleton

```python
from flask import Flask, request, jsonify
import jwt
import requests
import os
from datetime import datetime, timedelta

app = Flask(__name__)

@app.route('/oauth/exchange', methods=['POST'])
def exchange_oauth():
    try:
        data = request.get_json()
        auth_code = data['authorizationCode']
        redirect_uri = data['redirectUri']
        
        # Exchange with Salesforce
        sf_response = requests.post(
            'https://login.salesforce.com/services/oauth2/token',
            data={
                'grant_type': 'authorization_code',
                'code': auth_code,
                'client_id': os.getenv('SALESFORCE_CLIENT_ID'),
                'client_secret': os.getenv('SALESFORCE_CLIENT_SECRET'),
                'redirect_uri': redirect_uri
            }
        )
        
        if not sf_response.ok:
            return jsonify({
                'success': False,
                'error': 'salesforce_exchange_failed',
                'errorDescription': sf_response.json().get('error_description')
            }), 400
        
        sf_data = sf_response.json()
        
        # Generate JWT
        payload = {
            'sub': sf_data['id'],
            'sf_access_token': sf_data['access_token'],
            'sf_instance_url': sf_data['instance_url'],
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=1),
            'iss': 'jwt-backend-service',
            'aud': 'salesforce-api-test-tool'
        }
        
        with open(os.getenv('JWT_PRIVATE_KEY_PATH'), 'r') as key_file:
            private_key = key_file.read()
        
        jwt_token = jwt.encode(payload, private_key, algorithm='RS256')
        
        return jsonify({
            'success': True,
            'token': jwt_token,
            'expiresIn': 3600
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'internal_server_error',
            'errorDescription': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

---

*This API specification provides the complete requirements for implementing a JWT backend service that integrates with the Salesforce API test tool. Implement all endpoints according to these specifications to ensure proper functionality.*