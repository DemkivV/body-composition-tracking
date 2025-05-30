import type { ImportResult } from '../types/measurements.js';

interface ImportClientOptions {
	onProgress?: (message: string) => void;
	onError?: (error: string) => void;
}

class ImportClientService {
	/**
	 * Import incremental data from Withings API
	 */
	async importData(options: ImportClientOptions = {}): Promise<ImportResult> {
		try {
			options.onProgress?.('Starting data import...');

			const response = await fetch('/api/import', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result: ImportResult = await response.json();

			if (result.success) {
				options.onProgress?.('Import completed successfully');
			} else {
				options.onError?.(result.message);
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			options.onError?.(`Import failed: ${errorMessage}`);

			return {
				success: false,
				message: errorMessage
			};
		}
	}

	/**
	 * Import all historical data from Withings API
	 */
	async importAllData(options: ImportClientOptions = {}): Promise<ImportResult> {
		try {
			options.onProgress?.('Starting full data import (this may take a while)...');

			const response = await fetch('/api/import/all', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result: ImportResult = await response.json();

			if (result.success) {
				options.onProgress?.('Full import completed successfully');
			} else {
				options.onError?.(result.message);
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			options.onError?.(`Import failed: ${errorMessage}`);

			return {
				success: false,
				message: errorMessage
			};
		}
	}

	/**
	 * Check if existing data is available for the current data source
	 */
	async hasExistingData(): Promise<boolean> {
		try {
			const response = await fetch('/api/import/has-data', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				return false;
			}

			const result = await response.json();
			return result.hasData === true;
		} catch (error) {
			console.warn('Error checking existing data:', error);
			return false;
		}
	}

	/**
	 * Intelligent import that automatically chooses between incremental and full import
	 */
	async intelligentImport(options: ImportClientOptions = {}): Promise<ImportResult> {
		try {
			options.onProgress?.('Checking existing data...');

			const response = await fetch('/api/import/intelligent', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result: ImportResult = await response.json();

			if (result.success) {
				options.onProgress?.('Import completed successfully');
			} else {
				options.onError?.(result.message);
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			options.onError?.(`Import failed: ${errorMessage}`);

			return {
				success: false,
				message: errorMessage
			};
		}
	}
}

export const importClientService = new ImportClientService();
