<script lang="ts" generics="T extends Record<string, string | number>">
	import { onMount, onDestroy } from 'svelte';

	export let title: string;
	export let apiEndpoint: string;
	export let headers: Array<{
		key: keyof T;
		label: string;
		type: 'datetime-local' | 'date' | 'number' | 'text';
	}>;
	export let createNewRow: () => T;
	export let sortFunction: (data: T[]) => T[];
	export let dateFormatter: {
		formatForInput: (dateStr: string) => string;
		formatForDisplay: (inputValue: string) => string;
	};

	let data: T[] = [];
	let loading = true;
	let error = '';
	let saving = false;
	let saveTimeout: number | null = null;
	let abortController: AbortController | null = null;

	onMount(async () => {
		await loadData();
	});

	onDestroy(() => {
		// Clear any pending timeouts to prevent dangling saves
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		// Cancel any in-flight requests
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
	});

	async function loadData() {
		try {
			loading = true;

			// Cancel any previous requests
			if (abortController) {
				abortController.abort();
			}

			abortController = new AbortController();

			const response = await fetch(apiEndpoint, {
				signal: abortController.signal
			});
			const result = await response.json();

			if (result.success && result.data) {
				data = sortFunction(result.data);
			} else {
				error = result.error || 'Failed to load data';
			}
		} catch (err) {
			// Don't show error if request was aborted (component cleanup)
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			error = 'Failed to fetch data';
			console.error('Error loading data:', err);
		} finally {
			loading = false;
			abortController = null;
		}
	}

	async function saveData() {
		if (saving) return;

		try {
			saving = true;

			// Cancel any previous requests
			if (abortController) {
				abortController.abort();
			}

			abortController = new AbortController();

			// Sort data before saving
			const sortedData = sortFunction([...data]);

			const response = await fetch(apiEndpoint, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: sortedData }),
				signal: abortController.signal
			});

			const result = await response.json();
			if (!result.success) {
				error = result.error || 'Failed to save data';
			} else {
				// Update local data with sorted version
				data = sortedData;
			}
		} catch (err) {
			// Don't show error if request was aborted (component cleanup)
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			error = 'Failed to save data';
			console.error('Error saving data:', err);
		} finally {
			saving = false;
			abortController = null;
		}
	}

	function scheduleAutoSave() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = window.setTimeout(() => {
			saveData();
		}, 1000); // Auto-save after 1 second of inactivity
	}

	function handleCellChange(rowIndex: number, field: keyof T, value: string) {
		if (rowIndex >= 0 && rowIndex < data.length) {
			data[rowIndex] = { ...data[rowIndex], [field]: value };
			scheduleAutoSave();
		}
	}

	function addNewRow() {
		const newRow = createNewRow();
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

<div class="data-header">
	<h2 class="data-title">{title}</h2>
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
										value={dateFormatter.formatForInput(row[header.key] as string)}
										on:input={(e) =>
											handleCellChange(
												rowIndex,
												header.key,
												dateFormatter.formatForDisplay(e.currentTarget.value)
											)}
										class="data-table-input"
										style="min-width: 180px;"
									/>
								{:else if header.type === 'date'}
									<input
										type="date"
										value={row[header.key] as string}
										on:input={(e) => handleCellChange(rowIndex, header.key, e.currentTarget.value)}
										class="data-table-input"
										style="min-width: 140px;"
									/>
								{:else if header.type === 'number'}
									<input
										type="text"
										value={row[header.key] as string}
										on:input={(e) => handleCellChange(rowIndex, header.key, e.currentTarget.value)}
										class="data-table-input"
										style="text-align: right;"
										placeholder="--"
									/>
								{:else}
									<input
										type="text"
										value={row[header.key] as string}
										on:input={(e) => handleCellChange(rowIndex, header.key, e.currentTarget.value)}
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
