import axios from 'axios';

const SERVER_URL: string = 'http://localhost:3000';
const PROVER_URL: string = 'http://localhost:3001/buildProof';

interface RoleMapping {
    [key: string]: [string, string];
}

const generateMockProof = async (role: string) => {
    const roleMapping: RoleMapping = {
        member: [
            '2',
            '21565680844461314807147611702860246336805372493508489110556896454939225549736',
        ],
        admin: [
            '1',
            '7555220006856562833147743033256142154591945963958408607501861037584894828141',
        ],
        invalid_role: [
            '3',
            '27942348051329088894852777850568290047473460593152551617852488829426742444656',
        ],
        invalid_proof: [
            '1',
            '21565680844461314807147611702860246336805372493508489110556896454939225549736',
        ],
    };

    const rm = roleMapping[role];
    const [preimage, hash]: [string, string] = rm || [
        0,
        '00000000000000000000000000000000000000000000000000000000000000000000000000000',
    ];

    console.log(
        `building proof: For ${role}, public_inp ${hash}, private_inp ${preimage}`,
    );

    const data: BuildProofData = {
        entrypoint: {
            name: 'SimplePreimage',
            config: {},
        },
        arguments: [hash, preimage],
    };

    const response = await axios.post(PROVER_URL, data);
    console.log('Received response:', response);
    return response.data;
};

interface BuildProofData {
    entrypoint: {
        name: string;
        config: unknown;
    };
    arguments: [string, string];
}

const mockLoginData = async (role: string) => {
    return {
        entrypoint: {
            name: 'SimplePreimage',
            config: {},
        },
        proof: await generateMockProof(role),
    };
};

interface LoginResponse {
    jwt: string;
    refreshToken: string;
}

async function login(role: string): Promise<LoginResponse | null> {
    try {
        const loginData = await mockLoginData(role);
        console.log('Login with login data:', loginData);
        const response = await axios.post(`${SERVER_URL}/login`, loginData);
        return {
            jwt: response.data.token,
            refreshToken: response.data.refreshToken,
        };
    } catch (error: unknown) {
        console.error('Login failed:', error);
        return null;
    }
}

async function accessProtected(jwt: string): Promise<void> {
    try {
        const response = await axios.get(`${SERVER_URL}/protected`, {
            headers: {
                Authorization: `Bearer ${jwt}`,
            },
        });
        console.log('Protected response:', response.data);
    } catch (error) {
        console.error('Accessing protected route failed:', error);
    }
}

async function refreshToken(refreshToken: string): Promise<string | null> {
    try {
        const response = await axios.post(`${SERVER_URL}/token`, {
            refreshToken,
        });
        return response.data.token;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
    }
}

// Main Execution
(async () => {
    // provisional tests for the backend
    const tokens = await login('admin');
    if (tokens) {
        await accessProtected(tokens.jwt);

        const newJWT = await refreshToken(tokens.refreshToken);
        if (newJWT) {
            console.log('Successfully refreshed JWT.');
            await accessProtected(newJWT);
        }
    }
})();
