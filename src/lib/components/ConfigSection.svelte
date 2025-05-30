<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let clientId = '';
	let clientSecret = '';
	let redirectUri = 'http://localhost:5173/auth/callback';
	let isConfigured = false;
	let isConfiguring = false;
	let message = '';
	let isError = false;

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
		}
	}

	async function handleSaveConfiguration() {
		if (!clientId.trim() || !clientSecret.trim()) {
			message = 'Please enter both Client ID and Client Secret';
			isError = true;
			return;
		}

		isConfiguring = true;
		message = '';
		isError = false;

		try {
			const response = await fetch('/api/auth/configure', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					clientId: clientId.trim(),
					clientSecret: clientSecret.trim(),
					redirectUri: redirectUri.trim()
				})
			});

			const data = await response.json();

			if (data.success) {
				message = 'Configuration saved successfully!';
				isError = false;
				isConfigured = true;

				// Clear the form for security
				clientId = '';
				clientSecret = '';

				// Notify parent component
				dispatch('configured');
			} else {
				message = data.message || 'Failed to save configuration';
				isError = true;
			}
		} catch (error) {
			message = 'Network error: Failed to save configuration';
			isError = true;
		} finally {
			isConfiguring = false;
		}
	}

	function getStatusClass(): string {
		if (isError) {
			return 'status error';
		}

		if (message) {
			return 'status authenticated';
		}

		return '';
	}
</script>

<div class="config-section">
	<div class="config-header">
		<h2 class="section-title">Withings API Configuration</h2>

		{#if isConfigured}
			<div class="status authenticated config-status">
				✅ Withings API credentials are configured
			</div>
			<p class="config-description">
				Your credentials are stored securely. You can now authenticate with Withings.
			</p>
		{:else}
			<p class="config-instructions">
				To use this application, you need to configure your Withings API credentials. Don't have
				them yet? <a
					href="https://developer.withings.com/dashboard/"
					target="_blank"
					class="external-link">Get them here</a
				>
			</p>
		{/if}
	</div>

	{#if !isConfigured}
		<div class="config-form">
			<div class="form-group">
				<label for="client-id" class="form-label"> Client ID * </label>
				<input
					id="client-id"
					type="text"
					class="form-input"
					bind:value={clientId}
					placeholder="Enter your Withings Client ID"
					disabled={isConfiguring}
				/>
			</div>

			<div class="form-group">
				<label for="client-secret" class="form-label"> Client Secret * </label>
				<input
					id="client-secret"
					type="password"
					class="form-input"
					bind:value={clientSecret}
					placeholder="Enter your Withings Client Secret"
					disabled={isConfiguring}
				/>
			</div>

			<div class="form-group">
				<label for="redirect-uri" class="form-label"> Redirect URI </label>
				<input
					id="redirect-uri"
					type="url"
					class="form-input"
					bind:value={redirectUri}
					disabled={isConfiguring}
				/>
				<p class="field-hint">This should match the redirect URI configured in your Withings app</p>
			</div>

			<div class="button-group">
				<button class="btn" disabled={isConfiguring} on:click={handleSaveConfiguration}>
					{isConfiguring ? 'Saving...' : 'Save Configuration'}
				</button>
			</div>

			{#if message}
				<div class={getStatusClass()}>
					{message}
				</div>
			{/if}
		</div>

		<div class="setup-instructions">
			<h3 class="instructions-title">Setup Instructions</h3>
			<ol class="instructions-list">
				<li>
					Go to the <a
						href="https://developer.withings.com/dashboard/"
						target="_blank"
						class="external-link">Withings Developer Dashboard</a
					>
				</li>
				<li>Create a new application or use an existing one</li>
				<li>Set the redirect URI to: <code class="code-snippet">{redirectUri}</code></li>
				<li>Copy your Client ID and Client Secret</li>
				<li>Paste them in the form above and click "Save Configuration"</li>
			</ol>
		</div>
	{/if}
</div>

<style>
	@import 'tailwindcss/theme' reference;

	.form-group {
		@apply space-y-2;
	}

	.form-input {
		@apply w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-200 placeholder-slate-400;
		@apply focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none;
		@apply backdrop-blur-sm;
	}

	.form-input:disabled {
		@apply cursor-not-allowed opacity-50;
	}

	.setup-instructions {
		@apply rounded-lg border border-slate-700 bg-slate-800/30 p-4 backdrop-blur-sm;
	}

	code {
		@apply font-mono text-xs;
	}
</style>
