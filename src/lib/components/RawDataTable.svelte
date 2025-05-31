<script lang="ts">
	import { onMount } from 'svelte';
	import type { BodyCompositionRow, DataApiResponse } from '$lib/types/data';

	let data: BodyCompositionRow[] = [];
	let loading = true;
	let error = '';
	let saving = false;
	let saveTimeout: number | null = null;

	const headers = [
		{ key: 'Date' as keyof BodyCompositionRow, label: 'Date', type: 'datetime-local' },
		{ key: 'Weight (kg)' as keyof BodyCompositionRow, label: 'Weight (kg)', type: 'number' },
		{ key: 'Fat mass (kg)' as keyof BodyCompositionRow, label: 'Fat mass (kg)', type: 'number' },
		{ key: 'Bone mass (kg)' as keyof BodyCompositionRow, label: 'Bone mass (kg)', type: 'number' },
		{
			key: 'Muscle mass (kg)' as keyof BodyCompositionRow,
			label: 'Muscle mass (kg)',
			type: 'number'
		},
		{ key: 'Hydration (kg)' as keyof BodyCompositionRow, label: 'Hydration (kg)', type: 'number' },
		{ key: 'Comments' as keyof BodyCompositionRow, label: 'Comments', type: 'text' }
	];

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			const response = await fetch('/api/data/raw');
			const result: DataApiResponse = await response.json();

			if (result.success && result.data) {
				data = sortDataByDate(result.data);
			} else {
				error = result.error || 'Failed to load data';
			}
		} catch (err) {
			error = 'Failed to fetch data';
			console.error('Error loading data:', err);
		} finally {
			loading = false;
		}
	}

	async function saveData() {
		if (saving) return;

		try {
			saving = true;
			// Sort data by date before saving
			const sortedData = sortDataByDate([...data]);

			const response = await fetch('/api/data/raw', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: sortedData })
			});

			const result = await response.json();
			if (!result.success) {
				error = result.error || 'Failed to save data';
			} else {
				// Update local data with sorted version
				data = sortedData;
			}
		} catch (err) {
			error = 'Failed to save data';
			console.error('Error saving data:', err);
		} finally {
			saving = false;
		}
	}

	function sortDataByDate(dataToSort: BodyCompositionRow[]): BodyCompositionRow[] {
		return dataToSort.sort((a, b) => {
			const dateA = new Date(a.Date);
			const dateB = new Date(b.Date);
			// Sort in descending order (newest first)
			return dateB.getTime() - dateA.getTime();
		});
	}

	function scheduleAutoSave() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = window.setTimeout(() => {
			saveData();
		}, 1000); // Auto-save after 1 second of inactivity
	}

	function handleCellChange(rowIndex: number, field: keyof BodyCompositionRow, value: string) {
		if (rowIndex >= 0 && rowIndex < data.length) {
			data[rowIndex] = { ...data[rowIndex], [field]: value };
			scheduleAutoSave();
		}
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

	function addNewRow() {
		const newRow: BodyCompositionRow = {
			id: Date.now(), // Temporary ID
			Date: new Date().toISOString().replace('T', ' ').slice(0, 19),
			'Weight (kg)': '',
			'Fat mass (kg)': '',
			'Bone mass (kg)': '',
			'Muscle mass (kg)': '',
			'Hydration (kg)': '',
			Comments: ''
		};

		// Add to the beginning of the array (will be sorted on save)
		data = [newRow, ...data];
		scheduleAutoSave();
	}

	function deleteRow(index: number) {
		if (confirm('Are you sure you want to delete this row?')) {
			data = data.filter((_, i) => i !== index);
			scheduleAutoSave();
		}
	}
</script>

<div class="data-container">
	<div class="data-header">
		<h2 class="data-title">Raw Data</h2>
		<div class="data-actions">
			{#if saving}
				<span class="save-status saving">Saving...</span>
			{:else}
				<span class="save-status saved">Saved</span>
			{/if}
			<button class="btn" on:click={addNewRow}>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add Row
			</button>
		</div>
	</div>

	{#if loading}
		<div class="loading-section">
			<div class="loading-spinner"></div>
			<p>Loading data...</p>
		</div>
	{:else if error}
		<div class="error-container">
			<p class="feedback error">{error}</p>
			<button class="btn secondary" on:click={loadData}>Retry</button>
		</div>
	{:else}
		<div class="data-table-container">
			<table class="data-table">
				<thead>
					<tr>
						<th style="width: 60px;">Actions</th>
						{#each headers as header (header.key)}
							<th>{header.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each data as row, rowIndex (row.id || rowIndex)}
						<tr>
							<td style="text-align: center;">
								<button
									class="action-button delete"
									on:click={() => deleteRow(rowIndex)}
									title="Delete row"
									aria-label="Delete row"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"
										/>
									</svg>
								</button>
							</td>
							{#each headers as header (header.key)}
								<td>
									{#if header.type === 'datetime-local'}
										<input
											type="datetime-local"
											value={formatDateForInput(row[header.key] as string)}
											on:input={(e) =>
												handleCellChange(
													rowIndex,
													header.key,
													formatDateForDisplay(e.currentTarget.value)
												)}
											class="data-table-input"
											style="min-width: 180px;"
										/>
									{:else if header.type === 'number'}
										<input
											type="number"
											step="0.01"
											value={row[header.key] as string}
											on:input={(e) =>
												handleCellChange(rowIndex, header.key, e.currentTarget.value)}
											class="data-table-input"
											style="text-align: right;"
											placeholder="--"
										/>
									{:else}
										<input
											type="text"
											value={row[header.key] as string}
											on:input={(e) =>
												handleCellChange(rowIndex, header.key, e.currentTarget.value)}
											class="data-table-input"
											style="min-width: {header.key === 'Comments' ? '200px' : '120px'};"
											placeholder={header.key === 'Comments' ? 'Add notes...' : ''}
										/>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.length === 0}
			<div class="empty-state">
				<p>No data available</p>
				<button class="btn" on:click={addNewRow}>Add First Entry</button>
			</div>
		{/if}
	{/if}
</div>
