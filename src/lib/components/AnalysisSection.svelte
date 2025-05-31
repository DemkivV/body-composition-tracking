<script lang="ts">
	import { onMount } from 'svelte';
	import type { BodyCompositionRow, DataApiResponse } from '$lib/types/data';
	import { processBodyCompositionData, type ProcessedDataPoint } from '$lib/utils/dataProcessing';

	let data: BodyCompositionRow[] = [];
	let loading = true;
	let error = '';
	let weightChartContainer: HTMLDivElement;
	let bodyFatChartContainer: HTMLDivElement;
	let weightChart: any;
	let bodyFatChart: any;
	let echartsLib: any;

	// Reactive processed data
	$: processedData = processBodyCompositionData(data, {
		includeIncompleteData: true,
		sortOrder: 'asc'
	});

	onMount(() => {
		// Load data and initialize charts
		initializeAsync();

		// Handle window resize
		const handleResize = () => {
			weightChart?.resize();
			bodyFatChart?.resize();
		};
		window.addEventListener('resize', handleResize);

		// Return cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);
			weightChart?.dispose();
			bodyFatChart?.dispose();
		};
	});

	async function initializeAsync() {
		try {
			// Import ECharts using require-style dynamic import
			echartsLib = (await import('echarts')).default;
			if (!echartsLib) {
				echartsLib = await import('echarts');
			}

			// Load data and initialize charts directly
			await loadData();
			initializeCharts();
		} catch (err) {
			console.error('Failed to initialize:', err);
			error = 'Failed to load charting library';
			loading = false;
		}
	}

	// Watch for data changes and update charts
	$: if (weightChart && bodyFatChart && processedData) {
		updateCharts();
	}

	async function loadData() {
		try {
			loading = true;
			const response = await fetch('/api/data/raw');
			const result: DataApiResponse = await response.json();

			if (result.success && result.data) {
				data = result.data;
			} else {
				error = result.error || 'Failed to load data';
			}
		} catch (err) {
			error = 'Failed to fetch data';
			console.error('Error loading data:', err);
		} finally {
			loading = false;
		}
	}

	function initializeCharts() {
		if (!weightChartContainer || !bodyFatChartContainer || !echartsLib) return;

		// Initialize charts
		weightChart = echartsLib.init(weightChartContainer);
		bodyFatChart = echartsLib.init(bodyFatChartContainer);

		updateCharts();
	}

	function updateCharts() {
		if (!weightChart || !bodyFatChart) return;

		if (processedData.length === 0) {
			// Show empty state
			const emptyOption = {
				title: {
					text: 'No Data Available',
					left: 'center',
					top: 'center',
					textStyle: {
						color: '#94a3b8',
						fontSize: 16
					}
				},
				backgroundColor: 'transparent'
			};
			weightChart.setOption(emptyOption);
			bodyFatChart.setOption(emptyOption);
			return;
		}

		// Calculate Y-axis range for weight chart
		const weightValues = processedData.map((d) => d.weight).filter(w => w !== null) as number[];
		const minWeight = Math.min(...weightValues);
		const maxWeight = Math.max(...weightValues);
		const weightPadding = (maxWeight - minWeight) * 0.1; // 10% padding
		const weightMin = Math.max(0, minWeight - weightPadding);
		const weightMax = maxWeight + weightPadding;

		// Prepare weight chart
		const weightOption = {
			title: {
				text: 'Body Weight',
				left: 'center',
				textStyle: {
					color: '#e2e8f0',
					fontSize: 18,
					fontWeight: 'bold'
				}
			},
			tooltip: {
				trigger: 'axis',
				formatter: function (params: any) {
					const data = params[0];
					return `Date: ${data.axisValue}<br/>Weight: ${data.value.toFixed(2)} kg`;
				},
				backgroundColor: 'rgba(30, 41, 59, 0.9)',
				borderColor: 'rgba(148, 163, 184, 0.2)',
				textStyle: {
					color: '#e2e8f0'
				}
			},
			grid: {
				left: '3%',
				right: '4%',
				bottom: '3%',
				containLabel: true
			},
			xAxis: {
				type: 'category',
				data: processedData.map((d) => d.date),
				axisLabel: {
					rotate: 45,
					color: '#94a3b8'
				},
				axisLine: {
					lineStyle: {
						color: '#475569'
					}
				}
			},
			yAxis: {
				type: 'value',
				name: 'Weight (kg)',
				min: weightMin,
				max: weightMax,
				axisLabel: {
					formatter: '{value} kg',
					color: '#94a3b8'
				},
				nameTextStyle: {
					color: '#94a3b8'
				},
				axisLine: {
					lineStyle: {
						color: '#475569'
					}
				},
				splitLine: {
					lineStyle: {
						color: '#334155'
					}
				}
			},
			backgroundColor: 'transparent',
			series: [
				{
					name: 'Weight',
					type: 'line',
					data: processedData.map((d) => d.weight),
					smooth: true,
					lineStyle: {
						color: '#3b82f6',
						width: 3
					},
					itemStyle: {
						color: '#3b82f6'
					},
					areaStyle: {
						color: {
							type: 'linear',
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{
									offset: 0,
									color: 'rgba(59, 130, 246, 0.3)'
								},
								{
									offset: 1,
									color: 'rgba(59, 130, 246, 0.1)'
								}
							]
						}
					},
					emphasis: {
						focus: 'series'
					}
				}
			]
		};

		// Prepare body fat chart (only include data points where we have body fat percentage)
		const bodyFatData = processedData.filter((d) => d.bodyFatPercentage !== null);

		// Calculate Y-axis range for body fat chart
		const bodyFatValues = bodyFatData.map((d) => d.bodyFatPercentage).filter(bf => bf !== null) as number[];
		let bodyFatMin = 0;
		let bodyFatMax = 50;
		
		if (bodyFatValues.length > 0) {
			const minBodyFat = Math.min(...bodyFatValues);
			const maxBodyFat = Math.max(...bodyFatValues);
			const bodyFatPadding = (maxBodyFat - minBodyFat) * 0.1; // 10% padding
			bodyFatMin = Math.max(0, minBodyFat - bodyFatPadding);
			bodyFatMax = maxBodyFat + bodyFatPadding;
		}

		const bodyFatOption = {
			title: {
				text: 'Body Fat Percentage',
				left: 'center',
				textStyle: {
					color: '#e2e8f0',
					fontSize: 18,
					fontWeight: 'bold'
				}
			},
			tooltip: {
				trigger: 'axis',
				formatter: function (params: any) {
					const data = params[0];
					if (!data) return '';
					return `Date: ${data.axisValue}<br/>Body Fat: ${data.value.toFixed(1)}%`;
				},
				backgroundColor: 'rgba(30, 41, 59, 0.9)',
				borderColor: 'rgba(148, 163, 184, 0.2)',
				textStyle: {
					color: '#e2e8f0'
				}
			},
			grid: {
				left: '3%',
				right: '4%',
				bottom: '3%',
				containLabel: true
			},
			xAxis: {
				type: 'category',
				data: bodyFatData.map((d) => d.date),
				axisLabel: {
					rotate: 45,
					color: '#94a3b8'
				},
				axisLine: {
					lineStyle: {
						color: '#475569'
					}
				}
			},
			yAxis: {
				type: 'value',
				name: 'Body Fat (%)',
				min: bodyFatMin,
				max: bodyFatMax,
				axisLabel: {
					formatter: '{value}%',
					color: '#94a3b8'
				},
				nameTextStyle: {
					color: '#94a3b8'
				},
				axisLine: {
					lineStyle: {
						color: '#475569'
					}
				},
				splitLine: {
					lineStyle: {
						color: '#334155'
					}
				}
			},
			backgroundColor: 'transparent',
			series: [
				{
					name: 'Body Fat %',
					type: 'line',
					data: bodyFatData.map((d) => d.bodyFatPercentage),
					smooth: true,
					lineStyle: {
						color: '#ef4444',
						width: 3
					},
					itemStyle: {
						color: '#ef4444'
					},
					areaStyle: {
						color: {
							type: 'linear',
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{
									offset: 0,
									color: 'rgba(239, 68, 68, 0.3)'
								},
								{
									offset: 1,
									color: 'rgba(239, 68, 68, 0.1)'
								}
							]
						}
					},
					emphasis: {
						focus: 'series'
					}
				}
			]
		};

		weightChart.setOption(weightOption);
		bodyFatChart.setOption(bodyFatOption);
	}
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
		<div class="charts-grid">
			<div class="chart-container">
				<div class="chart" bind:this={weightChartContainer}></div>
			</div>

			<div class="chart-container">
				<div class="chart" bind:this={bodyFatChartContainer}></div>
			</div>
		</div>
	{/if}
</div>

<style>
	.analysis-container {
		padding: 0;
		max-width: 1200px;
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

	.charts-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	@media (min-width: 1024px) {
		.charts-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.chart-container {
		background: var(--gradient-surface);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(148 163 184 / 0.1);
		border-radius: 1rem;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
		padding: 1rem;
	}

	.chart {
		width: 100%;
		height: 400px;
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
