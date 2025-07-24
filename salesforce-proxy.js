const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

let accessToken = null;
let instanceUrl = null;

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'salesforce-test-proxy.html'));
});

// Salesforce authentication endpoint
app.post('/api/sf/authenticate', async (req, res) => {
    try {
        const { instanceUrl: sfInstanceUrl, clientId, clientSecret, username, password } = req.body;

        // Enhanced logging (without sensitive data)
        console.log('\n=== Salesforce Authentication Attempt ===');
        console.log('Instance URL:', sfInstanceUrl);
        console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
        console.log('Client Secret:', clientSecret ? 'PROVIDED' : 'MISSING');
        console.log('Username:', username);
        console.log('Password Length:', password ? password.length : 'MISSING');

        const authUrl = `${sfInstanceUrl}/services/oauth2/token`;
        console.log('Auth URL:', authUrl);

        const authBody = new URLSearchParams({
            grant_type: 'password',
            client_id: clientId,
            client_secret: clientSecret,
            username: username,
            password: password
        });

        console.log('Request body keys:', Array.from(authBody.keys()));

        const response = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: authBody
        });

        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('Salesforce Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            accessToken = data.access_token;
            instanceUrl = data.instance_url;
            
            console.log('✅ Authentication successful!');
            res.json({
                success: true,
                message: 'Successfully connected to Salesforce!',
                instanceUrl: instanceUrl,
                tokenType: data.token_type
            });
        } else {
            console.log('❌ Authentication failed:', data);
            
            // Enhanced error messages
            let errorMessage = data.error_description || data.error || 'Authentication failed';
            let troubleshooting = '';

            switch (data.error) {
                case 'invalid_client_id':
                    troubleshooting = 'Check your Consumer Key in the Connected App';
                    break;
                case 'invalid_client':
                    troubleshooting = 'Check your Consumer Secret in the Connected App';
                    break;
                case 'invalid_grant':
                    troubleshooting = 'Check username/password. Make sure security token is appended to password';
                    break;
                case 'unsupported_grant_type':
                    troubleshooting = 'Enable "Password Flow" in your Connected App OAuth settings';
                    break;
                default:
                    troubleshooting = 'Check all credentials and Connected App configuration';
            }

            res.status(400).json({
                success: false,
                error: errorMessage,
                errorCode: data.error,
                troubleshooting: troubleshooting,
                fullResponse: data
            });
        }
    } catch (error) {
        console.log('🔥 Network/Server Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            troubleshooting: 'Check if Salesforce instance URL is correct and accessible'
        });
    }
});

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