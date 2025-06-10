import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// Mock the dependencies BEFORE importing the service
vi.mock('../server/withings-auth.js');
vi.mock('../server/withings-source.js');
vi.mock('../server/config.js', () => ({
	getDataDir: vi.fn(() => '/tmp/test-data')
}));

// Use global fs mock from vitest.setup.ts

// Import after mocking
import { ImportService } from './import.js';
import * as withingsAuth from '../server/withings-auth.js';
import { WithingsSource } from '../server/withings-source.js';

const mockIsAuthenticated = withingsAuth.isAuthenticated as MockedFunction<
	typeof withingsAuth.isAuthenticated
>;

// Use global fs mock from vitest.setup.ts (no additional setup needed)

describe('ImportService', () => {
	let importService: ImportService;
	let mockWithingsSource: {
		importIncrementalDataToCSV: MockedFunction<() => Promise<number>>;
		importAllDataToCSV: MockedFunction<() => Promise<number>>;
		transformToUnifiedFormat: MockedFunction<() => Promise<number>>;
		getMostRecentTimestamp: MockedFunction<() => Promise<Date | null>>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		importService = new ImportService();

		// Create mock for WithingsSource
		mockWithingsSource = {
			importIncrementalDataToCSV: vi.fn(),
			importAllDataToCSV: vi.fn(),
			transformToUnifiedFormat: vi.fn(),
			getMostRecentTimestamp: vi.fn()
		};

		// Mock the WithingsSource constructor
		vi.mocked(WithingsSource).mockImplementation(() => mockWithingsSource as WithingsSource);
	});

	describe('importData', () => {
		it('should successfully import data when authenticated', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock getMostRecentTimestamp to simulate existing data
			mockWithingsSource.getMostRecentTimestamp.mockResolvedValue(new Date('2023-12-01T10:00:00Z'));

			// Mock the import methods
			mockWithingsSource.importIncrementalDataToCSV.mockResolvedValue(42);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(50);

			const result = await importService.importData();

			expect(result.success).toBe(true);
			expect(result.count).toBe(42);
			expect(result.total_unified).toBe(50);
			expect(result.message).toBe('Successfully imported 42 measurements.');
		});

		it('should return error when not authenticated', async () => {
			// Mock authentication failure
			mockIsAuthenticated.mockResolvedValue(false);

			const result = await importService.importData();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Not authenticated. Please authenticate first.');
		});

		it('should handle API errors gracefully', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock getMostRecentTimestamp to fail with error
			mockWithingsSource.getMostRecentTimestamp.mockRejectedValue(
				new Error('API connection failed')
			);

			const result = await importService.importData();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Import failed: API connection failed');
		});

		it('should handle no new measurements', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock getMostRecentTimestamp
			mockWithingsSource.getMostRecentTimestamp.mockResolvedValue(new Date('2023-12-01T10:00:00Z'));

			// Mock no new measurements
			mockWithingsSource.importIncrementalDataToCSV.mockResolvedValue(0);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(0);

			const result = await importService.importData();

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
			expect(result.message).toBe('No new measurements available.');
		});

		it('should generate correct file paths', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock getMostRecentTimestamp
			mockWithingsSource.getMostRecentTimestamp.mockResolvedValue(new Date('2023-12-01T10:00:00Z'));

			// Mock the import methods
			mockWithingsSource.importIncrementalDataToCSV.mockResolvedValue(10);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(15);

			const result = await importService.importData();

			expect(result.file_path).toContain('raw_data_withings_api.csv');
			expect(result.unified_file).toContain('raw_data_this_app.csv');
		});
	});

	describe('importAllData', () => {
		it('should successfully import all historical data', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock the import methods
			mockWithingsSource.importAllDataToCSV.mockResolvedValue(250);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(250);

			const result = await importService.importAllData();

			expect(result.success).toBe(true);
			expect(result.count).toBe(250);
			expect(result.total_unified).toBe(250);
			expect(result.message).toBe('Successfully imported 250 measurements.');
		});

		it('should return error when not authenticated', async () => {
			// Mock authentication failure
			mockIsAuthenticated.mockResolvedValue(false);

			const result = await importService.importAllData();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Not authenticated. Please authenticate first.');
		});

		it('should handle API errors gracefully', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock API error
			mockWithingsSource.importAllDataToCSV.mockRejectedValue(new Error('Network timeout'));

			const result = await importService.importAllData();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Import failed: Network timeout');
		});

		it('should handle no measurements available', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock no measurements
			mockWithingsSource.importAllDataToCSV.mockResolvedValue(0);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(0);

			const result = await importService.importAllData();

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
			expect(result.message).toBe('No measurements available for import.');
		});
	});

	describe('isAuthenticated', () => {
		it('should return true when authenticated', async () => {
			mockIsAuthenticated.mockResolvedValue(true);

			const result = await importService.isAuthenticated();

			expect(result).toBe(true);
		});

		it('should return false when not authenticated', async () => {
			mockIsAuthenticated.mockResolvedValue(false);

			const result = await importService.isAuthenticated();

			expect(result).toBe(false);
		});

		it('should return false when authentication check throws error', async () => {
			mockIsAuthenticated.mockRejectedValue(new Error('Auth check failed'));

			const result = await importService.isAuthenticated();

			expect(result).toBe(false);
		});
	});

	describe('hasExistingData', () => {
		it('should return true when data file exists with content', async () => {
			// Mock the hasExistingData method directly
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(true);

			const result = await importService.hasExistingData();

			expect(result).toBe(true);
		});

		it('should return false when data file does not exist', async () => {
			// Mock hasExistingData to return false (file doesn't exist)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(false);

			const result = await importService.hasExistingData();

			expect(result).toBe(false);
		});

		it('should return false when data file exists but has no content', async () => {
			// Mock hasExistingData to return false (no content)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(false);

			const result = await importService.hasExistingData();

			expect(result).toBe(false);
		});

		it('should return false when data file is empty', async () => {
			// Mock hasExistingData to return false (empty file)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(false);

			const result = await importService.hasExistingData();

			expect(result).toBe(false);
		});
	});

	describe('intelligentImport', () => {
		it('should use incremental import when data exists', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock hasExistingData to return true (data exists)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(true);

			// Mock getMostRecentTimestamp for incremental import
			mockWithingsSource.getMostRecentTimestamp.mockResolvedValue(new Date('2023-12-01T10:00:00Z'));

			// Mock incremental import
			mockWithingsSource.importIncrementalDataToCSV.mockResolvedValue(5);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(10);

			const result = await importService.intelligentImport();

			expect(result.success).toBe(true);
			expect(result.count).toBe(5);
			expect(mockWithingsSource.importIncrementalDataToCSV).toHaveBeenCalled();
			expect(mockWithingsSource.importAllDataToCSV).not.toHaveBeenCalled();
		});

		it('should use full import when no data exists', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock hasExistingData to return false (no data exists)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(false);

			// Mock full import
			mockWithingsSource.importAllDataToCSV.mockResolvedValue(250);
			mockWithingsSource.transformToUnifiedFormat.mockResolvedValue(250);

			const result = await importService.intelligentImport();

			expect(result.success).toBe(true);
			expect(result.count).toBe(250);
			expect(mockWithingsSource.importAllDataToCSV).toHaveBeenCalled();
			expect(mockWithingsSource.importIncrementalDataToCSV).not.toHaveBeenCalled();
		});

		it('should return error when not authenticated', async () => {
			// Mock authentication failure
			mockIsAuthenticated.mockResolvedValue(false);

			const result = await importService.intelligentImport();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Not authenticated. Please authenticate first.');
		});

		it('should handle errors gracefully', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock hasExistingData to return false (triggers full import)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(false);

			// Mock import error
			mockWithingsSource.importAllDataToCSV.mockRejectedValue(new Error('Network error'));

			const result = await importService.intelligentImport();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Import failed: Network error');
		});

		it('should handle Withings API authentication errors gracefully', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock hasExistingData to return false (triggers full import)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(false);

			// Mock Withings API authentication error
			mockWithingsSource.importAllDataToCSV.mockRejectedValue(
				new Error('Access token expired. Please re-authenticate')
			);

			const result = await importService.intelligentImport();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Import failed: Access token expired. Please re-authenticate');
		});

		it('should handle Withings API permission errors gracefully', async () => {
			// Mock authentication
			mockIsAuthenticated.mockResolvedValue(true);

			// Mock hasExistingData to return true (triggers incremental import)
			vi.spyOn(importService, 'hasExistingData').mockResolvedValue(true);
			mockWithingsSource.getMostRecentTimestamp.mockResolvedValue(new Date('2023-12-01T10:00:00Z'));

			// Mock Withings API permission error
			mockWithingsSource.importIncrementalDataToCSV.mockRejectedValue(
				new Error('Insufficient permissions for this action')
			);

			const result = await importService.intelligentImport();

			expect(result.success).toBe(false);
			expect(result.message).toBe('Import failed: Insufficient permissions for this action');
		});
	});
});
