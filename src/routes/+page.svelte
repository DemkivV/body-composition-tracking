<script lang="ts">
	import { onMount } from 'svelte';
	import TabNavigation from '$lib/components/TabNavigation.svelte';
	import AuthSection from '$lib/components/AuthSection.svelte';
	import ConfigSection from '$lib/components/ConfigSection.svelte';
	import RawDataTable from '$lib/components/RawDataTable.svelte';

	let activeTab = 'data-import';
	let isConfigured = false;
	let isCheckingConfig = true;

	onMount(async () => {
		await checkConfiguration();
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

	function handleTabChange(event: CustomEvent<string>) {
		activeTab = event.detail;
	}

	// Re-check configuration when it might have changed
	function handleConfigurationChange() {
		checkConfiguration();
	}
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
			<TabNavigation {activeTab} on:tabChange={handleTabChange} />

			<div class="tab-content">
				{#if activeTab === 'data-import'}
					<AuthSection />
				{:else if activeTab === 'raw-data'}
					<RawDataTable />
				{:else if activeTab === 'analysis'}
					<div class="feature-preview">
						<h2 class="feature-title">Analysis & Visualization</h2>
						<p class="feature-description">
							Interactive charts and trend analysis of your body composition data.
						</p>
						<p class="feature-note">
							This feature will be available after implementing data import functionality.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
