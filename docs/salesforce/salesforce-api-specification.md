# Salesforce API Specification

This document provides comprehensive API endpoint specifications for the Salesforce integration, following OAuth 2.0 Authorization Code flow patterns.

## Base Configuration

### API Base URLs
- **Salesforce API Base**: `https://login.salesforce.com` (or custom domain)
- **Application Base**: `http://localhost:3000` (development) / `https://yourdomain.com` (production)

### Authentication
All Salesforce API endpoints require Bearer token authentication:
```
Authorization: Bearer {access_token}
```

## OAuth Authentication Endpoints

### 1. Initiate OAuth Flow

**Endpoint**: `GET /api/sf/auth/login`

**Description**: Initiates Salesforce OAuth 2.0 Authorization Code flow with PKCE

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?client_id=...&redirect_uri=...&scope=...&response_type=code&state=...&code_challenge=...&code_challenge_method=S256",
  "message": "Redirect user to this URL for authentication"
}
```

**Response Error (500)**:
```json
{
  "success": false,
  "error": "OAuth configuration incomplete",
  "troubleshooting": [
    "Check your .env file contains:",
    "SF_CLIENT_ID=your_consumer_key",
    "SF_CLIENT_SECRET=your_consumer_secret"
  ]
}
```

### 2. OAuth Callback Handler

**Endpoint**: `GET /api/sf/auth/callback`

**Description**: Handles OAuth callback from Salesforce and exchanges code for tokens

**Query Parameters**:
- `code` (string): Authorization code from Salesforce
- `state` (string): State parameter for CSRF protection
- `error` (string, optional): Error code if authorization failed

**Response**: Redirects to:
- `/?auth=success` on success
- `/?error={error_code}` on failure

### 3. Refresh Access Token

**Endpoint**: `POST /api/sf/auth/refresh`

**Description**: Refreshes expired access token using refresh token

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "expiresIn": 7200
}
```

**Response Error (401)**:
```json
{
  "error": {
    "code": "NO_REFRESH_TOKEN",
    "message": "No refresh token available"
  }
}
```

### 4. Check Authentication Status

**Endpoint**: `GET /api/sf/auth/status`

**Description**: Checks current Salesforce authentication status and user info

**Request**: No body required

**Response Success (200)**:
```json
{
  "authenticated": true,
  "message": "Authenticated with Salesforce",
  "userInfo": {
    "userId": "005XXXXXXXXXXXXXXX",
    "organizationId": "00DXXXXXXXXXXXXXXX",
    "instanceUrl": "https://mydomain.my.salesforce.com"
  }
}
```

**Response Unauthenticated (200)**:
```json
{
  "authenticated": false,
  "message": "Not authenticated with Salesforce"
}
```

### 5. Logout

**Endpoint**: `POST /api/sf/auth/logout`

**Description**: Clears Salesforce authentication tokens

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Contact Management Endpoints

### 1. Create Contact

**Endpoint**: `POST /api/sf/contacts`

**Description**: Creates a new contact in Salesforce

**Request Body**:
```json
{
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john.doe@example.com",
  "Phone": "+1234567890",
  "Title": "Software Engineer",
  "Department": "Engineering"
}
```

**Response Success (201)**:
```json
{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true,
  "created": true
}
```

**Response Error (400)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required fields are missing",
    "details": {
      "fields": [
        {
          "field": "LastName",
          "message": "Last name is required"
        }
      ]
    }
  }
}
```

**Response Error (401)**:
```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Not authenticated with Salesforce"
  }
}
```

### 2. Get Contact by ID

**Endpoint**: `GET /api/sf/contacts/:id`

**Description**: Retrieves a specific contact by Salesforce contact ID

**URL Parameters**:
- `id` (string): Salesforce contact ID

**Query Parameters** (optional):
- `fields` (string): Comma-separated list of fields to retrieve
  - Default: `Id,FirstName,LastName,Email,Phone,Title,Department,CreatedDate,LastModifiedDate`

**Response Success (200)**:
```json
{
  "Id": "003XXXXXXXXXXXXXXX",
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john.doe@example.com",
  "Phone": "+1234567890",
  "Title": "Software Engineer",
  "Department": "Engineering",
  "CreatedDate": "2025-07-29T12:00:00.000+0000",
  "LastModifiedDate": "2025-07-29T12:30:00.000+0000"
}
```

**Response Error (404)**:
```json
{
  "error": {
    "code": "CONTACT_NOT_FOUND",
    "message": "Contact with ID 003XXXXXXXXXXXXXXX not found"
  }
}
```

### 3. List Contacts

**Endpoint**: `GET /api/sf/contacts`

**Description**: Retrieves a paginated list of contacts using SOQL

**Query Parameters** (optional):
- `limit` (number): Number of contacts to retrieve (default: 20, max: 200)
- `offset` (number): Number of records to skip (default: 0)
- `orderBy` (string): Field to sort by (default: `CreatedDate`)
- `order` (string): Sort order (`ASC` or `DESC`, default: `DESC`)

**Response Success (200)**:
```json
{
  "totalSize": 150,
  "done": true,
  "records": [
    {
      "Id": "003XXXXXXXXXXXXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com",
      "Phone": "+1234567890",
      "CreatedDate": "2025-07-29T12:00:00.000+0000"
    }
  ]
}
```

### 4. Search Contacts

**Endpoint**: `GET /api/sf/contacts/search`

**Description**: Searches contacts using Salesforce SOSL

**Query Parameters**:
- `q` (string, required): Search term
- `fields` (string): Comma-separated list of fields to retrieve

**Response Success (200)**:
```json
{
  "searchRecords": [
    {
      "Id": "003XXXXXXXXXXXXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com",
      "Phone": "+1234567890"
    }
  ]
}
```

### 5. Update Contact

**Endpoint**: `PUT /api/sf/contacts/:id`

**Description**: Updates an existing contact (full update)

**URL Parameters**:
- `id` (string): Salesforce contact ID

**Request Body**:
```json
{
  "FirstName": "John",
  "LastName": "Doe Updated",
  "Email": "john.updated@example.com",
  "Phone": "+1234567890",
  "Title": "Senior Software Engineer"
}
```

**Response Success (200)**:
```json
{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true,
  "updated": true
}
```

### 6. Partial Update Contact

**Endpoint**: `PATCH /api/sf/contacts/:id`

**Description**: Partially updates an existing contact

**URL Parameters**:
- `id` (string): Salesforce contact ID

**Request Body**:
```json
{
  "Title": "Lead Software Engineer",
  "Department": "Advanced Engineering"
}
```

**Response Success (200)**:
```json
{
  "id": "003XXXXXXXXXXXXXXX",
  "success": true,
  "updated": true,
  "updatedFields": ["Title", "Department"]
}
```

### 7. Delete Contact

**Endpoint**: `DELETE /api/sf/contacts/:id`

**Description**: Deletes a contact from Salesforce

**URL Parameters**:
- `id` (string): Salesforce contact ID

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "deleted": true,
  "id": "003XXXXXXXXXXXXXXX",
  "message": "Contact deleted successfully"
}
```

**Response Error (404)**:
```json
{
  "error": {
    "code": "CONTACT_NOT_FOUND",
    "message": "Contact with ID 003XXXXXXXXXXXXXXX not found"
  }
}
```

### 8. Bulk Contact Operations

**Endpoint**: `POST /api/sf/contacts/bulk`

**Description**: Performs bulk operations on contacts

**Request Body**:
```json
{
  "operation": "create",
  "contacts": [
    {
      "FirstName": "Contact",
      "LastName": "One",
      "Email": "contact1@example.com"
    },
    {
      "FirstName": "Contact",
      "LastName": "Two",
      "Email": "contact2@example.com"
    }
  ]
}
```

**Available Operations**:
- `create`: Create multiple contacts
- `update`: Update multiple contacts (requires `Id` field)
- `delete`: Delete multiple contacts (requires `Id` field)

**Response Success (200)**:
```json
{
  "success": true,
  "operation": "create",
  "results": [
    {
      "id": "003XXXXXXXXXXXXXXX",
      "success": true,
      "email": "contact1@example.com"
    },
    {
      "id": "003YYYYYYYYYYYYYYY",
      "success": true,
      "email": "contact2@example.com"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

## Legacy Endpoints

### Create Lead

**Endpoint**: `POST /api/sf/leads`

**Description**: Creates a new lead in Salesforce

**Request Body**:
```json
{
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john.doe@example.com",
  "Company": "Example Corp"
}
```

**Response Success (201)**:
```json
{
  "id": "00QXXXXXXXXXXXXXXX",
  "success": true
}
```

### Get Recent Leads

**Endpoint**: `GET /api/sf/leads`

**Description**: Retrieves recent leads

**Response Success (200)**:
```json
{
  "totalSize": 50,
  "done": true,
  "records": [
    {
      "Id": "00QXXXXXXXXXXXXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john.doe@example.com",
      "Company": "Example Corp"
    }
  ]
}
```

### Get Recent Accounts

**Endpoint**: `GET /api/sf/accounts`

**Description**: Retrieves recent accounts

**Response Success (200)**:
```json
{
  "totalSize": 25,
  "done": true,
  "records": [
    {
      "Id": "001XXXXXXXXXXXXXXX",
      "Name": "Example Corp",
      "Type": "Customer",
      "Industry": "Technology"
    }
  ]
}
```

## Error Response Format

All endpoints follow consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "Detailed explanation"
    }
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED`: Not authenticated with Salesforce
- `INVALID_TOKEN`: Access token is invalid or expired
- `INSUFFICIENT_SCOPE`: Token doesn't have required permissions
- `VALIDATION_ERROR`: Request data validation failed
- `CONTACT_NOT_FOUND`: Requested contact doesn't exist
- `RATE_LIMIT_EXCEEDED`: Salesforce API rate limit exceeded
- `INTERNAL_ERROR`: Server-side error occurred

## Rate Limiting

Salesforce API implements rate limiting based on your org's limits:
- **Daily API Requests**: Varies by edition (Developer: 15,000/day)
- **Concurrent Requests**: 25 concurrent requests per org
- **Bulk API**: Separate limits for bulk operations

### Rate Limit Headers
```
X-SF-RateLimit-Limit: 15000
X-SF-RateLimit-Remaining: 14850
X-SF-RateLimit-Reset: 1643723400
```

### Rate Limit Error Response (429)
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Salesforce API rate limit exceeded",
    "details": {
      "retryAfter": 3600,
      "dailyLimit": 15000,
      "dailyRemaining": 0
    }
  }
}
```

## Salesforce API Mapping

### Contact Fields Mapping
```javascript
// Standard Salesforce Contact Fields
const SF_CONTACT_FIELDS = {
  Id: 'Salesforce Record ID',
  FirstName: 'First Name',
  LastName: 'Last Name (Required)',
  Email: 'Email Address',
  Phone: 'Phone Number',
  Title: 'Job Title',
  Department: 'Department',
  AccountId: 'Related Account ID',
  CreatedDate: 'Record Creation Date',
  LastModifiedDate: 'Last Modified Date'
};
```

### API Endpoints Used
- **REST API**: `/services/data/v58.0/`
- **OAuth API**: `/services/oauth2/`
- **SOQL Queries**: `/services/data/v58.0/query`
- **SOSL Search**: `/services/data/v58.0/search`

## Testing Endpoints

For comprehensive API testing strategies, see the Salesforce testing documentation.

## Next Steps

1. Review [salesforce-setup-guide.md](./salesforce-setup-guide.md) for setup instructions
2. Check [salesforce-authorization-code-implementation.md](./salesforce-authorization-code-implementation.md) for technical details
3. Follow [salesforce-error-handling-guide.md](./salesforce-error-handling-guide.md) for error handling patterns