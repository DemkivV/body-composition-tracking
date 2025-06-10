import { promises as fs } from 'fs';
import path from 'path';

async function globalSetup() {
	const sourceDataPath = path.resolve('data');
	const tempDataDir = path.resolve('test-results/temp-data');

	// Ensure the temp directory is clean before a run
	await fs.mkdir(tempDataDir, { recursive: true });
	try {
		await fs.rm(tempDataDir, { recursive: true, force: true });
		await fs.mkdir(tempDataDir, { recursive: true });
	} catch {
		// Directory might not exist, create it
		await fs.mkdir(tempDataDir, { recursive: true });
	}

	// Create empty CSV files with just headers for clean test state
	// This ensures tests start with empty data by default
	const bodyCompCsvHeaders =
		'"Date","Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)","Comments"';
	const cycleCsvHeaders = '"Start Date","End Date","Cycle Name","Comments"';

	// Create empty CSV files
	await fs.writeFile(
		path.join(tempDataDir, 'raw_data_this_app.csv'),
		bodyCompCsvHeaders + '\n',
		'utf-8'
	);
	await fs.writeFile(path.join(tempDataDir, 'cycle_data.csv'), cycleCsvHeaders + '\n', 'utf-8');

	// If we need standard test data for some tests, we can copy production data
	// but only when specifically needed (this can be done by individual tests)
	const shouldCopyData = process.env.COPY_PRODUCTION_DATA === 'true';
	if (shouldCopyData) {
		try {
			const sourceExists = await fs
				.access(sourceDataPath)
				.then(() => true)
				.catch(() => false);
			if (sourceExists) {
				const sourceFiles = await fs.readdir(sourceDataPath);
				for (const file of sourceFiles) {
					const sourcePath = path.join(sourceDataPath, file);
					const destPath = path.join(tempDataDir, file);
					await fs.copyFile(sourcePath, destPath);
				}
			}
		} catch (error) {
			console.log(`[GLOBAL-SETUP] Note: No existing data directory to copy (${error})`);
		}
	}

	// Set an environment variable that the playwright.config.ts can read
	process.env.TEST_DATA_PATH = tempDataDir;

	console.log(`[GLOBAL-SETUP] Test data directory prepared: ${tempDataDir}`);
}

export default globalSetup;
