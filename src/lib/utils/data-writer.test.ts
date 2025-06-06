import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FileSystemDataWriter } from './data-writer.js';

describe('FileSystemDataWriter', () => {
	let dataWriter: FileSystemDataWriter;
	let testDir: string;
	let testFile: string;

	beforeEach(async () => {
		// Create a temporary test directory
		testDir = join(process.cwd(), 'test-data-writer-temp');
		testFile = 'test-file.csv';

		// Use a custom data writer pointing to test directory
		dataWriter = new (class extends FileSystemDataWriter {
			protected readonly dataDir = testDir;

			getDataPath(filename: string): string {
				return join(this.dataDir, filename);
			}
		})();

		await dataWriter.ensureDataDir();
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should write and read CSV files correctly', async () => {
		const testContent = 'Date,Weight\n2024-01-01,75.5\n2024-01-02,76.0';

		// Write the file
		await dataWriter.writeCSV(testFile, testContent);

		// Verify file exists
		const filePath = dataWriter.getDataPath(testFile);
		const exists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Read the file back
		const readContent = await dataWriter.readCSV(testFile);
		expect(readContent).toBe(testContent);
	});

	it('should create data directory if it does not exist', async () => {
		// Remove the directory
		await fs.rm(testDir, { recursive: true, force: true });

		// Ensure directory gets created
		await dataWriter.ensureDataDir();

		// Verify directory exists
		const stats = await fs.stat(testDir);
		expect(stats.isDirectory()).toBe(true);
	});

	it('should handle non-existent files gracefully', async () => {
		const nonExistentFile = 'does-not-exist.csv';

		await expect(dataWriter.readCSV(nonExistentFile)).rejects.toThrow();
	});

	it('should return correct data paths', () => {
		const filename = 'test.csv';
		const expectedPath = join(testDir, filename);

		expect(dataWriter.getDataPath(filename)).toBe(expectedPath);
	});
});
