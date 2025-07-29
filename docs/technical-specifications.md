# Technical Specifications

## System Architecture

### Overview
The CRM integration system provides unified access to multiple CRM platforms:
1. **Node.js/Express Proxy Server** - Main application server
2. **Salesforce Integration** - OAuth 2.0 + REST API integration  
3. **HubSpot Integration** - OAuth 2.0 + REST API integration

### Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │───▶│  Node.js Proxy  │───▶│   Salesforce    │
│    (Client)     │    │     Server      │    │      Org        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │     HubSpot     │
                       │   CRM via API   │
                       └─────────────────┘
```

---

## Node.js Implementation Specifications

### Core Dependencies
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5", 
  "node-fetch": "^2.7.0",
  "jsonwebtoken": "^9.0.0",
  "dotenv": "^16.0.3"
}
```

### Authentication Module Specifications

#### OAuth 2.0 Flows Implementation

##### 1. Username/Password Flow
```javascript
Endpoint: POST /api/sf/auth/username-password
Request Body:
{
  "instanceUrl": "https://xxx.my.salesforce.com",
  "clientId": "3MVG9...",
  "clientSecret": "xxxxx",
  "username": "user@example.com",
  "password": "password123"
}

Response:
{
  "accessToken": "00D...",
  "refreshToken": "5Aep...",
  "instanceUrl": "https://xxx.my.salesforce.com",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

##### 2. Authorization Code Flow
```javascript
Endpoint: GET /api/sf/auth/authorize
Query Parameters:
- response_type=code
- client_id=<client_id>
- redirect_uri=<callback_url>
- scope=api refresh_token

Callback: GET /api/sf/auth/callback
Query Parameters:
- code=<authorization_code>
- state=<state_parameter>
```

##### 3. Refresh Token Flow
```javascript
Endpoint: POST /api/sf/auth/refresh
Request Body:
{
  "refreshToken": "5Aep...",
  "clientId": "3MVG9...",
  "clientSecret": "xxxxx"
}
```

### Contact CRUD Specifications

#### Data Models
```javascript
Contact Model:
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

#### API Endpoints

##### Create Contact
```javascript
POST /api/sf/contacts
Content-Type: application/json

Request Body:
{
  "FirstName": "John",
  "LastName": "Doe", 
  "Email": "john.doe@example.com",
  "Phone": "+1-555-123-4567",
  "Title": "Software Engineer"
}

Response: 201 Created
{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true,
  "created": true
}
```

##### Read Contact
```javascript
GET /api/sf/contacts/:id

Response: 200 OK
{
  "Id": "003XXXXXXXXXXXXXXX",
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john.doe@example.com",
  "Phone": "+1-555-123-4567",
  "Title": "Software Engineer"
}
```

##### Update Contact
```javascript
PUT /api/sf/contacts/:id
Content-Type: application/json

Request Body:
{
  "Title": "Senior Software Engineer",
  "Phone": "+1-555-987-6543"
}

Response: 200 OK
{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true
}
```

##### Delete Contact
```javascript
DELETE /api/sf/contacts/:id

Response: 204 No Content
```

##### List Contacts
```javascript
GET /api/sf/contacts?limit=20&offset=0

Response: 200 OK
{
  "totalSize": 150,
  "done": false,
  "nextRecordsUrl": "/services/data/v58.0/query/01g...",
  "records": [
    {
      "Id": "003XXXXXXXXXXXXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com"
    }
  ]
}
```

##### Search Contacts
```javascript
GET /api/sf/contacts/search?q=john&fields=FirstName,LastName,Email

Response: 200 OK
{
  "searchRecords": [
    {
      "Id": "003XXXXXXXXXXXXXXX", 
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com"
    }
  ]
}
```

### Error Handling Specifications

#### Error Response Format
```javascript
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
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_123456789"
  }
}
```

#### Rate Limiting Implementation
```javascript
Rate Limit Headers:
- X-RateLimit-Limit: 5000
- X-RateLimit-Remaining: 4999
- X-RateLimit-Reset: 1642248600

Rate Limit Response (429):
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 60 seconds",
    "retryAfter": 60
  }
}
```

---

## HubSpot Integration Specifications

### HubSpot API Configuration
- **Base URL**: `https://api.hubapi.com`
- **OAuth URL**: `https://app.hubspot.com/oauth/authorize`
- **API Version**: v3 (Contacts API)
- **Authentication**: OAuth 2.0 Authorization Code flow

### Required Scopes
```
crm.objects.contacts.read
crm.objects.contacts.write  
oauth
```

### Environment Variables
```bash
HS_CLIENT_ID=your_hubspot_client_id
HS_CLIENT_SECRET=your_hubspot_client_secret
HS_REDIRECT_URI=http://localhost:3000/api/hs/auth/callback
HS_SCOPE=crm.objects.contacts.read crm.objects.contacts.write oauth
```
