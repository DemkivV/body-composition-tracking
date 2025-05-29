<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let activeTab: string = 'data-import';

	interface Tab {
		id: string;
		label: string;
		disabled?: boolean;
	}

	const tabs: Tab[] = [
		{ id: 'data-import', label: 'Data Import' },
		{ id: 'raw-data', label: 'Raw Data' },
		{ id: 'analysis', label: 'Analysis' }
	];

	const dispatch = createEventDispatcher<{ tabChange: string }>();

	function handleTabClick(tabId: string) {
		if (activeTab !== tabId) {
			activeTab = tabId;
			dispatch('tabChange', tabId);
		}
	}
</script>

<nav class="tab-nav">
	{#each tabs as tab}
		<button
			class:active={activeTab === tab.id}
			class:disabled={tab.disabled}
			disabled={tab.disabled}
			on:click={() => handleTabClick(tab.id)}
		>
			{tab.label}
		</button>
	{/each}
</nav> 