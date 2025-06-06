<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import type { ProcessedDataPoint } from '$lib/utils/dataProcessing';
	import { colorToRgba, createGradientConfig } from '$lib/utils/chart/colors';
	import {
		formatAxisLabel,
		formatChartDate,
		formatSliderDate,
		formatTooltipValue
	} from '$lib/utils/chart/formatting';
	import {
		calculateDualAxisRanges,
		normalizeDataForOverview
	} from '$lib/utils/chart/range-calculations';

	// Props
	export let data: ProcessedDataPoint[];
	export let title: string = 'Historical Data';
	export let leftAxisConfig: {
		label: string;
		color: string;
		unit: string;
		dataKey: keyof ProcessedDataPoint;
	};
	export let rightAxisConfig: {
		label: string;
		color: string;
		unit: string;
		dataKey: keyof ProcessedDataPoint;
	};
	export let height: number = 600;
	export let initialWindowDays: number = 28;

	// Chart state
	let chartContainer: HTMLDivElement;
	let chart: unknown;
	let echartsLib: unknown;
	let loading = true;
	let error = '';

	onMount(() => {
		initializeAsync();

		// Handle window resize
		const handleResize = () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(chart as any)?.resize();
		};
		window.addEventListener('resize', handleResize);

		// Return cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(chart as any)?.dispose();
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
			loading = false;

			// Initialize chart after ECharts is loaded and DOM is ready
			if (chartContainer) {
				await initializeChart();
			}
		} catch (err) {
			console.error('Failed to initialize chart:', err);
			error = 'Failed to load charting library';
			loading = false;
		}
	}

	// Update chart when data or chart instance changes
	// This reactive statement is safe - updateChart() only calls methods on chart, doesn't reassign it
	$: if (chart && data && !loading) {
		updateChart();
	}

	// Initialize chart when all conditions are met
	// This reactive statement is safe - initializeChart() only assigns chart once when it's null
	$: if (chartContainer && echartsLib && !chart && !loading) {
		initializeChart().catch((err) => console.error('Failed to initialize chart:', err));
	}

	async function initializeChart() {
		if (!echartsLib || !chartContainer) return;

		// Wait for DOM to be updated
		await tick();

		// Simple retry mechanism if container doesn't have dimensions yet
		let retryCount = 0;
		const maxRetries = 10;

		const tryInitialize = () => {
			if (!chartContainer || chart) return; // Exit if no container or chart already exists

			const containerWidth = chartContainer.offsetWidth || chartContainer.clientWidth;
			const containerHeight = chartContainer.offsetHeight || chartContainer.clientHeight;

			if (containerWidth > 0 && containerHeight > 0) {
				// Container has dimensions, initialize chart
				// This assignment is safe - it only happens once when chart is null
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				chart = (echartsLib as any).init(chartContainer);

				// If we have data, update the chart immediately
				if (data && data.length > 0) {
					updateChart();
				}
			} else if (retryCount < maxRetries) {
				// Container not ready yet, retry after a short delay
				retryCount++;
				setTimeout(tryInitialize, 50);
			} else {
				console.warn('Chart container failed to get dimensions after retries');
			}
		};

		tryInitialize();
	}

	function updateChart() {
		if (!chart) return;

		if (data.length === 0) {
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
			(chart as any).setOption(emptyOption);
			return;
		}

		// Prepare data for both metrics - convert dates to Date objects for proper time axis handling
		const dates = data.map((d) => new Date(d.date));
		const leftAxisData = data.map((d) => d[leftAxisConfig.dataKey] as number | null);
		const rightAxisData = data.map((d) => d[rightAxisConfig.dataKey] as number | null);

		// Calculate initial window (show the most recent period)
		const totalDays = dates.length;
		const windowSize = Math.min(initialWindowDays, totalDays);

		let startIndex = 0;
		let endIndex = totalDays - 1;

		if (totalDays > windowSize) {
			startIndex = totalDays - windowSize;
		}

		// Convert to percentages for ECharts dataZoom
		const startPercent = totalDays > 1 ? (startIndex / (totalDays - 1)) * 100 : 0;
		const endPercent = totalDays > 1 ? (endIndex / (totalDays - 1)) * 100 : 100;

		// Calculate initial ranges using utility function
		const { leftMin, leftMax, rightMin, rightMax } = calculateDualAxisRanges(
			leftAxisData,
			rightAxisData,
			startIndex,
			endIndex,
			{
				leftDefaults: { min: 0, max: 100 },
				rightDefaults: { min: 0, max: 30 },
				paddingPercent: 0.05
			}
		);

		const option = {
			title: {
				text: title,
				left: 'center',
				textStyle: {
					color: '#e2e8f0',
					fontSize: 20,
					fontWeight: 'bold'
				},
				top: 10
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

					const dateValue = params[0].axisValue;
					const formattedDate =
						dateValue instanceof Date
							? dateValue.toLocaleDateString()
							: new Date(dateValue).toLocaleDateString();
					let content = `Date: ${formattedDate}<br/>`;

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					params.forEach((param: any) => {
						const actualValue = Array.isArray(param.value) ? param.value[1] : param.value;

						if (
							param.seriesName === leftAxisConfig.label &&
							actualValue !== null &&
							actualValue !== undefined
						) {
							content += `${param.seriesName}: ${formatTooltipValue(actualValue, leftAxisConfig.unit)}<br/>`;
						} else if (
							param.seriesName === rightAxisConfig.label &&
							actualValue !== null &&
							actualValue !== undefined
						) {
							content += `${param.seriesName}: ${formatTooltipValue(actualValue, rightAxisConfig.unit)}<br/>`;
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
					left: '6%',
					right: '6%',
					top: 100,
					height: '50%'
				},
				{
					left: '6%',
					right: '6%',
					top: '75%',
					height: '15%'
				}
			],
			xAxis: [
				{
					type: 'time',
					boundaryGap: false,
					data: dates,
					axisLabel: {
						rotate: 45,
						color: '#94a3b8',
						formatter: formatChartDate
					},
					axisLine: {
						lineStyle: {
							color: '#475569'
						}
					},
					gridIndex: 0,
					minInterval: 24 * 60 * 60 * 1000
				},
				{
					type: 'time',
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
					name: leftAxisConfig.label,
					position: 'left',
					min: leftMin,
					max: leftMax,
					axisLabel: {
						formatter: (value: number) => formatAxisLabel(value, leftAxisConfig.unit),
						color: leftAxisConfig.color,
						margin: 8,
						showMinLabel: false,
						showMaxLabel: false
					},
					nameTextStyle: {
						color: leftAxisConfig.color,
						align: 'left'
					},
					axisLine: {
						lineStyle: {
							color: leftAxisConfig.color
						}
					},
					splitLine: {
						lineStyle: {
							color: '#334155'
						},
						show: true,
						interval: function (index: number) {
							const totalSplits = 5;
							return index < totalSplits - 1;
						}
					},
					gridIndex: 0,
					splitNumber: 5,
					boundaryGap: [0, 0]
				},
				{
					type: 'value',
					name: rightAxisConfig.label,
					position: 'right',
					min: rightMin,
					max: rightMax,
					axisLabel: {
						formatter: (value: number) => formatAxisLabel(value, rightAxisConfig.unit),
						color: rightAxisConfig.color,
						margin: 8,
						showMinLabel: false,
						showMaxLabel: false
					},
					nameTextStyle: {
						color: rightAxisConfig.color,
						align: 'right'
					},
					axisLine: {
						lineStyle: {
							color: rightAxisConfig.color
						}
					},
					splitLine: {
						show: false
					},
					gridIndex: 0,
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
					minSpan: 2,
					maxSpan: 100,
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
							color: colorToRgba('#3b82f6', 0.02)
						}
					},
					labelFormatter: formatSliderDate
				}
			],
			backgroundColor: 'transparent',
			series: [
				{
					name: leftAxisConfig.label,
					type: 'line',
					xAxisIndex: 0,
					yAxisIndex: 0,
					data: leftAxisData.map((value, index) => [dates[index], value]),
					smooth: true,
					symbol: 'circle',
					symbolSize: 4,
					lineStyle: {
						color: leftAxisConfig.color,
						width: 3
					},
					itemStyle: {
						color: leftAxisConfig.color
					},
					areaStyle: {
						color: createGradientConfig(leftAxisConfig.color)
					},
					emphasis: {
						focus: 'series'
					}
				},
				{
					name: rightAxisConfig.label,
					type: 'line',
					xAxisIndex: 0,
					yAxisIndex: 1,
					data: rightAxisData.map((value, index) => [dates[index], value]),
					smooth: true,
					symbol: 'circle',
					symbolSize: 4,
					lineStyle: {
						color: rightAxisConfig.color,
						width: 3
					},
					itemStyle: {
						color: rightAxisConfig.color
					},
					areaStyle: {
						color: createGradientConfig(rightAxisConfig.color)
					},
					emphasis: {
						focus: 'series'
					}
				},
				{
					name: 'Left Overview',
					type: 'line',
					xAxisIndex: 1,
					yAxisIndex: 2,
					data: leftAxisData.map((value, index) => [dates[index], value]),
					smooth: true,
					symbol: 'none',
					lineStyle: {
						color: leftAxisConfig.color,
						width: 1,
						opacity: 0.5
					},
					areaStyle: {
						color: colorToRgba(leftAxisConfig.color, 0.1)
					},
					silent: true,
					animation: false
				},
				{
					name: 'Right Overview',
					type: 'line',
					xAxisIndex: 1,
					yAxisIndex: 2,
					data: normalizeDataForOverview(rightAxisData, rightMin, rightMax, leftMin, leftMax).map(
						(value, index) => [dates[index], value]
					),
					smooth: true,
					symbol: 'none',
					lineStyle: {
						color: rightAxisConfig.color,
						width: 1,
						opacity: 0.3
					},
					areaStyle: {
						color: colorToRgba(rightAxisConfig.color, 0.02)
					},
					silent: true,
					animation: false
				}
			]
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(chart as any).setOption(option, true);

		// Add event listener for dataZoom to update y-axis ranges dynamically
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const chartInstance = chart as any;
		if (chartInstance?.off) {
			chartInstance.off('dataZoom');
		}

		if (chartInstance?.on) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chartInstance.on('dataZoom', function (event: any) {
				const zoomInfo = event.batch ? event.batch[0] : event;

				if (zoomInfo && zoomInfo.start !== undefined && zoomInfo.end !== undefined) {
					const startPercent = zoomInfo.start;
					const endPercent = zoomInfo.end;

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const currentOption = (chart as any).getOption();
					const xAxisData = currentOption.xAxis[0].data;

					if (xAxisData && xAxisData.length > 0) {
						const totalTimeSpan =
							xAxisData[xAxisData.length - 1].getTime() - xAxisData[0].getTime();
						const startTime = xAxisData[0].getTime() + (startPercent / 100) * totalTimeSpan;
						const endTime = xAxisData[0].getTime() + (endPercent / 100) * totalTimeSpan;

						const filteredData = data.filter((d) => {
							const dataTime = new Date(d.date).getTime();
							return dataTime >= startTime && dataTime <= endTime;
						});

						const visibleLeftData = filteredData.map(
							(d) => d[leftAxisConfig.dataKey] as number | null
						);
						const visibleRightData = filteredData.map(
							(d) => d[rightAxisConfig.dataKey] as number | null
						);

						// Calculate new ranges using utility function
						const newRanges = calculateDualAxisRanges(
							visibleLeftData,
							visibleRightData,
							0,
							visibleLeftData.length - 1,
							{
								leftDefaults: { min: 0, max: 100 },
								rightDefaults: { min: 0, max: 30 },
								paddingPercent: 0.05
							}
						);

						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(chart as any).setOption(
							{
								yAxis: [
									{
										min: newRanges.leftMin,
										max: newRanges.leftMax
									},
									{
										min: newRanges.rightMin,
										max: newRanges.rightMax
									},
									{}
								]
							},
							false
						);
					}
				}
			});
		}
	}
</script>

<div class="chart-container">
	{#if loading}
		<div class="loading-section">
			<div class="loading-spinner"></div>
			<p>Loading chart...</p>
		</div>
	{:else if error}
		<div class="error-container">
			<p class="feedback error">{error}</p>
		</div>
	{:else}
		<div class="chart" bind:this={chartContainer} style="height: {height}px;"></div>
	{/if}
</div>

<style>
	.chart-container {
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
</style>
