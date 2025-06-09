import { writable, type Writable } from 'svelte/store';
import type { BodyCompositionRow, CycleDataRow } from '$lib/types/data';

export interface DataState {
	bodyCompositionData: BodyCompositionRow[];
	cycleData: CycleDataRow[];
	loading: boolean;
	bodyCompLoading: boolean;
	cycleLoading: boolean;
	error: string | null;
	lastUpdated: Date | null;
	bodyCompLastUpdated: Date | null;
	cycleLastUpdated: Date | null;
	initialized: boolean;
}

const initialState: DataState = {
	bodyCompositionData: [],
	cycleData: [],
	loading: false,
	bodyCompLoading: false,
	cycleLoading: false,
	error: null,
	lastUpdated: null,
	bodyCompLastUpdated: null,
	cycleLastUpdated: null,
	initialized: false
};

export const dataStore: Writable<DataState> = writable(initialState);

export const dataActions = {
	setLoading: (loading: boolean) => {
		dataStore.update((state) => ({
			...state,
			loading,
			error: loading ? null : state.error
		}));
	},

	setBodyCompLoading: (loading: boolean) => {
		dataStore.update((state) => ({
			...state,
			bodyCompLoading: loading,
			error: loading ? null : state.error
		}));
	},

	setCycleLoading: (loading: boolean) => {
		dataStore.update((state) => ({
			...state,
			cycleLoading: loading,
			error: loading ? null : state.error
		}));
	},

	setBodyCompositionData: (data: BodyCompositionRow[]) => {
		dataStore.update((state) => ({
			...state,
			bodyCompositionData: data,
			bodyCompLoading: false,
			loading: state.cycleLoading, // Keep loading if cycle data is still loading
			error: null,
			lastUpdated: new Date(),
			bodyCompLastUpdated: new Date()
		}));
	},

	setCycleData: (data: CycleDataRow[]) => {
		dataStore.update((state) => ({
			...state,
			cycleData: data,
			cycleLoading: false,
			loading: state.bodyCompLoading, // Keep loading if body comp data is still loading
			error: null,
			lastUpdated: new Date(),
			cycleLastUpdated: new Date()
		}));
	},

	// Legacy method for backward compatibility
	setData: (data: BodyCompositionRow[]) => {
		dataActions.setBodyCompositionData(data);
	},

	setError: (error: string) => {
		dataStore.update((state) => ({
			...state,
			loading: false,
			bodyCompLoading: false,
			cycleLoading: false,
			error
		}));
	},

	clearData: () => {
		dataStore.set(initialState);
	},

	updateSingleBodyCompRow: (rowIndex: number, updatedRow: BodyCompositionRow) => {
		dataStore.update((state) => {
			const newData = [...state.bodyCompositionData];
			if (rowIndex >= 0 && rowIndex < newData.length) {
				newData[rowIndex] = updatedRow;
			}
			return {
				...state,
				bodyCompositionData: newData,
				lastUpdated: new Date(),
				bodyCompLastUpdated: new Date()
			};
		});
	},

	updateSingleCycleRow: (rowIndex: number, updatedRow: CycleDataRow) => {
		dataStore.update((state) => {
			const newData = [...state.cycleData];
			if (rowIndex >= 0 && rowIndex < newData.length) {
				newData[rowIndex] = updatedRow;
			}
			return {
				...state,
				cycleData: newData,
				lastUpdated: new Date(),
				cycleLastUpdated: new Date()
			};
		});
	},

	// Legacy method for backward compatibility
	updateSingleRow: (rowIndex: number, updatedRow: BodyCompositionRow) => {
		dataActions.updateSingleBodyCompRow(rowIndex, updatedRow);
	},

	addBodyCompRow: (newRow: BodyCompositionRow) => {
		dataStore.update((state) => ({
			...state,
			bodyCompositionData: [newRow, ...state.bodyCompositionData],
			lastUpdated: new Date(),
			bodyCompLastUpdated: new Date()
		}));
	},

	addCycleRow: (newRow: CycleDataRow) => {
		dataStore.update((state) => ({
			...state,
			cycleData: [newRow, ...state.cycleData],
			lastUpdated: new Date(),
			cycleLastUpdated: new Date()
		}));
	},

	// Legacy method for backward compatibility
	addRow: (newRow: BodyCompositionRow) => {
		dataActions.addBodyCompRow(newRow);
	},

	removeBodyCompRow: (rowIndex: number) => {
		dataStore.update((state) => {
			const newData = state.bodyCompositionData.filter((_, i) => i !== rowIndex);
			return {
				...state,
				bodyCompositionData: newData,
				lastUpdated: new Date(),
				bodyCompLastUpdated: new Date()
			};
		});
	},

	removeCycleRow: (rowIndex: number) => {
		dataStore.update((state) => {
			const newData = state.cycleData.filter((_, i) => i !== rowIndex);
			return {
				...state,
				cycleData: newData,
				lastUpdated: new Date(),
				cycleLastUpdated: new Date()
			};
		});
	},

	// Legacy method for backward compatibility
	removeRow: (rowIndex: number) => {
		dataActions.removeBodyCompRow(rowIndex);
	},

	setInitialized: (initialized: boolean) => {
		dataStore.update((state) => ({
			...state,
			initialized
		}));
	}
};
