<script lang="ts">
	import AuthSection from '$lib/components/AuthSection.svelte';
	import RawDataTable from '$lib/components/RawDataTable.svelte';

	let rawDataTableRef: RawDataTable;

	function handleDataImported() {
		// Trigger refresh of the data table after successful import
		if (rawDataTableRef) {
			rawDataTableRef.refreshData();
		}
	}
</script>

<svelte:head>
	<title>Body Comp Data - Body Composition Tracker</title>
</svelte:head>

<div class="data-container">
	<AuthSection onDataImported={handleDataImported} />
</div>

<RawDataTable bind:this={rawDataTableRef} />
