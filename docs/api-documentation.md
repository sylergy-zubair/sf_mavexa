# API Documentation

## Overview

This document provides comprehensive API documentation for the CRM integration system, covering both Salesforce and HubSpot integrations via the Node.js proxy server.

## Base URLs

- **Node.js Server**: `http://localhost:3000`
- **Salesforce API**: See [salesforce/salesforce-api-specification.md](./salesforce/salesforce-api-specification.md)
- **HubSpot API**: See [hubspot/hubspot-api-specification.md](./hubspot/hubspot-api-specification.md)

## Authentication

The system supports multiple authentication approaches:
1. **JWT Backend Authentication** (Recommended for enterprise)
2. **Legacy OAuth 2.0** (Current implementation)

### Authentication Headers

#### JWT Backend Mode
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Auth-Type: jwt
```

#### Legacy OAuth Mode
```http
Authorization: Bearer <salesforce_access_token>
Content-Type: application/json
X-Auth-Type: legacy
```

---

## Authentication Endpoints

### 1. OAuth 2.0 Authorization Code Flow (Recommended)

#### 1.1 Initiate OAuth Flow
```http
GET /api/sf/auth/login
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?...",
  "message": "Redirect user to this URL for authentication"
}
```

#### 1.2 OAuth Callback (Handled Automatically)
```http
GET /api/sf/auth/callback?code=...&state=...
```

**JWT Backend Mode:**
- Success: Redirects to `/?auth=success&type=jwt`
- Error: Redirects to `/?error=error_description`

**Legacy OAuth Mode:**
- Success: Redirects to `/?auth=success&type=legacy`
- Error: Redirects to `/?error=error_description`

#### 1.3 Token Refresh
```http
POST /api/sf/auth/refresh
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully"
}
```

#### 1.4 Authentication Status
```http
GET /api/sf/auth/status
```

**JWT Backend Mode Response:**
```json
{
  "authenticated": true,
  "authType": "jwt",
  "hasRefreshToken": true,
  "instanceUrl": "https://xxx.my.salesforce.com",
  "userProfile": {
    "id": "005U0000001ABCD",
    "email": "user@example.com",
    "name": "John Doe",
    "organizationId": "012345678912345",
    "permissions": ["api", "contact_crud"]
  },
  "tokenExpiry": "2025-01-25T11:30:00Z",
  "jwtFlow": true,
  "legacyEnabled": false
}
```

**Legacy OAuth Mode Response:**
```json
{
  "authenticated": true,
  "authType": "legacy",
  "hasRefreshToken": true,
  "instanceUrl": "https://xxx.my.salesforce.com",
  "userProfile": null,
  "tokenExpiry": null,
  "jwtFlow": false,
  "legacyEnabled": true
}
```

#### 1.5 Logout
```http
POST /api/sf/auth/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2. Username/Password Flow (Legacy)

#### Request
```http
POST /api/sf/authenticate
Content-Type: application/json

{
  "instanceUrl": "https://xxx.my.salesforce.com",
  "clientId": "3MVG9...",
  "clientSecret": "xxxxx",
  "username": "user@example.com",
  "password": "password123"
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Successfully connected to Salesforce!",
  "instanceUrl": "https://xxx.my.salesforce.com",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "scope": "api refresh_token"
}
```

#### Error Response
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "AUTHENTICATION_FAILURE",
    "message": "Invalid username, password, or security token",
    "details": {
      "statusCode": 400,
      "salesforceError": [
        {
          "message": "INVALID_LOGIN: Invalid username, password, or token",
          "errorCode": "INVALID_LOGIN"
        }
      ]
    }
  }
}
```

### 2. Authorization Code Flow

#### Step 1: Get Authorization URL
```http
GET /api/sf/auth/authorize?response_type=code&client_id=<client_id>&redirect_uri=<callback_url>&scope=api refresh_token&state=<state>
```

#### Step 2: Handle Callback
```http
GET /api/sf/auth/callback?code=<authorization_code>&state=<state>
```

### 3. Refresh Token

#### Request
```http
POST /api/sf/auth/refresh
Content-Type: application/json

{
  "refreshToken": "5Aep...",
  "clientId": "3MVG9...",
  "clientSecret": "xxxxx"
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "accessToken": "00D...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 4. Token Validation

#### Request
```http
GET /api/sf/auth/validate
Authorization: Bearer <access_token>
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "valid": true,
  "expiresAt": "2024-01-15T11:30:00.000Z",
  "userId": "005XXXXXXXXXXXXXXX",
  "organizationId": "00DXXXXXXXXXXXXXXX"
}
```

---

## Contact CRUD Endpoints

### 1. Create Contact

#### Request
```http
POST /api/sf/contacts
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john.doe@example.com",
  "Phone": "+1-555-123-4567",
  "Title": "Software Engineer",
  "Department": "Engineering"
}
```

#### Response
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true,
  "created": true
}
```

#### Validation Errors
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required fields are missing",
    "details": {
      "fields": [
        {
          "field": "LastName",
          "message": "Last name is required"
        },
        {
          "field": "Email",
          "message": "Invalid email format"
        }
      ]
    }
  }
}
```

### 2. Get Contact by ID

#### Request
```http
GET /api/sf/contacts/{contactId}
Authorization: Bearer <access_token>
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "Id": "003XXXXXXXXXXXXXXX",
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john.doe@example.com",
  "Phone": "+1-555-123-4567",
  "Title": "Software Engineer",
  "Department": "Engineering",
  "AccountId": "001XXXXXXXXXXXXXXX",
  "CreatedDate": "2024-01-15T10:30:00.000Z",
  "LastModifiedDate": "2024-01-15T10:30:00.000Z"
}
```

#### Not Found
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": {
    "code": "NOT_FOUND",
    "message": "Contact not found",
    "details": {
      "contactId": "003XXXXXXXXXXXXXXX"
    }
  }
}
```

### 3. Update Contact

#### Request
```http
PUT /api/sf/contacts/{contactId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "Title": "Senior Software Engineer",
  "Phone": "+1-555-987-6543",
  "Department": "Platform Engineering"
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true
}
```

### 4. Partial Update Contact

#### Request
```http
PATCH /api/sf/contacts/{contactId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "Title": "Senior Software Engineer"
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true,
  "updated": ["Title"]
}
```

### 5. Delete Contact

#### Request
```http
DELETE /api/sf/contacts/{contactId}
Authorization: Bearer <access_token>
```

#### Response
```http
HTTP/1.1 204 No Content
```

### 6. List Contacts

#### Request
```http
GET /api/sf/contacts?limit=20&offset=0&orderBy=LastName&order=ASC
Authorization: Bearer <access_token>
```

#### Query Parameters
- `limit` (optional): Number of records to return (default: 20, max: 100)
- `offset` (optional): Number of records to skip (default: 0)
- `orderBy` (optional): Field to sort by (default: LastModifiedDate)
- `order` (optional): Sort order ASC or DESC (default: DESC)

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "totalSize": 150,
  "done": false,
  "nextRecordsUrl": "/api/sf/contacts?limit=20&offset=20",
  "records": [
    {
      "Id": "003XXXXXXXXXXXXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com",
      "Phone": "+1-555-123-4567",
      "Title": "Software Engineer"
    },
    {
      "Id": "003YYYYYYYYYYYYYYY",
      "FirstName": "Jane",
      "LastName": "Smith",
      "Email": "jane.smith@example.com",
      "Phone": "+1-555-987-6543",
      "Title": "Product Manager"
    }
  ]
}
```

### 7. Search Contacts

#### Request
```http
GET /api/sf/contacts/search?q=john&fields=FirstName,LastName,Email,Title&limit=10
Authorization: Bearer <access_token>
```

#### Query Parameters
- `q` (required): Search query string
- `fields` (optional): Comma-separated list of fields to return
- `limit` (optional): Number of results to return (default: 20, max: 100)

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "searchRecords": [
    {
      "Id": "003XXXXXXXXXXXXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com",
      "Title": "Software Engineer"
    },
    {
      "Id": "003ZZZZZZZZZZZZZZZ",
      "FirstName": "Johnny",
      "LastName": "Test",
      "Email": "johnny.test@example.com",
      "Title": "QA Engineer"
    }
  ]
}
```

### 8. Bulk Operations

#### Bulk Create
```http
POST /api/sf/contacts/bulk
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operation": "create",
  "records": [
    {
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com"
    },
    {
      "FirstName": "Jane",
      "LastName": "Smith", 
      "Email": "jane.smith@example.com"
    }
  ]
}
```

#### Bulk Update
```http
POST /api/sf/contacts/bulk
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operation": "update",
  "records": [
    {
      "Id": "003XXXXXXXXXXXXXXX",
      "Title": "Senior Engineer"
    },
    {
      "Id": "003YYYYYYYYYYYYYYY",
      "Title": "Senior Manager"
    }
  ]
}
```

#### Bulk Delete
```http
POST /api/sf/contacts/bulk
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operation": "delete",
  "ids": [
    "003XXXXXXXXXXXXXXX",
    "003YYYYYYYYYYYYYYY"
  ]
}
```

#### Bulk Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "hasErrors": false,
  "results": [
    {
      "id": "003XXXXXXXXXXXXXXX",
      "success": true,
      "created": true
    },
    {
      "id": "003YYYYYYYYYYYYYYY",
      "success": true,
      "created": true
    }
  ]
}
```

---

## Performance & Monitoring Endpoints

### 1. Health Check

#### Request
```http
GET /api/health
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "salesforce": "connected",
    "database": "connected",
    "memory": "ok"
  }
}
```

### 2. Performance Metrics

#### Request
```http
GET /api/metrics
Authorization: Bearer <access_token>
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "requests": {
    "total": 1000,
    "successful": 995,
    "failed": 5,
    "averageResponseTime": 245
  },
  "operations": {
    "authentication": {
      "count": 50,
      "averageTime": 1200,
      "successRate": 0.98
    },
    "createContact": {
      "count": 200,
      "averageTime": 180,
      "successRate": 0.995
    },
    "getContact": {
      "count": 500,
      "averageTime": 120,
      "successRate": 0.999
    }
  },
  "system": {
    "memoryUsage": 45.2,
    "cpuUsage": 12.5,
    "uptime": 3600
  }
}
```

### 3. Performance Benchmark

#### Request
```http
POST /api/benchmark
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operation": "create_contact",
  "iterations": 100,
  "concurrency": 10,
  "implementation": "sdk"
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "operation": "create_contact",
  "implementation": "sdk",
  "iterations": 100,
  "concurrency": 10,
  "duration": 15.5,
  "averageResponseTime": 155,
  "minResponseTime": 89,
  "maxResponseTime": 450,
  "successRate": 0.99,
  "throughput": 6.45,
  "errors": [
    {
      "type": "RATE_LIMIT",
      "count": 1,
      "percentage": 0.01
    }
  ]
}
```

---

## Error Handling

### Standard Error Response Format
```http
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "statusCode": 400,
      "field": "fieldName",
      "value": "invalidValue"
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_123456789"
  }
}
```

### Error Codes

#### Authentication Errors
- `AUTHENTICATION_REQUIRED` (401): No valid authentication provided
- `AUTHENTICATION_FAILURE` (401): Invalid credentials
- `TOKEN_EXPIRED` (401): Access token has expired
- `INVALID_TOKEN` (401): Token format is invalid
- `INSUFFICIENT_SCOPE` (403): Token lacks required permissions

#### Validation Errors
- `VALIDATION_ERROR` (400): Input validation failed
- `REQUIRED_FIELD_MISSING` (400): Required field not provided
- `INVALID_FIELD_VALUE` (400): Field value is invalid
- `DUPLICATE_VALUE` (409): Duplicate value detected

#### Resource Errors
- `NOT_FOUND` (404): Requested resource not found
- `ALREADY_EXISTS` (409): Resource already exists
- `DELETED` (410): Resource has been deleted

#### Rate Limiting
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `QUOTA_EXCEEDED` (429): API quota exceeded

#### System Errors
- `INTERNAL_ERROR` (500): Internal server error
- `SALESFORCE_ERROR` (502): Salesforce API error
- `TIMEOUT` (504): Request timeout
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

### Rate Limiting Headers
```http
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1642248600
X-RateLimit-Window: 3600
```

---

## Go Implementation Specific Endpoints

### 1. SDK vs REST Comparison

#### Request
```http
POST /api/compare
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operation": "create_contact",
  "iterations": 50,
  "contact": {
    "FirstName": "Test",
    "LastName": "User",
    "Email": "test.user@example.com"
  }
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "comparison": {
    "sdk": {
      "averageTime": 145,
      "minTime": 89,
      "maxTime": 250,
      "memoryUsage": 2.1,
      "successRate": 1.0
    },
    "rest": {
      "averageTime": 132,
      "minTime": 85,
      "maxTime": 220,
      "memoryUsage": 1.8,
      "successRate": 1.0
    },
    "winner": "rest",
    "recommendation": "REST API shows better performance for this operation"
  }
}
```

### 2. Memory Profiling

#### Request
```http
GET /api/debug/pprof/heap
Authorization: Bearer <access_token>
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/octet-stream

[Binary heap profile data]
```

---

## Request/Response Examples

### Complete Contact Workflow

#### 1. Authenticate
```bash
curl -X POST http://localhost:3000/api/sf/auth/username-password \
  -H "Content-Type: application/json" \
  -d '{
    "instanceUrl": "https://xxx.my.salesforce.com",
    "clientId": "3MVG9...",
    "clientSecret": "xxxxx",
    "username": "user@example.com",
    "password": "password123"
  }'
```

#### 2. Create Contact
```bash
curl -X POST http://localhost:3000/api/sf/contacts \
  -H "Authorization: Bearer 00D..." \
  -H "Content-Type: application/json" \
  -d '{
    "FirstName": "John",
    "LastName": "Doe",
    "Email": "john.doe@example.com"
  }'
```

#### 3. Get Contact
```bash
curl -X GET http://localhost:3000/api/sf/contacts/003XXXXXXXXXXXXXXX \
  -H "Authorization: Bearer 00D..."
```

#### 4. Update Contact
```bash
curl -X PUT http://localhost:3000/api/sf/contacts/003XXXXXXXXXXXXXXX \
  -H "Authorization: Bearer 00D..." \
  -H "Content-Type: application/json" \
  -d '{
    "Title": "Senior Software Engineer"
  }'
```

#### 5. Delete Contact
```bash
curl -X DELETE http://localhost:3000/api/sf/contacts/003XXXXXXXXXXXXXXX \
  -H "Authorization: Bearer 00D..."
```

---

## SDK Usage Examples (Go)

### Authentication
```go
config := auth.AuthConfig{
    InstanceURL:  "https://xxx.my.salesforce.com",
    ClientID:     "3MVG9...",
    ClientSecret: "xxxxx",
    Username:     "user@example.com",
    Password:     "password123",
}

session, err := client.Authenticate(config)
if err != nil {
    log.Fatal(err)
}
```

### Create Contact
```go
contact := contacts.Contact{
    FirstName: "John",
    LastName:  "Doe",
    Email:     "john.doe@example.com",
}

response, err := client.CreateContact(session, contact)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Created contact with ID: %s\n", response.ID)
```

### Search Contacts
```go
results, err := client.SearchContacts(session, "john", []string{"FirstName", "LastName", "Email"})
if err != nil {
    log.Fatal(err)
}

for _, contact := range results.Records {
    fmt.Printf("%s %s - %s\n", contact.FirstName, contact.LastName, contact.Email)
}
```

---

*This API documentation provides comprehensive coverage of all available endpoints for both Node.js and Go implementations. All examples include proper error handling and response formats.* 