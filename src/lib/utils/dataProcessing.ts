import type { BodyCompositionRow } from '$lib/types/data';
import { removeOutliersFromDataset } from './data/outlier-detection';
import { applyWeightedAverages } from './data/weighted-averaging';

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
	// Preprocessing options
	removeOutliers?: boolean;
	outlierDetectionWindow?: number; // window size for local outlier detection (default: 15)
	outlierThreshold?: number; // modified z-score threshold (default: 3.5)

	// Weighted average settings
	useWeightedAverage?: boolean;
	weightedAverageWindow?: number; // days (default: 4)
	weightedAverageType?: 'linear' | 'exponential';

	// Current: basic filtering and sorting options
	includeIncompleteData?: boolean;
	sortOrder?: 'asc' | 'desc';
}

/**
 * Processes raw body composition data into a format suitable for charting
 *
 * This function applies a two-step preprocessing pipeline:
 * 1. Outlier Detection: Uses Modified Z-Score with local windowing to identify and remove
 *    unrealistic measurements (e.g., 3.5% body fat) that would skew the weighted averages
 * 2. Weighted Averaging: Computes rolling weighted averages to smooth the data and reduce
 *    noise while preserving trends
 *
 * The preprocessing is designed to handle long time series data (months/years) efficiently
 * and avoid issues with global statistics that don't account for natural body composition
 * changes over time.
 *
 * Performance: Optimized to process ~250 data points in under 10ms
 */
export function processBodyCompositionData(
	rawData: BodyCompositionRow[],
	options: DataProcessingOptions = {}
): ProcessedDataPoint[] {
	const {
		includeIncompleteData = false,
		sortOrder = 'asc',
		removeOutliers = true,
		outlierDetectionWindow = 15,
		outlierThreshold = 3.5,
		useWeightedAverage = true,
		weightedAverageWindow = 4
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

	// Step 1: Remove outliers using focused outlier detection module
	if (removeOutliers && processedData.length > outlierDetectionWindow) {
		processedData = removeOutliersFromDataset(
			processedData,
			[(point) => point.weight, (point) => point.bodyFatPercentage],
			{
				windowSize: outlierDetectionWindow,
				threshold: outlierThreshold
			}
		);
	}

	// Step 2: Apply weighted averages using focused averaging module
	if (
		useWeightedAverage &&
		weightedAverageWindow > 1 &&
		processedData.length >= weightedAverageWindow
	) {
		processedData = applyWeightedAverages(
			processedData,
			{
				weight: (point) => point.weight,
				fatMass: (point) => point.fatMass,
				bodyFatPercentage: (point) => point.bodyFatPercentage,
				boneMass: (point) => point.boneMass,
				muscleMass: (point) => point.muscleMass,
				hydration: (point) => point.hydration
			},
			{
				weight: (point, value) => ({ ...point, weight: value }),
				fatMass: (point, value) => ({ ...point, fatMass: value }),
				bodyFatPercentage: (point, value) => ({ ...point, bodyFatPercentage: value }),
				boneMass: (point, value) => ({ ...point, boneMass: value }),
				muscleMass: (point, value) => ({ ...point, muscleMass: value }),
				hydration: (point, value) => ({ ...point, hydration: value })
			},
			weightedAverageWindow
		);
	}

	return processedData;
}

/**
 * @deprecated Use calculateWeightedMetricAverage from weighted-averaging module instead
 */
export function calculateWeightedAverages(
	data: ProcessedDataPoint[],
	windowSize: number
): ProcessedDataPoint[] {
	// Legacy wrapper for backward compatibility
	return applyWeightedAverages(
		data,
		{
			weight: (point) => point.weight,
			fatMass: (point) => point.fatMass,
			bodyFatPercentage: (point) => point.bodyFatPercentage,
			boneMass: (point) => point.boneMass,
			muscleMass: (point) => point.muscleMass,
			hydration: (point) => point.hydration
		},
		{
			weight: (point, value) => ({ ...point, weight: value }),
			fatMass: (point, value) => ({ ...point, fatMass: value }),
			bodyFatPercentage: (point, value) => ({ ...point, bodyFatPercentage: value }),
			boneMass: (point, value) => ({ ...point, boneMass: value }),
			muscleMass: (point, value) => ({ ...point, muscleMass: value }),
			hydration: (point, value) => ({ ...point, hydration: value })
		},
		windowSize
	);
}

/**
 * Get data points within a specific date range
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
 * Calculate summary statistics for the dataset
 */
export function calculateSummaryStats(data: ProcessedDataPoint[]) {
	const validWeights = data.map((d) => d.weight).filter((w): w is number => w !== null);
	const validBodyFat = data
		.map((d) => d.bodyFatPercentage)
		.filter((bf): bf is number => bf !== null);

	return {
		totalPoints: data.length,
		dateRange: {
			start: data.length > 0 ? data[0].date : null,
			end: data.length > 0 ? data[data.length - 1].date : null
		},
		weight: {
			min: validWeights.length > 0 ? Math.min(...validWeights) : null,
			max: validWeights.length > 0 ? Math.max(...validWeights) : null,
			avg:
				validWeights.length > 0
					? validWeights.reduce((a, b) => a + b, 0) / validWeights.length
					: null
		},
		bodyFat: {
			min: validBodyFat.length > 0 ? Math.min(...validBodyFat) : null,
			max: validBodyFat.length > 0 ? Math.max(...validBodyFat) : null,
			avg:
				validBodyFat.length > 0
					? validBodyFat.reduce((a, b) => a + b, 0) / validBodyFat.length
					: null
		}
	};
}
