/**
 * Chart formatting utilities for axis labels, tooltips, and data display
 */

/**
 * Formats numbers with sensible precision for axis labels
 */
export function formatAxisLabel(value: number, unit: string): string {
	let formattedValue: string;

	if (value === 0) {
		formattedValue = '0';
	} else if (Math.abs(value) >= 100) {
		formattedValue = Math.round(value).toString();
	} else if (Math.abs(value) >= 10) {
		formattedValue = (Math.round(value * 10) / 10).toString();
	} else if (Math.abs(value) >= 1) {
		formattedValue = (Math.round(value * 10) / 10).toString();
	} else {
		formattedValue = (Math.round(value * 100) / 100).toString();
	}

	return formattedValue + unit;
}

/**
 * Formats a date for chart axis labels
 */
export function formatChartDate(value: number): string {
	const date = new Date(value);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Formats a date for chart slider labels
 */
export function formatSliderDate(value: number): string {
	const date = new Date(value);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Gets appropriate precision for a metric based on its unit
 */
export function getPrecisionForUnit(unit: string): number {
	switch (unit) {
		case ' kg':
			return 2;
		case '%':
			return 1;
		default:
			return 2;
	}
}

/**
 * Formats a value for tooltip display with appropriate precision
 */
export function formatTooltipValue(value: number, unit: string): string {
	const precision = getPrecisionForUnit(unit);
	return `${value.toFixed(precision)}${unit}`;
}
