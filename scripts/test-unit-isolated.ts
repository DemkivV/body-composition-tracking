import { execSync } from 'child_process';

async function runIsolatedUnitTests() {
	console.log('🔧 [UNIT-TEST] Running unit tests without dev server interference...');

	try {
		// Run unit tests with environment variables to prevent SvelteKit file regeneration
		console.log('🧪 [UNIT-TEST] Running unit tests with minimal file system impact...');
		execSync('npx vitest run --config=./vitest.config.isolated.ts --no-watch --reporter=basic', {
			cwd: process.cwd(),
			stdio: 'inherit',
			env: {
				...process.env,
				NODE_ENV: 'test',
				VITEST_POOL_WORKERS: '1', // Use single worker to avoid conflicts
				VITE_HMR: 'false', // Disable HMR
				SVELTE_KIT_DISABLE_SYNC: 'true', // Prevent svelte-kit sync during tests
				NODE_OPTIONS: '--no-warnings' // Suppress Node.js experimental warnings
			}
		});

		console.log('✅ [UNIT-TEST] Unit tests completed successfully!');
	} catch (error) {
		console.error('❌ [UNIT-TEST] Unit tests failed:', error);
		process.exit(1);
	}
}

// Execute the function when script is run
runIsolatedUnitTests();
