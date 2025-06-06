import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { mockDataWriter } from '$lib/utils/test-data-writer.js';

// Mock the data writer module in this test file
vi.mock('$lib/utils/data-writer.js', () => ({
	dataWriter: mockDataWriter,
	FileSystemDataWriter: vi.fn(),
	DataWriter: vi.fn()
}));

// Mock the auth module
vi.mock('./withings-auth.js', () => ({
	getValidToken: vi.fn()
}));

// Import after mocking
import { WithingsSource } from './withings-source.js';
import { getValidToken } from './withings-auth.js';

// Mock global fetch
global.fetch = vi.fn();

const mockFetch = global.fetch as MockedFunction<typeof global.fetch>;
const mockGetValidToken = getValidToken as MockedFunction<typeof getValidToken>;

// Store original console methods
let originalConsoleLog: typeof console.log;
let originalConsoleWarn: typeof console.warn;

describe('WithingsSource', () => {
	let withingsSource: WithingsSource;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDataWriter.clear();

		// Mock console methods to suppress WithingsSource output during tests
		originalConsoleLog = console.log;
		originalConsoleWarn = console.warn;
		console.log = vi.fn();
		console.warn = vi.fn();

		withingsSource = new WithingsSource();
	});

	afterEach(() => {
		// Restore original console methods
		console.log = originalConsoleLog;
		console.warn = originalConsoleWarn;
	});

	describe('importAllDataToCSV', () => {
		it('should create empty CSV when API returns successful response but no measurements', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
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

			// Should write CSV file with just headers to mock data writer
			const writeOp = mockDataWriter.expectWrite('raw_data_withings_api.csv');
			expect(writeOp.content).toBe(
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
			);
		});

		it('should create CSV with measurements when API returns valid data', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
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

			// Should write CSV file with header and data to mock data writer
			const writeOp = mockDataWriter.expectWrite('raw_data_withings_api.csv');

			// Should contain the header
			expect(writeOp.content).toContain(
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments'
			);

			// Should contain measurement data
			expect(writeOp.content).toContain('75.50'); // Weight
			expect(writeOp.content).toContain('15.20'); // Fat mass
			expect(writeOp.content).toContain('3.10'); // Bone mass
			expect(writeOp.content).toContain('24.40'); // Hydration
		});

		it('should handle API response with missing body', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
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

			// Should write empty CSV file to mock data writer
			const writeOp = mockDataWriter.expectWrite('raw_data_withings_api.csv');
			expect(writeOp.content).toBe(
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
			);
		});

		it('should handle API response with missing measuregrps', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
			});

			// Mock API response with body but no measuregrps
			const apiResponse = {
				status: 0,
				body: {}
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			const result = await withingsSource.importAllDataToCSV();

			// Should return 0 measurements (graceful handling)
			expect(result).toBe(0);

			// Should write empty CSV file to mock data writer
			const writeOp = mockDataWriter.expectWrite('raw_data_withings_api.csv');
			expect(writeOp.content).toBe(
				'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
			);
		});

		it('should throw error when API returns error status - FIXED BUG TEST', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
			});

			// Mock API error response
			const apiResponse = {
				status: 500,
				error: 'Internal server error'
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			await expect(withingsSource.importAllDataToCSV()).rejects.toThrow('Internal server error');

			// Should not write any file when API fails
			expect(mockDataWriter.writeOperations).toHaveLength(0);
		});

		it('should throw error when token is expired - FIXED BUG TEST', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
			});

			// Mock token expiration error
			const apiResponse = {
				status: 401,
				error: 'Token expired'
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			await expect(withingsSource.importAllDataToCSV()).rejects.toThrow(
				'Authentication expired. Please re-authenticate and try again'
			);

			// Should not write any file when authentication fails
			expect(mockDataWriter.writeOperations).toHaveLength(0);
		});

		it('should throw error when permissions are insufficient - FIXED BUG TEST', async () => {
			// Mock the token
			mockGetValidToken.mockResolvedValue({
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: Date.now() + 3600000,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.metrics',
				userid: 12345
			});

			// Mock permissions error
			const apiResponse = {
				status: 603,
				error: 'Insufficient permissions'
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(apiResponse)
			} as Response);

			await expect(withingsSource.importAllDataToCSV()).rejects.toThrow(
				'Insufficient permissions for this action'
			);

			// Should not write any file when permissions are insufficient
			expect(mockDataWriter.writeOperations).toHaveLength(0);
		});
	});
});
