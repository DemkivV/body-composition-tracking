<script lang="ts">
	import { onMount } from 'svelte';
	import TabNavigation from '$lib/components/TabNavigation.svelte';
	import AuthSection from '$lib/components/AuthSection.svelte';
	import ConfigSection from '$lib/components/ConfigSection.svelte';

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

<div class="min-h-screen">
	<div class="app-container">
		<header class="mb-8">
			<h1 class="gradient-heading">Body Composition Tracker</h1>
		</header>

		{#if isCheckingConfig}
			<div class="tab-content">
				<div class="text-center">
					<div class="status authenticating">
						Loading...
					</div>
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
					<div class="feature-preview">
						<h2 class="text-xl font-semibold text-slate-200 mb-4">Raw Data</h2>
						<p class="text-slate-300">
							View your imported body composition data in table format.
						</p>
						<p class="text-slate-400 text-sm mt-2">
							This feature will be available after implementing data import functionality.
						</p>
					</div>
				{:else if activeTab === 'analysis'}
					<div class="feature-preview">
						<h2 class="text-xl font-semibold text-slate-200 mb-4">Analysis & Visualization</h2>
						<p class="text-slate-300">
							Interactive charts and trend analysis of your body composition data.
						</p>
						<p class="text-slate-400 text-sm mt-2">
							This feature will be available after implementing data import functionality.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
