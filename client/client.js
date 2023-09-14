const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

// Step 1: Generate Serialized Proof
function generateSerializedProof() {
    // For simplicity, we're returning a hardcoded proof. 
    // Replace this with your client-side logic.
    return "VALID_TOKEN";
}

// Step 2: Login to get JWT and Refresh Token
async function login() {
    try {
        const proof = generateSerializedProof();
        const response = await axios.post(`${SERVER_URL}/login`, { serializedProof: proof });
        return {
            jwt: response.data.token,
            refreshToken: response.data.refreshToken
        };
    } catch (error) {
        console.error('Login failed:', error.response.data);
        return null;
    }
}

// Step 3: Access Protected Endpoint
async function accessProtected(jwt) {
    try {
        const response = await axios.get(`${SERVER_URL}/protected`, {
            headers: {
                'Authorization': `Bearer ${jwt}`
            }
        });
        console.log('Protected response:', response.data);
    } catch (error) {
        console.error('Accessing protected route failed:', error.response.data);
    }
}

// Step 4: Refresh the JWT
async function refreshToken(refreshToken) {
    try {
        const response = await axios.post(`${SERVER_URL}/token`, { refreshToken });
        return response.data.token;
    } catch (error) {
        console.error('Token refresh failed:', error.response.data);
        return null;
    }
}

// Main Execution
(async function() {
    const tokens = await login();

    if (tokens) {
        await accessProtected(tokens.jwt);

        const newJWT = await refreshToken(tokens.refreshToken);
        if (newJWT) {
            console.log('Successfully refreshed JWT.');
            await accessProtected(newJWT);
        }
    }
})();



// ---------- proof submission

const makePostRequest = async (url, data) => {
    return fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
        },
    });
};

// Make a POST request to the API submitting the proof
const submitProof = async (proof) => {
    const data = { proof };
    return makePostRequest(api_url, data);
};
