<script lang="ts">
	import { goto } from '$app/navigation';

	export let activeTab: string = 'data-import';

	interface Tab {
		id: string;
		label: string;
		path: string;
		disabled?: boolean;
	}

	const tabs: Tab[] = [
		{ id: 'body-comp-data', label: 'Body Comp Data', path: '/body-comp-data' },
		{ id: 'cycle-data', label: 'Cycle Data', path: '/cycle-data' },
		{ id: 'analysis', label: 'Analysis', path: '/analysis' }
	];

	function handleTabClick(tab: Tab) {
		if (activeTab !== tab.id && !tab.disabled) {
			goto(tab.path);
		}
	}
</script>

<nav class="tab-nav">
	{#each tabs as tab (tab.id)}
		<button
			role="tab"
			data-tab={tab.id}
			aria-selected={activeTab === tab.id}
			aria-controls="tab-content"
			class:active={activeTab === tab.id}
			class:disabled={tab.disabled}
			disabled={tab.disabled}
			on:click={() => handleTabClick(tab)}
		>
			{tab.label}
		</button>
	{/each}
</nav>
