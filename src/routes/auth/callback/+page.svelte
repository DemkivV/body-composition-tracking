<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authActions } from '$lib/stores/auth';

	let status = 'Processing authorization...';
	let isError = false;

	onMount(async () => {
		try {
			// Get authorization code and state from URL parameters
			const code = $page.url.searchParams.get('code');
			const state = $page.url.searchParams.get('state');
			const error = $page.url.searchParams.get('error');

			if (error) {
				throw new Error(`Authorization failed: ${error}`);
			}

			if (!code || !state) {
				throw new Error('Missing authorization code or state parameter');
			}

			status = 'Exchanging authorization code for access token...';

			// Exchange authorization code for access token
			const response = await fetch('/api/auth/callback', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ code, state })
			});

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.message || 'Authentication failed');
			}

			status = 'Authentication successful! Redirecting...';
			
			// Update auth store
			authActions.setAuthenticated(true);

			// Redirect back to main app after brief delay
			setTimeout(() => {
				goto('/', { replaceState: true });
			}, 2000);

		} catch (error) {
			console.error('OAuth callback error:', error);
			status = error instanceof Error ? error.message : 'Authentication failed';
			isError = true;

			// Update auth store with error
			authActions.setError(status);

			// Redirect back to main app after delay
			setTimeout(() => {
				goto('/', { replaceState: true });
			}, 5000);
		}
	});
</script>

<svelte:head>
	<title>Authentication - Body Composition Tracker</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center">
	<div class="app-container">
		<div class="text-center">
			<h1 class="gradient-heading">Body Composition Tracker</h1>
			
			<div class="tab-content max-w-md mx-auto">
				<div class="text-center space-y-4">
					{#if isError}
						<div class="status error">
							<h3 class="text-lg font-semibold mb-2">Authentication Failed</h3>
							<p>{status}</p>
							<p class="text-sm mt-4">Redirecting back to the main page...</p>
						</div>
					{:else}
						<div class="status authenticating">
							<h3 class="text-lg font-semibold mb-2">Authenticating</h3>
							<p>{status}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div> 