import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import AnalysisSettings from './AnalysisSettings.svelte';

describe('AnalysisSettings', () => {
	it('should render with default weighted average window value', () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 7
			}
		});

		const slider = screen.getByTestId('weighted-average-slider') as HTMLInputElement;
		const sliderValue = screen.getByTestId('slider-value');

		expect(slider.value).toBe('7');
		expect(sliderValue.textContent?.trim()).toBe('7 days');
	});

	it('should render singular "day" for value of 1', () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 1
			}
		});

		const sliderValue = screen.getByTestId('slider-value');
		expect(sliderValue.textContent?.trim()).toBe('1 day');
	});

	it('should render plural "days" for values greater than 1', () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 5
			}
		});

		const sliderValue = screen.getByTestId('slider-value');
		expect(sliderValue.textContent?.trim()).toBe('5 days');
	});

	it('should have correct slider attributes', () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 7
			}
		});

		const slider = screen.getByTestId('weighted-average-slider') as HTMLInputElement;

		expect(slider.type).toBe('range');
		expect(slider.min).toBe('1');
		expect(slider.max).toBe('14');
		expect(slider.id).toBe('window-size-slider');
	});

	it('should update slider value display when slider changes', async () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 7
			}
		});

		const slider = screen.getByTestId('weighted-average-slider');
		const sliderValue = screen.getByTestId('slider-value');

		// Change slider value
		await fireEvent.input(slider, { target: { value: '12' } });

		expect(sliderValue.textContent?.trim()).toBe('12 days');
	});

	it('should render Settings heading', () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 7
			}
		});

		const heading = screen.getByRole('heading', { level: 3 });
		expect(heading.textContent).toBe('Settings');
	});

	it('should render Weighted Average label', () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 7
			}
		});

		const label = screen.getByText('Weighted Average');
		expect(label).toBeInTheDocument();
		expect(label.tagName).toBe('LABEL');
		expect(label.getAttribute('for')).toBe('window-size-slider');
	});

	it('should handle edge case values correctly', async () => {
		render(AnalysisSettings, {
			props: {
				weightedAverageWindow: 7
			}
		});

		const slider = screen.getByTestId('weighted-average-slider');
		const sliderValue = screen.getByTestId('slider-value');

		// Test minimum value
		await fireEvent.input(slider, { target: { value: '1' } });
		expect(sliderValue.textContent?.trim()).toBe('1 day');

		// Test maximum value
		await fireEvent.input(slider, { target: { value: '14' } });
		expect(sliderValue.textContent?.trim()).toBe('14 days');
	});
});
