<script lang="ts">
	import { onMount } from 'svelte';
	import { dataStore } from '$lib/stores/data';
	import { dataService } from '$lib/services/data-service';
	import HistoricalDataChart from './charts/HistoricalDataChart.svelte';
	import AnalysisSettings from './AnalysisSettings.svelte';
	import type { ProcessedDataPoint } from '$lib/utils/dataProcessing';
	import { processBodyCompositionData } from '$lib/utils/dataProcessing';

	$: storeData = $dataStore;
	$: rawData = storeData.bodyCompositionData;
	$: loading = storeData.bodyCompLoading;
	$: error = storeData.error;

	// Settings state
	let weightedAverageWindow = 7; // Default value

	// Reactive processed data with dynamic weighted averaging window
	$: globalProcessedData = processBodyCompositionData(rawData, {
		includeIncompleteData: true,
		sortOrder: 'asc',
		removeOutliers: true,
		outlierDetectionWindow: 15,
		outlierThreshold: 3.5,
		useWeightedAverage: true,
		weightedAverageWindow: weightedAverageWindow
	});

	onMount(async () => {
		// Wait for data service initialization if not yet initialized
		const initPromise = dataService.getInitializationPromise();
		if (initPromise) {
			await initPromise;
		}

		// If no data yet or very old, refresh
		const shouldLoad =
			!storeData.bodyCompLastUpdated ||
			Date.now() - storeData.bodyCompLastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes

		if (shouldLoad || storeData.bodyCompositionData.length === 0) {
			await dataService.refreshBodyCompositionData();
		}
	});

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

	// Handle settings changes from AnalysisSettings component
	function handleSettingsChange(event: CustomEvent<{ weightedAverageWindow: number }>) {
		weightedAverageWindow = event.detail.weightedAverageWindow;
	}
</script>

{#if loading}
	<div class="analysis-container">
		<div class="loading-section">
			<div class="loading-spinner"></div>
			<p>Loading data...</p>
		</div>
	</div>
{:else if error}
	<div class="analysis-container">
		<div class="error-container">
			<p class="feedback error">{error}</p>
			<button class="btn secondary" on:click={() => dataService.refreshBodyCompositionData()}
				>Retry</button
			>
		</div>
	</div>
{:else}
	<div class="analysis-columns">
		<!-- Settings Column -->
		<div class="settings-column">
			<AnalysisSettings bind:weightedAverageWindow on:settingsChange={handleSettingsChange} />
		</div>

		<!-- Charts Column -->
		<div class="charts-column">
			<!-- Weight vs Body Fat Chart -->
			<HistoricalDataChart
				data={globalProcessedData}
				title="Historical Overview"
				leftAxisConfig={weightVsBodyFatConfig.leftAxis}
				rightAxisConfig={weightVsBodyFatConfig.rightAxis}
				height={600}
				initialWindowDays={28}
			/>
		</div>
	</div>
{/if}

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
