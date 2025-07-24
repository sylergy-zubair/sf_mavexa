const fetch = require('node-fetch');

async function testSalesforceAuth() {
    // Replace these with your actual values
    const credentials = {
        instanceUrl: 'https://test.salesforce.com',
        clientId: 'YOUR_CLIENT_ID',           // Replace with full Client ID
        clientSecret: 'YOUR_CLIENT_SECRET',   // Replace with Client Secret
        username: 'your-username@example.com',
        password: 'YOUR_PASSWORD_WITH_TOKEN'  // Replace with password+token
    };

    console.log('🧪 Testing Salesforce Authentication...\n');
    
    // Test 1: Basic connectivity
    console.log('📡 Testing connectivity to Salesforce...');
    try {
        const connectTest = await fetch(`${credentials.instanceUrl}/services/oauth2/token`, {
            method: 'HEAD'
        });
        console.log('✅ Salesforce instance is reachable');
    } catch (error) {
        console.log('❌ Cannot reach Salesforce instance:', error.message);
        return;
    }

    // Test 2: OAuth endpoint structure
    const authUrl = `${credentials.instanceUrl}/services/oauth2/token`;
    console.log('\n🔗 OAuth URL:', authUrl);

    // Test 3: Authentication attempt
    console.log('\n🔐 Attempting authentication...');
    
    const authBody = new URLSearchParams({
        grant_type: 'password',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        username: credentials.username,
        password: credentials.password
    });

    try {
        const response = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'SalesforceTestScript/1.0'
            },
            body: authBody
        });

        const data = await response.json();
        
        console.log('📊 Response Status:', response.status);
        console.log('📄 Response Data:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ SUCCESS! Authentication worked!');
            console.log('🎯 Access Token (first 20 chars):', data.access_token.substring(0, 20) + '...');
            console.log('🏢 Instance URL:', data.instance_url);
        } else {
            console.log('\n❌ AUTHENTICATION FAILED');
            
            // Detailed error analysis
            switch (data.error) {
                case 'invalid_client_id':
                    console.log('🔍 DIAGNOSIS: Invalid Client ID (Consumer Key)');
                    console.log('💡 SOLUTION: Check your Connected App Consumer Key');
                    break;
                    
                case 'invalid_client':
                    console.log('🔍 DIAGNOSIS: Invalid Client Secret (Consumer Secret)');
                    console.log('💡 SOLUTION: Check your Connected App Consumer Secret');
                    break;
                    
                case 'invalid_grant':
                    console.log('🔍 DIAGNOSIS: Invalid credentials or configuration');
                    console.log('💡 POSSIBLE SOLUTIONS:');
                    console.log('   1. Check username and password are correct');
                    console.log('   2. Ensure security token is appended to password');
                    console.log('   3. Reset security token if needed');
                    console.log('   4. Check Connected App allows Password Flow');
                    console.log('   5. Verify user has API access permissions');
                    console.log('   6. Check IP restrictions in Connected App');
                    break;
                    
                case 'unsupported_grant_type':
                    console.log('🔍 DIAGNOSIS: Password Flow not enabled');
                    console.log('💡 SOLUTION: Enable Password Flow in Connected App OAuth settings');
                    break;
                    
                default:
                    console.log('🔍 DIAGNOSIS: Unknown error -', data.error);
                    console.log('💡 SOLUTION: Check Salesforce documentation for error code');
            }
        }
        
    } catch (error) {
        console.log('\n💥 NETWORK ERROR:', error.message);
        console.log('💡 Check your internet connection and Salesforce URL');
    }
}

// Instructions
console.log('⚙️  SETUP INSTRUCTIONS:');
console.log('1. Replace YOUR_CLIENT_ID with your actual Consumer Key');
console.log('2. Replace YOUR_CLIENT_SECRET with your actual Consumer Secret');
console.log('3. Replace YOUR_PASSWORD_WITH_TOKEN with: yourPassword + securityToken');
console.log('4. Run: node test-sf-auth.js\n');

testSalesforceAuth(); 