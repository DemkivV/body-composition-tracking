import { describe, it, expect } from 'vitest';
import {
	calculateDynamicRange,
	calculateDualAxisRanges,
	normalizeDataForOverview
} from './range-calculations';

describe('Chart Range Calculations', () => {
	describe('calculateDynamicRange', () => {
		it('should calculate range for valid data', () => {
			const data = [70, 75, 80, 85];
			const result = calculateDynamicRange(data);

			expect(result.min).toBeLessThan(70);
			expect(result.max).toBeGreaterThan(85);
		});

		it('should handle null values', () => {
			const data = [70, null, 80, null, 85];
			const result = calculateDynamicRange(data);

			expect(result.min).toBeLessThan(70);
			expect(result.max).toBeGreaterThan(85);
		});

		it('should return defaults for empty data', () => {
			const result = calculateDynamicRange([], 0, 100);

			expect(result.min).toBe(0);
			expect(result.max).toBe(100);
		});

		it('should respect default minimums', () => {
			const data = [10, 15, 20];
			const result = calculateDynamicRange(data, 0, 100);

			expect(result.min).toBeGreaterThanOrEqual(0);
		});

		it('should apply custom padding', () => {
			const data = [70, 80];
			const result1 = calculateDynamicRange(data, 0, 100, 0.1);
			const result2 = calculateDynamicRange(data, 0, 100, 0.2);

			expect(result2.min).toBeLessThan(result1.min);
			expect(result2.max).toBeGreaterThan(result1.max);
		});
	});

	describe('calculateDualAxisRanges', () => {
		it('should calculate ranges for both axes', () => {
			const leftData = [70, 75, 80, 85];
			const rightData = [15, 20, 25, 30];

			const result = calculateDualAxisRanges(leftData, rightData, 0, 3);

			expect(result.leftMin).toBeLessThan(70);
			expect(result.leftMax).toBeGreaterThan(85);
			expect(result.rightMin).toBeLessThan(15);
			expect(result.rightMax).toBeGreaterThan(30);
		});

		it('should handle windowed data correctly', () => {
			const leftData = [60, 70, 75, 80, 85, 90];
			const rightData = [10, 15, 20, 25, 30, 35];

			// Only look at middle portion
			const result = calculateDualAxisRanges(leftData, rightData, 2, 4);

			// Should be based on values 75, 80, 85 for left and 20, 25, 30 for right
			expect(result.leftMin).toBeLessThan(75);
			expect(result.leftMax).toBeGreaterThan(85);
			expect(result.rightMin).toBeLessThan(20);
			expect(result.rightMax).toBeGreaterThan(30);
		});

		it('should use custom defaults and options', () => {
			const leftData = [70, 75];
			const rightData = [20, 25];

			const result = calculateDualAxisRanges(leftData, rightData, 0, 1, {
				leftDefaults: { min: 50, max: 120 },
				rightDefaults: { min: 10, max: 40 },
				paddingPercent: 0.1
			});

			expect(result.leftMin).toBeGreaterThanOrEqual(50);
			expect(result.rightMin).toBeGreaterThanOrEqual(10);
		});
	});

	describe('normalizeDataForOverview', () => {
		it('should normalize data to target range', () => {
			const rightData = [10, 15, 20];
			const rightMin = 10;
			const rightMax = 20;
			const leftMin = 0;
			const leftMax = 100;

			const normalized = normalizeDataForOverview(rightData, rightMin, rightMax, leftMin, leftMax);

			expect(normalized[0]).toBe(0); // 10 maps to 0
			expect(normalized[1]).toBe(50); // 15 maps to 50
			expect(normalized[2]).toBe(100); // 20 maps to 100
		});

		it('should handle null values', () => {
			const rightData = [10, null, 20];
			const normalized = normalizeDataForOverview(rightData, 10, 20, 0, 100);

			expect(normalized[0]).toBe(0);
			expect(normalized[1]).toBeNull();
			expect(normalized[2]).toBe(100);
		});

		it('should handle edge cases', () => {
			const rightData = [15];
			const normalized = normalizeDataForOverview(rightData, 10, 20, 50, 150);

			// 15 is halfway between 10 and 20, so should map to halfway between 50 and 150
			expect(normalized[0]).toBe(100);
		});
	});
});
