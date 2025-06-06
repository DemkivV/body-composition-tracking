export interface BodyCompositionRow extends Record<string, string | number> {
	id: number;
	Date: string;
	'Weight (kg)': string;
	'Fat mass (kg)': string;
	'Bone mass (kg)': string;
	'Muscle mass (kg)': string;
	'Hydration (kg)': string;
	Comments: string;
}

export interface CycleDataRow extends Record<string, string | number> {
	id: number;
	'Start Date': string;
	'End Date': string;
	'Cycle Name': string;
	Comments: string;
}

export interface DataApiResponse {
	success: boolean;
	data?: BodyCompositionRow[];
	error?: string;
}

export interface CycleDataApiResponse {
	success: boolean;
	data?: CycleDataRow[];
	error?: string;
}
