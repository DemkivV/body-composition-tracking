/**
 * Chart range calculation utilities for dynamic axis scaling
 */

export interface RangeResult {
	min: number;
	max: number;
}

export interface DualAxisRanges {
	leftMin: number;
	leftMax: number;
	rightMin: number;
	rightMax: number;
}

/**
 * Calculates dynamic range for a dataset with padding
 */
export function calculateDynamicRange(
	data: (number | null)[],
	defaultMin = 0,
	defaultMax = 100,
	paddingPercent = 0.05
): RangeResult {
	const validData = data.filter((v): v is number => v !== null);

	if (validData.length === 0) {
		return { min: defaultMin, max: defaultMax };
	}

	const min = Math.min(...validData);
	const max = Math.max(...validData);
	const range = max - min;
	const padding = Math.max(range * paddingPercent, 0.1);

	return {
		min: Math.max(defaultMin, min - padding),
		max: max + padding
	};
}

/**
 * Calculates dynamic ranges for dual-axis charts based on visible data window
 */
export function calculateDualAxisRanges(
	leftData: (number | null)[],
	rightData: (number | null)[],
	startIndex: number,
	endIndex: number,
	options: {
		leftDefaults?: { min: number; max: number };
		rightDefaults?: { min: number; max: number };
		paddingPercent?: number;
	} = {}
): DualAxisRanges {
	const {
		leftDefaults = { min: 0, max: 100 },
		rightDefaults = { min: 0, max: 30 },
		paddingPercent = 0.05
	} = options;

	// Extract visible data
	const visibleLeftData = leftData.slice(startIndex, endIndex + 1);
	const visibleRightData = rightData.slice(startIndex, endIndex + 1);

	// Calculate ranges
	const leftRange = calculateDynamicRange(
		visibleLeftData,
		leftDefaults.min,
		leftDefaults.max,
		paddingPercent
	);

	const rightRange = calculateDynamicRange(
		visibleRightData,
		rightDefaults.min,
		rightDefaults.max,
		paddingPercent
	);

	return {
		leftMin: leftRange.min,
		leftMax: leftRange.max,
		rightMin: rightRange.min,
		rightMax: rightRange.max
	};
}

/**
 * Normalizes right axis data to the same scale as left axis for overview charts
 */
export function normalizeDataForOverview(
	rightData: (number | null)[],
	rightMin: number,
	rightMax: number,
	leftMin: number,
	leftMax: number
): (number | null)[] {
	return rightData.map((value) => {
		if (value === null) return null;
		const normalizedValue =
			((value - rightMin) / (rightMax - rightMin)) * (leftMax - leftMin) + leftMin;
		return normalizedValue;
	});
}
