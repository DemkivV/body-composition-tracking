// E2E Mock Data Writer - writes to safe temporary directory, never production
import { promises } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DataWriter } from '../src/lib/utils/data-writer.js';

export class E2EDataWriter implements DataWriter {
	// CRITICAL: Use OS temp directory + unique E2E prefix - never production data dir
	private dataDir = join(tmpdir(), 'e2e-body-comp-test-' + Date.now());

	constructor() {
		console.log(`[E2E-MOCK] ⚠️ E2E Data Writer using SAFE temp directory: ${this.dataDir} ⚠️`);
	}

	async writeCSV(filename: string, content: string): Promise<void> {
		console.log(`[E2E-MOCK] ⚠️ Writing to SAFE temp file: ${this.getDataPath(filename)} ⚠️`);
		await this.ensureDataDir();
		const filePath = this.getDataPath(filename);
		await promises.writeFile(filePath, content, 'utf-8');
	}

	async readCSV(filename: string): Promise<string> {
		console.log(`[E2E-MOCK] ⚠️ Reading from SAFE temp file: ${this.getDataPath(filename)} ⚠️`);
		try {
			const filePath = this.getDataPath(filename);
			return await promises.readFile(filePath, 'utf-8');
		} catch {
			// Return empty if file doesn't exist in temp directory
			return '';
		}
	}

	async ensureDataDir(): Promise<void> {
		console.log(`[E2E-MOCK] ⚠️ Ensuring SAFE temp directory: ${this.dataDir} ⚠️`);
		await promises.mkdir(this.dataDir, { recursive: true });
	}

	getDataPath(filename: string): string {
		const safePath = join(this.dataDir, filename);
		console.log(`[E2E-MOCK] ⚠️ Safe temp path: ${safePath} (NOT production!) ⚠️`);
		return safePath;
	}

	// Cleanup method for after tests
	async cleanup(): Promise<void> {
		try {
			console.log(`[E2E-MOCK] ⚠️ Cleaning up temp directory: ${this.dataDir} ⚠️`);
			await promises.rm(this.dataDir, { recursive: true, force: true });
		} catch (error) {
			console.log(`[E2E-MOCK] Cleanup warning: ${error}`);
		}
	}
}

// Export using same interface as production but with E2E safety
export class FileSystemDataWriter extends E2EDataWriter {}

export const dataWriter = new E2EDataWriter();

console.log('[E2E-MOCK] ⚠️ E2E Data Writer Mock loaded - writes to SAFE temp directory only ⚠️');
