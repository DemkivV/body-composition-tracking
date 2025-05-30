import { getWithingsConfig, getDataDir } from './config.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Withings OAuth endpoints
const WITHINGS_AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2';
const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
const WITHINGS_SCOPES = ['user.metrics'];

interface WithingsToken {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	userid: number;
	expires_at: number;
}

interface AuthState {
	state: string;
	codeVerifier: string;
	timestamp: number;
}

// In-memory storage for auth states
const authStates = new Map<string, AuthState>();

// Token storage file path
const TOKEN_FILE = 'authentication_token_withings.json';

/**
 * Get full path to token file
 */
function getTokenFilePath(): string {
	return join(getDataDir(), TOKEN_FILE);
}

/**
 * Load token from file storage
 */
async function loadToken(): Promise<WithingsToken | null> {
	try {
		const tokenPath = getTokenFilePath();
		const tokenData = await fs.readFile(tokenPath, 'utf-8');
		const token = JSON.parse(tokenData);

		// Validate token structure
		if (!token.access_token || !token.refresh_token) {
			return null;
		}

		return token;
	} catch (error) {
		// Token file doesn't exist or is invalid
		return null;
	}
}

/**
 * Save token to file storage
 */
async function saveToken(token: WithingsToken): Promise<void> {
	const tokenPath = getTokenFilePath();
	await fs.writeFile(tokenPath, JSON.stringify(token, null, 2), 'utf-8');

	// Set restrictive permissions (readable only by owner)
	try {
		await fs.chmod(tokenPath, 0o600);
	} catch (error) {
		// chmod might not work on all systems, but that's okay
	}
}

/**
 * Clear stored token
 */
async function clearToken(): Promise<void> {
	try {
		const tokenPath = getTokenFilePath();
		await fs.unlink(tokenPath);
	} catch (error) {
		// File might not exist, that's fine
	}
}

/**
 * Generate OAuth authorization URL
 */
export async function generateAuthUrl(): Promise<{ authUrl: string; state: string }> {
	const config = await getWithingsConfig();

	if (!config.clientId) {
		throw new Error('Withings client ID not configured. Please set up your API credentials first.');
	}

	const state = randomBytes(32).toString('hex');
	const codeVerifier = randomBytes(32).toString('hex');

	// Store auth state for validation
	authStates.set(state, {
		state,
		codeVerifier,
		timestamp: Date.now()
	});

	// Clean up old states (older than 10 minutes)
	const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
	for (const [key, value] of authStates.entries()) {
		if (value.timestamp < tenMinutesAgo) {
			authStates.delete(key);
		}
	}

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: WITHINGS_SCOPES.join(' '),
		state: state,
		access_type: 'offline', // Request refresh token
		prompt: 'consent'
	});

	const authUrl = `${WITHINGS_AUTH_URL}?${params.toString()}`;

	return { authUrl, state };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string, state: string): Promise<WithingsToken> {
	const config = await getWithingsConfig();

	if (!config.clientId || !config.clientSecret) {
		throw new Error(
			'Withings credentials not configured. Please set up your API credentials first.'
		);
	}

	// Validate state
	const authState = authStates.get(state);
	if (!authState) {
		throw new Error('Invalid or expired state parameter');
	}

	// Remove used state
	authStates.delete(state);

	const tokenData = {
		action: 'requesttoken',
		grant_type: 'authorization_code',
		client_id: config.clientId,
		client_secret: config.clientSecret,
		code: code,
		redirect_uri: config.redirectUri
	};

	const response = await fetch(WITHINGS_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': 'body-composition-tracker/1.0'
		},
		body: new URLSearchParams(tokenData)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
	}

	const responseData = await response.json();

	// Withings returns tokens in a 'body' field
	const tokenInfo = responseData.body || responseData;

	if (tokenInfo.error) {
		throw new Error(
			`Withings API error: ${tokenInfo.error} - ${tokenInfo.error_description || ''}`
		);
	}

	if (!tokenInfo.access_token) {
		throw new Error('No access token received from Withings');
	}

	// Add expires_at timestamp
	const token: WithingsToken = {
		...tokenInfo,
		expires_at: Date.now() + tokenInfo.expires_in * 1000
	};

	// Save token to file
	await saveToken(token);

	return token;
}

/**
 * Check if a token is expired
 */
function isTokenExpired(token: WithingsToken): boolean {
	return Date.now() > token.expires_at - 60000; // 1 minute buffer
}

/**
 * Refresh an access token using refresh token
 */
export async function refreshToken(token: WithingsToken): Promise<WithingsToken> {
	const config = await getWithingsConfig();

	if (!config.clientId || !config.clientSecret) {
		throw new Error('Withings credentials not configured');
	}

	if (!token.refresh_token) {
		throw new Error('No refresh token available');
	}

	const tokenData = {
		action: 'requesttoken',
		grant_type: 'refresh_token',
		client_id: config.clientId,
		client_secret: config.clientSecret,
		refresh_token: token.refresh_token
	};

	const response = await fetch(WITHINGS_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': 'body-composition-tracker/1.0'
		},
		body: new URLSearchParams(tokenData)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
	}

	const responseData = await response.json();
	const tokenInfo = responseData.body || responseData;

	if (tokenInfo.error) {
		throw new Error(
			`Withings API error: ${tokenInfo.error} - ${tokenInfo.error_description || ''}`
		);
	}

	if (!tokenInfo.access_token) {
		throw new Error('No access token received from refresh');
	}

	// Update token with new values
	const refreshedToken: WithingsToken = {
		...token,
		...tokenInfo,
		expires_at: Date.now() + tokenInfo.expires_in * 1000
	};

	// Save updated token
	await saveToken(refreshedToken);

	return refreshedToken;
}

/**
 * Get valid token (refresh if needed)
 */
export async function getValidToken(): Promise<WithingsToken | null> {
	const token = await loadToken();
	if (!token) {
		return null;
	}

	if (isTokenExpired(token)) {
		try {
			return await refreshToken(token);
		} catch (error) {
			// Refresh failed, remove invalid token
			await clearToken();
			return null;
		}
	}

	return token;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
	const token = await getValidToken();
	return token !== null;
}

/**
 * Clear user authentication
 */
export async function clearAuthentication(): Promise<void> {
	await clearToken();
}
