import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CycleDataTable from './CycleDataTable.svelte';

// Mock the fetch function
global.fetch = vi.fn();

// Setup mock to return successful response
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
	mockFetch.mockClear();
	mockFetch.mockResolvedValue({
		json: async () => ({
			success: true,
			data: [
				{
					id: 1,
					'Start Date': '2024-09-01',
					'End Date': '2024-09-20',
					'Cycle Name': 'Meso 2024.09',
					Comments: ''
				}
			]
		})
	});
});

describe('CycleDataTable', () => {
	it('should render the cycle data table with correct title', async () => {
		render(CycleDataTable);

		// Wait for the component to load
		await screen.findByText('Cycle Data');

		expect(screen.getByText('Cycle Data')).toBeInTheDocument();
		expect(screen.getByText('Add Row')).toBeInTheDocument();
	});

	it('should have correct column headers', async () => {
		render(CycleDataTable);

		// Wait for the table to load
		await screen.findByText('Start Date');

		expect(screen.getByText('Start Date')).toBeInTheDocument();
		expect(screen.getByText('End Date')).toBeInTheDocument();
		expect(screen.getByText('Cycle Name')).toBeInTheDocument();
		expect(screen.getByText('Comments')).toBeInTheDocument();
	});

	it('should call the correct API endpoint', async () => {
		render(CycleDataTable);

		// Wait for the component to make the API call
		await screen.findByText('Cycle Data');

		expect(mockFetch).toHaveBeenCalledWith('/api/data/cycles', {
			signal: expect.any(AbortSignal)
		});
	});
});
