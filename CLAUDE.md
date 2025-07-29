# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Salesforce API integration test tool built with Node.js/Express that demonstrates OAuth 2.0 authentication flows and complete Contact CRUD operations. The application serves as a technical proof-of-concept for Salesforce API integration with both OAuth 2.0 Authorization Code flow and legacy Username/Password authentication.

## Core Architecture

### Main Components

- **`salesforce-proxy.js`** - Primary Express server with OAuth flows, API endpoints, and Contact CRUD operations
- **`salesforce-oauth.html`** - Frontend interface for Contact management with tabbed UI (Create, List, Search, Edit)
- **`test-sf-auth.js`** - Authentication testing utility
- **`docs/`** - Comprehensive technical documentation including OAuth guides, API specs, and implementation plans

### Authentication Architecture

The application implements dual authentication modes:
1. **OAuth 2.0 Authorization Code Flow** (recommended) - Full OAuth implementation with PKCE, state validation, and refresh tokens
2. **Username/Password Flow** (legacy) - Direct credential authentication for testing

Token management is handled in-memory with session-based storage. In production, this should be moved to a secure database or session store.

### API Structure

All Salesforce API endpoints are prefixed with `/api/sf/`:
- OAuth endpoints: `/api/sf/auth/*`
- Contact CRUD: `/api/sf/contacts/*`
- Legacy endpoints: `/api/sf/leads`, `/api/sf/accounts`

## Development Commands

### Start Commands
```bash
# Start development server
npm start

# Start with OAuth as default
USE_OAUTH=true npm start

# Start with debug logging
NODE_ENV=development npm start

# Development mode with detailed logging
npm run dev
```

### Testing
```bash
# Basic server load test
npm test

# Manual testing endpoints
# 1. Open http://localhost:3000 for main interface
# 2. Open http://localhost:3000/oauth for OAuth flow
# 3. Test Contact CRUD operations via UI tabs
```

### Custom Commands

#### Quick Commit and Push: `cc`
When the user types "cc", Claude should:
1. Run `git status` to see all untracked and modified files
2. Run `git diff` to review staged and unstaged changes
3. Run `git log --oneline -5` to see recent commit message style
4. Add all changes to staging area with `git add .`
5. Create a detailed commit message that:
   - Summarizes the nature of changes (feature, fix, refactor, docs, etc.)
   - Explains the purpose and impact of changes
   - Follows the repository's commit message style
6. Commit with the detailed message ending with the Claude Code signature
7. Push changes to the current branch
8. Confirm successful commit and push

### Environment Configuration

Required environment variables in `.env`:
```bash
# Salesforce OAuth Configuration
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_REDIRECT_URI=http://localhost:3000/api/sf/auth/callback
SF_INSTANCE_URL=https://login.salesforce.com

# Session Configuration
SESSION_SECRET=your_random_session_secret

# Server Configuration
PORT=3000
NODE_ENV=development
USE_OAUTH=false  # Set to true for OAuth default
```

## Key Implementation Details

### OAuth Flow Implementation
- Full PKCE implementation with code verifier/challenge
- CSRF protection using state parameter validation
- Automatic token refresh mechanism
- Session-based token storage with HTTP-only cookies

### Contact CRUD Operations
- All Contact operations include app-created markers (`[SF-APP-CREATED]`)
- Comprehensive error handling with standardized error responses
- Real-time UI updates after operations
- Bulk operations support for create/update/delete

### Security Features
- CSRF protection via state parameter validation
- Secure session management with HTTP-only cookies
- Environment-based configuration
- No credential exposure in application layer
- Production-ready HTTPS enforcement

### Error Handling Patterns
The application implements comprehensive error handling:
- Authentication errors (401) with specific error codes
- Validation errors (400) with field-level details
- Rate limiting detection and handling
- Automatic token refresh on 401 responses
- Structured error responses with troubleshooting guidance

### Frontend Architecture
The main interface (`salesforce-oauth.html`) provides:
- Tabbed interface for Contact operations (Create, List, Search, Edit)
- Real-time list updates after CRUD operations
- Form validation and error display
- Responsive design for mobile/desktop
- Authentication status monitoring

## Test Driven Development (TDD) Requirements

**MANDATORY**: This project follows strict Test Driven Development practices. All new features and modifications MUST follow the TDD cycle.

### TDD Workflow (Red-Green-Refactor)

#### For ALL new features, Claude must:

1. **RED Phase - Write Failing Tests First**
   - Write comprehensive unit tests that describe the expected behavior
   - Tests must fail initially (proving they test the right thing)
   - Cover all edge cases and error conditions
   - Test both success and failure scenarios

2. **GREEN Phase - Write Minimal Implementation**
   - Write the simplest code that makes tests pass
   - Focus on functionality, not optimization
   - Ensure all tests pass before moving forward

3. **REFACTOR Phase - Improve Code Quality**
   - Clean up code while keeping tests green
   - Improve performance, readability, and maintainability
   - Ensure tests still pass after refactoring

### Testing Standards

#### Test Structure Requirements
- **Unit Tests**: Test individual functions and methods in isolation
- **Integration Tests**: Test API endpoints and database interactions
- **Authentication Tests**: Test OAuth flows and token management
- **Error Handling Tests**: Test all error conditions and edge cases

#### Test File Organization
```
tests/
├── unit/                 # Unit tests for individual functions
├── integration/          # API endpoint integration tests
├── auth/                # Authentication flow tests
├── fixtures/            # Test data and mock responses
└── helpers/             # Test utilities and setup
```

#### Test Naming Convention
- Test files: `*.test.js` or `*.spec.js`
- Test descriptions: "should [expected behavior] when [condition]"
- Group related tests using `describe()` blocks

### Testing Commands and Setup

Before implementing any feature, set up the testing framework:
```bash
# Install testing dependencies (if not present)
npm install --save-dev jest supertest @types/jest

# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

### Example TDD Implementation

When adding a new Salesforce object (e.g., Leads):

1. **Write tests first** (`tests/integration/leads.test.js`):
```javascript
describe('Leads API', () => {
  describe('POST /api/sf/leads', () => {
    it('should create a new lead when valid data provided', async () => {
      // Test implementation
    });
    
    it('should return 400 when required fields missing', async () => {
      // Test implementation
    });
    
    it('should return 401 when not authenticated', async () => {
      // Test implementation
    });
  });
});
```

2. **Run tests** - they should fail (RED)
3. **Implement minimal functionality** - make tests pass (GREEN)
4. **Refactor code** - improve while keeping tests green (REFACTOR)

### TDD Enforcement Rules

#### Before ANY new feature implementation:
1. Check if proper test framework is set up
2. Write comprehensive test cases covering the feature
3. Ensure tests fail initially
4. Only then implement the feature
5. Verify all tests pass
6. Refactor if needed while maintaining green tests

#### For bug fixes:
1. Write a test that reproduces the bug (should fail)
2. Fix the bug to make the test pass
3. Ensure no existing tests are broken

#### Code Review Checklist:
- [ ] Are there tests for the new functionality?
- [ ] Do tests cover edge cases and error conditions?
- [ ] Are all tests passing?
- [ ] Is test coverage adequate (aim for >80%)?
- [ ] Are test names descriptive and clear?

## Development Workflows

### Adding New Salesforce Objects (TDD Required)
1. **Write tests first** for all CRUD operations (unit and integration tests)
2. **Run tests** to ensure they fail (RED phase)
3. **Implement API endpoints** following the Contact CRUD pattern in `salesforce-proxy.js`
4. **Verify tests pass** (GREEN phase)
5. **Refactor and optimize** while keeping tests green (REFACTOR phase)
6. Add object-specific validation and error handling with corresponding tests
7. Update frontend with new tabs/forms as needed
8. Write UI tests for new frontend components
9. Document new endpoints in `docs/api-documentation.md`

### Modifying Authentication Flows (TDD Required)
1. **Write tests first** for new authentication scenarios and edge cases
2. **Run tests** to ensure they fail initially (RED phase)
3. **Update OAuth configuration** in the main server file
4. **Implement changes** to make tests pass (GREEN phase)
5. **Refactor** authentication code while maintaining test coverage (REFACTOR phase)
6. Test both OAuth and password flows with automated tests
7. Verify session management and token refresh with integration tests
8. Update documentation in `docs/oauth/`

### Debugging Authentication Issues
1. Enable debug logging with `NODE_ENV=development`
2. Check OAuth configuration validation in server logs
3. Verify Connected App settings in Salesforce
4. Test callback URL configuration
5. Check session and token storage

## Documentation Structure

- `docs/oauth/` - OAuth implementation guides and specifications
- `docs/jwt/` - JWT token exchange documentation
- `docs/js_migration/` - JavaScript to Go migration plans
- Main documentation files cover API specs, implementation status, and technical specifications

## Branch Strategy

- Current working branch: `jwt`
- Recent commits show evolution from password-only to full OAuth implementation
- Documentation is organized into JWT and OAuth specific folders

## Production Considerations

- Replace in-memory token storage with secure database
- Enable HTTPS enforcement
- Configure production-ready session settings
- Set up process manager (PM2) and reverse proxy
- Implement proper logging and monitoring
- Use environment-specific Salesforce instance URLs