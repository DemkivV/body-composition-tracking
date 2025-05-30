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

<div class="auth-callback-page">
	<div class="app-container">
		<div class="callback-content">
			<h1 class="gradient-heading">Body Composition Tracker</h1>

			<div class="callback-status tab-content">
				<div class="status-content">
					{#if isError}
						<div class="status error">
							<h3 class="status-title">Authentication Failed</h3>
							<p>{status}</p>
							<p class="redirect-notice">Redirecting back to the main page...</p>
						</div>
					{:else}
						<div class="status authenticating">
							<h3 class="status-title">Authenticating</h3>
							<p>{status}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
