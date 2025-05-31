import { describe, it, expect } from 'vitest';
import { processBodyCompositionData } from './dataProcessing';
import type { BodyCompositionRow } from '$lib/types/data';

// Helper function to create test data
function createTestRow(
	date: string,
	weight: number,
	fatMass?: number,
	boneMass?: number,
	muscleMass?: number,
	hydration?: number
): BodyCompositionRow {
	return {
		id: Math.random(),
		Date: date,
		'Weight (kg)': weight.toString(),
		'Fat mass (kg)': fatMass?.toString() || '',
		'Bone mass (kg)': boneMass?.toString() || '',
		'Muscle mass (kg)': muscleMass?.toString() || '',
		'Hydration (kg)': hydration?.toString() || '',
		Comments: ''
	};
}

describe('Data Processing with Outlier Detection and Weighted Averages', () => {
	it('should remove obvious outliers from body fat percentage', () => {
		const testData: BodyCompositionRow[] = [
			createTestRow('2025-01-01', 85.0, 12.0, 3.5, 69.5, 50.0), // ~14.1% body fat
			createTestRow('2025-01-02', 85.2, 12.2, 3.5, 69.5, 50.0), // ~14.3% body fat
			createTestRow('2025-01-03', 85.1, 12.1, 3.5, 69.5, 50.0), // ~14.2% body fat
			createTestRow('2025-01-04', 85.0, 3.0, 3.5, 69.5, 50.0), // ~3.5% body fat (OUTLIER)
			createTestRow('2025-01-05', 85.3, 12.3, 3.5, 69.5, 50.0), // ~14.4% body fat
			createTestRow('2025-01-06', 85.1, 12.0, 3.5, 69.5, 50.0), // ~14.1% body fat
			createTestRow('2025-01-07', 85.2, 5.0, 3.5, 69.5, 50.0), // ~5.9% body fat (OUTLIER)
			createTestRow('2025-01-08', 85.0, 12.1, 3.5, 69.5, 50.0) // ~14.2% body fat
		];

		const processedData = processBodyCompositionData(testData, {
			includeIncompleteData: true,
			removeOutliers: true,
			outlierDetectionWindow: 5,
			outlierThreshold: 3.5,
			useWeightedAverage: false // Test outlier removal separately
		});

		// Should have filtered out the extreme outliers
		expect(processedData.length).toBeLessThan(testData.length);

		// Check that extreme body fat values are removed
		const bodyFatValues = processedData
			.map((d) => d.bodyFatPercentage)
			.filter((bf) => bf !== null) as number[];

		expect(bodyFatValues.every((bf) => bf > 10 && bf < 20)).toBe(true);
	});

	it('should calculate weighted averages correctly', () => {
		const testData: BodyCompositionRow[] = [
			createTestRow('2025-01-01', 85.0, 12.0, 3.5, 69.5, 50.0),
			createTestRow('2025-01-02', 86.0, 12.5, 3.5, 69.5, 50.0),
			createTestRow('2025-01-03', 87.0, 13.0, 3.5, 69.5, 50.0),
			createTestRow('2025-01-04', 88.0, 13.5, 3.5, 69.5, 50.0),
			createTestRow('2025-01-05', 89.0, 14.0, 3.5, 69.5, 50.0)
		];

		const processedData = processBodyCompositionData(testData, {
			includeIncompleteData: true,
			removeOutliers: false, // Test weighted average separately
			useWeightedAverage: true,
			weightedAverageWindow: 3
		});

		// Should drop first 2 points for 3-day window
		expect(processedData.length).toBe(testData.length - 2);

		// Check that the first result is a weighted average of the first 3 points
		// With linear weighting: (85*1 + 86*2 + 87*3) / (1+2+3) = (85+172+261)/6 = 518/6 ≈ 86.33
		expect(processedData[0].weight).toBeCloseTo(86.33, 1);

		// The last data point should be a weighted average of the last 3 points
		// (87*1 + 88*2 + 89*3) / (1+2+3) = (87+176+267)/6 = 530/6 ≈ 88.33
		expect(processedData[processedData.length - 1].weight).toBeCloseTo(88.33, 1);
	});

	it('should handle missing data gracefully in weighted averages', () => {
		const testData: BodyCompositionRow[] = [
			createTestRow('2025-01-01', 85.0, 12.0),
			createTestRow('2025-01-02', 86.0), // Missing fat mass
			createTestRow('2025-01-03', 87.0, 13.0),
			createTestRow('2025-01-04', 88.0, 14.0)
		];

		const processedData = processBodyCompositionData(testData, {
			includeIncompleteData: true,
			removeOutliers: false,
			useWeightedAverage: true,
			weightedAverageWindow: 3
		});

		expect(processedData.length).toBe(testData.length - 2);

		// Should handle missing values properly in the weighted average
		const firstPoint = processedData[0];
		expect(firstPoint.weight).toBeDefined();
		expect(firstPoint.bodyFatPercentage).toBeDefined(); // Should average available values
	});

	it('should preserve data when no outliers exist', () => {
		const testData: BodyCompositionRow[] = [
			createTestRow('2025-01-01', 85.0, 12.0, 3.5, 69.5, 50.0),
			createTestRow('2025-01-02', 85.1, 12.1, 3.5, 69.5, 50.0),
			createTestRow('2025-01-03', 85.2, 12.2, 3.5, 69.5, 50.0),
			createTestRow('2025-01-04', 85.3, 12.3, 3.5, 69.5, 50.0),
			createTestRow('2025-01-05', 85.4, 12.4, 3.5, 69.5, 50.0)
		];

		const processedData = processBodyCompositionData(testData, {
			includeIncompleteData: true,
			removeOutliers: true,
			outlierDetectionWindow: 5,
			outlierThreshold: 3.5,
			useWeightedAverage: false
		});

		// Should preserve all data points when no outliers exist
		expect(processedData.length).toBe(testData.length);
	});

	it('should complete processing within reasonable time for large datasets', () => {
		// Create a dataset similar to the real one (~250 entries)
		const testData: BodyCompositionRow[] = [];
		const startDate = new Date('2024-01-01');

		for (let i = 0; i < 250; i++) {
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);

			// Create realistic but varied data
			const baseWeight = 85 + Math.sin(i * 0.01) * 2; // Slow variation
			const baseFat = 12 + Math.sin(i * 0.02) * 1; // Slow variation

			testData.push(
				createTestRow(
					date.toISOString().split('T')[0],
					baseWeight + (Math.random() - 0.5) * 0.5, // Small random variation
					baseFat + (Math.random() - 0.5) * 0.3,
					3.5,
					69.5,
					50.0
				)
			);
		}

		const startTime = performance.now();

		const processedData = processBodyCompositionData(testData, {
			includeIncompleteData: true,
			removeOutliers: true,
			outlierDetectionWindow: 15,
			outlierThreshold: 3.5,
			useWeightedAverage: true,
			weightedAverageWindow: 4
		});

		const endTime = performance.now();
		const processingTime = endTime - startTime;

		// Should complete within 100ms as requested
		expect(processingTime).toBeLessThan(100);

		// Should return processed data
		expect(processedData.length).toBeGreaterThan(0);
		expect(processedData.length).toBeLessThanOrEqual(testData.length);

		console.log(`Processing ${testData.length} entries took ${processingTime.toFixed(2)}ms`);
	});

	it('should work with both preprocessing steps enabled', () => {
		const testData: BodyCompositionRow[] = [
			createTestRow('2025-01-01', 85.0, 12.0, 3.5, 69.5, 50.0),
			createTestRow('2025-01-02', 85.1, 12.1, 3.5, 69.5, 50.0),
			createTestRow('2025-01-03', 85.2, 3.0, 3.5, 69.5, 50.0), // OUTLIER
			createTestRow('2025-01-04', 85.3, 12.3, 3.5, 69.5, 50.0),
			createTestRow('2025-01-05', 85.4, 12.4, 3.5, 69.5, 50.0),
			createTestRow('2025-01-06', 85.5, 12.5, 3.5, 69.5, 50.0),
			createTestRow('2025-01-07', 85.6, 12.6, 3.5, 69.5, 50.0)
		];

		const processedData = processBodyCompositionData(testData, {
			includeIncompleteData: true,
			removeOutliers: true,
			outlierDetectionWindow: 7,
			outlierThreshold: 3.5,
			useWeightedAverage: true,
			weightedAverageWindow: 4
		});

		// Should have removed outliers first, then applied weighted averaging
		expect(processedData.length).toBeGreaterThan(0);
		expect(processedData.length).toBeLessThan(testData.length);

		// All remaining body fat values should be reasonable
		const bodyFatValues = processedData
			.map((d) => d.bodyFatPercentage)
			.filter((bf) => bf !== null) as number[];

		expect(bodyFatValues.every((bf) => bf > 10)).toBe(true);
	});
});
