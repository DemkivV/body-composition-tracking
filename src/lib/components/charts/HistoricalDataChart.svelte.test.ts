import { render, waitFor } from '@testing-library/svelte';
import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import HistoricalDataChart from './HistoricalDataChart.svelte';
import type { ProcessedDataPoint } from '$lib/utils/dataProcessing';

// Mock ECharts tree-shaking modules to avoid DOM sizing issues
const mockChart = {
	setOption: vi.fn(),
	resize: vi.fn(),
	dispose: vi.fn(),
	off: vi.fn(),
	on: vi.fn()
};

const mockEcharts = {
	init: vi.fn(() => mockChart),
	use: vi.fn()
};

vi.mock('echarts/core', () => mockEcharts);
vi.mock('echarts/charts', () => ({
	LineChart: Symbol('LineChart')
}));
vi.mock('echarts/components', () => ({
	GridComponent: Symbol('GridComponent'),
	TitleComponent: Symbol('TitleComponent'),
	TooltipComponent: Symbol('TooltipComponent'),
	LegendComponent: Symbol('LegendComponent'),
	DataZoomComponent: Symbol('DataZoomComponent')
}));
vi.mock('echarts/renderers', () => ({
	CanvasRenderer: Symbol('CanvasRenderer')
}));

// Store original console methods
let originalConsoleError: typeof console.error;
let originalConsoleLog: typeof console.log;
let originalConsoleWarn: typeof console.warn;

beforeEach(() => {
	// Store and mock console methods to suppress logs in tests
	originalConsoleError = console.error;
	originalConsoleLog = console.log;
	originalConsoleWarn = console.warn;

	console.error = vi.fn();
	console.log = vi.fn();
	console.warn = vi.fn();
});

afterEach(() => {
	// Restore original console methods
	console.error = originalConsoleError;
	console.log = originalConsoleLog;
	console.warn = originalConsoleWarn;
	vi.clearAllMocks();
});

test('HistoricalDataChart renders loading state initially', () => {
	const mockData: ProcessedDataPoint[] = [];
	const leftAxisConfig = {
		label: 'Weight',
		color: '#3b82f6',
		unit: ' kg',
		dataKey: 'weight' as keyof ProcessedDataPoint
	};
	const rightAxisConfig = {
		label: 'Body Fat',
		color: '#f97316',
		unit: '%',
		dataKey: 'bodyFatPercentage' as keyof ProcessedDataPoint
	};

	const { getByText } = render(HistoricalDataChart, {
		props: {
			data: mockData,
			title: 'Test Chart',
			leftAxisConfig,
			rightAxisConfig
		}
	});

	expect(getByText('Loading chart...')).toBeInTheDocument();
});

test('HistoricalDataChart renders chart container when data is provided', async () => {
	const mockData: ProcessedDataPoint[] = [
		{
			date: '2024-01-01',
			weight: 75.5,
			fatMass: 12.5,
			bodyFatPercentage: 16.6,
			boneMass: 3.2,
			muscleMass: 59.8,
			hydration: 45.2
		}
	];

	const leftAxisConfig = {
		label: 'Weight',
		color: '#3b82f6',
		unit: ' kg',
		dataKey: 'weight' as keyof ProcessedDataPoint
	};
	const rightAxisConfig = {
		label: 'Body Fat',
		color: '#f97316',
		unit: '%',
		dataKey: 'bodyFatPercentage' as keyof ProcessedDataPoint
	};

	const { container } = render(HistoricalDataChart, {
		props: {
			data: mockData,
			title: 'Test Chart',
			leftAxisConfig,
			rightAxisConfig
		}
	});

	// Wait for the chart to load
	await waitFor(
		() => {
			// Check that chart container exists
			const chartContainer = container.querySelector('.chart-container');
			expect(chartContainer).toBeInTheDocument();

			// Check that chart element exists
			const chart = container.querySelector('.chart');
			expect(chart).toBeInTheDocument();
		},
		{ timeout: 3000 }
	);
});
