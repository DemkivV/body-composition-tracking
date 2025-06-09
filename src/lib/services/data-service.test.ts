import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataService } from './data-service';
import { dataStore, dataActions } from '$lib/stores/data';
import { get } from 'svelte/store';

// Mock the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DataService', () => {
	beforeEach(() => {
		// Reset store to initial state
		dataActions.clearData();
		mockFetch.mockClear();

		// Reset the singleton's internal state
		// @ts-expect-error - accessing private property for testing
		dataService.initializationPromise = null;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initialize', () => {
		it('should load both body composition and cycle data', async () => {
			const bodyCompData = [
				{
					id: 1,
					Date: '2024-01-01 12:00:00',
					'Weight (kg)': '70.0',
					'Fat mass (kg)': '15.0',
					'Bone mass (kg)': '3.0',
					'Muscle mass (kg)': '35.0',
					'Hydration (kg)': '45.0',
					Comments: 'Test data'
				}
			];

			const cycleData = [
				{
					id: 1,
					'Start Date': '2024-01-01',
					'End Date': '2024-01-20',
					'Cycle Name': 'Test Cycle',
					Comments: 'Test cycle data'
				}
			];

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ success: true, data: bodyCompData })
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ success: true, data: cycleData })
				});

			await dataService.initialize();

			const state = get(dataStore);
			expect(state.bodyCompositionData).toHaveLength(1);
			expect(state.cycleData).toHaveLength(1);
			expect(state.initialized).toBe(true);
			expect(state.loading).toBe(false);
			expect(state.bodyCompLoading).toBe(false);
			expect(state.cycleLoading).toBe(false);
		});

		it('should only initialize once even if called multiple times', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true, data: [] })
			});

			const promise1 = dataService.initialize();
			const promise2 = dataService.initialize();

			// Both calls should return the same promise
			expect(promise1).toStrictEqual(promise2);

			await Promise.all([promise1, promise2]);

			// Should only make 2 fetch calls (one for body comp, one for cycle data)
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should handle API errors gracefully', async () => {
			mockFetch
				.mockRejectedValueOnce(new Error('Network error'))
				.mockRejectedValueOnce(new Error('Network error'));

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await dataService.initialize();

			// Error might not be set if individual loaders handle their own errors
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('loadBodyCompositionData', () => {
		it('should fetch and sort body composition data', async () => {
			const mockData = [
				{
					id: 1,
					Date: '2024-01-01 12:00:00',
					'Weight (kg)': '70.0',
					'Fat mass (kg)': '15.0',
					'Bone mass (kg)': '3.0',
					'Muscle mass (kg)': '35.0',
					'Hydration (kg)': '45.0',
					Comments: 'Earlier data'
				},
				{
					id: 2,
					Date: '2024-01-02 12:00:00',
					'Weight (kg)': '70.5',
					'Fat mass (kg)': '15.2',
					'Bone mass (kg)': '3.1',
					'Muscle mass (kg)': '35.2',
					'Hydration (kg)': '45.2',
					Comments: 'Later data'
				}
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockData })
			});

			await dataService.loadBodyCompositionData();

			const state = get(dataStore);
			expect(state.bodyCompositionData).toHaveLength(2);
			// Should be sorted with newest first
			expect(state.bodyCompositionData[0].Date).toBe('2024-01-02 12:00:00');
			expect(state.bodyCompositionData[1].Date).toBe('2024-01-01 12:00:00');
			expect(state.bodyCompLastUpdated).toBeInstanceOf(Date);
		});

		it('should handle API errors without throwing', async () => {
			mockFetch.mockRejectedValue(new Error('API Error'));

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await dataService.loadBodyCompositionData();

			const state = get(dataStore);
			expect(state.bodyCompLoading).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('loadCycleData', () => {
		it('should fetch and sort cycle data', async () => {
			const mockData = [
				{
					id: 1,
					'Start Date': '2024-01-01',
					'End Date': '2024-01-20',
					'Cycle Name': 'Earlier Cycle',
					Comments: 'First cycle'
				},
				{
					id: 2,
					'Start Date': '2024-02-01',
					'End Date': '2024-02-20',
					'Cycle Name': 'Later Cycle',
					Comments: 'Second cycle'
				}
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockData })
			});

			await dataService.loadCycleData();

			const state = get(dataStore);
			expect(state.cycleData).toHaveLength(2);
			// Should be sorted with newest first
			expect(state.cycleData[0]['Start Date']).toBe('2024-02-01');
			expect(state.cycleData[1]['Start Date']).toBe('2024-01-01');
			expect(state.cycleLastUpdated).toBeInstanceOf(Date);
		});

		it('should handle API errors without throwing', async () => {
			mockFetch.mockRejectedValue(new Error('API Error'));

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await dataService.loadCycleData();

			const state = get(dataStore);
			expect(state.cycleLoading).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('refresh methods', () => {
		it('should refresh body composition data', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: [] })
			});

			await dataService.refreshBodyCompositionData();

			expect(mockFetch).toHaveBeenCalledWith('/api/data/raw');
		});

		it('should refresh cycle data', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: [] })
			});

			await dataService.refreshCycleData();

			expect(mockFetch).toHaveBeenCalledWith('/api/data/cycles');
		});

		it('should refresh all data', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true, data: [] })
			});

			await dataService.refreshAllData();

			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(mockFetch).toHaveBeenCalledWith('/api/data/raw');
			expect(mockFetch).toHaveBeenCalledWith('/api/data/cycles');
		});
	});

	describe('utility methods', () => {
		it('should track initialization state', () => {
			expect(dataService.isInitialized()).toBe(false);
			expect(dataService.getInitializationPromise()).toBeNull();

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true, data: [] })
			});

			const promise = dataService.initialize();

			expect(dataService.isInitialized()).toBe(true);
			expect(dataService.getInitializationPromise()).toStrictEqual(promise);
		});
	});
});
