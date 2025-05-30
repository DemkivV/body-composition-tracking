import { isAuthenticated } from '../server/withings-auth.js';
import { WithingsSource } from '../server/withings-source.js';
import { getDataDir } from '../server/config.js';
import { join } from 'path';
import { promises as fs } from 'fs';
import type { ImportResult } from '../types/measurements.js';

export class ImportService {
	private withingsSource: WithingsSource | null = null;

	/**
	 * Get Withings source instance
	 */
	private getWithingsSource(): WithingsSource {
		if (!this.withingsSource) {
			this.withingsSource = new WithingsSource();
		}
		return this.withingsSource;
	}

	/**
	 * Check if user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		try {
			return await isAuthenticated();
		} catch (error) {
			console.error('Error checking authentication:', error);
			return false;
		}
	}

	/**
	 * Import data from Withings API
	 */
	async importData(): Promise<ImportResult> {
		try {
			// Check authentication
			const authenticated = await this.isAuthenticated();
			if (!authenticated) {
				return {
					success: false,
					message: 'Not authenticated. Please authenticate first.'
				};
			}

			const source = this.getWithingsSource();
			
			// Get the most recent timestamp from existing data
			const mostRecentTimestamp = await source.getMostRecentTimestamp();
			
			let startDate: Date;
			if (mostRecentTimestamp) {
				// Start from 1 minute after the most recent entry to avoid duplicates
				// (Withings timestamps are usually rounded to minutes)
				startDate = new Date(mostRecentTimestamp.getTime() + 60 * 1000);
			} else {
				// Fallback: import from 30 days ago if no existing data found
				startDate = new Date();
				startDate.setDate(startDate.getDate() - 30);
			}

			// Import data from API
			const count = await source.importIncrementalDataToCSV(startDate);

			// Transform to unified format
			const totalUnified = await source.transformToUnifiedFormat();

			// Generate file paths
			const withingsCsvPath = join(getDataDir(), 'raw_data_withings_api.csv');
			const unifiedCsvPath = join(getDataDir(), 'raw_data_this_app.csv');

			if (count === 0) {
				return {
					success: true,
					message: 'No new measurements available.',
					file_path: withingsCsvPath,
					unified_file: unifiedCsvPath,
					count: 0,
					total_unified: totalUnified
				};
			}

			// Simplified message format
			const measurementWord = count === 1 ? 'measurement' : 'measurements';
			const message = `Successfully imported ${count} ${measurementWord}.`;

			return {
				success: true,
				message,
				file_path: withingsCsvPath,
				unified_file: unifiedCsvPath,
				count,
				total_unified: totalUnified
			};

		} catch (error) {
			console.error('Error importing data:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			
			return {
				success: false,
				message: `Import failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Import all historical data from Withings API
	 */
	async importAllData(): Promise<ImportResult> {
		try {
			// Check authentication
			const authenticated = await this.isAuthenticated();
			if (!authenticated) {
				return {
					success: false,
					message: 'Not authenticated. Please authenticate first.'
				};
			}

			const source = this.getWithingsSource();
			
			// Import all available data
			const count = await source.importAllDataToCSV();

			// Transform to unified format
			const totalUnified = await source.transformToUnifiedFormat();

			// Generate file paths
			const withingsCsvPath = join(getDataDir(), 'raw_data_withings_api.csv');
			const unifiedCsvPath = join(getDataDir(), 'raw_data_this_app.csv');

			if (count === 0) {
				return {
					success: true,
					message: 'No measurements available for import.',
					file_path: withingsCsvPath,
					unified_file: unifiedCsvPath,
					count: 0,
					total_unified: totalUnified
				};
			}

			// Simplified message format
			const measurementWord = count === 1 ? 'measurement' : 'measurements';
			const message = `Successfully imported ${count} ${measurementWord}.`;

			return {
				success: true,
				message,
				file_path: withingsCsvPath,
				unified_file: unifiedCsvPath,
				count,
				total_unified: totalUnified
			};

		} catch (error) {
			console.error('Error importing all data:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			
			return {
				success: false,
				message: `Import failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Check if Withings data file exists
	 */
	async hasExistingData(): Promise<boolean> {
		try {
			const csvPath = join(getDataDir(), 'raw_data_withings_api.csv');
			await fs.access(csvPath);
			
			// Check if file has content (more than just header)
			const content = await fs.readFile(csvPath, 'utf-8');
			const lines = content.split('\n').filter(line => line.trim());
			return lines.length > 1; // More than just header line
		} catch {
			return false;
		}
	}

	/**
	 * Intelligent import that chooses between incremental and full import
	 * based on whether data already exists
	 */
	async intelligentImport(): Promise<ImportResult> {
		try {
			// Check authentication
			const authenticated = await this.isAuthenticated();
			if (!authenticated) {
				return {
					success: false,
					message: 'Not authenticated. Please authenticate first.'
				};
			}

			// Check if data already exists
			const hasData = await this.hasExistingData();
			
			if (hasData) {
				// Use incremental import for existing data
				return await this.importData();
			} else {
				// Use full import for first time setup
				return await this.importAllData();
			}
		} catch (error) {
			console.error('Error in intelligent import:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			
			return {
				success: false,
				message: `Import failed: ${errorMessage}`
			};
		}
	}
}

// Export singleton instance
export const importService = new ImportService(); 