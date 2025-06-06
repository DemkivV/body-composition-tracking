<script lang="ts">
	import AuthSection from '$lib/components/AuthSection.svelte';
	import RawDataTable from '$lib/components/RawDataTable.svelte';
</script>

<svelte:head>
	<title>Body Comp Data - Body Composition Tracker</title>
</svelte:head>

<div class="data-container">
	<AuthSection />
</div>

<div class="data-container">
	<RawDataTable />
</div>
