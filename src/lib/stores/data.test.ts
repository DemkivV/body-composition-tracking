import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore, dataActions } from './data';
import { get } from 'svelte/store';
import type { BodyCompositionRow, CycleDataRow } from '$lib/types/data';

describe('Data Store', () => {
	beforeEach(() => {
		// Reset store to initial state before each test
		dataActions.clearData();
	});

	describe('initial state', () => {
		it('should have correct initial state', () => {
			const state = get(dataStore);

			expect(state.bodyCompositionData).toEqual([]);
			expect(state.cycleData).toEqual([]);
			expect(state.loading).toBe(false);
			expect(state.bodyCompLoading).toBe(false);
			expect(state.cycleLoading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.lastUpdated).toBeNull();
			expect(state.bodyCompLastUpdated).toBeNull();
			expect(state.cycleLastUpdated).toBeNull();
			expect(state.initialized).toBe(false);
		});
	});

	describe('loading states', () => {
		it('should set general loading state', () => {
			dataActions.setLoading(true);
			expect(get(dataStore).loading).toBe(true);

			dataActions.setLoading(false);
			expect(get(dataStore).loading).toBe(false);
		});

		it('should set body composition loading state', () => {
			dataActions.setBodyCompLoading(true);
			expect(get(dataStore).bodyCompLoading).toBe(true);

			dataActions.setBodyCompLoading(false);
			expect(get(dataStore).bodyCompLoading).toBe(false);
		});

		it('should set cycle loading state', () => {
			dataActions.setCycleLoading(true);
			expect(get(dataStore).cycleLoading).toBe(true);

			dataActions.setCycleLoading(false);
			expect(get(dataStore).cycleLoading).toBe(false);
		});

		it('should clear error when setting loading to true', () => {
			dataActions.setError('Test error');
			expect(get(dataStore).error).toBe('Test error');

			dataActions.setLoading(true);
			expect(get(dataStore).error).toBeNull();
		});
	});

	describe('body composition data management', () => {
		const sampleBodyCompData: BodyCompositionRow[] = [
			{
				id: 1,
				Date: '2024-01-01 12:00:00',
				'Weight (kg)': '70.0',
				'Fat mass (kg)': '15.0',
				'Bone mass (kg)': '3.0',
				'Muscle mass (kg)': '35.0',
				'Hydration (kg)': '45.0',
				Comments: 'Test data'
			},
			{
				id: 2,
				Date: '2024-01-02 12:00:00',
				'Weight (kg)': '70.2',
				'Fat mass (kg)': '15.1',
				'Bone mass (kg)': '3.0',
				'Muscle mass (kg)': '35.1',
				'Hydration (kg)': '45.1',
				Comments: 'More test data'
			}
		];

		it('should set body composition data', () => {
			dataActions.setBodyCompositionData(sampleBodyCompData);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toEqual(sampleBodyCompData);
			expect(state.bodyCompLoading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.bodyCompLastUpdated).toBeInstanceOf(Date);
			expect(state.lastUpdated).toBeInstanceOf(Date);
		});

		it('should maintain cycle loading when setting body comp data', () => {
			dataActions.setCycleLoading(true);
			dataActions.setBodyCompositionData(sampleBodyCompData);

			const state = get(dataStore);
			expect(state.loading).toBe(true); // Should stay true because cycle is still loading
			expect(state.bodyCompLoading).toBe(false);
			expect(state.cycleLoading).toBe(true);
		});

		it('should add new body composition row', () => {
			const newRow: BodyCompositionRow = {
				id: 3,
				Date: '2024-01-03 12:00:00',
				'Weight (kg)': '70.5',
				'Fat mass (kg)': '15.2',
				'Bone mass (kg)': '3.1',
				'Muscle mass (kg)': '35.2',
				'Hydration (kg)': '45.2',
				Comments: 'New row'
			};

			dataActions.setBodyCompositionData(sampleBodyCompData);
			dataActions.addBodyCompRow(newRow);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toHaveLength(3);
			expect(state.bodyCompositionData[0]).toEqual(newRow); // Should be first (newest)
		});

		it('should update single body composition row', () => {
			dataActions.setBodyCompositionData(sampleBodyCompData);

			const updatedRow: BodyCompositionRow = {
				...sampleBodyCompData[0],
				'Weight (kg)': '71.0',
				Comments: 'Updated comment'
			};

			dataActions.updateSingleBodyCompRow(0, updatedRow);

			const state = get(dataStore);
			expect(state.bodyCompositionData[0]).toEqual(updatedRow);
			expect(state.bodyCompositionData[1]).toEqual(sampleBodyCompData[1]); // Other rows unchanged
		});

		it('should remove body composition row', () => {
			dataActions.setBodyCompositionData(sampleBodyCompData);
			dataActions.removeBodyCompRow(0);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toHaveLength(1);
			expect(state.bodyCompositionData[0]).toEqual(sampleBodyCompData[1]);
		});

		it('should handle invalid row indices gracefully', () => {
			dataActions.setBodyCompositionData(sampleBodyCompData);

			// Try to update non-existent row
			const updatedRow: BodyCompositionRow = {
				...sampleBodyCompData[0],
				Comments: 'Should not update'
			};

			dataActions.updateSingleBodyCompRow(10, updatedRow);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toEqual(sampleBodyCompData); // Should remain unchanged
		});
	});

	describe('cycle data management', () => {
		const sampleCycleData: CycleDataRow[] = [
			{
				id: 1,
				'Start Date': '2024-01-01',
				'End Date': '2024-01-20',
				'Cycle Name': 'Test Cycle 1',
				Comments: 'First cycle'
			},
			{
				id: 2,
				'Start Date': '2024-02-01',
				'End Date': '2024-02-20',
				'Cycle Name': 'Test Cycle 2',
				Comments: 'Second cycle'
			}
		];

		it('should set cycle data', () => {
			dataActions.setCycleData(sampleCycleData);

			const state = get(dataStore);
			expect(state.cycleData).toEqual(sampleCycleData);
			expect(state.cycleLoading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.cycleLastUpdated).toBeInstanceOf(Date);
			expect(state.lastUpdated).toBeInstanceOf(Date);
		});

		it('should maintain body comp loading when setting cycle data', () => {
			dataActions.setBodyCompLoading(true);
			dataActions.setCycleData(sampleCycleData);

			const state = get(dataStore);
			expect(state.loading).toBe(true); // Should stay true because body comp is still loading
			expect(state.bodyCompLoading).toBe(true);
			expect(state.cycleLoading).toBe(false);
		});

		it('should add new cycle row', () => {
			const newRow: CycleDataRow = {
				id: 3,
				'Start Date': '2024-03-01',
				'End Date': '2024-03-20',
				'Cycle Name': 'Test Cycle 3',
				Comments: 'Third cycle'
			};

			dataActions.setCycleData(sampleCycleData);
			dataActions.addCycleRow(newRow);

			const state = get(dataStore);
			expect(state.cycleData).toHaveLength(3);
			expect(state.cycleData[0]).toEqual(newRow); // Should be first (newest)
		});

		it('should update single cycle row', () => {
			dataActions.setCycleData(sampleCycleData);

			const updatedRow: CycleDataRow = {
				...sampleCycleData[0],
				'Cycle Name': 'Updated Cycle',
				Comments: 'Updated comment'
			};

			dataActions.updateSingleCycleRow(0, updatedRow);

			const state = get(dataStore);
			expect(state.cycleData[0]).toEqual(updatedRow);
			expect(state.cycleData[1]).toEqual(sampleCycleData[1]); // Other rows unchanged
		});

		it('should remove cycle row', () => {
			dataActions.setCycleData(sampleCycleData);
			dataActions.removeCycleRow(0);

			const state = get(dataStore);
			expect(state.cycleData).toHaveLength(1);
			expect(state.cycleData[0]).toEqual(sampleCycleData[1]);
		});
	});

	describe('legacy compatibility', () => {
		it('should support legacy setData method', () => {
			const sampleData: BodyCompositionRow[] = [
				{
					id: 1,
					Date: '2024-01-01 12:00:00',
					'Weight (kg)': '70.0',
					'Fat mass (kg)': '15.0',
					'Bone mass (kg)': '3.0',
					'Muscle mass (kg)': '35.0',
					'Hydration (kg)': '45.0',
					Comments: 'Legacy test'
				}
			];

			dataActions.setData(sampleData);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toEqual(sampleData);
		});

		it('should support legacy updateSingleRow method', () => {
			const sampleData: BodyCompositionRow[] = [
				{
					id: 1,
					Date: '2024-01-01 12:00:00',
					'Weight (kg)': '70.0',
					'Fat mass (kg)': '15.0',
					'Bone mass (kg)': '3.0',
					'Muscle mass (kg)': '35.0',
					'Hydration (kg)': '45.0',
					Comments: 'Original'
				}
			];

			dataActions.setData(sampleData);

			const updatedRow: BodyCompositionRow = {
				...sampleData[0],
				Comments: 'Updated via legacy method'
			};

			dataActions.updateSingleRow(0, updatedRow);

			const state = get(dataStore);
			expect(state.bodyCompositionData[0].Comments).toBe('Updated via legacy method');
		});

		it('should support legacy addRow method', () => {
			const newRow: BodyCompositionRow = {
				id: 1,
				Date: '2024-01-01 12:00:00',
				'Weight (kg)': '70.0',
				'Fat mass (kg)': '15.0',
				'Bone mass (kg)': '3.0',
				'Muscle mass (kg)': '35.0',
				'Hydration (kg)': '45.0',
				Comments: 'Legacy add'
			};

			dataActions.addRow(newRow);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toHaveLength(1);
			expect(state.bodyCompositionData[0]).toEqual(newRow);
		});

		it('should support legacy removeRow method', () => {
			const sampleData: BodyCompositionRow[] = [
				{
					id: 1,
					Date: '2024-01-01 12:00:00',
					'Weight (kg)': '70.0',
					'Fat mass (kg)': '15.0',
					'Bone mass (kg)': '3.0',
					'Muscle mass (kg)': '35.0',
					'Hydration (kg)': '45.0',
					Comments: 'To be removed'
				}
			];

			dataActions.setData(sampleData);
			dataActions.removeRow(0);

			const state = get(dataStore);
			expect(state.bodyCompositionData).toHaveLength(0);
		});
	});

	describe('error handling', () => {
		it('should set and clear errors', () => {
			dataActions.setError('Test error message');

			let state = get(dataStore);
			expect(state.error).toBe('Test error message');
			expect(state.loading).toBe(false);
			expect(state.bodyCompLoading).toBe(false);
			expect(state.cycleLoading).toBe(false);

			dataActions.setError('');
			state = get(dataStore);
			expect(state.error).toBe('');
		});

		it('should clear all loading states when setting error', () => {
			dataActions.setLoading(true);
			dataActions.setBodyCompLoading(true);
			dataActions.setCycleLoading(true);

			dataActions.setError('Critical error');

			const state = get(dataStore);
			expect(state.loading).toBe(false);
			expect(state.bodyCompLoading).toBe(false);
			expect(state.cycleLoading).toBe(false);
			expect(state.error).toBe('Critical error');
		});
	});

	describe('initialization state', () => {
		it('should manage initialization state', () => {
			expect(get(dataStore).initialized).toBe(false);

			dataActions.setInitialized(true);
			expect(get(dataStore).initialized).toBe(true);

			dataActions.setInitialized(false);
			expect(get(dataStore).initialized).toBe(false);
		});
	});

	describe('clearData', () => {
		it('should reset store to initial state', () => {
			// Set up some state
			dataActions.setLoading(true);
			dataActions.setBodyCompositionData([
				{
					id: 1,
					Date: '2024-01-01 12:00:00',
					'Weight (kg)': '70.0',
					'Fat mass (kg)': '15.0',
					'Bone mass (kg)': '3.0',
					'Muscle mass (kg)': '35.0',
					'Hydration (kg)': '45.0',
					Comments: 'Test'
				}
			]);
			dataActions.setError('Test error');
			dataActions.setInitialized(true);

			// Clear data
			dataActions.clearData();

			// Should be back to initial state
			const state = get(dataStore);
			expect(state.bodyCompositionData).toEqual([]);
			expect(state.cycleData).toEqual([]);
			expect(state.loading).toBe(false);
			expect(state.bodyCompLoading).toBe(false);
			expect(state.cycleLoading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.lastUpdated).toBeNull();
			expect(state.bodyCompLastUpdated).toBeNull();
			expect(state.cycleLastUpdated).toBeNull();
			expect(state.initialized).toBe(false);
		});
	});
});
