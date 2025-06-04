import { render, waitFor } from '@testing-library/svelte';
import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import AnalysisSection from './AnalysisSection.svelte';

// Mock fetch globally
global.fetch = vi.fn();

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

test('AnalysisSection renders loading state initially', () => {
	// Mock fetch to return a pending promise
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(fetch as any).mockReturnValue(new Promise(() => {}));

	const { getByText } = render(AnalysisSection);
	expect(getByText('Loading data...')).toBeInTheDocument();
});

test('AnalysisSection handles API error gracefully', async () => {
	// Mock fetch to reject
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(fetch as any).mockRejectedValue(new Error('Network error'));

	const { findByText } = render(AnalysisSection);

	// Wait for the error state to be rendered - the error message should be 'Failed to fetch data'
	expect(await findByText('Failed to fetch data')).toBeInTheDocument();
});

test('AnalysisSection renders charts when data is available', async () => {
	// Mock successful API response
	const mockData = [
		{
			id: 1,
			Date: '2024-01-01 08:00:00',
			'Weight (kg)': '75.5',
			'Fat mass (kg)': '12.5',
			'Bone mass (kg)': '3.2',
			'Muscle mass (kg)': '59.8',
			'Hydration (kg)': '45.2',
			Comments: ''
		}
	];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(fetch as any).mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ success: true, data: mockData })
	});

	const { container } = render(AnalysisSection);

	// Wait for data to load and the chart component to initialize
	await waitFor(
		() => {
			// Check that the loading state is no longer visible
			expect(container.querySelector('.loading-section')).not.toBeInTheDocument();
			// Check for the chart container (from the HistoricalDataChart component)
			const chartContainer = container.querySelector('.chart-container');
			expect(chartContainer).toBeInTheDocument();
		},
		{ timeout: 3000 }
	);

	// Check that the chart element is present
	const chart = container.querySelector('.chart');
	expect(chart).toBeInTheDocument();
});
