import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
	testDir: 'e2e',
	workers: process.env.CI ? undefined : 12,
	timeout: 60000,
	expect: {
		timeout: 10000
	},
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',

	// Global setup to prepare isolated test data environment
	globalSetup: path.resolve('./e2e/global-setup.ts'),

	// Clean up the temp directory after all tests are done
	globalTeardown: path.resolve('./e2e/global-teardown.ts'),

	// Configure web server for tests
	webServer: {
		command: 'cmd /c "npm run build && npm run preview"',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		// CRITICAL: Set environment variable for the server process
		env: {
			// Use the path set by our globalSetup script
			DATA_DIR: process.env.TEST_DATA_PATH || 'test-results/temp-data'
		}
	},

	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
