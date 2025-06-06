/**
 * Chart color utilities for converting between color formats
 */

/**
 * Converts any CSS color to RGBA format with specified alpha
 */
export function colorToRgba(color: string, alpha: number): string {
	// If it's already an rgba/rgb color, handle it
	if (color.startsWith('rgb(')) {
		return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
	}
	if (color.startsWith('rgba(')) {
		// Extract RGB values and replace alpha
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) {
			return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
		}
	}
	// Handle hex colors
	if (color.startsWith('#')) {
		const hex = color.slice(1);
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	// Fallback - return as is
	return color;
}

/**
 * Extracts RGB values from a CSS color string
 */
export function extractRgbValues(color: string): { r: number; g: number; b: number } | null {
	// Handle rgba/rgb colors
	const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (rgbMatch) {
		return {
			r: parseInt(rgbMatch[1], 10),
			g: parseInt(rgbMatch[2], 10),
			b: parseInt(rgbMatch[3], 10)
		};
	}

	// Handle hex colors
	if (color.startsWith('#')) {
		const hex = color.slice(1);
		if (hex.length === 6) {
			return {
				r: parseInt(hex.slice(0, 2), 16),
				g: parseInt(hex.slice(2, 4), 16),
				b: parseInt(hex.slice(4, 6), 16)
			};
		}
	}

	return null;
}

/**
 * Creates a gradient color configuration for chart areas
 * Matches original chart gradient configuration
 * Using original alpha values from git history
 */
export function createGradientConfig(color: string, startAlpha = 0.2, endAlpha = 0.05) {
	return {
		type: 'linear' as const,
		x: 0,
		y: 0,
		x2: 0,
		y2: 1,
		colorStops: [
			{
				offset: 0,
				color: colorToRgba(color, startAlpha)
			},
			{
				offset: 1,
				color: colorToRgba(color, endAlpha)
			}
		]
	};
}
