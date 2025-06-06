import { env } from '$env/dynamic/private';
import { dataWriter } from '$lib/utils/data-writer.js';

interface WithingsConfig {
	clientId?: string;
	clientSecret?: string;
	redirectUri: string;
}

interface AppConfig {
	withings?: WithingsConfig;
}

const CONFIG_FILENAME = 'config.json';

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
	withings: {
		redirectUri: 'http://localhost:5173/auth/callback'
	}
};

/**
 * Load configuration from file
 */
async function loadConfig(): Promise<AppConfig> {
	try {
		await dataWriter.ensureDataDir();
		const configData = await dataWriter.readCSV(CONFIG_FILENAME);
		const config = JSON.parse(configData);

		// Merge with defaults
		return {
			...DEFAULT_CONFIG,
			...config,
			withings: {
				...DEFAULT_CONFIG.withings,
				...config.withings
			}
		};
	} catch (_error) {
		// Config file doesn't exist or is invalid, return defaults
		return DEFAULT_CONFIG;
	}
}

/**
 * Save configuration to file
 */
async function saveConfig(config: AppConfig): Promise<void> {
	await dataWriter.writeCSV(CONFIG_FILENAME, JSON.stringify(config, null, 2));
}

/**
 * Get Withings configuration (from file or environment)
 */
export async function getWithingsConfig(): Promise<WithingsConfig> {
	// First try to load from config file
	const config = await loadConfig();

	// Use environment variables as fallback (for development)
	return {
		clientId: config.withings?.clientId || env.WITHINGS_CLIENT_ID,
		clientSecret: config.withings?.clientSecret || env.WITHINGS_CLIENT_SECRET,
		redirectUri:
			config.withings?.redirectUri ||
			env.WITHINGS_REDIRECT_URI ||
			'http://localhost:5173/auth/callback'
	};
}

/**
 * Set Withings API credentials
 */
export async function setWithingsCredentials(
	clientId: string,
	clientSecret: string,
	redirectUri?: string
): Promise<void> {
	const config = await loadConfig();

	config.withings = {
		clientId,
		clientSecret,
		redirectUri: redirectUri || 'http://localhost:5173/auth/callback'
	};

	await saveConfig(config);
}

/**
 * Check if Withings credentials are configured
 */
export async function hasWithingsCredentials(): Promise<boolean> {
	const config = await getWithingsConfig();
	return !!(config.clientId && config.clientSecret);
}

/**
 * Get data directory path
 */
export function getDataDir(): string {
	return dataWriter.getDataPath('');
}
