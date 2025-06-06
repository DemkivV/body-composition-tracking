<script lang="ts">
	import DataTable from './DataTable.svelte';
	import type { BodyCompositionRow } from '$lib/types/data';

	const headers = [
		{ key: 'Date' as keyof BodyCompositionRow, label: 'Date', type: 'datetime-local' as const },
		{
			key: 'Weight (kg)' as keyof BodyCompositionRow,
			label: 'Weight (kg)',
			type: 'number' as const
		},
		{
			key: 'Fat mass (kg)' as keyof BodyCompositionRow,
			label: 'Fat mass (kg)',
			type: 'number' as const
		},
		{
			key: 'Bone mass (kg)' as keyof BodyCompositionRow,
			label: 'Bone mass (kg)',
			type: 'number' as const
		},
		{
			key: 'Muscle mass (kg)' as keyof BodyCompositionRow,
			label: 'Muscle mass (kg)',
			type: 'number' as const
		},
		{
			key: 'Hydration (kg)' as keyof BodyCompositionRow,
			label: 'Hydration (kg)',
			type: 'number' as const
		},
		{ key: 'Comments' as keyof BodyCompositionRow, label: 'Comments', type: 'text' as const }
	];

	function createNewBodyCompositionRow(): BodyCompositionRow {
		return {
			id: Date.now(), // Temporary ID
			Date: new Date().toISOString().replace('T', ' ').slice(0, 19),
			'Weight (kg)': '',
			'Fat mass (kg)': '',
			'Bone mass (kg)': '',
			'Muscle mass (kg)': '',
			'Hydration (kg)': '',
			Comments: ''
		};
	}

	function sortBodyCompositionData(data: BodyCompositionRow[]): BodyCompositionRow[] {
		return data.sort((a, b) => {
			const dateA = new Date(a.Date);
			const dateB = new Date(b.Date);
			// Sort in descending order (newest first)
			return dateB.getTime() - dateA.getTime();
		});
	}

	function formatDateForInput(dateStr: string): string {
		if (!dateStr) return '';
		try {
			// Parse the date from "YYYY-MM-DD HH:MM:SS" format
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return '';

			// Format for datetime-local input (YYYY-MM-DDTHH:MM)
			return date.toISOString().slice(0, 16);
		} catch {
			return '';
		}
	}

	function formatDateForDisplay(inputValue: string): string {
		if (!inputValue) return '';
		try {
			// Convert from datetime-local format back to our format
			const date = new Date(inputValue);
			if (isNaN(date.getTime())) return inputValue;

			// Format as "YYYY-MM-DD HH:MM:SS"
			return date.toISOString().replace('T', ' ').slice(0, 19);
		} catch {
			return inputValue;
		}
	}

	const dateFormatter = {
		formatForInput: formatDateForInput,
		formatForDisplay: formatDateForDisplay
	};
</script>

<DataTable
	title="Raw Data"
	apiEndpoint="/api/data/raw"
	{headers}
	createNewRow={createNewBodyCompositionRow}
	sortFunction={sortBodyCompositionData}
	{dateFormatter}
/>
