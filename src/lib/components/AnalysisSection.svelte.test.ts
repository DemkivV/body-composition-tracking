import { render, waitFor } from '@testing-library/svelte';
import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import AnalysisSection from './AnalysisSection.svelte';

// Mock fetch globally
global.fetch = vi.fn();

// Mock ECharts tree-shaking modules to avoid DOM sizing issues
const mockChart = {
	setOption: vi.fn(),
	resize: vi.fn(),
	dispose: vi.fn()
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

// Store original console.error
let originalConsoleError: typeof console.error;

beforeEach(() => {
	// Store and mock console.error to suppress error logs in tests
	originalConsoleError = console.error;
	console.error = vi.fn();
});

afterEach(() => {
	// Restore original console.error
	console.error = originalConsoleError;
	vi.clearAllMocks();
});

test('AnalysisSection renders loading state initially', () => {
	// Mock fetch to return a pending promise
	(fetch as any).mockReturnValue(new Promise(() => {}));

	const { getByText } = render(AnalysisSection);
	expect(getByText('Loading data...')).toBeInTheDocument();
});

test('AnalysisSection handles API error gracefully', async () => {
	// Mock fetch to reject
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

	(fetch as any).mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ success: true, data: mockData })
	});

	const { container } = render(AnalysisSection);

	// Wait for data to load and the unified chart to initialize
	await waitFor(
		() => {
			// Check for the unified chart container
			const unifiedChartContainer = container.querySelector('.unified-chart-container');
			expect(unifiedChartContainer).toBeInTheDocument();
		},
		{ timeout: 3000 }
	);

	// Check that the chart element is present
	const chart = container.querySelector('.chart');
	expect(chart).toBeInTheDocument();
	
	// Verify the loading state is no longer visible
	expect(container.querySelector('.loading-section')).not.toBeInTheDocument();
});
