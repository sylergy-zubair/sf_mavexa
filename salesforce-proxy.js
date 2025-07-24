require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// OAuth configuration
const OAUTH_CONFIG = {
    clientId: process.env.SF_CLIENT_ID || '',
    clientSecret: process.env.SF_CLIENT_SECRET || '',
    redirectUri: process.env.SF_REDIRECT_URI || `http://localhost:${PORT}/api/sf/auth/callback`,
    instanceUrl: process.env.SF_INSTANCE_URL || 'https://login.salesforce.com'
};

// Debug flag
const DEBUG = process.env.NODE_ENV !== 'production';

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Token storage (in production, use database or secure session storage)
let accessToken = null;
let instanceUrl = null;
let refreshToken = null;

// Serve the OAuth HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'salesforce-oauth.html'));
});

app.get('/oauth', (req, res) => {
    res.sendFile(path.join(__dirname, 'salesforce-oauth.html'));
});


// =============================================================================
// OAuth 2.0 Authorization Code Flow Endpoints
// =============================================================================

// OAuth Login - Initiate authorization flow
app.get('/api/sf/auth/login', async (req, res) => {
    try {
        // Validate OAuth configuration first
        console.log('\n=== OAuth Configuration Validation ===');
        console.log('Client ID:', OAUTH_CONFIG.clientId ? `${OAUTH_CONFIG.clientId.substring(0, 20)}...` : '❌ MISSING');
        console.log('Client Secret:', OAUTH_CONFIG.clientSecret ? '✅ PROVIDED' : '❌ MISSING');
        console.log('Redirect URI:', OAUTH_CONFIG.redirectUri);
        console.log('Instance URL:', OAUTH_CONFIG.instanceUrl);
        
        if (!OAUTH_CONFIG.clientId || !OAUTH_CONFIG.clientSecret) {
            console.log('❌ OAuth configuration incomplete');
            return res.status(500).json({
                success: false,
                error: 'OAuth configuration incomplete',
                troubleshooting: [
                    'Check your .env file contains:',
                    'SF_CLIENT_ID=your_consumer_key',
                    'SF_CLIENT_SECRET=your_consumer_secret'
                ]
            });
        }
        
        // Generate random state for CSRF protection
        const state = crypto.randomBytes(32).toString('hex');
        
        // Generate PKCE code verifier and challenge
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
        
        // Store state and code verifier in session
        req.session.oauthState = state;
        req.session.codeVerifier = codeVerifier;
        
        debugLog('OAuth initiation', { 
            state, 
            redirectUri: OAUTH_CONFIG.redirectUri,
            codeChallenge: codeChallenge.substring(0, 20) + '...'
        });
        
        const authUrl = `${OAUTH_CONFIG.instanceUrl}/services/oauth2/authorize?` + 
            new URLSearchParams({
                response_type: 'code',
                client_id: OAUTH_CONFIG.clientId,
                redirect_uri: OAUTH_CONFIG.redirectUri,
                scope: 'api refresh_token id',
                state: state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            });
        
        console.log('\n=== OAuth Authorization Flow Initiated ===');
        console.log('Auth URL generated:', authUrl);
        console.log('State parameter:', state);
        
        // Test OAuth URL accessibility to detect Connected App issues
        console.log('\n=== Testing Salesforce OAuth URL Accessibility ===');
        try {
            const testResponse = await fetch(authUrl, { 
                method: 'HEAD',
                timeout: 5000 
            });
            
            console.log('🔍 Salesforce OAuth URL Test Result:');
            console.log('   Status:', testResponse.status);
            console.log('   Status Text:', testResponse.statusText);
            
            if (testResponse.status === 400) {
                console.log('❌ CRITICAL: OAuth URL returned 400 Bad Request');
                console.log('📋 This means your Connected App is NOT configured for Authorization Code flow');
                console.log('');
                console.log('🔧 TO FIX THIS ISSUE:');
                console.log('1. Go to Salesforce Setup → App Manager');
                console.log('2. Find your Connected App with Consumer Key:', OAUTH_CONFIG.clientId.substring(0, 20) + '...');
                console.log('3. Click "View" then "Edit"');
                console.log('4. In OAuth Settings, ensure "Web Server Flow" is CHECKED');
                console.log('5. Verify Callback URL is:', OAUTH_CONFIG.redirectUri);
                console.log('6. Save and wait 2-10 minutes');
                console.log('');
                
                return res.status(400).json({
                    success: false,
                    error: 'Connected App not configured for OAuth Authorization Code flow',
                    troubleshooting: [
                        '🚨 Your Connected App needs configuration:',
                        '',
                        '1. Go to Salesforce Setup → App Manager',
                        '2. Find Connected App: ' + OAUTH_CONFIG.clientId.substring(0, 20) + '...',
                        '3. Click "View" then "Edit"',
                        '4. In OAuth Settings section, CHECK:',
                        '   ✅ Web Server Flow (CRITICAL - this is missing)',
                        '   ✅ Refresh Token Flow',
                        '5. Verify Callback URL: ' + OAUTH_CONFIG.redirectUri,
                        '6. Selected OAuth Scopes: api, refresh_token, id',
                        '7. Save and wait 2-10 minutes for changes to take effect',
                        '',
                        '🔗 After fixing, this OAuth URL should work:'
                    ],
                    authUrl: authUrl,
                    debug: {
                        status: testResponse.status,
                        clientId: OAUTH_CONFIG.clientId.substring(0, 20) + '...',
                        callbackUrl: OAUTH_CONFIG.redirectUri
                    }
                });
                
            } else if (testResponse.status === 302) {
                console.log('✅ Salesforce OAuth URL is accessible (302 redirect to login page)');
            } else if (testResponse.status === 200) {
                console.log('✅ Salesforce OAuth URL responded successfully');
            } else {
                console.log('⚠️ Unexpected response status:', testResponse.status);
            }
            
        } catch (testError) {
            console.log('⚠️ Unable to test OAuth URL accessibility:', testError.message);
            console.log('   This might be a network issue, continuing anyway...');
        }
        
        console.log('✅ OAuth URL validation complete, sending to browser');
        
        res.json({ 
            success: true, 
            authUrl: authUrl,
            message: 'Redirect user to this URL for authentication'
        });
        
    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// OAuth Callback - Handle authorization code
app.get('/api/sf/auth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        console.log('\n=== OAuth Callback Received ===');
        debugLog('OAuth callback received', { 
            code: code?.substring(0, 10) + '...', 
            state, 
            error 
        });
        
        // Handle authorization denied
        if (error) {
            console.log('❌ OAuth authorization denied:', error);
            return res.redirect(`/?error=${encodeURIComponent(error)}`);
        }
        
        // Verify state parameter (CSRF protection)
        if (!state || state !== req.session.oauthState) {
            console.log('❌ Invalid state parameter - potential CSRF attack');
            return res.redirect('/?error=invalid_state');
        }
        
        // Get code verifier from session
        const codeVerifier = req.session.codeVerifier;
        
        // Clear used state and code verifier
        delete req.session.oauthState;
        delete req.session.codeVerifier;
        
        console.log('✅ State parameter verified');
        console.log('🔄 Exchanging authorization code for access token...');
        
        // Exchange authorization code for access token (with PKCE)
        const tokenRequestBody = {
            grant_type: 'authorization_code',
            client_id: OAUTH_CONFIG.clientId,
            client_secret: OAUTH_CONFIG.clientSecret,
            redirect_uri: OAUTH_CONFIG.redirectUri,
            code: code
        };
        
        // Add code verifier if it exists (for PKCE)
        if (codeVerifier) {
            tokenRequestBody.code_verifier = codeVerifier;
        }
        
        const tokenResponse = await fetch(`${OAUTH_CONFIG.instanceUrl}/services/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(tokenRequestBody)
        });
        
        const tokenData = await tokenResponse.json();
        
        // Enhanced logging for Salesforce response
        console.log('\n=== Salesforce Token Response ===');
        console.log('Response Status:', tokenResponse.status);
        console.log('Response Headers:', Object.fromEntries(tokenResponse.headers.entries()));
        
        if (tokenResponse.ok) {
            console.log('✅ Salesforce Token Exchange SUCCESS');
            console.log('📋 Complete Token Response:');
            console.log(JSON.stringify(tokenData, null, 2));
            
            // Log individual token details (safely)
            console.log('\n🔍 Token Details:');
            console.log('• Access Token Length:', tokenData.access_token?.length || 'N/A');
            console.log('• Access Token (first 30 chars):', tokenData.access_token?.substring(0, 30) + '...');
            console.log('• Refresh Token Length:', tokenData.refresh_token?.length || 'N/A');
            console.log('• Refresh Token (first 30 chars):', tokenData.refresh_token?.substring(0, 30) + '...');
            console.log('• Instance URL:', tokenData.instance_url);
            console.log('• ID URL:', tokenData.id);
            console.log('• Token Type:', tokenData.token_type);
            console.log('• Issued At:', tokenData.issued_at);
            console.log('• Signature Length:', tokenData.signature?.length || 'N/A');
            
            // Store tokens
            // Store tokens
            accessToken = tokenData.access_token;
            refreshToken = tokenData.refresh_token;
            instanceUrl = tokenData.instance_url;
            
            console.log('\n✅ OAuth authentication successful!');
            console.log('📍 Instance URL:', instanceUrl);
            console.log('🎯 Access Token (first 20 chars):', accessToken.substring(0, 20) + '...');
            console.log('🔄 Refresh Token available:', !!refreshToken);
            
            res.redirect('/?auth=success');
        } else {
            console.log('❌ Salesforce Token Exchange FAILED');
            console.log('Error Response:');
            console.log(JSON.stringify(tokenData, null, 2));
            console.log('❌ Token exchange failed:', tokenData);
            res.redirect(`/?error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`);
        }
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
});

// OAuth Token Refresh
app.post('/api/sf/auth/refresh', async (req, res) => {
    try {
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: 'No refresh token available'
            });
        }
        
        console.log('\n=== Token Refresh Attempt ===');
        
        const refreshResponse = await fetch(`${instanceUrl}/services/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: OAUTH_CONFIG.clientId,
                client_secret: OAUTH_CONFIG.clientSecret,
                refresh_token: refreshToken
            })
        });
        
        const tokenData = await refreshResponse.json();
        
        // Enhanced logging for refresh response
        console.log('\n=== Salesforce Refresh Token Response ===');
        console.log('Response Status:', refreshResponse.status);
        console.log('Response Headers:', Object.fromEntries(refreshResponse.headers.entries()));
        
        if (refreshResponse.ok) {
            console.log('✅ Salesforce Refresh Token SUCCESS');
            console.log('📋 Complete Refresh Response:');
            console.log(JSON.stringify(tokenData, null, 2));
            
            // Log individual token details (safely)
            console.log('\n🔍 Refresh Token Details:');
            console.log('• New Access Token Length:', tokenData.access_token?.length || 'N/A');
            console.log('• New Access Token (first 30 chars):', tokenData.access_token?.substring(0, 30) + '...');
            console.log('• New Refresh Token Provided:', !!tokenData.refresh_token);
            if (tokenData.refresh_token) {
                console.log('• New Refresh Token Length:', tokenData.refresh_token.length);
                console.log('• New Refresh Token (first 30 chars):', tokenData.refresh_token.substring(0, 30) + '...');
            }
            console.log('• Instance URL:', tokenData.instance_url);
            console.log('• ID URL:', tokenData.id);
            console.log('• Token Type:', tokenData.token_type);
            console.log('• Issued At:', tokenData.issued_at);
            
            accessToken = tokenData.access_token;
            accessToken = tokenData.access_token;
            // Note: Salesforce may or may not return a new refresh token
            if (tokenData.refresh_token) {
                refreshToken = tokenData.refresh_token;
            }
            
            console.log('\n✅ Token refreshed successfully');
            
            res.json({
                success: true,
                message: 'Token refreshed successfully'
            });
        } else {
            console.log('❌ Salesforce Refresh Token FAILED');
            console.log('Error Response:');
            console.log(JSON.stringify(tokenData, null, 2));
            console.log('❌ Token refresh failed:', tokenData);
            res.status(400).json({
                success: false,
                error: tokenData.error_description || 'Token refresh failed'
            });
        }
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// OAuth Status Check
app.get('/api/sf/auth/status', (req, res) => {
    res.json({
        authenticated: !!accessToken,
        hasRefreshToken: !!refreshToken,
        instanceUrl: instanceUrl
    });
});

// OAuth Logout
app.post('/api/sf/auth/logout', (req, res) => {
    accessToken = null;
    refreshToken = null;
    instanceUrl = null;
    
    console.log('🔓 User logged out - tokens cleared');
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// =============================================================================
// Contact CRUD API Endpoints  
// =============================================================================

// Helper function for making authenticated Salesforce API calls
async function makeAuthenticatedRequest(url, options = {}) {
    if (!accessToken) {
        throw new Error('Not authenticated with Salesforce');
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    let data = null;
    
    // Get response text first to avoid JSON parsing errors
    const responseText = await response.text();
    
    // Only try to parse JSON if there's actual content
    if (responseText && responseText.trim().length > 0) {
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.log('⚠️ Response is not JSON:', responseText);
            // For non-JSON responses, just store the text
            data = { rawResponse: responseText };
        }
    }
    
    if (!response.ok) {
        const errorMessage = data?.[0]?.message || data?.message || data?.rawResponse || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    
    return { response, data };
}

// Create Contact
app.post('/api/sf/contacts', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const contactData = req.body;
        console.log('\n=== Creating Contact ===');
        console.log('Contact data:', JSON.stringify(contactData, null, 2));

        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/sobjects/Contact`,
            {
                method: 'POST',
                body: JSON.stringify(contactData)
            }
        );

        console.log('✅ Contact created successfully:', data.id);

        res.status(201).json({
            id: data.id,
            success: true,
            created: true
        });

    } catch (error) {
        console.error('❌ Create contact error:', error);
        
        if (error.message.includes('REQUIRED_FIELD_MISSING')) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Required fields are missing',
                    details: {
                        fields: [{ field: 'LastName', message: 'Last name is required' }]
                    }
                }
            });
        }
        
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// Get Contact by ID
app.get('/api/sf/contacts/:id', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const contactId = req.params.id;
        console.log('\n=== Getting Contact by ID ===');
        console.log('Contact ID:', contactId);

        const fields = 'Id,FirstName,LastName,Email,Phone,Title,Department,AccountId,CreatedDate,LastModifiedDate';
        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/sobjects/Contact/${contactId}?fields=${fields}`
        );

        console.log('✅ Contact retrieved successfully');
        res.json(data);

    } catch (error) {
        console.error('❌ Get contact error:', error);
        
        if (error.message.includes('NOT_FOUND')) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Contact not found',
                    details: {
                        contactId: req.params.id
                    }
                }
            });
        }
        
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// List Contacts with pagination
app.get('/api/sf/contacts', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const orderBy = req.query.orderBy || 'LastModifiedDate';
        const order = req.query.order || 'DESC';

        console.log('\n=== Listing Contacts ===');
        console.log(`Limit: ${limit}, Offset: ${offset}, OrderBy: ${orderBy} ${order}`);

        const query = `SELECT Id,FirstName,LastName,Email,Phone,Title,Department,CreatedDate,LastModifiedDate FROM Contact ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`;
        
        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(query)}`
        );

        console.log(`✅ Retrieved ${data.records.length} contacts`);

        res.json({
            totalSize: data.totalSize,
            done: data.done,
            nextRecordsUrl: data.nextRecordsUrl ? `/api/sf/contacts?limit=${limit}&offset=${offset + limit}` : null,
            records: data.records
        });

    } catch (error) {
        console.error('❌ List contacts error:', error);
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// Search Contacts  
app.get('/api/sf/contacts/search', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const searchQuery = req.query.q;
        const fields = req.query.fields || 'Id,FirstName,LastName,Email,Phone,Title';
        const limit = parseInt(req.query.limit) || 20;

        if (!searchQuery) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Search query parameter "q" is required'
                }
            });
        }

        console.log('\n=== Searching Contacts ===');
        console.log(`Query: "${searchQuery}", Fields: ${fields}, Limit: ${limit}`);

        const sosl = `FIND {${searchQuery}} IN NAME FIELDS RETURNING Contact(${fields}) LIMIT ${limit}`;
        
        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/search?q=${encodeURIComponent(sosl)}`
        );

        const contacts = data.searchRecords || [];
        console.log(`✅ Found ${contacts.length} contacts`);

        res.json({
            searchRecords: contacts
        });

    } catch (error) {
        console.error('❌ Search contacts error:', error);
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// Update Contact (full update)
app.put('/api/sf/contacts/:id', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const contactId = req.params.id;
        const updateData = req.body;
        
        console.log('\n=== Updating Contact (Full) ===');
        console.log('Contact ID:', contactId);
        console.log('Update data:', JSON.stringify(updateData, null, 2));

        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/sobjects/Contact/${contactId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            }
        );

        console.log('✅ Contact updated successfully');

        res.json({
            id: contactId,
            success: true
        });

    } catch (error) {
        console.error('❌ Update contact error:', error);
        
        if (error.message.includes('NOT_FOUND')) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Contact not found',
                    details: {
                        contactId: req.params.id
                    }
                }
            });
        }
        
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// Partial Update Contact
app.patch('/api/sf/contacts/:id', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const contactId = req.params.id;
        const updateData = req.body;
        const updatedFields = Object.keys(updateData);
        
        console.log('\n=== Updating Contact (Partial) ===');
        console.log('Contact ID:', contactId);
        console.log('Updated fields:', updatedFields);
        console.log('Update data:', JSON.stringify(updateData, null, 2));

        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/sobjects/Contact/${contactId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            }
        );

        console.log('✅ Contact partially updated successfully');

        res.json({
            id: contactId,
            success: true,
            updated: updatedFields
        });

    } catch (error) {
        console.error('❌ Partial update contact error:', error);
        
        if (error.message.includes('NOT_FOUND')) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Contact not found',
                    details: {
                        contactId: req.params.id
                    }
                }
            });
        }
        
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// Delete Contact
app.delete('/api/sf/contacts/:id', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const contactId = req.params.id;
        console.log('\n=== Deleting Contact ===');
        console.log('Contact ID:', contactId);

        const { response, data } = await makeAuthenticatedRequest(
            `${instanceUrl}/services/data/v58.0/sobjects/Contact/${contactId}`,
            {
                method: 'DELETE'
            }
        );

        console.log('✅ Contact deleted successfully');

        res.status(204).send();

    } catch (error) {
        console.error('❌ Delete contact error:', error);
        
        if (error.message.includes('NOT_FOUND')) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Contact not found',
                    details: {
                        contactId: req.params.id
                    }
                }
            });
        }
        
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// Bulk Operations
app.post('/api/sf/contacts/bulk', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Not authenticated with Salesforce'
                }
            });
        }

        const { operation, records, ids } = req.body;
        
        console.log('\n=== Bulk Contact Operation ===');
        console.log('Operation:', operation);
        console.log('Records count:', records?.length || ids?.length || 0);

        let results = [];
        let hasErrors = false;

        if (operation === 'create' && records) {
            // Bulk create
            for (const record of records) {
                try {
                    const { response, data } = await makeAuthenticatedRequest(
                        `${instanceUrl}/services/data/v58.0/sobjects/Contact`,
                        {
                            method: 'POST',
                            body: JSON.stringify(record)
                        }
                    );
                    results.push({
                        id: data.id,
                        success: true,
                        created: true
                    });
                } catch (error) {
                    hasErrors = true;
                    results.push({
                        success: false,
                        error: error.message
                    });
                }
            }
        } else if (operation === 'update' && records) {
            // Bulk update
            for (const record of records) {
                try {
                    const { Id, ...updateData } = record;
                    const { response, data } = await makeAuthenticatedRequest(
                        `${instanceUrl}/services/data/v58.0/sobjects/Contact/${Id}`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify(updateData)
                        }
                    );
                    results.push({
                        id: Id,
                        success: true
                    });
                } catch (error) {
                    hasErrors = true;
                    results.push({
                        id: record.Id,
                        success: false,
                        error: error.message
                    });
                }
            }
        } else if (operation === 'delete' && ids) {
            // Bulk delete
            for (const id of ids) {
                try {
                    const { response, data } = await makeAuthenticatedRequest(
                        `${instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`,
                        {
                            method: 'DELETE'
                        }
                    );
                    results.push({
                        id: id,
                        success: true
                    });
                } catch (error) {
                    hasErrors = true;
                    results.push({
                        id: id,
                        success: false,
                        error: error.message
                    });
                }
            }
        } else {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid bulk operation or missing data'
                }
            });
        }

        console.log(`✅ Bulk ${operation} completed. Success: ${results.filter(r => r.success).length}, Errors: ${results.filter(r => !r.success).length}`);

        res.json({
            hasErrors: hasErrors,
            results: results
        });

    } catch (error) {
        console.error('❌ Bulk operation error:', error);
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

// =============================================================================
// Existing API Endpoints (unchanged)
// =============================================================================

// Create Lead endpoint
app.post('/api/sf/leads', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated with Salesforce'
            });
        }

        const leadData = req.body;

        const response = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
        });

        const data = await response.json();

        if (response.ok) {
            res.json({
                success: true,
                message: 'Lead created successfully!',
                leadId: data.id,
                leadData: leadData
            });
        } else {
            res.status(400).json({
                success: false,
                error: data[0]?.message || 'Failed to create lead'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Leads endpoint
app.get('/api/sf/leads', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated with Salesforce'
            });
        }

        const query = "SELECT Id, FirstName, LastName, Email, Company, CreatedDate FROM Lead ORDER BY CreatedDate DESC LIMIT 10";
        const response = await fetch(`${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            res.json({
                success: true,
                message: `Retrieved ${data.records.length} leads`,
                leads: data.records
            });
        } else {
            res.status(400).json({
                success: false,
                error: data[0]?.message || 'Failed to fetch leads'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Accounts endpoint
app.get('/api/sf/accounts', async (req, res) => {
    try {
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated with Salesforce'
            });
        }

        const query = "SELECT Id, Name, Type, Industry, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT 10";
        const response = await fetch(`${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            res.json({
                success: true,
                message: `Retrieved ${data.records.length} accounts`,
                accounts: data.records
            });
        } else {
            res.status(400).json({
                success: false,
                error: data[0]?.message || 'Failed to fetch accounts'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Salesforce Proxy Server running at http://localhost:${PORT}`);
    console.log(`Open your browser to: http://localhost:${PORT}`);
});