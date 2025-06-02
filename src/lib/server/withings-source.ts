import { getValidToken, type WithingsToken } from './withings-auth.js';
import { getDataDir } from './config.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { BodyMeasurement, MeasurementData } from '../types/measurements.js';

// Withings API endpoints
const WITHINGS_MEASURE_URL = 'https://wbsapi.withings.net/measure';

interface WithingsMeasureGroup {
	date: number;
	measures: Array<{
		type: number;
		value: number;
		unit: number;
	}>;
}

interface WithingsApiResponse {
	status: number;
	body?: {
		measuregrps?: WithingsMeasureGroup[];
	};
	error?: string;
}

export class WithingsSource {
	private token: WithingsToken | null = null;

	/**
	 * Get valid authentication token
	 */
	private async getToken(): Promise<WithingsToken> {
		if (!this.token) {
			this.token = await getValidToken();
			if (!this.token) {
				throw new Error('No valid authentication token available');
			}
		}
		return this.token;
	}

	/**
	 * Make authenticated request to Withings API
	 */
	private async makeRequest(
		action: string,
		params: Record<string, string | number> = {}
	): Promise<WithingsApiResponse> {
		const token = await this.getToken();

		const requestParams = {
			action,
			...params
		};

		const response = await fetch(WITHINGS_MEASURE_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': 'body-composition-tracker/1.0'
			},
			body: new URLSearchParams(requestParams)
		});

		if (!response.ok) {
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		const apiResponse: WithingsApiResponse = await response.json();

		// Check for Withings API error status codes
		if (apiResponse.status !== 0) {
			const errorMessage = apiResponse.error || `Withings API error (status: ${apiResponse.status})`;
			
			// Map common error codes to more user-friendly messages
			switch (apiResponse.status) {
				case 401:
					throw new Error('Unauthorized: Invalid access token');
				case 601:
					throw new Error('Access token expired. Please re-authenticate');
				case 603:
					throw new Error('Insufficient permissions for this action');
				case 2555:
					throw new Error('Unknown user - user does not exist');
				case 2556:
					throw new Error('User suspended');
				default:
					throw new Error(errorMessage);
			}
		}

		return apiResponse;
	}

	/**
	 * Get measurements from Withings API
	 */
	async getMeasurements(startDate: Date, endDate: Date): Promise<BodyMeasurement[]> {
		const startTimestamp = Math.floor(startDate.getTime() / 1000);
		const endTimestamp = Math.floor(endDate.getTime() / 1000);

		const response = await this.makeRequest('getmeas', {
			startdate: startTimestamp,
			enddate: endTimestamp,
			meastypes: '1,8,5,88,77', // Weight, fat mass, fat free mass, bone mass, water mass
			category: 1, // Real measurements only
			lastupdate: startTimestamp
		});

		const measurements: BodyMeasurement[] = [];
		const measureGroups = response.body?.measuregrps || [];

		for (const group of measureGroups) {
			const timestamp = new Date(group.date * 1000);
			const measures: Record<number, number> = {};

			// Convert raw measures to proper values
			for (const measure of group.measures) {
				measures[measure.type] = measure.value * Math.pow(10, measure.unit);
			}

			const measurement: BodyMeasurement = {
				timestamp,
				weight_kg: measures[1],
				fat_mass_kg: measures[8],
				bone_mass_kg: measures[88],
				muscle_mass_kg: measures[5], // This will be corrected later
				hydration_kg: measures[77],
				source: 'withings'
			};

			measurements.push(measurement);
		}

		return measurements;
	}

	/**
	 * Process API measurements and group by timestamp
	 */
	private processApiMeasurements(response: WithingsApiResponse): Map<Date, MeasurementData> {
		const measurementsByTimestamp = new Map<Date, MeasurementData>();
		const measureGroups = response.body?.measuregrps || [];

		for (const group of measureGroups) {
			const timestamp = new Date(group.date * 1000);

			if (!measurementsByTimestamp.has(timestamp)) {
				measurementsByTimestamp.set(timestamp, {});
			}

			const measurementData = measurementsByTimestamp.get(timestamp)!;

			for (const measure of group.measures) {
				const value = measure.value * Math.pow(10, measure.unit);
				this.mapMeasurementType(measurementData, measure.type, value);
			}
		}

		return measurementsByTimestamp;
	}

	/**
	 * Map Withings measurement type to our data structure
	 */
	private mapMeasurementType(data: MeasurementData, measureType: number, value: number): void {
		switch (measureType) {
			case 1: // Weight in kg
				data.weight_kg = value;
				break;
			case 8: // Fat mass in kg
				data.fat_mass_kg = value;
				break;
			case 88: // Bone mass in kg
				data.bone_mass_kg = value;
				break;
			case 5: // Fat free mass (muscle mass) in kg
				data.muscle_mass_kg = value;
				break;
			case 77: // Water mass (hydration) in kg
				data.hydration_kg = value;
				break;
		}
	}

	/**
	 * Apply muscle mass correction by subtracting bone mass from fat-free mass
	 */
	private applyMuscleMassCorrection(measurements: Map<Date, MeasurementData>): void {
		for (const [, measurementData] of measurements) {
			const fatFreeMass = measurementData.muscle_mass_kg || 0; // This is actually fat-free mass
			const boneMass = measurementData.bone_mass_kg || 0;

			if (fatFreeMass > 0) {
				const actualMuscleMass = fatFreeMass - boneMass;
				measurementData.muscle_mass_kg = actualMuscleMass > 0 ? actualMuscleMass : fatFreeMass;
			} else {
				delete measurementData.muscle_mass_kg;
			}
		}
	}

	/**
	 * Format metric value for CSV output
	 */
	private static formatMetric(data: MeasurementData, key: keyof MeasurementData): string {
		const value = data[key];

		if (value === undefined || value === null) {
			return '';
		}

		if (isNaN(value) || !isFinite(value)) {
			return '';
		}

		try {
			return value.toFixed(2);
		} catch {
			return '';
		}
	}

	/**
	 * Format a Date object to local timezone string (YYYY-MM-DD HH:MM:SS)
	 * This matches the behavior of Python's datetime.fromtimestamp().strftime()
	 */
	private static formatDateLocal(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}

	/**
	 * Get CSV file path for Withings data
	 */
	private getWithingsCsvPath(): string {
		return join(getDataDir(), 'raw_data_withings_api.csv');
	}

	/**
	 * Get CSV file path for unified app data
	 */
	private getUnifiedCsvPath(): string {
		return join(getDataDir(), 'raw_data_this_app.csv');
	}

	/**
	 * Write measurements to CSV file
	 */
	private async writeToCSV(
		filePath: string,
		measurements: Map<Date, MeasurementData>
	): Promise<void> {
		// Ensure data directory exists
		await fs.mkdir(getDataDir(), { recursive: true });

		let csvContent =
			'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n';

		// Sort by timestamp in reverse chronological order (newest first)
		const sortedTimestamps = Array.from(measurements.keys()).sort(
			(a, b) => b.getTime() - a.getTime()
		);

		for (const timestamp of sortedTimestamps) {
			const measurementData = measurements.get(timestamp)!;

			// Format date in local timezone to match Python behavior
			const dateStr = `"${WithingsSource.formatDateLocal(timestamp)}"`;
			const weight = WithingsSource.formatMetric(measurementData, 'weight_kg');
			const fatMass = WithingsSource.formatMetric(measurementData, 'fat_mass_kg');
			const boneMass = WithingsSource.formatMetric(measurementData, 'bone_mass_kg');
			const muscleMass = WithingsSource.formatMetric(measurementData, 'muscle_mass_kg');
			const hydration = WithingsSource.formatMetric(measurementData, 'hydration_kg');

			csvContent += `${dateStr},${weight},${fatMass},${boneMass},${muscleMass},${hydration},\n`;
		}

		await fs.writeFile(filePath, csvContent, 'utf-8');
	}

	/**
	 * Import all available data from Withings and save to CSV
	 */
	async importAllDataToCSV(): Promise<number> {
		// Get measurements from a wide date range (10 years back)
		const endDate = new Date();
		const startDate = new Date(2015, 0, 1); // January 1, 2015

		console.log(`Importing all data from ${startDate.toDateString()} to ${endDate.toDateString()}`);

		const response = await this.makeRequest('getmeas', {
			startdate: Math.floor(startDate.getTime() / 1000),
			enddate: Math.floor(endDate.getTime() / 1000),
			meastypes: '1,8,5,88,77', // Weight, fat mass, fat free mass, bone mass, water mass
			category: 1 // Real measurements only
		});

		// Process measurements and group by timestamp
		const measurementsByTimestamp = this.processApiMeasurements(response);

		// Apply muscle mass correction
		this.applyMuscleMassCorrection(measurementsByTimestamp);

		// Write data to CSV file
		const csvPath = this.getWithingsCsvPath();
		await this.writeToCSV(csvPath, measurementsByTimestamp);

		console.log(`Successfully imported ${measurementsByTimestamp.size} measurements to ${csvPath}`);
		return measurementsByTimestamp.size;
	}

	/**
	 * Load existing CSV data and return timestamps and measurements
	 */
	private async loadExistingCSVData(csvPath: string): Promise<{
		existingTimestamps: Set<number>; // Use timestamps as numbers for precise comparison
		existingData: Map<Date, MeasurementData>;
	}> {
		const existingTimestamps = new Set<number>();
		const existingData = new Map<Date, MeasurementData>();

		try {
			const csvContent = await fs.readFile(csvPath, 'utf-8');
			const lines = csvContent.split('\n');

			if (lines.length <= 1) {
				return { existingTimestamps, existingData };
			}

			for (let i = 1; i < lines.length; i++) {
				const line = lines[i].trim();
				if (!line) continue;

				try {
					const parts = line.split(',');
					if (parts.length >= 6) {
						const dateStr = parts[0].replace(/"/g, '');
						// Parse as local time to match the format we're writing
						const timestamp = new Date(dateStr);
						existingTimestamps.add(timestamp.getTime());

						const measurementData: MeasurementData = {
							weight_kg: parts[1] ? parseFloat(parts[1]) : undefined,
							fat_mass_kg: parts[2] ? parseFloat(parts[2]) : undefined,
							bone_mass_kg: parts[3] ? parseFloat(parts[3]) : undefined,
							muscle_mass_kg: parts[4] ? parseFloat(parts[4]) : undefined,
							hydration_kg: parts[5] ? parseFloat(parts[5]) : undefined
						};

						existingData.set(timestamp, measurementData);
					}
				} catch (error) {
					console.warn(`Failed to parse CSV line: ${line}`, error);
				}
			}
		} catch (error) {
			console.warn(`Could not read existing CSV file: ${error}`);
		}

		return { existingTimestamps, existingData };
	}

	/**
	 * Get the most recent timestamp from existing CSV data
	 */
	async getMostRecentTimestamp(): Promise<Date | null> {
		const csvPath = this.getWithingsCsvPath();

		try {
			const { existingTimestamps } = await this.loadExistingCSVData(csvPath);

			if (existingTimestamps.size === 0) {
				return null;
			}

			// Find the most recent timestamp (highest number)
			const mostRecentTime = Math.max(...Array.from(existingTimestamps));
			return new Date(mostRecentTime);
		} catch (error) {
			console.warn('Error getting most recent timestamp:', error);
			return null;
		}
	}

	/**
	 * Import incremental data from API and update CSV file
	 */
	async importIncrementalDataToCSV(startDate: Date): Promise<number> {
		const endDate = new Date();

		console.log(
			`Importing incremental data from ${startDate.toDateString()} to ${endDate.toDateString()}`
		);

		const response = await this.makeRequest('getmeas', {
			startdate: Math.floor(startDate.getTime() / 1000),
			enddate: Math.floor(endDate.getTime() / 1000),
			meastypes: '1,8,5,88,77', // Weight, fat mass, fat free mass, bone mass, water mass
			category: 1 // Real measurements only
		});

		// Get new measurements from API
		const newMeasurements = this.processApiMeasurements(response);

		if (newMeasurements.size === 0) {
			console.log('No new measurements found');
			return 0;
		}

		// Apply muscle mass correction
		this.applyMuscleMassCorrection(newMeasurements);

		// Load existing data and merge with new data
		const csvPath = this.getWithingsCsvPath();
		const { existingTimestamps, existingData } = await this.loadExistingCSVData(csvPath);

		// Add new measurements that don't already exist
		const allMeasurements = new Map(existingData);
		let newCount = 0;

		for (const [timestamp, data] of newMeasurements) {
			const timestampKey = new Date(timestamp.getTime()); // Normalize timestamp
			if (!existingTimestamps.has(timestampKey.getTime())) {
				allMeasurements.set(timestampKey, data);
				newCount++;
			}
		}

		// Write updated data to CSV
		await this.writeToCSV(csvPath, allMeasurements);

		console.log(
			`Successfully imported ${newCount} new measurements (total: ${allMeasurements.size}) to ${csvPath}`
		);
		return newCount;
	}

	/**
	 * Transform Withings CSV to unified format
	 */
	async transformToUnifiedFormat(): Promise<number> {
		const withingsCsvPath = this.getWithingsCsvPath();
		const unifiedCsvPath = this.getUnifiedCsvPath();

		try {
			// Check if Withings CSV exists
			await fs.access(withingsCsvPath);
		} catch {
			console.log('No Withings CSV file found');
			return 0;
		}

		// For now, just copy the file (in the future, this could merge multiple sources)
		await fs.copyFile(withingsCsvPath, unifiedCsvPath);

		// Count lines to return number of entries
		const content = await fs.readFile(unifiedCsvPath, 'utf-8');
		const lines = content.split('\n').filter((line) => line.trim());
		const entryCount = Math.max(0, lines.length - 1); // Subtract header

		console.log(`Transformed ${entryCount} entries to unified format`);
		return entryCount;
	}
}
