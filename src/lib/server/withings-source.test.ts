import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { WithingsSource } from './withings-source.js';
import * as config from './config.js';
import { join } from 'path';
import { promises as fs } from 'fs';

// Mock dependencies
vi.mock('./config.js');
vi.mock('fs', () => ({
	promises: {
		writeFile: vi.fn(),
		readFile: vi.fn(),
		mkdir: vi.fn(),
		access: vi.fn(),
		copyFile: vi.fn()
	}
}));

// Mock global fetch
global.fetch = vi.fn();

const mockGetDataDir = config.getDataDir as MockedFunction<typeof config.getDataDir>;
const mockFetch = global.fetch as MockedFunction<typeof global.fetch>;
const mockFsWriteFile = fs.writeFile as MockedFunction<typeof fs.writeFile>;
const mockFsMkdir = fs.mkdir as MockedFunction<typeof fs.mkdir>;

// Store original console methods
let originalConsoleLog: typeof console.log;
let originalConsoleWarn: typeof console.warn;

describe('WithingsSource', () => {
	let withingsSource: WithingsSource;

	beforeEach(() => {
		vi.clearAllMocks();
		
		// Mock console methods to suppress WithingsSource output during tests
		originalConsoleLog = console.log;
		originalConsoleWarn = console.warn;
		console.log = vi.fn();
		console.warn = vi.fn();
		
		withingsSource = new WithingsSource();
		
		// Mock config
		mockGetDataDir.mockReturnValue('/tmp/test-data');
		mockFsMkdir.mockResolvedValue(undefined);
		mockFsWriteFile.mockResolvedValue(undefined);
	});

	afterEach(() => {
		// Restore original console methods
		console.log = originalConsoleLog;
		console.warn = originalConsoleWarn;
	});

	describe('importAllDataToCSV', () => {
		it('should create empty CSV when API returns successful response but no measurements', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response with status 0 (success) but empty measuregrps
			const apiResponse = {
				status: 0,
				body: {
					measuregrps: []
				}
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			const result = await withingsSource.importAllDataToCSV();

			// Should return 0 measurements
			expect(result).toBe(0);

			// Should still write CSV file with just headers
			expect(mockFsWriteFile).toHaveBeenCalledWith(
				join('/tmp/test-data', 'raw_data_withings_api.csv'),
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n',
				'utf-8'
			);
		});

		it('should create CSV with measurements when API returns valid data', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response with actual measurement data
			const apiResponse = {
				status: 0,
				body: {
					measuregrps: [
						{
							date: 1704110400, // 2024-01-01 12:00:00 UTC
							measures: [
								{ type: 1, value: 755, unit: -1 }, // Weight: 75.5 kg
								{ type: 8, value: 152, unit: -1 }, // Fat mass: 15.2 kg
								{ type: 88, value: 31, unit: -1 }, // Bone mass: 3.1 kg
								{ type: 5, value: 328, unit: -1 }, // Fat free mass: 32.8 kg
								{ type: 77, value: 244, unit: -1 } // Water mass: 24.4 kg
							]
						}
					]
				}
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			const result = await withingsSource.importAllDataToCSV();

			// Should return 1 measurement
			expect(result).toBe(1);

			// Should write CSV file with header and data
			expect(mockFsWriteFile).toHaveBeenCalledWith(
				join('/tmp/test-data', 'raw_data_withings_api.csv'),
				expect.stringContaining('Date,"Weight (kg)"'),
				'utf-8'
			);

			// Get the actual CSV content that was written
			const csvContent = (mockFsWriteFile.mock.calls[0][1] as string);
			
			// Should contain the header
			expect(csvContent).toContain('Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments');
			
			// Should contain measurement data
			expect(csvContent).toContain('75.50'); // Weight
			expect(csvContent).toContain('15.20'); // Fat mass
			expect(csvContent).toContain('3.10'); // Bone mass
			expect(csvContent).toContain('24.40'); // Hydration
		});

		it('should handle API response with missing body', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response without body (could be a bug condition)
			const apiResponse = {
				status: 0
				// No body property
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			const result = await withingsSource.importAllDataToCSV();

			// Should return 0 measurements (graceful handling)
			expect(result).toBe(0);

			// Should still write empty CSV file
			expect(mockFsWriteFile).toHaveBeenCalledWith(
				join('/tmp/test-data', 'raw_data_withings_api.csv'),
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n',
				'utf-8'
			);
		});

		it('should handle API response with missing measuregrps', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response with body but no measuregrps
			const apiResponse = {
				status: 0,
				body: {
					// No measuregrps property
				}
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			const result = await withingsSource.importAllDataToCSV();

			// Should return 0 measurements (graceful handling)
			expect(result).toBe(0);

			// Should still write empty CSV file
			expect(mockFsWriteFile).toHaveBeenCalledWith(
				join('/tmp/test-data', 'raw_data_withings_api.csv'),
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n',
				'utf-8'
			);
		});

		it('should throw error when API returns error status - FIXED BUG TEST', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response with error status
			const apiResponse = {
				status: 401, // Unauthorized
				error: 'The access token provided is invalid'
			};

			mockFetch.mockResolvedValue({
				ok: true, // HTTP response is OK, but Withings API returns error in JSON
				json: () => Promise.resolve(apiResponse)
			} as Response);

			// Now it should throw an error instead of creating empty CSV
			await expect(withingsSource.importAllDataToCSV()).rejects.toThrow('Authentication expired. Please re-authenticate and try again');

			// Should not write any CSV file
			expect(mockFsWriteFile).not.toHaveBeenCalled();
		});

		it('should throw error when token is expired - FIXED BUG TEST', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'expired-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response with expired token error
			const apiResponse = {
				status: 601, // Token expired
				error: 'Access token expired'
			};

			mockFetch.mockResolvedValue({
				ok: true, // HTTP response is OK, but Withings API returns error in JSON
				json: () => Promise.resolve(apiResponse)
			} as Response);

			// Now it should throw an error instead of creating empty CSV
			await expect(withingsSource.importAllDataToCSV()).rejects.toThrow('Authentication expired. Please re-authenticate and try again');

			// Should not write any CSV file
			expect(mockFsWriteFile).not.toHaveBeenCalled();
		});

		it('should throw error when permissions are insufficient - FIXED BUG TEST', async () => {
			// Mock the token
			vi.spyOn(withingsSource as any, 'getToken').mockResolvedValue({
				access_token: 'valid-token',
				refresh_token: 'refresh-token',
				expires_at: new Date(Date.now() + 3600000)
			});

			// Mock API response with permission error
			const apiResponse = {
				status: 603, // Permission denied 
				error: 'Insufficient scope for this action'
			};

			mockFetch.mockResolvedValue({
				ok: true, // HTTP response is OK, but Withings API returns error in JSON
				json: () => Promise.resolve(apiResponse)
			} as Response);

			// Now it should throw an error instead of creating empty CSV
			await expect(withingsSource.importAllDataToCSV()).rejects.toThrow('Insufficient permissions for this action');

			// Should not write any CSV file
			expect(mockFsWriteFile).not.toHaveBeenCalled();
		});
	});
}); 