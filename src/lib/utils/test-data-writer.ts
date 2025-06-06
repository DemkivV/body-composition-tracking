import type { DataWriter } from './data-writer.js';

export interface WriteOperation {
	filename: string;
	content: string;
	timestamp: Date;
}

export class MockDataWriter implements DataWriter {
	public writeOperations: WriteOperation[] = [];
	public mockFileContents: Map<string, string> = new Map();

	async writeCSV(filename: string, content: string): Promise<void> {
		this.writeOperations.push({
			filename,
			content,
			timestamp: new Date()
		});
		this.mockFileContents.set(filename, content);
	}

	async readCSV(filename: string): Promise<string> {
		const content = this.mockFileContents.get(filename);
		if (content === undefined) {
			throw new Error(`File not found: ${filename}`);
		}
		return content;
	}

	async ensureDataDir(): Promise<void> {
		// No-op in tests
	}

	getDataPath(filename: string): string {
		return `mock://${filename}`;
	}

	// Test utilities
	getLastWrite(): WriteOperation | undefined {
		return this.writeOperations[this.writeOperations.length - 1];
	}

	getWritesForFile(filename: string): WriteOperation[] {
		return this.writeOperations.filter((op) => op.filename === filename);
	}

	clear(): void {
		this.writeOperations = [];
		this.mockFileContents.clear();
	}

	expectWrite(filename: string, expectedContent?: string): WriteOperation {
		const writes = this.getWritesForFile(filename);
		if (writes.length === 0) {
			throw new Error(`No writes found for file: ${filename}`);
		}
		const lastWrite = writes[writes.length - 1];
		if (expectedContent && !lastWrite.content.includes(expectedContent)) {
			throw new Error(
				`Expected content not found in ${filename}. Expected: ${expectedContent}, Got: ${lastWrite.content}`
			);
		}
		return lastWrite;
	}
}

export const mockDataWriter = new MockDataWriter();
