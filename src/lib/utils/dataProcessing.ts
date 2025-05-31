import type { BodyCompositionRow } from '$lib/types/data';

export interface ProcessedDataPoint {
	date: string;
	weight: number | null;
	fatMass: number | null;
	bodyFatPercentage: number | null;
	boneMass: number | null;
	muscleMass: number | null;
	hydration: number | null;
}

export interface DataProcessingOptions {
	// Future: weighted average settings
	useWeightedAverage?: boolean;
	weightedAverageWindow?: number; // days (3-7)
	weightedAverageType?: 'linear' | 'exponential';

	// Current: basic filtering and sorting options
	includeIncompleteData?: boolean;
	sortOrder?: 'asc' | 'desc';
}

/**
 * Processes raw body composition data into a format suitable for charting
 * This function is designed to be extensible for future weighted average calculations
 */
export function processBodyCompositionData(
	rawData: BodyCompositionRow[],
	options: DataProcessingOptions = {}
): ProcessedDataPoint[] {
	const {
		includeIncompleteData = false,
		sortOrder = 'asc',
		useWeightedAverage = false,
		weightedAverageWindow = 3
	} = options;

	// Convert and filter data
	let processedData = rawData
		.filter((row) => {
			// Always require date and weight
			if (!row.Date || !row['Weight (kg)']) return false;

			// If includeIncompleteData is false, require all metrics
			if (!includeIncompleteData) {
				return (
					row['Fat mass (kg)'] &&
					row['Bone mass (kg)'] &&
					row['Muscle mass (kg)'] &&
					row['Hydration (kg)']
				);
			}

			return true;
		})
		.map((row) => {
			const weight = parseFloat(row['Weight (kg)']) || null;
			const fatMass = parseFloat(row['Fat mass (kg)']) || null;
			const boneMass = parseFloat(row['Bone mass (kg)']) || null;
			const muscleMass = parseFloat(row['Muscle mass (kg)']) || null;
			const hydration = parseFloat(row['Hydration (kg)']) || null;

			// Calculate body fat percentage if we have both weight and fat mass
			const bodyFatPercentage = weight && fatMass ? (fatMass / weight) * 100 : null;

			return {
				date: new Date(row.Date).toISOString().split('T')[0], // Format as YYYY-MM-DD
				weight,
				fatMass,
				bodyFatPercentage,
				boneMass,
				muscleMass,
				hydration
			};
		})
		.filter((point) => point.weight !== null); // Remove invalid entries

	// Sort data
	processedData.sort((a, b) => {
		const dateA = new Date(a.date).getTime();
		const dateB = new Date(b.date).getTime();
		return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
	});

	// Future: Apply weighted averages if enabled
	if (useWeightedAverage && weightedAverageWindow > 1) {
		processedData = applyWeightedAverages(processedData, weightedAverageWindow);
	}

	return processedData;
}

/**
 * Applies weighted averages to the processed data
 * This is a placeholder for future implementation
 */
function applyWeightedAverages(
	data: ProcessedDataPoint[],
	windowSize: number
): ProcessedDataPoint[] {
	// TODO: Implement weighted average calculation
	// For now, return data as-is
	// Future implementation will calculate rolling weighted averages
	// based on the specified window size
	console.log(`Weighted averages (${windowSize}-day window) not yet implemented`);
	return data;
}

/**
 * Gets metrics for a specific date range
 */
export function getMetricsForDateRange(
	data: ProcessedDataPoint[],
	startDate: string,
	endDate: string
): ProcessedDataPoint[] {
	const start = new Date(startDate);
	const end = new Date(endDate);

	return data.filter((point) => {
		const pointDate = new Date(point.date);
		return pointDate >= start && pointDate <= end;
	});
}

/**
 * Calculates summary statistics for a dataset
 */
export function calculateSummaryStats(data: ProcessedDataPoint[]) {
	if (data.length === 0) return null;

	const weights = data.map((d) => d.weight).filter((w) => w !== null) as number[];
	const bodyFatPercentages = data
		.map((d) => d.bodyFatPercentage)
		.filter((bf) => bf !== null) as number[];

	const weightStats =
		weights.length > 0
			? {
					min: Math.min(...weights),
					max: Math.max(...weights),
					avg: weights.reduce((sum, w) => sum + w, 0) / weights.length,
					latest: weights[weights.length - 1],
					earliest: weights[0],
					change: weights[weights.length - 1] - weights[0]
				}
			: null;

	const bodyFatStats =
		bodyFatPercentages.length > 0
			? {
					min: Math.min(...bodyFatPercentages),
					max: Math.max(...bodyFatPercentages),
					avg: bodyFatPercentages.reduce((sum, bf) => sum + bf, 0) / bodyFatPercentages.length,
					latest: bodyFatPercentages[bodyFatPercentages.length - 1],
					earliest: bodyFatPercentages[0],
					change: bodyFatPercentages[bodyFatPercentages.length - 1] - bodyFatPercentages[0]
				}
			: null;

	return {
		dataPoints: data.length,
		weight: weightStats,
		bodyFat: bodyFatStats
	};
}
