# HubSpot API Specification

This document provides complete API endpoint specifications for the HubSpot integration, following the same patterns established for Salesforce integration.

## Base Configuration

### API Base URLs
- **HubSpot API Base**: `https://api.hubapi.com`
- **OAuth Base**: `https://app.hubspot.com/oauth`
- **Application Base**: `http://localhost:3000` (development) / `https://yourdomain.com` (production)

### Authentication
All HubSpot API endpoints require Bearer token authentication:
```
Authorization: Bearer {access_token}
```

## OAuth Authentication Endpoints

### 1. Initiate OAuth Flow

**Endpoint**: `GET /api/hs/auth/login`

**Description**: Initiates HubSpot OAuth 2.0 Authorization Code flow

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "authUrl": "https://app.hubspot.com/oauth/authorize?client_id=...&redirect_uri=...&scope=...&response_type=code&state=...",
  "message": "Redirect user to this URL for authentication"
}
```

**Response Error (500)**:
```json
{
  "success": false,
  "error": "HubSpot OAuth configuration incomplete",
  "troubleshooting": [
    "Check your .env file contains:",
    "HS_CLIENT_ID=your_client_id",
    "HS_CLIENT_SECRET=your_client_secret"
  ]
}
```

### 2. OAuth Callback Handler

**Endpoint**: `GET /api/hs/auth/callback`

**Description**: Handles OAuth callback from HubSpot and exchanges code for tokens

**Query Parameters**:
- `code` (string): Authorization code from HubSpot
- `state` (string): State parameter for CSRF protection
- `error` (string, optional): Error code if authorization failed

**Response**: Redirects to:
- `/?hubspot_auth=success` on success
- `/?error={error_code}` on failure

### 3. Refresh Access Token

**Endpoint**: `POST /api/hs/auth/refresh`

**Description**: Refreshes expired access token using refresh token

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "expiresIn": 21600
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

**Endpoint**: `GET /api/hs/auth/status`

**Description**: Checks current HubSpot authentication status

**Request**: No body required

**Response Success (200)**:
```json
{
  "authenticated": true,
  "message": "Authenticated with HubSpot",
  "tokenInfo": {
    "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write", "oauth"],
    "hubId": 12345678,
    "appId": 987654,
    "expiresAt": "2025-07-29T15:30:00.000Z"
  }
}
```

**Response Unauthenticated (200)**:
```json
{
  "authenticated": false,
  "message": "Not authenticated with HubSpot"
}
```

### 5. Logout

**Endpoint**: `POST /api/hs/auth/logout`

**Description**: Clears HubSpot authentication tokens

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Logged out from HubSpot successfully"
}
```

## Contact Management Endpoints

### 1. Create Contact

**Endpoint**: `POST /api/hs/contacts`

**Description**: Creates a new contact in HubSpot

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "firstname": "John",
  "lastname": "Doe",
  "phone": "+1234567890",
  "company": "Example Corp",
  "website": "https://example.com",
  "jobtitle": "Software Engineer"
}
```

**Response Success (201)**:
```json
{
  "id": "12345678901",
  "success": true,
  "created": true,
  "properties": {
    "email": "john.doe@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "createdate": "2025-07-29T12:00:00.000Z"
  }
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
          "field": "email",
          "message": "Email is required for contact creation"
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
    "message": "Not authenticated with HubSpot"
  }
}
```

### 2. Get Contact by ID

**Endpoint**: `GET /api/hs/contacts/:id`

**Description**: Retrieves a specific contact by HubSpot contact ID

**URL Parameters**:
- `id` (string): HubSpot contact ID

**Query Parameters** (optional):
- `properties` (string): Comma-separated list of properties to retrieve
  - Default: `firstname,lastname,email,phone,company,website,jobtitle,createdate,lastmodifieddate`

**Response Success (200)**:
```json
{
  "id": "12345678901",
  "properties": {
    "email": "john.doe@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "phone": "+1234567890",
    "company": "Example Corp",
    "website": "https://example.com",
    "jobtitle": "Software Engineer",
    "createdate": "2025-07-29T12:00:00.000Z",
    "lastmodifieddate": "2025-07-29T12:30:00.000Z"
  },
  "createdAt": "2025-07-29T12:00:00.000Z",
  "updatedAt": "2025-07-29T12:30:00.000Z"
}
```

**Response Error (404)**:
```json
{
  "error": {
    "code": "CONTACT_NOT_FOUND",
    "message": "Contact with ID 12345678901 not found"
  }
}
```

### 3. List Contacts

**Endpoint**: `GET /api/hs/contacts`

**Description**: Retrieves a paginated list of contacts

**Query Parameters** (optional):
- `limit` (number): Number of contacts to retrieve (default: 20, max: 100)
- `after` (string): Pagination cursor for next page
- `properties` (string): Comma-separated list of properties to retrieve
- `sort` (string): Property to sort by (e.g., `createdate`, `lastname`)
- `order` (string): Sort order (`asc` or `desc`, default: `desc`)

**Response Success (200)**:
```json
{
  "results": [
    {
      "id": "12345678901",
      "properties": {
        "email": "john.doe@example.com",
        "firstname": "John",
        "lastname": "Doe",
        "phone": "+1234567890",
        "company": "Example Corp",
        "createdate": "2025-07-29T12:00:00.000Z"
      }
    }
  ],
  "paging": {
    "next": {
      "after": "next_cursor_token"
    },
    "prev": {
      "before": "prev_cursor_token"
    }
  },
  "total": 150,
  "hasMore": true
}
```

### 4. Search Contacts

**Endpoint**: `GET /api/hs/contacts/search`

**Description**: Searches contacts using HubSpot's search API

**Query Parameters**:
- `query` (string, required): Search term
- `limit` (number): Number of results (default: 20, max: 100)
- `properties` (string): Comma-separated list of properties to retrieve

**Response Success (200)**:
```json
{
  "results": [
    {
      "id": "12345678901",
      "properties": {
        "email": "john.doe@example.com",
        "firstname": "John",
        "lastname": "Doe",
        "phone": "+1234567890"
      }
    }
  ],
  "total": 3,
  "query": "john"
}
```

### 5. Update Contact

**Endpoint**: `PUT /api/hs/contacts/:id`

**Description**: Updates an existing contact (full update)

**URL Parameters**:
- `id` (string): HubSpot contact ID

**Request Body**:
```json
{
  "email": "john.updated@example.com",
  "firstname": "John",
  "lastname": "Doe Updated",
  "phone": "+1234567890",
  "company": "New Company Inc",
  "jobtitle": "Senior Software Engineer"
}
```

**Response Success (200)**:
```json
{
  "id": "12345678901",
  "success": true,
  "updated": true,
  "properties": {
    "email": "john.updated@example.com",
    "firstname": "John",
    "lastname": "Doe Updated",
    "lastmodifieddate": "2025-07-29T14:00:00.000Z"
  }
}
```

### 6. Partial Update Contact

**Endpoint**: `PATCH /api/hs/contacts/:id`

**Description**: Partially updates an existing contact

**URL Parameters**:
- `id` (string): HubSpot contact ID

**Request Body**:
```json
{
  "jobtitle": "Lead Software Engineer",
  "company": "Updated Company"
}
```

**Response Success (200)**:
```json
{
  "id": "12345678901",
  "success": true,
  "updated": true,
  "updatedFields": ["jobtitle", "company"],
  "properties": {
    "jobtitle": "Lead Software Engineer",
    "company": "Updated Company",
    "lastmodifieddate": "2025-07-29T14:15:00.000Z"
  }
}
```

### 7. Delete Contact

**Endpoint**: `DELETE /api/hs/contacts/:id`

**Description**: Deletes a contact from HubSpot

**URL Parameters**:
- `id` (string): HubSpot contact ID

**Request**: No body required

**Response Success (200)**:
```json
{
  "success": true,
  "deleted": true,
  "id": "12345678901",
  "message": "Contact deleted successfully"
}
```

**Response Error (404)**:
```json
{
  "error": {
    "code": "CONTACT_NOT_FOUND",
    "message": "Contact with ID 12345678901 not found"
  }
}
```

### 8. Bulk Contact Operations

**Endpoint**: `POST /api/hs/contacts/bulk`

**Description**: Performs bulk operations on contacts

**Request Body**:
```json
{
  "operation": "create",
  "contacts": [
    {
      "email": "contact1@example.com",
      "firstname": "Contact",
      "lastname": "One"
    },
    {
      "email": "contact2@example.com",
      "firstname": "Contact",
      "lastname": "Two"
    }
  ]
}
```

**Available Operations**:
- `create`: Create multiple contacts
- `update`: Update multiple contacts (requires `id` field)
- `delete`: Delete multiple contacts (requires `id` field)

**Response Success (200)**:
```json
{
  "success": true,
  "operation": "create",
  "results": [
    {
      "id": "12345678901",
      "success": true,
      "email": "contact1@example.com"
    },
    {
      "id": "12345678902",
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

- `AUTHENTICATION_REQUIRED`: Not authenticated with HubSpot
- `INVALID_TOKEN`: Access token is invalid or expired
- `INSUFFICIENT_SCOPE`: Token doesn't have required permissions
- `VALIDATION_ERROR`: Request data validation failed
- `CONTACT_NOT_FOUND`: Requested contact doesn't exist
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `INTERNAL_ERROR`: Server-side error occurred

## Rate Limiting

HubSpot API implements rate limiting:
- **Daily Limit**: 40,000 requests per day
- **Burst Limit**: 100 requests per 10 seconds
- **Contact Creation**: 100 contacts per request (bulk operations)

### Rate Limit Headers
```
X-HubSpot-RateLimit-Daily: 40000
X-HubSpot-RateLimit-Daily-Remaining: 39850
X-HubSpot-RateLimit-Secondly: 10
X-HubSpot-RateLimit-Secondly-Remaining: 9
```

### Rate Limit Error Response (429)
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "details": {
      "retryAfter": 60,
      "dailyLimit": 40000,
      "dailyRemaining": 0
    }
  }
}
```

## HubSpot API Mapping

### Contact Properties Mapping
```javascript
// HubSpot Property -> Application Field
const HUBSPOT_PROPERTY_MAPPING = {
  email: 'email',
  firstname: 'firstName',
  lastname: 'lastName',
  phone: 'phone',
  company: 'company',
  website: 'website',
  jobtitle: 'jobTitle',
  createdate: 'createdDate',
  lastmodifieddate: 'modifiedDate'
};
```

### API Endpoints Used
- **Contacts API**: `/crm/v3/objects/contacts`
- **Search API**: `/crm/v3/objects/contacts/search`
- **Batch API**: `/crm/v3/objects/contacts/batch`
- **OAuth API**: `/oauth/v1/token`
- **Token Info**: `/oauth/v1/access-tokens/{token}`

## Testing Endpoints

See [`hubspot-api-testing-guide.md`](./hubspot-api-testing-guide.md) for comprehensive API testing strategies.

## Next Steps

1. Review [`hubspot-contact-crud-specification.md`](./hubspot-contact-crud-specification.md) for detailed contact operations
2. Check [`hubspot-error-handling-guide.md`](./hubspot-error-handling-guide.md) for error handling patterns
3. Follow [`hubspot-integration-plan.md`](./hubspot-integration-plan.md) for implementation roadmap