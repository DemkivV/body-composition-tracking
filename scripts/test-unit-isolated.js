import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import path from 'path';

// Get the project root directory
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(PROJECT_ROOT, '.tmp');
const SHARED_TEST_DIR = path.join(TMP_DIR, 'shared-test');

async function getSharedTestDirectory() {
	// Check if main shared directory exists and is valid
	if (existsSync(SHARED_TEST_DIR)) {
		const hasProperFiles =
			existsSync(path.join(SHARED_TEST_DIR, 'src')) &&
			existsSync(path.join(SHARED_TEST_DIR, 'package.json')) &&
			existsSync(path.join(SHARED_TEST_DIR, 'node_modules'));

		if (hasProperFiles) {
			console.log('🔄 [UNIT-TEST] Using existing shared test environment');
			return SHARED_TEST_DIR;
		}
	}

	// Look for timestamped directories as fallback
	if (existsSync(TMP_DIR)) {
		try {
			const entries = readdirSync(TMP_DIR);
			const timestampedDirs = entries.filter((name) => name.startsWith('shared-test-'));
			if (timestampedDirs.length > 0) {
				timestampedDirs.sort();
				const latestDir = path.join(TMP_DIR, timestampedDirs[timestampedDirs.length - 1]);

				const hasProperFiles =
					existsSync(path.join(latestDir, 'src')) &&
					existsSync(path.join(latestDir, 'package.json')) &&
					existsSync(path.join(latestDir, 'node_modules'));

				if (hasProperFiles) {
					console.log('🔄 [UNIT-TEST] Using existing timestamped shared test environment');
					return latestDir;
				}
			}
		} catch (_error) {
			// Continue to setup
		}
	}

	// Create shared test environment using setupSharedTestEnvironment function
	console.log('📦 [UNIT-TEST] No valid shared test environment found');
	console.log('🔧 [UNIT-TEST] Creating shared test environment...');

	try {
		// Import the setup function and run it
		const { setupSharedTestEnvironment } = await import('./e2e-build.js');
		const testDir = await setupSharedTestEnvironment();
		console.log('✅ [UNIT-TEST] Test environment setup completed');
		return testDir;
	} catch (error) {
		console.error('❌ [UNIT-TEST] Failed to setup test environment:', error);
		throw new Error(`Could not create shared test environment: ${error.message}`);
	}
}

async function runIsolatedUnitTests() {
	console.log('🔧 [UNIT-TEST] Running unit tests in fully isolated sandbox environment...');

	try {
		const testDir = await getSharedTestDirectory();
		console.log(`📁 [UNIT-TEST] Using sandbox directory: ${testDir}`);

		// Ensure dependencies are installed in test directory
		if (!existsSync(path.join(testDir, 'node_modules'))) {
			console.log('📦 [UNIT-TEST] Installing dependencies in sandbox...');
			execSync('npm install', {
				cwd: testDir,
				stdio: 'inherit'
			});
		}

		// Ensure we have a clean, isolated test environment
		const isolatedEnv = {
			...process.env,
			NODE_ENV: 'test',
			VITEST_POOL_WORKERS: '1', // Use single worker to avoid conflicts
			VITE_HMR: 'false', // Disable HMR
			SVELTE_KIT_DISABLE_SYNC: 'true', // Prevent svelte-kit sync during tests
			NODE_OPTIONS: '--no-warnings', // Suppress Node.js experimental warnings
			// Prevent any file system watchers from triggering
			CHOKIDAR_USEPOLLING: 'false',
			CHOKIDAR_INTERVAL: '0',
			// Ensure tests don't interfere with dev server port
			PORT: '0',
			HOST: 'localhost'
		};

		// Run unit tests in the isolated sandbox directory
		console.log('🧪 [UNIT-TEST] Running tests in complete sandbox isolation...');
		console.log('🔒 [UNIT-TEST] Production files are fully protected - tests cannot modify them!');
		execSync(
			'npx vitest run --config=./vitest.config.isolated.ts --no-watch --reporter=default --run',
			{
				cwd: testDir, // KEY CHANGE: Run in sandbox directory, not main project
				stdio: 'inherit',
				env: isolatedEnv
			}
		);

		console.log('✅ [UNIT-TEST] Unit tests completed successfully in sandbox!');
		console.log('🛡️ [UNIT-TEST] All production files remained safe and unmodified.');
	} catch (error) {
		console.error('❌ [UNIT-TEST] Unit tests failed:', error);
		process.exit(1);
	}
}

// Execute the function when script is run
runIsolatedUnitTests();
