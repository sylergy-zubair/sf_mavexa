# Error Handling Guide

## Overview

This guide provides comprehensive error handling patterns and strategies for the Salesforce technical validation system. It covers both Node.js and Go implementations with specific focus on resilience, recovery, and user experience.

## Error Categories

### 1. Authentication Errors
- **Token Expiration**: Access tokens expire and need refresh
- **Invalid Credentials**: Username/password authentication failures
- **Insufficient Permissions**: Token lacks required scopes
- **Org Security**: IP restrictions, login hours, etc.

### 2. API Errors
- **Rate Limiting**: API call limits exceeded
- **Validation Errors**: Invalid data submitted to Salesforce
- **Resource Not Found**: Requested records don't exist
- **Permission Errors**: User lacks object/field permissions

### 3. Network Errors
- **Timeouts**: Request takes too long to complete
- **Connection Failures**: Network connectivity issues
- **DNS Resolution**: Unable to resolve Salesforce endpoints
- **SSL/TLS Issues**: Certificate or encryption problems

### 4. System Errors
- **Memory Issues**: Out of memory conditions
- **Processing Errors**: Internal application errors
- **Configuration Errors**: Invalid settings or missing config

---

## Error Handling Patterns

### 1. Retry Strategies

#### Exponential Backoff
```javascript
// Node.js Implementation
class RetryManager {
    constructor(maxRetries = 3, baseDelay = 1000) {
        this.maxRetries = maxRetries;
        this.baseDelay = baseDelay;
    }

    async executeWithRetry(operation, retryableErrors = []) {
        let lastError;
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (!this.isRetryable(error, retryableErrors) || 
                    attempt === this.maxRetries) {
                    throw error;
                }
                
                const delay = this.calculateDelay(attempt);
                console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    calculateDelay(attempt) {
        return this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
    }

    isRetryable(error, retryableErrors) {
        return retryableErrors.includes(error.code) || 
               error.statusCode >= 500 || 
               error.code === 'NETWORK_ERROR';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

#### Go Implementation
```go
package retry

import (
    "context"
    "math"
    "math/rand"
    "time"
)

type RetryConfig struct {
    MaxRetries int
    BaseDelay  time.Duration
    MaxDelay   time.Duration
}

type RetryManager struct {
    config RetryConfig
}

func (r *RetryManager) ExecuteWithRetry(ctx context.Context, operation func() error) error {
    var lastErr error
    
    for attempt := 0; attempt <= r.config.MaxRetries; attempt++ {
        err := operation()
        if err == nil {
            return nil
        }
        
        lastErr = err
        
        if !r.isRetryable(err) || attempt == r.config.MaxRetries {
            return err
        }
        
        delay := r.calculateDelay(attempt)
        
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(delay):
            continue
        }
    }
    
    return lastErr
}

func (r *RetryManager) calculateDelay(attempt int) time.Duration {
    exponential := time.Duration(math.Pow(2, float64(attempt))) * r.config.BaseDelay
    jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
    delay := exponential + jitter
    
    if delay > r.config.MaxDelay {
        delay = r.config.MaxDelay
    }
    
    return delay
}

func (r *RetryManager) isRetryable(err error) bool {
    // Check for retryable error types
    switch e := err.(type) {
    case *SalesforceError:
        return e.StatusCode >= 500 || e.Code == "RATE_LIMIT_EXCEEDED"
    case *NetworkError:
        return true
    default:
        return false
    }
}
```

### 2. Circuit Breaker Pattern

#### Node.js Implementation
```javascript
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.recoveryTimeout = options.recoveryTimeout || 30000;
        this.monitoringPeriod = options.monitoringPeriod || 60000;
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.nextAttempt = Date.now();
        this.successCount = 0;
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
        }
        this.successCount++;
    }

    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.recoveryTimeout;
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount
        };
    }
}
```

### 3. Rate Limiting Detection and Handling

#### Salesforce Rate Limit Monitoring
```javascript
class RateLimitManager {
    constructor() {
        this.rateLimitInfo = {
            remaining: null,
            limit: null,
            resetTime: null
        };
        this.requestQueue = [];
        this.isProcessing = false;
    }

    updateRateLimitInfo(headers) {
        this.rateLimitInfo = {
            remaining: parseInt(headers['X-RateLimit-Remaining'] || '0'),
            limit: parseInt(headers['X-RateLimit-Limit'] || '5000'),
            resetTime: parseInt(headers['X-RateLimit-Reset'] || '0')
        };
    }

    async executeRequest(requestFunction) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requestFunction, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0) {
            // Check rate limit before processing
            if (this.rateLimitInfo.remaining !== null && this.rateLimitInfo.remaining <= 10) {
                const waitTime = this.calculateWaitTime();
                if (waitTime > 0) {
                    console.log(`Rate limit approaching, waiting ${waitTime}ms`);
                    await this.sleep(waitTime);
                }
            }

            const { requestFunction, resolve, reject } = this.requestQueue.shift();

            try {
                const response = await requestFunction();
                
                // Update rate limit info from response headers
                if (response.headers) {
                    this.updateRateLimitInfo(response.headers);
                }
                
                resolve(response);
            } catch (error) {
                if (error.statusCode === 429) {
                    // Rate limit exceeded, put request back in queue
                    this.requestQueue.unshift({ requestFunction, resolve, reject });
                    
                    const retryAfter = error.headers['Retry-After'] || 60;
                    console.log(`Rate limit exceeded, waiting ${retryAfter} seconds`);
                    await this.sleep(retryAfter * 1000);
                } else {
                    reject(error);
                }
            }
        }

        this.isProcessing = false;
    }

    calculateWaitTime() {
        if (this.rateLimitInfo.resetTime) {
            const now = Math.floor(Date.now() / 1000);
            const timeUntilReset = (this.rateLimitInfo.resetTime - now) * 1000;
            return Math.max(0, timeUntilReset);
        }
        return 60000; // Default 1 minute wait
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### 4. Authentication Error Recovery

#### Token Refresh Implementation
```javascript
class AuthenticationManager {
    constructor(config) {
        this.config = config;
        this.session = null;
        this.refreshPromise = null;
    }

    async ensureValidSession() {
        if (!this.session) {
            return await this.authenticate();
        }

        if (this.isTokenExpired()) {
            return await this.refreshToken();
        }

        return this.session;
    }

    async executeWithAuth(operation) {
        let session = await this.ensureValidSession();
        
        try {
            return await operation(session);
        } catch (error) {
            if (this.isAuthenticationError(error)) {
                console.log('Authentication error, attempting token refresh');
                session = await this.refreshToken();
                return await operation(session);
            }
            throw error;
        }
    }

    async refreshToken() {
        // Prevent multiple simultaneous refresh attempts
        if (this.refreshPromise) {
            return await this.refreshPromise;
        }

        this.refreshPromise = this.performTokenRefresh();
        
        try {
            this.session = await this.refreshPromise;
            return this.session;
        } finally {
            this.refreshPromise = null;
        }
    }

    async performTokenRefresh() {
        if (!this.session?.refreshToken) {
            return await this.authenticate();
        }

        try {
            const response = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.session.refreshToken,
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret
                })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || this.session.refreshToken,
                instanceUrl: data.instance_url,
                expiresAt: Date.now() + (data.expires_in * 1000)
            };
        } catch (error) {
            console.log('Token refresh failed, performing full authentication');
            return await this.authenticate();
        }
    }

    isTokenExpired() {
        if (!this.session?.expiresAt) return true;
        return Date.now() >= (this.session.expiresAt - 300000); // 5 minutes buffer
    }

    isAuthenticationError(error) {
        return error.statusCode === 401 || 
               error.code === 'INVALID_SESSION_ID' ||
               error.code === 'AUTHENTICATION_FAILURE';
    }
}
```

---

## Error Response Formatting

### Standardized Error Structure
```javascript
class ErrorResponse {
    constructor(code, message, details = {}, statusCode = 500) {
        this.error = {
            code,
            message,
            details: {
                statusCode,
                ...details
            },
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId()
        };
    }

    generateRequestId() {
        return 'req_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return this.error;
    }
}

// Usage examples
const authError = new ErrorResponse(
    'AUTHENTICATION_FAILURE',
    'Invalid username, password, or security token',
    { 
        field: 'password',
        salesforceError: 'INVALID_LOGIN'
    },
    401
);

const validationError = new ErrorResponse(
    'VALIDATION_ERROR',
    'Required fields are missing',
    {
        fields: [
            { field: 'LastName', message: 'Last name is required' },
            { field: 'Email', message: 'Invalid email format' }
        ]
    },
    400
);
```

### Go Error Types
```go
package errors

import (
    "fmt"
    "time"
)

type SalesforceError struct {
    Code       string                 `json:"code"`
    Message    string                 `json:"message"`
    Details    map[string]interface{} `json:"details"`
    StatusCode int                    `json:"statusCode"`
    Timestamp  time.Time              `json:"timestamp"`
    RequestID  string                 `json:"requestId"`
}

func (e *SalesforceError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func NewSalesforceError(code, message string, statusCode int) *SalesforceError {
    return &SalesforceError{
        Code:       code,
        Message:    message,
        Details:    make(map[string]interface{}),
        StatusCode: statusCode,
        Timestamp:  time.Now(),
        RequestID:  generateRequestID(),
    }
}

func (e *SalesforceError) WithDetail(key string, value interface{}) *SalesforceError {
    e.Details[key] = value
    return e
}

// Specific error types
type AuthenticationError struct {
    *SalesforceError
}

type ValidationError struct {
    *SalesforceError
    Fields []FieldError `json:"fields"`
}

type FieldError struct {
    Field   string `json:"field"`
    Message string `json:"message"`
    Value   string `json:"value,omitempty"`
}

type RateLimitError struct {
    *SalesforceError
    RetryAfter int `json:"retryAfter"`
}

type NetworkError struct {
    *SalesforceError
    Retryable bool `json:"retryable"`
}
```

---

## Error Monitoring and Alerting

### Error Metrics Collection
```javascript
class ErrorMetrics {
    constructor() {
        this.metrics = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByEndpoint: new Map(),
            responseTimesByError: new Map()
        };
    }

    recordError(error, endpoint, responseTime) {
        this.metrics.totalErrors++;
        
        // Track by error type
        const errorType = error.code || 'UNKNOWN';
        this.metrics.errorsByType.set(
            errorType, 
            (this.metrics.errorsByType.get(errorType) || 0) + 1
        );
        
        // Track by endpoint
        this.metrics.errorsByEndpoint.set(
            endpoint,
            (this.metrics.errorsByEndpoint.get(endpoint) || 0) + 1
        );
        
        // Track response times for errors
        if (!this.metrics.responseTimesByError.has(errorType)) {
            this.metrics.responseTimesByError.set(errorType, []);
        }
        this.metrics.responseTimesByError.get(errorType).push(responseTime);
        
        this.checkAlertThresholds(error, endpoint);
    }

    checkAlertThresholds(error, endpoint) {
        // Alert if error rate exceeds threshold
        const recentErrors = this.getRecentErrors(300000); // Last 5 minutes
        if (recentErrors.length > 50) {
            this.sendAlert('HIGH_ERROR_RATE', {
                count: recentErrors.length,
                timeWindow: '5 minutes'
            });
        }
        
        // Alert for critical errors
        if (error.statusCode >= 500) {
            this.sendAlert('CRITICAL_ERROR', {
                error: error.code,
                endpoint,
                message: error.message
            });
        }
    }

    getRecentErrors(timeWindow) {
        const cutoff = Date.now() - timeWindow;
        return this.errors.filter(error => 
            new Date(error.timestamp).getTime() > cutoff
        );
    }

    sendAlert(type, details) {
        console.log(`ALERT: ${type}`, details);
        // Integrate with alerting system (email, Slack, PagerDuty, etc.)
    }

    generateReport() {
        return {
            totalErrors: this.metrics.totalErrors,
            errorsByType: Object.fromEntries(this.metrics.errorsByType),
            errorsByEndpoint: Object.fromEntries(this.metrics.errorsByEndpoint),
            topErrors: this.getTopErrors(),
            errorRate: this.calculateErrorRate()
        };
    }
}
```

---

## Error Recovery Strategies

### 1. Graceful Degradation
```javascript
class ContactService {
    constructor(primaryClient, fallbackClient) {
        this.primaryClient = primaryClient;
        this.fallbackClient = fallbackClient;
        this.isUsingFallback = false;
    }

    async createContact(contactData) {
        try {
            if (!this.isUsingFallback) {
                return await this.primaryClient.createContact(contactData);
            }
        } catch (error) {
            console.log('Primary client failed, switching to fallback');
            this.isUsingFallback = true;
        }

        try {
            return await this.fallbackClient.createContact(contactData);
        } catch (fallbackError) {
            // If fallback also fails, try to recover primary
            this.isUsingFallback = false;
            throw new Error('Both primary and fallback clients failed');
        }
    }
}
```

### 2. Data Consistency Strategies
```javascript
class TransactionManager {
    constructor() {
        this.pendingOperations = new Map();
    }

    async executeWithRollback(operations) {
        const completedOperations = [];
        const transactionId = this.generateTransactionId();
        
        try {
            for (const operation of operations) {
                const result = await operation.execute();
                completedOperations.push({
                    operation,
                    result,
                    rollback: operation.rollback
                });
            }
            
            return completedOperations.map(op => op.result);
        } catch (error) {
            console.log(`Transaction ${transactionId} failed, rolling back`);
            await this.rollback(completedOperations);
            throw error;
        }
    }

    async rollback(completedOperations) {
        // Rollback in reverse order
        for (let i = completedOperations.length - 1; i >= 0; i--) {
            try {
                await completedOperations[i].rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
                // Log for manual intervention
            }
        }
    }
}
```

---

## Testing Error Scenarios

### Error Simulation Framework
```javascript
class ErrorSimulator {
    constructor() {
        this.simulationRules = new Map();
        this.isEnabled = false;
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    addRule(endpoint, errorType, probability = 0.1) {
        if (!this.simulationRules.has(endpoint)) {
            this.simulationRules.set(endpoint, []);
        }
        
        this.simulationRules.get(endpoint).push({
            errorType,
            probability
        });
    }

    shouldSimulateError(endpoint) {
        if (!this.isEnabled) return null;
        
        const rules = this.simulationRules.get(endpoint) || [];
        
        for (const rule of rules) {
            if (Math.random() < rule.probability) {
                return this.createSimulatedError(rule.errorType);
            }
        }
        
        return null;
    }

    createSimulatedError(errorType) {
        const errorDefinitions = {
            'RATE_LIMIT': new ErrorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', {}, 429),
            'AUTH_FAILURE': new ErrorResponse('AUTHENTICATION_FAILURE', 'Token expired', {}, 401),
            'NETWORK_TIMEOUT': new ErrorResponse('NETWORK_TIMEOUT', 'Request timeout', {}, 504),
            'VALIDATION': new ErrorResponse('VALIDATION_ERROR', 'Invalid data', {}, 400)
        };
        
        return errorDefinitions[errorType] || 
               new ErrorResponse('SIMULATED_ERROR', 'Simulated error', {}, 500);
    }
}

// Usage in tests
const simulator = new ErrorSimulator();
simulator.enable();
simulator.addRule('/api/sf/contacts', 'RATE_LIMIT', 0.2); // 20% chance
simulator.addRule('/api/sf/auth/refresh', 'AUTH_FAILURE', 0.1); // 10% chance
```

---

## Best Practices Summary

### 1. Error Handling Principles
- **Fail Fast**: Detect errors early and respond quickly
- **Be Specific**: Provide detailed error messages and codes
- **Log Everything**: Comprehensive logging for debugging
- **Graceful Degradation**: Maintain functionality when possible
- **User-Friendly**: Transform technical errors into user-friendly messages

### 2. Recovery Strategies
- **Automatic Retry**: For transient failures
- **Circuit Breaker**: Prevent cascading failures
- **Fallback Options**: Alternative data sources or methods
- **Graceful Timeout**: Set reasonable timeouts for all operations

### 3. Monitoring and Alerting
- **Real-time Monitoring**: Track error rates and patterns
- **Threshold Alerts**: Notify when error rates exceed limits
- **Performance Impact**: Monitor how errors affect system performance
- **Trend Analysis**: Identify patterns and root causes

### 4. Documentation and Communication
- **Error Catalogs**: Maintain comprehensive error documentation
- **Runbooks**: Provide step-by-step recovery procedures
- **Status Pages**: Communicate system status to users
- **Post-Mortems**: Learn from significant incidents

---

*This error handling guide provides comprehensive patterns and strategies for building resilient Salesforce integrations. Regular review and updates ensure continued effectiveness as the system evolves.* 