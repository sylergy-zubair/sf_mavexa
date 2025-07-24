# Technical Specifications

## System Architecture

### Overview
The Salesforce technical validation system consists of two parallel implementations:
1. **Node.js/Express Proxy Server** - Enhanced existing implementation
2. **Go Application** - New implementation for comparison

### Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │───▶│  Node.js Proxy  │───▶│   Salesforce    │
│    (Client)     │    │     Server      │    │      Org        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Go SDK/REST   │
                       │  Implementation │
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

## Go Implementation Specifications

### Project Structure
```
go-salesforce/
├── cmd/
│   └── main.go
├── pkg/
│   ├── auth/
│   │   ├── oauth.go
│   │   ├── session.go
│   │   └── types.go
│   ├── contacts/
│   │   ├── crud.go
│   │   ├── models.go
│   │   └── service.go
│   ├── api/
│   │   ├── rest_client.go
│   │   ├── sdk_client.go
│   │   └── interface.go
│   ├── benchmarks/
│   │   ├── performance.go
│   │   └── comparison.go
│   └── common/
│       ├── errors.go
│       ├── config.go
│       └── logging.go
├── tests/
│   ├── integration/
│   └── benchmarks/
├── docs/
├── go.mod
└── go.sum
```

### Dependencies
```go
require (
    github.com/go-resty/resty/v2 v2.7.0
    github.com/golang-jwt/jwt/v4 v4.5.0
    github.com/gorilla/mux v1.8.0
    github.com/joho/godotenv v1.4.0
    github.com/stretchr/testify v1.8.4
)
```

### Data Models

#### Authentication
```go
type AuthConfig struct {
    InstanceURL  string `json:"instanceUrl"`
    ClientID     string `json:"clientId"`
    ClientSecret string `json:"clientSecret"`
    Username     string `json:"username"`
    Password     string `json:"password"`
}

type AuthResponse struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    InstanceURL  string `json:"instance_url"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
}

type Session struct {
    AccessToken  string
    RefreshToken string
    InstanceURL  string
    ExpiresAt    time.Time
    ClientID     string
    ClientSecret string
}
```

#### Contact Model
```go
type Contact struct {
    ID               string    `json:"Id,omitempty"`
    FirstName        string    `json:"FirstName"`
    LastName         string    `json:"LastName"`
    Email            string    `json:"Email"`
    Phone            string    `json:"Phone,omitempty"`
    Title            string    `json:"Title,omitempty"`
    Department       string    `json:"Department,omitempty"`
    AccountID        string    `json:"AccountId,omitempty"`
    CreatedDate      time.Time `json:"CreatedDate,omitempty"`
    LastModifiedDate time.Time `json:"LastModifiedDate,omitempty"`
}

type ContactResponse struct {
    ID      string `json:"id"`
    Success bool   `json:"success"`
    Created bool   `json:"created,omitempty"`
    Errors  []struct {
        Message string `json:"message"`
        Fields  []string `json:"fields"`
    } `json:"errors,omitempty"`
}

type ContactListResponse struct {
    TotalSize        int       `json:"totalSize"`
    Done             bool      `json:"done"`
    NextRecordsURL   string    `json:"nextRecordsUrl,omitempty"`
    Records          []Contact `json:"records"`
}
```

### Interface Definitions

#### API Client Interface
```go
type SalesforceClient interface {
    Authenticate(config AuthConfig) (*Session, error)
    RefreshToken(session *Session) error
    
    CreateContact(session *Session, contact Contact) (*ContactResponse, error)
    GetContact(session *Session, id string) (*Contact, error)
    UpdateContact(session *Session, id string, contact Contact) (*ContactResponse, error)
    DeleteContact(session *Session, id string) error
    ListContacts(session *Session, limit, offset int) (*ContactListResponse, error)
    SearchContacts(session *Session, query string, fields []string) (*ContactListResponse, error)
}
```

#### Performance Benchmarking
```go
type BenchmarkResult struct {
    Operation     string        `json:"operation"`
    Implementation string       `json:"implementation"`
    RequestCount  int           `json:"requestCount"`
    Duration      time.Duration `json:"duration"`
    AvgLatency    time.Duration `json:"avgLatency"`
    MinLatency    time.Duration `json:"minLatency"`
    MaxLatency    time.Duration `json:"maxLatency"`
    ErrorCount    int           `json:"errorCount"`
    MemoryUsage   int64         `json:"memoryUsage"`
}

type ComparisonReport struct {
    TestDate    time.Time         `json:"testDate"`
    Environment string           `json:"environment"`
    Results     []BenchmarkResult `json:"results"`
    Summary     struct {
        Winner         string `json:"winner"`
        Performance    string `json:"performance"`
        MemoryUsage    string `json:"memoryUsage"`
        Maintainability string `json:"maintainability"`
    } `json:"summary"`
}
```

---

## Database & Storage Specifications

### Session Management
- **Node.js**: In-memory storage with Redis option for production
- **Go**: In-memory with configurable persistence

### Configuration Management
```javascript
// Node.js - .env
SALESFORCE_INSTANCE_URL=https://xxx.my.salesforce.com
SALESFORCE_CLIENT_ID=3MVG9...
SALESFORCE_CLIENT_SECRET=xxxxx
SALESFORCE_USERNAME=user@example.com
SALESFORCE_PASSWORD=password123
SERVER_PORT=3000
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

```go
// Go - config.yaml
salesforce:
  instanceUrl: "https://xxx.my.salesforce.com"
  clientId: "3MVG9..."
  clientSecret: "xxxxx"
  username: "user@example.com"
  password: "password123"

server:
  port: 8080
  timeout: 30s

logging:
  level: "info"
  format: "json"

performance:
  maxConcurrentRequests: 100
  timeoutDuration: "30s"
```

---

## Security Specifications

### Token Security
- **Storage**: Encrypted in-memory storage
- **Transmission**: HTTPS only
- **Rotation**: Automatic refresh token rotation
- **Expiration**: Token expiration enforcement

### API Security
- **CORS**: Configurable CORS policies
- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: No sensitive data in error responses

### Environment Security
```javascript
Security Headers:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
```

---

## Performance Specifications

### Response Time Requirements
- **Authentication**: < 2 seconds
- **CRUD Operations**: < 1 second
- **Bulk Operations**: < 10 seconds (up to 100 records)
- **Search Operations**: < 3 seconds

### Concurrency Requirements
- **Node.js**: Support 50 concurrent requests
- **Go**: Support 100 concurrent requests
- **Memory Usage**: < 100MB under normal load

### Scalability Targets
- **Throughput**: 1000 requests/minute
- **Error Rate**: < 1% under normal conditions
- **Availability**: 99.9% uptime target

---

## Testing Specifications

### Unit Testing
- **Coverage**: Minimum 80% code coverage
- **Framework**: Jest (Node.js), Go testing package
- **Mocking**: Mock external API calls

### Integration Testing
- **Salesforce Sandbox**: Use developer sandbox for testing
- **End-to-End**: Full workflow testing
- **Error Scenarios**: Test all error conditions

### Performance Testing
- **Load Testing**: Simulate concurrent users
- **Stress Testing**: Test beyond normal capacity
- **Memory Testing**: Monitor for memory leaks

### Test Data
```javascript
Test Contacts:
[
  {
    "FirstName": "Test",
    "LastName": "User1",
    "Email": "test.user1@example.com"
  },
  {
    "FirstName": "Test", 
    "LastName": "User2",
    "Email": "test.user2@example.com"
  }
]
```

---

## Deployment Specifications

### Environment Requirements

#### Development
- **Node.js**: v18.x or higher
- **Go**: v1.21 or higher
- **Memory**: 2GB minimum
- **Storage**: 10GB available

#### Production (Recommended)
- **CPU**: 2 cores minimum
- **Memory**: 4GB minimum
- **Storage**: 20GB SSD
- **Network**: Low latency to Salesforce servers

### Configuration Management
- **Environment Variables**: All sensitive data
- **Configuration Files**: Non-sensitive settings
- **Version Control**: Configuration templates only

---

## Monitoring & Logging Specifications

### Logging Requirements
```javascript
Log Levels:
- ERROR: Authentication failures, API errors
- WARN: Rate limiting, retry attempts
- INFO: Successful operations, performance metrics
- DEBUG: Detailed request/response data

Log Format:
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "operation": "create_contact",
  "duration": 234,
  "status": "success",
  "requestId": "req_123456789"
}
```

### Metrics Collection
- **Response Times**: P50, P95, P99 percentiles
- **Error Rates**: By operation and error type
- **Throughput**: Requests per minute
- **Resource Usage**: CPU, memory, network

---

## API Versioning

### Salesforce API Version
- **Target Version**: v58.0 (Winter '24)
- **Fallback Support**: v57.0, v56.0
- **Version Detection**: Automatic version negotiation

### Internal API Versioning
- **URL Versioning**: `/api/v1/sf/contacts`
- **Header Versioning**: `Accept: application/json;version=1`
- **Backward Compatibility**: Maintain v1 support

---

*This document provides the complete technical specifications for the Salesforce technical validation project. All specifications are subject to review and updates based on implementation findings.* 