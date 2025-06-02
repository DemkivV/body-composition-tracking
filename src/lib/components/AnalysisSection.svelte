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

		// Prepare data for both metrics - convert dates to Date objects for proper time axis handling
		const dates = processedData.map((d) => new Date(d.date));
		const dateStrings = processedData.map((d) => d.date); // Keep string format for fallback
		const weightData = processedData.map((d) => d.weight);
		const bodyFatData = processedData.map((d) => d.bodyFatPercentage);

		// Calculate initial 6-month window (show the most recent 6 months)
		const totalDays = dates.length;
		const windowSize = Math.min(28, totalDays);
		
		// If we have more than 6 months of data, show the last 6 months
		// Otherwise, show all available data
		let startIndex = 0;
		let endIndex = totalDays - 1;
		
		if (totalDays > windowSize) {
			startIndex = totalDays - windowSize;
		}
		
		// Convert to percentages for ECharts dataZoom
		const startPercent = totalDays > 1 ? (startIndex / (totalDays - 1)) * 100 : 0;
		const endPercent = totalDays > 1 ? (endIndex / (totalDays - 1)) * 100 : 100;

		// Function to calculate dynamic ranges based on visible data window
		function calculateDynamicRanges(start: number, end: number) {
			const visibleWeightData = weightData.slice(start, end + 1).filter((w) => w !== null) as number[];
			const visibleBodyFatData = bodyFatData.slice(start, end + 1).filter((bf) => bf !== null) as number[];

			// Weight axis range
			if (visibleWeightData.length > 0) {
				const minWeight = Math.min(...visibleWeightData);
				const maxWeight = Math.max(...visibleWeightData);
				const weightRange = maxWeight - minWeight;
				const weightPadding = Math.max(weightRange * 0.05, 0.1); // 5% padding or minimum 0.1
				const weightMin = Math.max(0, minWeight - weightPadding);
				const weightMax = maxWeight + weightPadding;

				// Body fat axis range - ensure it's also properly calculated
				let bodyFatMin = 0;
				let bodyFatMax = 30;
				
				if (visibleBodyFatData.length > 0) {
					const minBodyFat = Math.min(...visibleBodyFatData);
					const maxBodyFat = Math.max(...visibleBodyFatData);
					const bodyFatRange = maxBodyFat - minBodyFat;
					const bodyFatPadding = Math.max(bodyFatRange * 0.05, 0.1); // 5% padding or minimum 0.1
					bodyFatMin = Math.max(0, minBodyFat - bodyFatPadding);
					bodyFatMax = maxBodyFat + bodyFatPadding;
				}

				return { weightMin, weightMax, bodyFatMin, bodyFatMax };
			} else {
				// Fallback if no visible data
				return { weightMin: 0, weightMax: 100, bodyFatMin: 0, bodyFatMax: 30 };
			}
		}

		// Calculate initial ranges
		const { weightMin, weightMax, bodyFatMin, bodyFatMax } = calculateDynamicRanges(startIndex, endIndex);

		// Format numbers with sensible precision - avoid unnecessarily long decimals
		function formatAxisLabel(value: number, unit: string): string {
			let formattedValue: string;
			
			if (value === 0) {
				formattedValue = '0';
			} else if (Math.abs(value) >= 100) {
				// For values >= 100, show as integers
				formattedValue = Math.round(value).toString();
			} else if (Math.abs(value) >= 10) {
				// For values >= 10, show at most 1 decimal place
				formattedValue = (Math.round(value * 10) / 10).toString();
			} else if (Math.abs(value) >= 1) {
				// For values >= 1, show at most 1 decimal place
				formattedValue = (Math.round(value * 10) / 10).toString();
			} else {
				// For values < 1, show at most 2 decimal places
				formattedValue = (Math.round(value * 100) / 100).toString();
			}
			
			return formattedValue + unit;
		}

		const option = {
			title: {
				text: 'Historical Data',
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

					// Format date properly
					const dateValue = params[0].axisValue;
					const formattedDate = dateValue instanceof Date 
						? dateValue.toLocaleDateString() 
						: new Date(dateValue).toLocaleDateString();
					let content = `Date: ${formattedDate}<br/>`;

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					params.forEach((param: any) => {
						// Handle the new data format where param.value is [timestamp, actualValue]
						const actualValue = Array.isArray(param.value) ? param.value[1] : param.value;
						
						if (param.seriesName === 'Body Weight' && actualValue !== null && actualValue !== undefined) {
							content += `${param.seriesName}: ${actualValue.toFixed(2)} kg<br/>`;
						} else if (param.seriesName === 'Body Fat %' && actualValue !== null && actualValue !== undefined) {
							content += `${param.seriesName}: ${actualValue.toFixed(1)}%<br/>`;
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
					left: '6%', // Reduced from 8% to give more space
					right: '6%', // Increased from 4% to 8% to prevent right y-axis label cutoff
					top: 100,
					height: '50%'
				},
				{
					left: '6%', // Reduced from 8% for consistency
					right: '6%', // Increased from 4% for consistency
					top: '75%',
					height: '15%'
				}
			],
			xAxis: [
				{
					type: 'time', // Changed from 'category' to 'time' for better datetime handling
					boundaryGap: false,
					data: dates, // Use Date objects instead of strings
					axisLabel: {
						rotate: 45,
						color: '#94a3b8',
						// Let ECharts handle the formatting automatically for time axis
						formatter: function(value: number) {
							const date = new Date(value);
							return date.toLocaleDateString('en-US', { 
								month: 'short', 
								day: 'numeric'
							});
						}
					},
					axisLine: {
						lineStyle: {
							color: '#475569'
						}
					},
					gridIndex: 0,
					// Remove interval limitations to allow better scaling
					minInterval: 24 * 60 * 60 * 1000, // Minimum 1 day interval
					maxInterval: null // Remove max interval limitation
				},
				{
					type: 'time', // Changed from 'category' to 'time'
					boundaryGap: false,
					data: dates, // Use Date objects
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
						formatter: (value: number) => formatAxisLabel(value, ' kg'),
						color: '#3b82f6',
						margin: 8, // Add margin to prevent cutoff
						showMinLabel: false, // Hide min label to prevent verbose decimals
						showMaxLabel: false // Hide max label to prevent verbose decimals
					},
					nameTextStyle: {
						color: '#3b82f6',
						align: 'left'
					},
					axisLine: {
						lineStyle: {
							color: '#3b82f6'
						}
					},
					splitLine: {
						lineStyle: {
							color: '#334155'
						},
						show: true
					},
					gridIndex: 0,
					// Improve tick spacing
					splitNumber: 5,
					boundaryGap: [0, 0]
				},
				{
					type: 'value',
					name: 'Body Fat (%)',
					position: 'right',
					min: bodyFatMin,
					max: bodyFatMax,
					axisLabel: {
						formatter: (value: number) => formatAxisLabel(value, '%'),
						color: '#ef4444',
						margin: 8, // Add margin to prevent cutoff
						showMinLabel: false, // Hide min label to prevent verbose decimals
						showMaxLabel: false // Hide max label to prevent verbose decimals
					},
					nameTextStyle: {
						color: '#ef4444',
						align: 'right'
					},
					axisLine: {
						lineStyle: {
							color: '#ef4444'
						}
					},
					splitLine: {
						show: false
					},
					gridIndex: 0,
					// Improve tick spacing
					splitNumber: 5,
					boundaryGap: [0, 0]
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
					minSpan: 2, // Reduced from 5% to 2% to allow more zooming
					maxSpan: 100, // Allow full range
					// Add event handler for dynamic y-axis scaling
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					throttle: 100
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
					},
					// Remove limitations on label density
					labelFormatter: function(value: number, valueStr: string) {
						const date = new Date(value);
						return date.toLocaleDateString('en-US', { 
							month: 'short', 
							day: 'numeric' 
						});
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
					data: weightData.map((weight, index) => [dates[index], weight]),
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
					data: bodyFatData.map((bodyFat, index) => [dates[index], bodyFat]),
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
					data: weightData.map((weight, index) => [dates[index], weight]),
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
						if (value === null) return [dates[index], null];
						const normalizedValue = ((value - bodyFatMin) / (bodyFatMax - bodyFatMin)) * (weightMax - weightMin) + weightMin;
						return [dates[index], normalizedValue];
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

		// Add event listener for dataZoom to update y-axis ranges dynamically
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const chartInstance = unifiedChart as any;
		if (chartInstance?.off) {
			chartInstance.off('dataZoom');
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (chartInstance?.on) {
			chartInstance.on('dataZoom', function (event: any) {
				// Handle both batch and direct dataZoom events
				const zoomInfo = event.batch ? event.batch[0] : event;
				
				if (zoomInfo && zoomInfo.start !== undefined && zoomInfo.end !== undefined) {
					const startPercent = zoomInfo.start;
					const endPercent = zoomInfo.end;
					
					// Get the actual time range from the chart's current option
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const currentOption = (unifiedChart as any).getOption();
					const xAxisData = currentOption.xAxis[0].data;
					
					if (xAxisData && xAxisData.length > 0) {
						// Calculate the actual time range based on the selection
						const totalTimeSpan = xAxisData[xAxisData.length - 1].getTime() - xAxisData[0].getTime();
						const startTime = xAxisData[0].getTime() + (startPercent / 100) * totalTimeSpan;
						const endTime = xAxisData[0].getTime() + (endPercent / 100) * totalTimeSpan;
						
						// Filter data based on actual time range
						const filteredData = processedData.filter(d => {
							const dataTime = new Date(d.date).getTime();
							return dataTime >= startTime && dataTime <= endTime;
						});
						
						// Calculate ranges based on filtered data
						const visibleWeightData = filteredData
							.map(d => d.weight)
							.filter((w): w is number => w !== null);
						const visibleBodyFatData = filteredData
							.map(d => d.bodyFatPercentage)
							.filter((bf): bf is number => bf !== null);
						
						// Calculate new y-axis ranges
						let newRanges = { weightMin: 0, weightMax: 100, bodyFatMin: 0, bodyFatMax: 30 };
						
						if (visibleWeightData.length > 0) {
							const minWeight = Math.min(...visibleWeightData);
							const maxWeight = Math.max(...visibleWeightData);
							const weightRange = maxWeight - minWeight;
							const weightPadding = Math.max(weightRange * 0.05, 0.1);
							const weightMin = Math.max(0, minWeight - weightPadding);
							const weightMax = maxWeight + weightPadding;
							
							newRanges.weightMin = weightMin;
							newRanges.weightMax = weightMax;
						}
						
						if (visibleBodyFatData.length > 0) {
							const minBodyFat = Math.min(...visibleBodyFatData);
							const maxBodyFat = Math.max(...visibleBodyFatData);
							const bodyFatRange = maxBodyFat - minBodyFat;
							const bodyFatPadding = Math.max(bodyFatRange * 0.05, 0.1);
							const bodyFatMin = Math.max(0, minBodyFat - bodyFatPadding);
							const bodyFatMax = maxBodyFat + bodyFatPadding;
							
							newRanges.bodyFatMin = bodyFatMin;
							newRanges.bodyFatMax = bodyFatMax;
						}
						
						// Update only the min/max values for y-axes
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(unifiedChart as any).setOption({
							yAxis: [
								{
									min: newRanges.weightMin,
									max: newRanges.weightMax
								},
								{
									min: newRanges.bodyFatMin,
									max: newRanges.bodyFatMax
								},
								{} // Third y-axis (overview) - no changes needed
							]
						}, false); // Use merge mode instead of replace
					}
				}
			});
		}
		
		// Remove the brush event listener as it's causing conflicts
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (chartInstance?.off) {
			chartInstance.off('brush');
		}
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
