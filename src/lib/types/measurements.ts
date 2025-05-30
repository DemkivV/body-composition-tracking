export interface BodyMeasurement {
	timestamp: Date;
	weight_kg?: number;
	body_fat_percent?: number;
	fat_mass_kg?: number;
	bone_mass_kg?: number;
	muscle_mass_kg?: number;
	hydration_kg?: number;
	source: string;
}

export interface MeasurementData {
	weight_kg?: number;
	fat_mass_kg?: number;
	bone_mass_kg?: number;
	muscle_mass_kg?: number;
	hydration_kg?: number;
}

export interface ImportResult {
	success: boolean;
	message: string;
	file_path?: string;
	unified_file?: string;
	count?: number;
	total_unified?: number;
}
