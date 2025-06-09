<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import TabNavigation from '$lib/components/TabNavigation.svelte';
	import ConfigSection from '$lib/components/ConfigSection.svelte';
	import { dataService } from '$lib/services/data-service';

	let isConfigured = false;
	let isCheckingConfig = true;

	onMount(async () => {
		await checkConfiguration();

		// Initialize data cache if app is configured
		if (isConfigured) {
			// Don't await this - let it load in background
			dataService.initialize().catch((error) => {
				console.error('Failed to initialize data service:', error);
			});
		}
	});

	async function checkConfiguration() {
		try {
			const response = await fetch('/api/auth/configure');
			const data = await response.json();

			if (data.success) {
				isConfigured = data.configured;
			}
		} catch (error) {
			console.error('Failed to check configuration:', error);
		} finally {
			isCheckingConfig = false;
		}
	}

	// Re-check configuration when it might have changed
	function handleConfigurationChange() {
		checkConfiguration();
	}

	// Get active tab from current route
	$: activeTab = $page.url.pathname.slice(1) || 'body-comp-data';
</script>

<svelte:head>
	<title>Body Composition Tracker</title>
	<meta name="description" content="Track and analyze your body composition data over time" />
</svelte:head>

<div class="page-container">
	<div class="app-container">
		<header class="page-header">
			<h1 class="gradient-heading">Body Composition Tracker</h1>
		</header>

		{#if isCheckingConfig}
			<div class="tab-content">
				<div class="loading-section">
					<div class="status authenticating">Loading...</div>
				</div>
			</div>
		{:else if !isConfigured}
			<div class="tab-content">
				<ConfigSection on:configured={handleConfigurationChange} />
			</div>
		{:else}
			<TabNavigation {activeTab} />

			<div class="tab-content" class:analysis-layout={activeTab === 'analysis'}>
				<slot />
			</div>
		{/if}
	</div>
</div>
