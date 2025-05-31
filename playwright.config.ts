import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: true
	},
	testDir: 'e2e',

	// Performance optimizations for 12-core machine
	workers: process.env.CI ? undefined : 12, // undefined lets Playwright auto-detect CI workers

	// Global test settings
	timeout: 30000, // 30 seconds per test
	expect: {
		timeout: 5000 // 5 seconds for assertions
	},

	// Run tests in parallel within files
	fullyParallel: true,

	// Retry on CI only
	retries: process.env.CI ? 2 : 0,

	// Reporter configuration
	reporter: process.env.CI ? 'github' : 'list',

	use: {
		// Global test configuration
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
