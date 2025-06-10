<script lang="ts" generics="T extends Record<string, string | number>">
	import { onMount, onDestroy } from 'svelte';
	import { dataStore, dataActions } from '$lib/stores/data';
	import { dataService } from '$lib/services/data-service';
	import type { BodyCompositionRow, CycleDataRow } from '$lib/types/data';

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

	// Determine data type based on endpoint
	const isBodyCompositionTable = apiEndpoint === '/api/data/raw';
	const isCycleTable = apiEndpoint === '/api/data/cycles';
	const useDataStore = isBodyCompositionTable || isCycleTable;

	// Use store data for body comp and cycle data, otherwise use local state
	$: storeData = $dataStore;
	let localData: T[] = [];
	let localLoading = true;
	let localError = '';

	$: data = useDataStore
		? isBodyCompositionTable
			? (storeData.bodyCompositionData as unknown as T[])
			: (storeData.cycleData as unknown as T[])
		: localData;

	$: loading = useDataStore
		? isBodyCompositionTable
			? storeData.bodyCompLoading
			: storeData.cycleLoading
		: localLoading;

	$: error = useDataStore ? storeData.error || '' : localError;

	let saving = false;
	let saveTimeout: number | null = null;
	let abortController: AbortController | null = null;

	// Function to refresh data from API
	export async function refreshData() {
		if (useDataStore) {
			if (isBodyCompositionTable) {
				await dataService.refreshBodyCompositionData();
			} else if (isCycleTable) {
				await dataService.refreshCycleData();
			}
		} else {
			await loadData();
		}
	}

	onMount(async () => {
		if (useDataStore) {
			// Wait for data service initialization if not yet initialized
			const initPromise = dataService.getInitializationPromise();
			if (initPromise) {
				await initPromise;
			}

			// If no data yet or very old, refresh
			const lastUpdated = isBodyCompositionTable
				? storeData.bodyCompLastUpdated
				: storeData.cycleLastUpdated;

			const shouldLoad = !lastUpdated || Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes

			const hasData = isBodyCompositionTable
				? storeData.bodyCompositionData.length > 0
				: storeData.cycleData.length > 0;

			if (shouldLoad || !hasData) {
				await refreshData();
			}
		} else {
			await loadData();
		}
	});

	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		if (abortController) {
			abortController.abort();
		}
	});

	async function loadData() {
		if (useDataStore) return; // Store handles loading

		localLoading = true;
		localError = '';

		try {
			const response = await fetch(apiEndpoint);
			const result = await response.json();

			if (result.success) {
				const parsedData = result.data || [];
				localData = sortFunction ? sortFunction(parsedData) : parsedData;
			} else {
				localError = result.error || 'Failed to load data';
			}
		} catch (err) {
			localError = 'Failed to load data';
			console.error('Error loading data:', err);
		} finally {
			localLoading = false;
		}
	}

	async function saveData() {
		if (saving || abortController) return;

		saving = true;
		abortController = new AbortController();

		try {
			const sortedData = sortFunction ? sortFunction(data) : data;

			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: sortedData }),
				signal: abortController.signal
			});

			const result = await response.json();
			if (!result.success) {
				const errorMsg = result.error || 'Failed to save data';
				if (useDataStore) {
					dataActions.setError(errorMsg);
				} else {
					localError = errorMsg;
				}
			} else {
				// Update with sorted version
				if (useDataStore) {
					if (isBodyCompositionTable) {
						dataActions.setBodyCompositionData(sortedData as unknown as BodyCompositionRow[]);
					} else if (isCycleTable) {
						dataActions.setCycleData(sortedData as unknown as CycleDataRow[]);
					}
				} else {
					localData = sortedData;
				}
			}
		} catch (err) {
			// Don't show error if request was aborted (component cleanup)
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			const errorMsg = 'Failed to save data';
			if (useDataStore) {
				dataActions.setError(errorMsg);
			} else {
				localError = errorMsg;
			}
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
			if (useDataStore) {
				if (isBodyCompositionTable) {
					const updatedRow = { ...data[rowIndex], [field]: value };
					dataActions.updateSingleBodyCompRow(
						rowIndex,
						updatedRow as unknown as BodyCompositionRow
					);
				} else if (isCycleTable) {
					const updatedRow = { ...data[rowIndex], [field]: value };
					dataActions.updateSingleCycleRow(rowIndex, updatedRow as unknown as CycleDataRow);
				}
			} else {
				localData[rowIndex] = { ...data[rowIndex], [field]: value };
				localData = [...localData]; // Trigger reactivity
			}
			scheduleAutoSave();
		}
	}

	function addNewRow() {
		const newRow = createNewRow();
		if (useDataStore) {
			if (isBodyCompositionTable) {
				dataActions.addBodyCompRow(newRow as unknown as BodyCompositionRow);
			} else if (isCycleTable) {
				dataActions.addCycleRow(newRow as unknown as CycleDataRow);
			}
		} else {
			localData = [newRow, ...localData];
		}
		scheduleAutoSave();
	}

	function deleteRow(index: number) {
		if (confirm('Are you sure you want to delete this row?')) {
			if (useDataStore) {
				if (isBodyCompositionTable) {
					dataActions.removeBodyCompRow(index);
				} else if (isCycleTable) {
					dataActions.removeCycleRow(index);
				}
			} else {
				localData = localData.filter((_, i) => i !== index);
			}
			scheduleAutoSave();
		}
	}
</script>

<div class="data-container" data-testid="data-table">
	<div class="data-header">
		<h2 class="data-title">{title}</h2>
		<div class="add-row-container">
			<div class="status save-status" data-testid="save-status" class:saving>
				{#if saving}
					Saving...
				{:else}
					Saved
				{/if}
			</div>
			<button class="btn add-row-btn" on:click={addNewRow}>
				<span class="icon">+</span>
				<span class="text">Add Row</span>
			</button>
		</div>
	</div>

	{#if error}
		<div class="error-container">
			<p class="feedback error">{error}</p>
		</div>
	{/if}

	{#if loading}
		<div class="loading-container loading-section">
			<div class="status authenticating">Loading data...</div>
		</div>
	{:else}
		<div class="data-table-container">
			<table class="data-table">
				<thead>
					<tr>
						<th>Actions</th>
						{#each headers as header, index (header.key)}
							<th class:flex-column={index === headers.length - 1}>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html header.label.replace(/\s+/g, '<br>')}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#if data.length === 0}
						<tr>
							<td colspan={headers.length + 1} class="empty-state">
								No data available. Click "Add Row" to get started.
							</td>
						</tr>
					{:else}
						{#each data as row, rowIndex (row.id)}
							<tr>
								<td class="actions">
									<button
										class="btn delete-btn action-button delete"
										on:click={() => deleteRow(rowIndex)}
										title="Delete row"
										aria-label="Delete row"
									>
										✗
									</button>
								</td>
								{#each headers as header, index (header.key)}
									<td class:flex-column={index === headers.length - 1}>
										{#if header.type === 'datetime-local'}
											<input
												type="datetime-local"
												class="table-input"
												value={dateFormatter.formatForInput(String(row[header.key]))}
												on:change={(e) =>
													handleCellChange(
														rowIndex,
														header.key,
														dateFormatter.formatForDisplay(e.currentTarget.value)
													)}
											/>
										{:else if header.type === 'date'}
											<input
												type="date"
												class="table-input"
												value={String(row[header.key])}
												on:change={(e) =>
													handleCellChange(rowIndex, header.key, e.currentTarget.value)}
											/>
										{:else if header.type === 'number'}
											<input
												type="text"
												inputmode="decimal"
												class="table-input"
												value={String(row[header.key])}
												on:change={(e) =>
													handleCellChange(rowIndex, header.key, e.currentTarget.value)}
											/>
										{:else}
											<input
												type="text"
												class="table-input comment-input"
												value={String(row[header.key])}
												title={String(row[header.key])}
												on:change={(e) =>
													handleCellChange(rowIndex, header.key, e.currentTarget.value)}
											/>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	/* Force table to be content-based sizing */
	.data-table {
		table-layout: auto;
		width: 100%;
	}

	/* Center all table headers and cells */
	.data-table th,
	.data-table td {
		text-align: center;
		white-space: normal;
		line-height: 1.2;
		padding: 8px 4px;
		/* Force columns to be as narrow as content */
		width: 1px;
		/* Minimum width for data columns to accommodate numeric content */
		min-width: 60px;
	}

	/* Headers should be bottom-aligned vertically */
	.data-table th {
		vertical-align: bottom;
	}

	/* Compact headers with smaller font */
	.data-table th {
		font-size: 0.9em;
	}

	/* Actions column - force minimal width and center button */
	.actions {
		width: 1px;
		white-space: nowrap;
		min-width: auto; /* Override the general min-width for actions */
	}

	/* Last column - flexible to use remaining space */
	.flex-column {
		width: auto !important;
	}

	/* Name columns need more space for content like "Cycle Name" */
	.data-table td .comment-input {
		min-width: 120px;
	}

	/* Center delete button within its cell */
	.delete-btn {
		margin: 0 auto;
		display: block;
	}

	/* Delete button styling - reuse standard button styles */
	.delete-btn {
		width: 32px;
		height: 32px;
		min-width: 32px;
		padding: 0;
		background: var(--gradient-primary);
		color: white;
		font-weight: 600;
		border-radius: 0.5rem;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 300ms cubic-bezier(0, 0, 0.2, 1);
		box-shadow: 0 4px 20px rgb(14 165 233 / 0.3);
	}

	.delete-btn:hover {
		transform: scale(1.05);
		box-shadow: var(--shadow-glow);
		background: linear-gradient(135deg in oklch, var(--color-primary-500), var(--color-accent-500));
	}

	.delete-btn:active {
		transform: scale(0.95);
	}

	.add-row-container {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	/* Ensure inputs fill their cells appropriately and center content */
	.table-input {
		width: 100%;
		box-sizing: border-box;
		text-align: center;
		min-width: 0; /* Allow inputs to shrink */
	}
</style>
