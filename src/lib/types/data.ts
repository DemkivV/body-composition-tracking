export interface BodyCompositionRow {
	id: number;
	Date: string;
	'Weight (kg)': string;
	'Fat mass (kg)': string;
	'Bone mass (kg)': string;
	'Muscle mass (kg)': string;
	'Hydration (kg)': string;
	Comments: string;
}

export interface DataApiResponse {
	success: boolean;
	data?: BodyCompositionRow[];
	error?: string;
}
