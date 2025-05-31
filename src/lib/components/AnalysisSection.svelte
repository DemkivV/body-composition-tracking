<script lang="ts">
	import { onMount } from 'svelte';
	import type { BodyCompositionRow, DataApiResponse } from '$lib/types/data';
	import { processBodyCompositionData } from '$lib/utils/dataProcessing';

	let data: BodyCompositionRow[] = [];
	let loading = true;
	let error = '';
	let unifiedChartContainer: HTMLDivElement;
	let unifiedChart: unknown;
	let echartsLib: unknown;

	// Reactive processed data with outlier removal and weighted averaging enabled
	$: processedData = processBodyCompositionData(data, {
		includeIncompleteData: true,
		sortOrder: 'asc',
		removeOutliers: true,
		outlierDetectionWindow: 15,
		outlierThreshold: 3.5,
		useWeightedAverage: true,
		weightedAverageWindow: 4
	});

	onMount(() => {
		// Load data and initialize charts
		initializeAsync();

		// Handle window resize
		const handleResize = () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(unifiedChart as any)?.resize();
		};
		window.addEventListener('resize', handleResize);

		// Return cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(unifiedChart as any)?.dispose();
		};
	});

	async function initializeAsync() {
		try {
			// Dynamic import with tree-shaking - load what we need for line charts and dataZoom
			const [
				echarts,
				{ LineChart },
				{ GridComponent, TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent },
				{ CanvasRenderer }
			] = await Promise.all([
				import('echarts/core'),
				import('echarts/charts'),
				import('echarts/components'),
				import('echarts/renderers')
			]);

			// Register the components we need
			echarts.use([
				LineChart,
				GridComponent,
				TitleComponent,
				TooltipComponent,
				LegendComponent,
				DataZoomComponent,
				CanvasRenderer
			]);

			echartsLib = echarts;

			// Load data and initialize chart
			await loadData();
			initializeChart();
		} catch (err) {
			console.error('Failed to initialize:', err);
			error = 'Failed to load charting library';
			loading = false;
		}
	}

	// Watch for data changes and update chart
	$: if (unifiedChart && processedData) {
		updateChart();
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

	function initializeChart() {
		if (!unifiedChartContainer || !echartsLib) return;

		// Initialize unified chart
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		unifiedChart = (echartsLib as any).init(unifiedChartContainer);

		updateChart();
	}

	function updateChart() {
		if (!unifiedChart) return;

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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(unifiedChart as any).setOption(emptyOption);
			return;
		}

		// Prepare data for both metrics
		const dates = processedData.map((d) => d.date);
		const weightData = processedData.map((d) => d.weight);
		const bodyFatData = processedData.map((d) => d.bodyFatPercentage);

		// Calculate dynamic ranges for both y-axes
		const weightValues = weightData.filter((w) => w !== null) as number[];
		const bodyFatValues = bodyFatData.filter((bf) => bf !== null) as number[];

		// Weight axis range
		const minWeight = Math.min(...weightValues);
		const maxWeight = Math.max(...weightValues);
		const weightPadding = (maxWeight - minWeight) * 0.05; // 5% padding
		const weightMin = Math.max(0, minWeight - weightPadding);
		const weightMax = maxWeight + weightPadding;

		// Body fat axis range
		const minBodyFat = Math.min(...bodyFatValues);
		const maxBodyFat = Math.max(...bodyFatValues);
		const bodyFatPadding = (maxBodyFat - minBodyFat) * 0.05; // 5% padding
		const bodyFatMin = Math.max(0, minBodyFat - bodyFatPadding);
		const bodyFatMax = maxBodyFat + bodyFatPadding;

		// Calculate initial 28-day window (show the most recent 28 days)
		const totalDays = dates.length;
		const windowSize = Math.min(28, totalDays);
		
		// If we have more than 28 days of data, show the last 28 days
		// Otherwise, show all available data
		let startIndex = 0;
		let endIndex = totalDays - 1;
		
		if (totalDays > windowSize) {
			startIndex = totalDays - windowSize;
		}
		
		// Convert to percentages for ECharts dataZoom
		const startPercent = totalDays > 1 ? (startIndex / (totalDays - 1)) * 100 : 0;
		const endPercent = totalDays > 1 ? (endIndex / (totalDays - 1)) * 100 : 100;

		const option = {
			title: {
				text: 'Body Composition Analysis',
				left: 'center',
				textStyle: {
					color: '#e2e8f0',
					fontSize: 20,
					fontWeight: 'bold'
				},
				top: 10
			},
			legend: {
				data: ['Body Weight', 'Body Fat %'],
				top: 50,
				textStyle: {
					color: '#e2e8f0'
				}
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: {
					type: 'cross',
					crossStyle: {
						color: '#999'
					}
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				formatter: function (params: any) {
					if (!params || params.length === 0) return '';

					const date = params[0].axisValue;
					let content = `Date: ${date}<br/>`;

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					params.forEach((param: any) => {
						if (param.seriesName === 'Body Weight' && param.value !== null) {
							content += `${param.seriesName}: ${param.value.toFixed(2)} kg<br/>`;
						} else if (param.seriesName === 'Body Fat %' && param.value !== null) {
							content += `${param.seriesName}: ${param.value.toFixed(1)}%<br/>`;
						}
					});

					return content;
				},
				backgroundColor: 'rgba(30, 41, 59, 0.9)',
				borderColor: 'rgba(148, 163, 184, 0.2)',
				textStyle: {
					color: '#e2e8f0'
				}
			},
			grid: [
				{
					left: '3%',
					right: '4%',
					top: 100,
					height: '50%'
				},
				{
					left: '3%',
					right: '4%',
					top: '75%',
					height: '15%'
				}
			],
			xAxis: [
				{
					type: 'category',
					boundaryGap: false,
					data: dates,
					axisLabel: {
						rotate: 45,
						color: '#94a3b8'
					},
					axisLine: {
						lineStyle: {
							color: '#475569'
						}
					},
					gridIndex: 0
				},
				{
					type: 'category',
					boundaryGap: false,
					data: dates,
					axisLabel: {
						show: false
					},
					axisLine: {
						lineStyle: {
							color: '#475569'
						}
					},
					gridIndex: 1
				}
			],
			yAxis: [
				{
					type: 'value',
					name: 'Weight (kg)',
					position: 'left',
					min: weightMin,
					max: weightMax,
					axisLabel: {
						formatter: '{value} kg',
						color: '#3b82f6'
					},
					nameTextStyle: {
						color: '#3b82f6'
					},
					axisLine: {
						lineStyle: {
							color: '#3b82f6'
						}
					},
					splitLine: {
						lineStyle: {
							color: '#334155'
						}
					},
					gridIndex: 0
				},
				{
					type: 'value',
					name: 'Body Fat (%)',
					position: 'right',
					min: bodyFatMin,
					max: bodyFatMax,
					axisLabel: {
						formatter: '{value}%',
						color: '#ef4444'
					},
					nameTextStyle: {
						color: '#ef4444'
					},
					axisLine: {
						lineStyle: {
							color: '#ef4444'
						}
					},
					splitLine: {
						show: false
					},
					gridIndex: 0
				},
				{
					type: 'value',
					gridIndex: 1,
					axisLabel: {
						show: false
					},
					axisLine: {
						show: false
					},
					axisTick: {
						show: false
					},
					splitLine: {
						show: false
					}
				}
			],
			dataZoom: [
				{
					type: 'inside',
					xAxisIndex: 0,
					start: startPercent,
					end: endPercent,
					minSpan: 5, // Minimum 5% of data (roughly a week for monthly data)
					maxSpan: 50 // Maximum 50% of data
				},
				{
					type: 'slider',
					xAxisIndex: [0, 1],
					start: startPercent,
					end: endPercent,
					height: 60,
					bottom: 20,
					brushSelect: true,
					brushStyle: {
						color: 'rgba(59, 130, 246, 0.2)',
						borderColor: 'rgba(59, 130, 246, 0.5)',
						borderWidth: 1
					},
					textStyle: {
						color: '#94a3b8'
					},
					dataBackground: {
						lineStyle: {
							color: '#475569'
						},
						areaStyle: {
							color: 'rgba(59, 130, 246, 0.1)'
						}
					}
				}
			],
			backgroundColor: 'transparent',
			series: [
				{
					name: 'Body Weight',
					type: 'line',
					xAxisIndex: 0,
					yAxisIndex: 0,
					data: weightData,
					smooth: true,
					symbol: 'circle',
					symbolSize: 4,
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
									color: 'rgba(59, 130, 246, 0.2)'
								},
								{
									offset: 1,
									color: 'rgba(59, 130, 246, 0.05)'
								}
							]
						}
					},
					emphasis: {
						focus: 'series'
					}
				},
				{
					name: 'Body Fat %',
					type: 'line',
					xAxisIndex: 0,
					yAxisIndex: 1,
					data: bodyFatData,
					smooth: true,
					symbol: 'circle',
					symbolSize: 4,
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
									color: 'rgba(239, 68, 68, 0.2)'
								},
								{
									offset: 1,
									color: 'rgba(239, 68, 68, 0.05)'
								}
							]
						}
					},
					emphasis: {
						focus: 'series'
					}
				},
				{
					name: 'Weight Overview',
					type: 'line',
					xAxisIndex: 1,
					yAxisIndex: 2,
					data: weightData,
					smooth: true,
					symbol: 'none',
					lineStyle: {
						color: '#3b82f6',
						width: 1,
						opacity: 0.5
					},
					areaStyle: {
						color: 'rgba(59, 130, 246, 0.1)'
					},
					silent: true,
					animation: false
				},
				{
					name: 'Body Fat Overview',
					type: 'line',
					xAxisIndex: 1,
					yAxisIndex: 2,
					data: bodyFatData.map((value, index) => {
						// Normalize body fat data to the same scale as weight for overview
						if (value === null) return null;
						const normalizedValue = ((value - bodyFatMin) / (bodyFatMax - bodyFatMin)) * (weightMax - weightMin) + weightMin;
						return normalizedValue;
					}),
					smooth: true,
					symbol: 'none',
					lineStyle: {
						color: '#ef4444',
						width: 1,
						opacity: 0.3
					},
					silent: true,
					animation: false
				}
			]
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(unifiedChart as any).setOption(option, true);
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
		<div class="unified-chart-container">
			<div class="chart" bind:this={unifiedChartContainer}></div>
		</div>
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

	.unified-chart-container {
		background: var(--gradient-surface);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(148 163 184 / 0.1);
		border-radius: 1rem;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
		padding: 1rem;
		margin: 1rem 0;
	}

	.chart {
		width: 100%;
		height: 600px;
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
