import { execSync } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

// Get the project root directory (parent of scripts directory)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(PROJECT_ROOT, '.tmp');
const SHARED_TEST_DIR = path.join(TMP_DIR, 'shared-test');

async function copyRecursive(src, dest) {
	const exists = existsSync(src);
	const stats = exists && (await fs.stat(src));
	const isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
		if (!existsSync(dest)) {
			await fs.mkdir(dest, { recursive: true });
		}
		for (const child of await fs.readdir(src)) {
			// Skip directories that should not be copied
			if (
				child === 'node_modules' ||
				child === '.tmp' ||
				child === '.git' ||
				child === '.svelte-kit' ||
				child === 'build' ||
				child === 'dist'
			) {
				continue;
			}
			await copyRecursive(path.join(src, child), path.join(dest, child));
		}
	} else {
		await fs.copyFile(src, dest);
	}
}

async function isSourceNewerThan(targetTime) {
	const sourceFiles = ['package.json', 'vite.config.ts', 'svelte.config.js', 'tailwind.config.js'];

	// Check individual files first
	for (const source of sourceFiles) {
		if (existsSync(path.join(PROJECT_ROOT, source))) {
			const sourceStats = statSync(path.join(PROJECT_ROOT, source));
			if (sourceStats.mtime > targetTime) {
				return { isNewer: true, source };
			}
		}
	}

	// Check directories recursively for any newer files
	const sourceDirs = ['src', 'static'];
	for (const sourceDir of sourceDirs) {
		const dirPath = path.join(PROJECT_ROOT, sourceDir);
		if (existsSync(dirPath)) {
			const hasNewerFiles = await checkDirectoryForNewerFiles(dirPath, targetTime);
			if (hasNewerFiles) {
				return { isNewer: true, source: sourceDir };
			}
		}
	}

	return { isNewer: false };
}

async function checkDirectoryForNewerFiles(dirPath, targetTime) {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);

			// Skip node_modules and other build artifacts
			if (
				entry.name === 'node_modules' ||
				entry.name === '.git' ||
				entry.name === '.tmp' ||
				entry.name === '.svelte-kit'
			) {
				continue;
			}

			const stats = await fs.stat(fullPath);

			if (stats.mtime > targetTime) {
				return true;
			}

			if (entry.isDirectory()) {
				const hasNewerFilesInSubdir = await checkDirectoryForNewerFiles(fullPath, targetTime);
				if (hasNewerFilesInSubdir) {
					return true;
				}
			}
		}
	} catch (_error) {
		// If we can't read the directory, assume it's changed
		return true;
	}

	return false;
}

async function setupSharedTestEnvironment() {
	console.log('🔧 [E2E-BUILD] Setting up shared test environment...');
	console.log(`🔧 [E2E-BUILD] Project root: ${PROJECT_ROOT}`);

	try {
		let testDir = SHARED_TEST_DIR;

		// First, check if there are existing good timestamped directories we can reuse
		if (existsSync(TMP_DIR)) {
			try {
				const entries = readdirSync(TMP_DIR);
				const timestampedDirs = entries.filter((name) => name.startsWith('shared-test-'));
				if (timestampedDirs.length > 0) {
					// Sort and use the most recent one
					timestampedDirs.sort();
					const latestDir = path.join(TMP_DIR, timestampedDirs[timestampedDirs.length - 1]);

					// Check if this directory is good and up to date
					if (
						existsSync(path.join(latestDir, 'src')) &&
						existsSync(path.join(latestDir, 'package.json'))
					) {
						const dirStats = statSync(latestDir);
						const sourceCheck = await isSourceNewerThan(dirStats.mtime);

						if (!sourceCheck.isNewer && existsSync(path.join(latestDir, 'node_modules'))) {
							console.log('⚡ [E2E-BUILD] Reusing existing timestamped test environment!');
							return latestDir;
						} else if (sourceCheck.isNewer) {
							console.log(
								`📦 [E2E-BUILD] Source '${sourceCheck.source}' is newer, will update timestamped environment...`
							);
							testDir = latestDir;
						}
					}
				}
			} catch (_error) {
				// Ignore errors in directory scanning
			}
		}

		// Check if we can reuse or fix the main shared directory
		if (testDir === SHARED_TEST_DIR && existsSync(testDir)) {
			const nestedTmpExists = existsSync(path.join(testDir, '.tmp'));
			const hasProperFiles =
				existsSync(path.join(testDir, 'src')) && existsSync(path.join(testDir, 'package.json'));

			// If main directory is corrupted, create a new timestamped one
			if (nestedTmpExists || !hasProperFiles) {
				console.log(
					'⚠️ [E2E-BUILD] Main shared directory corrupted, creating fresh timestamped environment...'
				);
				testDir = path.join(TMP_DIR, `shared-test-${Date.now()}`);
			} else {
				const dirStats = statSync(testDir);
				const sourceCheck = await isSourceNewerThan(dirStats.mtime);

				if (!sourceCheck.isNewer && existsSync(path.join(testDir, 'node_modules'))) {
					console.log('⚡ [E2E-BUILD] Reusing existing main shared test environment!');
					return testDir;
				} else if (sourceCheck.isNewer) {
					console.log(
						`📦 [E2E-BUILD] Source '${sourceCheck.source}' is newer, updating main environment...`
					);
					// Will update the existing directory
				}

				// Check if directory is locked
				try {
					await fs.access(path.join(testDir, 'node_modules'), fs.constants.W_OK);
				} catch (_error) {
					console.log(
						'⚠️ [E2E-BUILD] Main shared directory locked, creating timestamped directory...'
					);
					testDir = path.join(TMP_DIR, `shared-test-${Date.now()}`);
				}
			}
		}

		await fs.mkdir(testDir, { recursive: true });

		// Only copy files if this is a new directory or needs updating
		const needsCopying = !existsSync(path.join(testDir, 'package.json'));
		if (needsCopying) {
			console.log('📋 [E2E-BUILD] Copying project files...');
			const filesToCopy = [
				'package.json',
				'package-lock.json',
				'svelte.config.js',
				'vite.config.ts',
				'tsconfig.json',
				'tailwind.config.js',
				'vitest.config.isolated.ts',
				'vitest.config.client.ts',
				'vitest.config.server.ts',
				'vitest-setup-client.ts',
				'vitest-setup-server.ts',
				'static',
				'src'
			];

			for (const file of filesToCopy) {
				if (existsSync(path.join(PROJECT_ROOT, file))) {
					const destPath = path.join(testDir, file);
					await copyRecursive(path.join(PROJECT_ROOT, file), destPath);
				}
			}

			// Verify package.json was copied properly
			if (!existsSync(path.join(testDir, 'package.json'))) {
				console.error('❌ [E2E-BUILD] Critical: package.json was not copied properly!');
				throw new Error('Failed to copy package.json to test directory');
			}
		}

		// Install dependencies if needed - use npm install instead of npm ci to avoid lock issues
		if (!existsSync(path.join(testDir, 'node_modules'))) {
			console.log('📦 [E2E-BUILD] Installing dependencies with npm install...');
			execSync('npm install', {
				cwd: testDir,
				stdio: 'inherit'
			});
		}

		console.log('✅ [E2E-BUILD] Shared test environment ready!');
		return testDir;
	} catch (error) {
		console.error('❌ [E2E-BUILD] Failed to setup environment:', error);
		process.exit(1);
	}
}

async function tryUseDeveloperBuild(testDir) {
	console.log('🔍 [E2E-BUILD] Checking for active dev build...');

	// Check if dev build artifacts exist and are fresh in main directory
	const devOutputDir = path.join(PROJECT_ROOT, '.svelte-kit', 'output');
	const devGeneratedDir = path.join(PROJECT_ROOT, '.svelte-kit/generated');
	const devTypesDir = path.join(PROJECT_ROOT, '.svelte-kit/types');

	// Dev server creates different artifacts than production build
	// Check for any SvelteKit build artifacts that indicate recent dev activity
	const devArtifacts = [devOutputDir, devGeneratedDir, devTypesDir];
	const existingArtifacts = devArtifacts.filter((dir) => existsSync(dir));

	if (existingArtifacts.length === 0) {
		console.log('📦 [E2E-BUILD] No dev build artifacts found, will build from scratch');
		return false;
	}

	// Get the most recent timestamp from existing dev artifacts
	let mostRecentDevTime = new Date(0);
	for (const artifact of existingArtifacts) {
		const stats = statSync(artifact);
		if (stats.mtime > mostRecentDevTime) {
			mostRecentDevTime = stats.mtime;
		}
	}

	// Check if source files are newer than dev build
	const sourceCheck = await isSourceNewerThan(mostRecentDevTime);
	if (sourceCheck.isNewer) {
		console.log(`📦 [E2E-BUILD] Source '${sourceCheck.source}' is newer than dev build`);
		return false;
	}

	// Check if production build exists in test dir and is newer than dev build
	const prodBuildDir = path.join(testDir, '.svelte-kit/output');
	if (existsSync(prodBuildDir)) {
		const prodStats = statSync(prodBuildDir);
		if (prodStats.mtime > mostRecentDevTime) {
			console.log('⚡ [E2E-BUILD] Production build in test dir is already up to date!');
			return true;
		}
	}

	// If dev artifacts exist and are fresh, but we need production build for E2E
	// Try to copy dev .svelte-kit directory if it has useful artifacts
	if (existsSync(devOutputDir)) {
		try {
			console.log('🔄 [E2E-BUILD] Copying fresh dev build artifacts to test environment...');
			const testSvelteKitDir = path.join(testDir, '.svelte-kit');
			await fs.mkdir(testSvelteKitDir, { recursive: true });

			// Copy the entire .svelte-kit directory from dev to test
			await copyRecursive(path.join(PROJECT_ROOT, '.svelte-kit'), testSvelteKitDir);

			console.log('✅ [E2E-BUILD] Successfully copied dev build artifacts!');
			return true;
		} catch (error) {
			console.log(
				'⚠️ [E2E-BUILD] Failed to copy dev build artifacts, will build fresh:',
				error.message
			);
			return false;
		}
	}

	console.log('🔄 [E2E-BUILD] Dev build is fresh, but need production build for E2E tests...');
	return false;
}

async function smartBuild() {
	console.log('🔧 [E2E-BUILD] Checking if build is needed...');

	let testDir;
	try {
		// Setup shared test environment
		testDir = await setupSharedTestEnvironment();

		// First, try to use the developer build if available and fresh
		const usedDevBuild = await tryUseDeveloperBuild(testDir);
		if (!usedDevBuild) {
			// Check if production build exists in test dir and is up to date
			const buildOutputDir = path.join(testDir, '.svelte-kit/output');
			if (existsSync(buildOutputDir)) {
				const buildStats = statSync(buildOutputDir);
				const sourceCheck = await isSourceNewerThan(buildStats.mtime);

				if (!sourceCheck.isNewer) {
					console.log('⚡ [E2E-BUILD] Production build in test dir is up to date, skipping!');
				} else {
					console.log(
						`📦 [E2E-BUILD] Source '${sourceCheck.source}' is newer than build, rebuilding...`
					);
					await runBuild(testDir);
				}
			} else {
				console.log('📦 [E2E-BUILD] No production build found in test dir, building...');
				await runBuild(testDir);
			}
		}
	} catch (error) {
		console.error('❌ [E2E-BUILD] Build check failed:', error);
		// Fallback: setup environment and build
		testDir = await setupSharedTestEnvironment();
		await runBuild(testDir);
	}

	// Start the preview server
	await startPreviewServer(testDir);
}

async function runBuild(testDir) {
	console.log('🏗️ [E2E-BUILD] Building application in test environment...');
	try {
		execSync('npm run build', {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'inherit']
		});
		console.log('✅ [E2E-BUILD] Build completed successfully!');
	} catch (error) {
		console.error('❌ [E2E-BUILD] Build failed:', error);
		process.exit(1);
	}
}

async function startPreviewServer(testDir) {
	console.log('🚀 [E2E-BUILD] Starting preview server...');
	try {
		// Start the preview server and keep it running
		execSync('npm run preview -- --port 4174', {
			cwd: testDir,
			stdio: ['inherit', 'inherit', 'inherit']
		});
	} catch (error) {
		console.error('❌ [E2E-BUILD] Preview server failed:', error);
		process.exit(1);
	}
}

// Run if called directly
if (
	import.meta.url.startsWith('file:') &&
	process.argv[1] &&
	import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
	smartBuild();
}

export { smartBuild, setupSharedTestEnvironment };
