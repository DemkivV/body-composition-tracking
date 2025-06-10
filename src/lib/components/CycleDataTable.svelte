<script lang="ts">
	import DataTable from './DataTable.svelte';
	import type { CycleDataRow } from '$lib/types/data';

	let dataTableRef: DataTable<CycleDataRow>;
	// Export refresh method for parent components
	export function refreshData() {
		if (dataTableRef) {
			dataTableRef.refreshData();
		}
	}

	const headers = [
		{ key: 'Start Date' as keyof CycleDataRow, label: 'Start Date', type: 'date' as const },
		{ key: 'End Date' as keyof CycleDataRow, label: 'End Date', type: 'date' as const },
		{ key: 'Cycle Name' as keyof CycleDataRow, label: 'Cycle Name', type: 'text' as const },
		{ key: 'Comments' as keyof CycleDataRow, label: 'Comments', type: 'text' as const }
	];

	function createNewCycleDataRow(): CycleDataRow {
		const now = new Date();
		const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
		const endDate = new Date(now.getFullYear(), now.getMonth(), 20);

		return {
			id: Date.now(), // Temporary ID
			'Start Date': startDate.toISOString().split('T')[0],
			'End Date': endDate.toISOString().split('T')[0],
			'Cycle Name': `Meso ${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`,
			Comments: ''
		};
	}

	function sortCycleData(data: CycleDataRow[]): CycleDataRow[] {
		return data.sort((a, b) => {
			const dateA = new Date(a['Start Date']);
			const dateB = new Date(b['Start Date']);
			// Sort in descending order (most recent first, like weight data)
			return dateB.getTime() - dateA.getTime();
		});
	}

	// Simple date formatter for date inputs (no time needed)
	const dateFormatter = {
		formatForInput: (dateStr: string) => dateStr,
		formatForDisplay: (inputValue: string) => inputValue
	};

	async function handleDataChange() {
		if (dataTableRef) {
			await dataTableRef.saveData();
		}
	}
</script>

<DataTable
	bind:this={dataTableRef}
	title="Data"
	apiEndpoint="/api/data/cycles"
	{headers}
	createNewRow={createNewCycleDataRow}
	sortFunction={sortCycleData}
	{dateFormatter}
	on:add={handleDataChange}
	on:change={handleDataChange}
	on:delete={handleDataChange}
/>
