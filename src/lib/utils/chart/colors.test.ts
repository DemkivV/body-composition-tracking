import { describe, it, expect } from 'vitest';
import { colorToRgba, extractRgbValues, createGradientConfig } from './colors';

describe('Chart Colors', () => {
	describe('colorToRgba', () => {
		it('should convert hex colors to rgba', () => {
			expect(colorToRgba('#3b82f6', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
			expect(colorToRgba('#ff0000', 0.8)).toBe('rgba(255, 0, 0, 0.8)');
		});

		it('should convert rgb colors to rgba', () => {
			expect(colorToRgba('rgb(59, 130, 246)', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
		});

		it('should update alpha in existing rgba colors', () => {
			expect(colorToRgba('rgba(59, 130, 246, 0.2)', 0.8)).toBe('rgba(59, 130, 246, 0.8)');
		});

		it('should return original color for unknown formats', () => {
			expect(colorToRgba('blue', 0.5)).toBe('blue');
		});
	});

	describe('extractRgbValues', () => {
		it('should extract RGB values from hex colors', () => {
			expect(extractRgbValues('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
			expect(extractRgbValues('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
		});

		it('should extract RGB values from rgb colors', () => {
			expect(extractRgbValues('rgb(59, 130, 246)')).toEqual({ r: 59, g: 130, b: 246 });
		});

		it('should extract RGB values from rgba colors', () => {
			expect(extractRgbValues('rgba(59, 130, 246, 0.5)')).toEqual({ r: 59, g: 130, b: 246 });
		});

		it('should return null for unknown formats', () => {
			expect(extractRgbValues('blue')).toBeNull();
		});
	});

	describe('createGradientConfig', () => {
		it('should create gradient with default alpha values', () => {
			const config = createGradientConfig('#3b82f6');
			expect(config).toEqual({
				type: 'linear',
				x: 0,
				y: 0,
				x2: 0,
				y2: 1,
				colorStops: [
					{ offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
					{ offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
				]
			});
		});

		it('should create gradient with custom alpha values', () => {
			const config = createGradientConfig('#3b82f6', 0.5, 0.1);
			expect(config).toEqual({
				type: 'linear',
				x: 0,
				y: 0,
				x2: 0,
				y2: 1,
				colorStops: [
					{ offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
					{ offset: 1, color: 'rgba(59, 130, 246, 0.1)' }
				]
			});
		});

		it('should match original chart gradient configuration for blue', () => {
			const config = createGradientConfig('#3b82f6');
			// These match the original chart gradient values from git history
			expect(config.colorStops[0].color).toBe('rgba(59, 130, 246, 0.2)');
			expect(config.colorStops[1].color).toBe('rgba(59, 130, 246, 0.05)');
		});

		it('should match original chart gradient configuration for orange', () => {
			const config = createGradientConfig('#f97316');
			// These match the original chart gradient values from git history
			expect(config.colorStops[0].color).toBe('rgba(249, 115, 22, 0.2)');
			expect(config.colorStops[1].color).toBe('rgba(249, 115, 22, 0.05)');
		});
	});
});
