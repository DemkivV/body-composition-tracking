import { describe, it, expect } from 'vitest';
import {
	formatAxisLabel,
	formatChartDate,
	formatSliderDate,
	getPrecisionForUnit,
	formatTooltipValue
} from './formatting';

describe('Chart Formatting', () => {
	describe('formatAxisLabel', () => {
		it('should format zero correctly', () => {
			expect(formatAxisLabel(0, ' kg')).toBe('0 kg');
		});

		it('should format large numbers without decimals', () => {
			expect(formatAxisLabel(123, ' kg')).toBe('123 kg');
			expect(formatAxisLabel(100, '%')).toBe('100%');
		});

		it('should format medium numbers with one decimal', () => {
			expect(formatAxisLabel(12.34, ' kg')).toBe('12.3 kg');
			expect(formatAxisLabel(45.67, '%')).toBe('45.7%');
		});

		it('should format small numbers with one decimal', () => {
			expect(formatAxisLabel(1.23, ' kg')).toBe('1.2 kg');
			expect(formatAxisLabel(9.87, '%')).toBe('9.9%');
		});

		it('should format very small numbers with two decimals', () => {
			expect(formatAxisLabel(0.123, ' kg')).toBe('0.12 kg');
			expect(formatAxisLabel(0.789, '%')).toBe('0.79%');
		});
	});

	describe('formatChartDate', () => {
		it('should format dates correctly', () => {
			const date = new Date('2023-12-25').getTime();
			const formatted = formatChartDate(date);
			expect(formatted).toBe('Dec 25');
		});

		it('should handle different months', () => {
			const januaryDate = new Date('2023-01-15').getTime();
			expect(formatChartDate(januaryDate)).toBe('Jan 15');
		});
	});

	describe('formatSliderDate', () => {
		it('should format dates correctly', () => {
			const date = new Date('2023-12-25').getTime();
			const formatted = formatSliderDate(date);
			expect(formatted).toBe('Dec 25');
		});
	});

	describe('getPrecisionForUnit', () => {
		it('should return correct precision for weight units', () => {
			expect(getPrecisionForUnit(' kg')).toBe(2);
		});

		it('should return correct precision for percentage units', () => {
			expect(getPrecisionForUnit('%')).toBe(1);
		});

		it('should return default precision for unknown units', () => {
			expect(getPrecisionForUnit(' unknown')).toBe(2);
		});
	});

	describe('formatTooltipValue', () => {
		it('should format weight values with 2 decimals', () => {
			expect(formatTooltipValue(75.123, ' kg')).toBe('75.12 kg');
		});

		it('should format percentage values with 1 decimal', () => {
			expect(formatTooltipValue(23.456, '%')).toBe('23.5%');
		});

		it('should handle zero values', () => {
			expect(formatTooltipValue(0, ' kg')).toBe('0.00 kg');
			expect(formatTooltipValue(0, '%')).toBe('0.0%');
		});
	});
});
