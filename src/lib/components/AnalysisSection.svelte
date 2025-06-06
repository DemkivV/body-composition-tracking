<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { BodyCompositionRow, DataApiResponse } from '$lib/types/data';
	import type { ProcessedDataPoint } from '$lib/utils/dataProcessing';
	import { processBodyCompositionData } from '$lib/utils/dataProcessing';
	import HistoricalDataChart from './charts/HistoricalDataChart.svelte';

	// Global data state - precomputed once and shared across all charts
	let rawData: BodyCompositionRow[] = [];
	let globalProcessedData: ProcessedDataPoint[] = [];
	let loading = true;
	let error = '';
	let abortController: AbortController | null = null;

	// Reactive processed data with outlier removal and weighted averaging enabled
	// This is the SINGLE place where data preprocessing happens to avoid double processing
	$: globalProcessedData = processBodyCompositionData(rawData, {
		includeIncompleteData: true,
		sortOrder: 'asc',
		removeOutliers: true,
		outlierDetectionWindow: 15,
		outlierThreshold: 3.5,
		useWeightedAverage: true,
		weightedAverageWindow: 4
	});

	onMount(() => {
		loadData();
	});

	onDestroy(() => {
		// Cancel any in-flight requests
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
	});

	async function loadData() {
		try {
			loading = true;

			// Cancel any previous requests
			if (abortController) {
				abortController.abort();
			}

			abortController = new AbortController();

			const response = await fetch('/api/data/raw', {
				signal: abortController.signal
			});
			const result: DataApiResponse = await response.json();

			if (result.success && result.data) {
				rawData = result.data;
			} else {
				error = result.error || 'Failed to load data';
			}
		} catch (err) {
			// Don't show error if request was aborted (component cleanup)
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			error = 'Failed to fetch data';
			console.error('Error loading data:', err);
		} finally {
			loading = false;
			abortController = null;
		}
	}

	// Chart configurations - flexible axis setup for different visualizations
	const weightVsBodyFatConfig = {
		leftAxis: {
			label: 'Body Weight',
			color: '#3b82f6',
			unit: ' kg',
			dataKey: 'weight' as keyof ProcessedDataPoint
		},
		rightAxis: {
			label: 'Body Fat %',
			color: '#f97316',
			unit: '%',
			dataKey: 'bodyFatPercentage' as keyof ProcessedDataPoint
		}
	};

	// Example of a different chart configuration for future use
	const _muscleMassVsHydrationConfig = {
		leftAxis: {
			label: 'Muscle Mass',
			color: '#10b981',
			unit: ' kg',
			dataKey: 'muscleMass' as keyof ProcessedDataPoint
		},
		rightAxis: {
			label: 'Hydration',
			color: '#06b6d4',
			unit: ' kg',
			dataKey: 'hydration' as keyof ProcessedDataPoint
		}
	};
</script>

<div class="analysis-container">
	{#if loading}
		<div class="loading-section">
			<div class="loading-spinner"></div>
			<p>Loading data...</p>
		</div>
	{:else if error}
		<div class="error-container">
			<p class="feedback error">{error}</p>
			<button class="btn secondary" on:click={loadData}>Retry</button>
		</div>
	{:else}
		<!-- Weight vs Body Fat Chart -->
		<HistoricalDataChart
			data={globalProcessedData}
			title="Weight & Body Fat Trends"
			leftAxisConfig={weightVsBodyFatConfig.leftAxis}
			rightAxisConfig={weightVsBodyFatConfig.rightAxis}
			height={600}
			initialWindowDays={28}
		/>

		<!-- Placeholder for future charts -->
		<!-- 
		<HistoricalDataChart
			data={globalProcessedData}
			title="Muscle Mass & Hydration Trends"
			leftAxisConfig={_muscleMassVsHydrationConfig.leftAxis}
			rightAxisConfig={_muscleMassVsHydrationConfig.rightAxis}
			height={400}
			initialWindowDays={28}
		/>
		-->
	{/if}
</div>

<style>
	.analysis-container {
		padding: 0;
		max-width: 1400px;
		margin: 0 auto;
	}

	.loading-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
		color: #e2e8f0;
	}

	.loading-spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid #334155;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-container {
		text-align: center;
		padding: 2rem;
	}

	.feedback.error {
		color: #ef4444;
		margin-bottom: 1rem;
	}

	.btn {
		background-color: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background-color 0.2s;
	}

	.btn.secondary {
		background-color: #6b7280;
	}

	.btn:hover {
		background-color: #2563eb;
	}

	.btn.secondary:hover {
		background-color: #4b5563;
	}
</style>
