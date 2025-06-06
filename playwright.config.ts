import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { existsSync, readdirSync } from 'fs';

// Get the shared test directory
function getSharedTestDir(): string {
	const sharedTestDir = path.join(process.cwd(), '.tmp', 'shared-test');
	if (existsSync(sharedTestDir)) {
		return sharedTestDir;
	}

	// Fallback: look for timestamped shared-test directories
	const tmpDir = path.join(process.cwd(), '.tmp');
	if (existsSync(tmpDir)) {
		try {
			const entries = readdirSync(tmpDir);
			const sharedDirs = entries.filter((name: string) => name.startsWith('shared-test-'));
			if (sharedDirs.length > 0) {
				// Use the most recent one
				sharedDirs.sort();
				return path.join(tmpDir, sharedDirs[sharedDirs.length - 1]);
			}
		} catch (_error) {
			// Ignore error and fall back to default
		}
	}

	// Final fallback
	return sharedTestDir;
}

const _TEST_BUILD_DIR = getSharedTestDir();

export default defineConfig({
	// Use a distinct port for E2E tests to avoid conflicts with the dev server
	webServer: {
		command: 'node scripts/e2e-build.js',
		port: 4174,
		reuseExistingServer: !process.env.CI,
		stdout: 'pipe',
		stderr: 'pipe'
	},

	// Path to the global setup and teardown scripts.
	// These will create and manage the isolated test environment.
	// globalSetup: './scripts/e2e-setup.js',
	// globalTeardown: './scripts/e2e-teardown.ts',

	testDir: 'e2e',

	// Performance optimizations for 12-core machine
	workers: process.env.CI ? undefined : 12,

	// Global test settings
	timeout: 60000, // Increased timeout to account for build time in setup
	expect: {
		timeout: 10000 // Increased expect timeout for potentially slower CI runs
	},

	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',

	use: {
		baseURL: 'http://localhost:4174',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
		// Uncomment these if you want to test on multiple browsers
		// {
		// 	name: 'firefox',
		// 	use: { ...devices['Desktop Firefox'] },
		// },
		// {
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] },
		// },
	]
});
