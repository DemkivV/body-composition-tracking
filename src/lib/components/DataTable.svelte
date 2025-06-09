<script lang="ts" generics="T extends Record<string, string | number>">
	import { onMount, onDestroy } from 'svelte';
	import { dataStore, dataActions } from '$lib/stores/data';
	import { dataService } from '$lib/services/data-service';
	import {
		calculateTableColumnWidths,
		applyTableColumnWidths,
		logColumnWidthDecisions,
		type ColumnWidthResult
	} from '$lib/utils/table-layout';
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

	// Column width management
	let tableElement: HTMLElement | undefined;
	let columnWidths = new Map<keyof T, ColumnWidthResult>();
	let hasCalculatedInitialLayout = false;

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

		// Recalculate layout after data refresh
		setTimeout(() => calculateColumnWidths(), 100);
	}

	function calculateColumnWidths() {
		if (!tableElement || data.length === 0) return;

		// Get actual table width
		const tableWidth = tableElement.offsetWidth || 1200;

		// Calculate optimal widths
		const newColumnWidths = calculateTableColumnWidths(headers, data, tableWidth);

		// Apply widths to table
		applyTableColumnWidths(tableElement, newColumnWidths);

		// Debug logging (only in development)
		if (process.env.NODE_ENV === 'development') {
			logColumnWidthDecisions(newColumnWidths);
		}

		// Update state
		columnWidths = newColumnWidths;
		hasCalculatedInitialLayout = true;
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

		// Set up resize observer and initial layout
		if (tableElement) {
			setupResizeObserver();
			// Initial layout calculation after data loads
			setTimeout(() => calculateColumnWidths(), 100);
		}
	});

	let resizeObserver: ResizeObserver | null = null;

	// Track when we have the necessary conditions for layout calculation
	let initialLayoutScheduled = false;

	// Handle initial layout when table element becomes available and data is loaded
	$: if (tableElement && data.length > 0 && !loading && !initialLayoutScheduled) {
		initialLayoutScheduled = true;
		setTimeout(() => {
			calculateColumnWidths();
			setupResizeObserver();
		}, 50);
	}

	function setupResizeObserver() {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}

		// Check if ResizeObserver is available (might not be in test environment)
		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		resizeObserver = new ResizeObserver(() => {
			if (hasCalculatedInitialLayout && tableElement) {
				calculateColumnWidths();
			}
		});

		if (tableElement) {
			resizeObserver.observe(tableElement);
		}
	}

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

		// Clean up resize observer
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
	});

	async function loadData() {
		try {
			if (useDataStore) {
				// This should not be called for store-managed data
				return;
			}

			localLoading = true;

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
				const sortedData = sortFunction(result.data);
				localData = sortedData;
			} else {
				localError = result.error || 'Failed to load data';
			}
		} catch (err) {
			// Don't show error if request was aborted (component cleanup)
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			localError = 'Failed to fetch data';
			console.error('Error loading data:', err);
		} finally {
			localLoading = false;
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
			saveData().then(() => {
				// Recalculate column widths after save to account for any content changes
				setTimeout(() => calculateColumnWidths(), 50);
			});
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
		// Immediate layout recalculation for new rows
		setTimeout(() => calculateColumnWidths(), 100);
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
			// Immediate layout recalculation for removed rows
			setTimeout(() => calculateColumnWidths(), 100);
		}
	}

	function getColumnStyle(headerKey: keyof T): string {
		const result = columnWidths.get(headerKey);
		return result ? `width: ${result.width};` : '';
	}

	function getHeaderTitleClass(headerKey: keyof T): string {
		const result = columnWidths.get(headerKey);
		if (!result) return '';

		// Apply different classes based on number of title lines
		switch (result.titleLines) {
			case 1:
				return 'header-title-single';
			case 2:
				return 'header-title-double';
			case 3:
				return 'header-title-triple';
			default:
				return 'header-title-multi';
		}
	}
</script>

<div class="data-container">
	<div class="data-header">
		<h2 class="data-title">{title}</h2>
		<div class="add-row-container">
			{#if saving}
				<div class="status save-status saving">Saving...</div>
			{/if}
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
		<div class="table-wrapper">
			<table class="data-table" bind:this={tableElement}>
			<thead>
				<tr>
					<th style="width: 40px;">Actions</th>
					{#each headers as header (header.key)}
						<th style={getColumnStyle(header.key)} class={getHeaderTitleClass(header.key)}>
							{header.label}
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
									×
								</button>
							</td>
							{#each headers as header (header.key)}
								<td style={getColumnStyle(header.key)}>
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
											type="number"
											step="0.1"
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
	/* Dynamic header title classes for column width optimization */
	.header-title-single {
		white-space: nowrap;
		text-align: center;
	}

	.header-title-double {
		white-space: normal;
		text-align: center;
		line-height: 1.2;
		padding: 8px 4px;
	}

	.header-title-triple {
		white-space: normal;
		text-align: center;
		line-height: 1.1;
		padding: 6px 2px;
		font-size: 0.9em;
	}

	.header-title-multi {
		white-space: normal;
		text-align: center;
		line-height: 1;
		padding: 4px 2px;
		font-size: 0.85em;
	}

	/* Smaller delete button */
	.delete-btn {
		width: 28px;
		height: 28px;
		min-width: 28px;
		padding: 0;
		background: #ef4444;
		border-radius: 0.25rem;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		background: #dc2626;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
	}

	.actions {
		width: 40px;
		text-align: center;
		padding: 0.25rem !important;
	}

	.add-row-container {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
</style>
