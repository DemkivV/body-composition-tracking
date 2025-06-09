<script lang="ts">
	import DataTable from './DataTable.svelte';
	import type { BodyCompositionRow } from '$lib/types/data';

	let dataTableRef: DataTable<BodyCompositionRow>;

	// Export refresh method for parent components
	export function refreshData() {
		if (dataTableRef) {
			dataTableRef.refreshData();
		}
	}

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
			// Parse the date from "YYYY-MM-DD HH:MM:SS" format as local time
			// Split the date string to avoid timezone conversion
			const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
			if (!parts) return '';

			const [, year, month, day, hour, minute] = parts;
			// Create date as local time using the constructor that doesn't apply timezone conversion
			const date = new Date(
				parseInt(year),
				parseInt(month) - 1,
				parseInt(day),
				parseInt(hour),
				parseInt(minute)
			);

			if (isNaN(date.getTime())) return '';

			// Format for datetime-local input (YYYY-MM-DDTHH:MM)
			const yearStr = date.getFullYear().toString();
			const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
			const dayStr = date.getDate().toString().padStart(2, '0');
			const hourStr = date.getHours().toString().padStart(2, '0');
			const minuteStr = date.getMinutes().toString().padStart(2, '0');

			return `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}`;
		} catch {
			return '';
		}
	}

	function formatDateForDisplay(inputValue: string): string {
		if (!inputValue) return '';
		try {
			// Convert from datetime-local format back to our format
			// Parse the datetime-local format (YYYY-MM-DDTHH:MM)
			const parts = inputValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
			if (!parts) return inputValue;

			const [, year, month, day, hour, minute] = parts;
			// Create as local time
			const date = new Date(
				parseInt(year),
				parseInt(month) - 1,
				parseInt(day),
				parseInt(hour),
				parseInt(minute)
			);

			if (isNaN(date.getTime())) return inputValue;

			// Format as "YYYY-MM-DD HH:MM:SS"
			const yearStr = date.getFullYear().toString();
			const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
			const dayStr = date.getDate().toString().padStart(2, '0');
			const hourStr = date.getHours().toString().padStart(2, '0');
			const minuteStr = date.getMinutes().toString().padStart(2, '0');
			const secondStr = date.getSeconds().toString().padStart(2, '0');

			return `${yearStr}-${monthStr}-${dayStr} ${hourStr}:${minuteStr}:${secondStr}`;
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
	bind:this={dataTableRef}
	title="Data"
	apiEndpoint="/api/data/raw"
	{headers}
	createNewRow={createNewBodyCompositionRow}
	sortFunction={sortBodyCompositionData}
	{dateFormatter}
/>
