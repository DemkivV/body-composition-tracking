import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, PUT } from '../../routes/api/data/cycles/+server';
import { readFile, writeFile, access } from 'fs/promises';

// Mock the fs/promises module
vi.mock('fs/promises');

const mockReadFile = readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as ReturnType<typeof vi.fn>;
const mockAccess = access as ReturnType<typeof vi.fn>;

describe('/api/data/cycles', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('GET', () => {
		it('should return initial data when file does not exist', async () => {
			// Mock file not existing
			mockAccess.mockRejectedValue(new Error('File not found'));
			mockWriteFile.mockResolvedValue(undefined);

			const response = await GET();
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);

			// Should have generated data with cycles (most recent first)
			expect(result.data[0]['Cycle Name']).toMatch(/Meso \d{4}\.\d{2}/);
		});

		it('should parse and return existing CSV data', async () => {
			const csvData = `"Start Date","End Date","Cycle Name","Comments"
"2024-09-01","2024-09-20","Meso 2024.09",""
"2024-10-01","2024-10-20","Meso 2024.10","Test comment"`;

			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(csvData);

			const response = await GET();
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data[0]['Cycle Name']).toBe('Meso 2024.09');
			expect(result.data[1]['Cycle Name']).toBe('Meso 2024.10');
			expect(result.data[1]['Comments']).toBe('Test comment');
		});

		it('should handle empty file by generating initial data', async () => {
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue('');
			mockWriteFile.mockResolvedValue(undefined);

			const response = await GET();
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);
		});
	});

	describe('PUT', () => {
		it('should save data to CSV file', async () => {
			const testData = [
				{
					'Start Date': '2024-09-01',
					'End Date': '2024-09-20',
					'Cycle Name': 'Meso 2024.09',
					Comments: ''
				}
			];

			mockWriteFile.mockResolvedValue(undefined);

			const request = new Request('http://localhost', {
				method: 'PUT',
				body: JSON.stringify({ data: testData })
			});

			const response = await PUT({ request } as { request: Request });
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(mockWriteFile).toHaveBeenCalledWith(
				expect.stringContaining('cycle_data.csv'),
				expect.stringContaining('"Start Date","End Date","Cycle Name","Comments"'),
				'utf-8'
			);
		});

		it('should handle invalid data format', async () => {
			const request = new Request('http://localhost', {
				method: 'PUT',
				body: JSON.stringify({ data: 'invalid' })
			});

			const response = await PUT({ request } as { request: Request });
			const result = await response.json();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid data format');
			expect(response.status).toBe(400);
		});
	});
});
