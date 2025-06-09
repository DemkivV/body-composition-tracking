import { dataActions } from '$lib/stores/data';
import type { BodyCompositionRow, CycleDataRow } from '$lib/types/data';

interface DataApiResponse<T> {
	success: boolean;
	data?: T[];
	error?: string;
}

// Control debug logging
const DEBUG_MODE = typeof window !== 'undefined' && window.location?.search?.includes('debug=true');

class DataService {
	private initializationPromise: Promise<void> | null = null;

	/**
	 * Initialize the data service by loading all data asynchronously
	 * This should be called once when the app starts
	 */
	async initialize(): Promise<void> {
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.loadAllData();
		return this.initializationPromise;
	}

	/**
	 * Load all data types in parallel
	 */
	private async loadAllData(): Promise<void> {
		if (DEBUG_MODE) {
			console.log('[DataService] Initializing data cache...');
		}

		// Start both loading operations in parallel
		const bodyCompPromise = this.loadBodyCompositionData();
		const cyclePromise = this.loadCycleData();

		try {
			await Promise.all([bodyCompPromise, cyclePromise]);
			dataActions.setInitialized(true);
			if (DEBUG_MODE) {
				console.log('[DataService] Data cache initialized successfully');
			}
		} catch (error) {
			console.error('[DataService] Failed to initialize data cache:', error);
			dataActions.setError('Failed to initialize data. Please try again later.');
		}
	}

	/**
	 * Load body composition data from API
	 */
	async loadBodyCompositionData(): Promise<void> {
		try {
			dataActions.setBodyCompLoading(true);

			const response = await fetch('/api/data/raw');
			const result: DataApiResponse<BodyCompositionRow> = await response.json();

			if (result.success && result.data) {
				// Sort data for consistency
				const sortedData = result.data.sort((a, b) => {
					const dateA = new Date(a.Date);
					const dateB = new Date(b.Date);
					return dateB.getTime() - dateA.getTime(); // Newest first
				});

				dataActions.setBodyCompositionData(sortedData);
				if (DEBUG_MODE) {
					console.log('[DataService] Body composition data loaded:', sortedData.length, 'rows');
				}
			} else {
				// Don't treat empty data as an error - it's expected for new users
				if (result.error && !result.error.includes('No data found')) {
					throw new Error(result.error);
				}
				// For empty data, just set empty array and log if debug mode
				dataActions.setBodyCompositionData([]);
				if (DEBUG_MODE) {
					console.log('[DataService] No body composition data found (empty dataset)');
				}
			}
		} catch (error) {
			const errorMessage = 'Failed to load body composition data. Please check your connection.';
			// Only log error if it's not a "no data" scenario
			if (error instanceof Error && !error.message.includes('No data found')) {
				console.error('[DataService] Error loading body composition data:', error);
			}
			dataActions.setError(errorMessage);
			// Don't throw here, allow other data to load
		}
	}

	/**
	 * Load cycle data from API
	 */
	async loadCycleData(): Promise<void> {
		try {
			dataActions.setCycleLoading(true);

			const response = await fetch('/api/data/cycles');
			const result: DataApiResponse<CycleDataRow> = await response.json();

			if (result.success && result.data) {
				// Sort data for consistency
				const sortedData = result.data.sort((a, b) => {
					const dateA = new Date(a['Start Date']);
					const dateB = new Date(b['Start Date']);
					return dateB.getTime() - dateA.getTime(); // Newest first
				});

				dataActions.setCycleData(sortedData);
				if (DEBUG_MODE) {
					console.log('[DataService] Cycle data loaded:', sortedData.length, 'rows');
				}
			} else {
				// Don't treat empty data as an error - it's expected for new users
				if (result.error && !result.error.includes('No data found')) {
					throw new Error(result.error);
				}
				// For empty data, just set empty array and log if debug mode
				dataActions.setCycleData([]);
				if (DEBUG_MODE) {
					console.log('[DataService] No cycle data found (empty dataset)');
				}
			}
		} catch (error) {
			const errorMessage = 'Failed to load cycle data. Please check your connection.';
			// Only log error if it's not a "no data" scenario
			if (error instanceof Error && !error.message.includes('No data found')) {
				console.error('[DataService] Error loading cycle data:', error);
			}
			dataActions.setError(errorMessage);
			// Don't throw here, allow other data to load
		}
	}

	/**
	 * Refresh body composition data
	 */
	async refreshBodyCompositionData(): Promise<void> {
		await this.loadBodyCompositionData();
	}

	/**
	 * Refresh cycle data
	 */
	async refreshCycleData(): Promise<void> {
		await this.loadCycleData();
	}

	/**
	 * Refresh all data
	 */
	async refreshAllData(): Promise<void> {
		await this.loadAllData();
	}

	/**
	 * Check if data service is initialized
	 */
	isInitialized(): boolean {
		// This will be checked from the store
		return this.initializationPromise !== null;
	}

	/**
	 * Get initialization promise for components that need to wait
	 */
	getInitializationPromise(): Promise<void> | null {
		return this.initializationPromise;
	}
}

// Export singleton instance
export const dataService = new DataService();
