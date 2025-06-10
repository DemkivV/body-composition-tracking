import { promises as fs } from 'fs';
import { join } from 'path';

export interface DataWriter {
	writeCSV(filename: string, content: string): Promise<void>;
	readCSV(filename: string): Promise<string>;
	ensureDataDir(): Promise<void>;
	getDataPath(filename: string): string;
}

export class FileSystemDataWriter implements DataWriter {
	private readonly dataDir: string;

	constructor() {
		// Use environment variable if set, otherwise fallback to default
		const envDataDir = process.env.VITE_DATA_DIR || process.env.DATA_DIR;
		this.dataDir = envDataDir || join(process.cwd(), 'data');
	}

	async writeCSV(filename: string, content: string): Promise<void> {
		await this.ensureDataDir();
		const filePath = this.getDataPath(filename);
		await fs.writeFile(filePath, content, 'utf-8');
	}

	async readCSV(filename: string): Promise<string> {
		const filePath = this.getDataPath(filename);
		return await fs.readFile(filePath, 'utf-8');
	}

	async ensureDataDir(): Promise<void> {
		await fs.mkdir(this.dataDir, { recursive: true });
	}

	getDataPath(filename: string): string {
		return join(this.dataDir, filename);
	}
}

// Default instance for production use
export const dataWriter: DataWriter = new FileSystemDataWriter();
