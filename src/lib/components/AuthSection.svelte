<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '../stores/auth';
	import { authService } from '../services/auth';
	import { importClientService } from '../services/import-client.js';
	import type { ImportResult } from '../types/measurements.js';

	// Reactive state from store
	$: authState = $authStore;

	// Import state
	let isImporting = false;
	let importResult: ImportResult | null = null;
	let progressMessage = '';
	let hasExistingData = false;

	onMount(async () => {
		// Check authentication status when component mounts
		try {
			await authService.checkStatus();
			// Check if data exists for button text
			await checkDataExists();
		} catch (_error) {
			// Error is already handled by the service, this is just to prevent unhandled rejections
		}
	});

	async function checkDataExists() {
		try {
			const response = await importClientService.hasExistingData();
			hasExistingData = response;
		} catch (_error) {
			console.warn('Error checking existing data:', _error);
			hasExistingData = false;
		}
	}

	async function handleAuthenticate() {
		try {
			await authService.authenticate();
		} catch (_error) {
			// Error is already handled by the service and stored in the auth store
			// This catch block just prevents unhandled promise rejections
		}
	}

	async function handleLogout() {
		await authService.logout();
		// Clear import state when logging out
		isImporting = false;
		importResult = null;
		progressMessage = '';
	}

	async function handleImport() {
		if (isImporting || !authState.isAuthenticated) return;

		isImporting = true;
		importResult = null;
		progressMessage = '';

		try {
			importResult = await importClientService.intelligentImport({
				onProgress: (message) => {
					progressMessage = message;
				},
				onError: (error) => {
					progressMessage = `Error: ${error}`;
				}
			});

			// Update data existence status after import
			if (importResult.success) {
				await checkDataExists();
			}
		} finally {
			isImporting = false;
		}
	}

	function getButtonText(): string {
		if (authState.isAuthenticating) {
			return 'Authenticating...';
		}
		return authState.isAuthenticated ? 'Authenticated' : 'Authenticate';
	}

	function getButtonClass(): string {
		if (authState.isAuthenticated) {
			return 'btn authenticated';
		}

		if (authState.isAuthenticating) {
			return 'btn secondary';
		}

		return 'btn';
	}

	function getStatusText(): string {
		// Priority 1: Import status
		if (isImporting && progressMessage) {
			return progressMessage;
		}

		if (importResult) {
			// Use simplified message format
			return importResult.message;
		}

		// Priority 2: Auth errors
		if (authState.error) {
			return authState.error;
		}

		// Priority 3: Auth status
		if (authState.isAuthenticating) {
			return 'Opening Withings authorization page...';
		}

		if (authState.isAuthenticated) {
			return 'Successfully authenticated with Withings!';
		}

		return 'Not authenticated yet. Click "Authenticate" to connect to your Withings account.';
	}

	function getFeedbackClass(): string {
		// Import status classes
		if (isImporting) {
			return 'feedback authenticating'; // Use similar styling to auth loading
		}

		if (importResult) {
			return importResult.success ? 'feedback authenticated' : 'feedback error';
		}

		// Auth status classes
		if (authState.error) {
			return 'feedback error';
		}

		if (authState.isAuthenticated) {
			return 'feedback authenticated';
		}

		if (authState.isAuthenticating) {
			return 'feedback authenticating';
		}

		return 'feedback not-authenticated';
	}
</script>

<div class="auth-section">
	<div class="data-source-row">
		<label for="data-source" class="form-label"> Data Source: </label>
		<select id="data-source" class="form-select">
			<option value="withings" selected>Withings API</option>
		</select>
	</div>

	<div class="auth-controls">
		<div class="button-group-split">
			<!-- Left side buttons -->
			<div class="button-group-left">
				{#if authState.isAuthenticated}
					<button class="btn authenticated" disabled={true}> ✓ Authenticated </button>
				{:else}
					<button
						class={getButtonClass()}
						disabled={authState.isAuthenticating}
						on:click={handleAuthenticate}
					>
						{getButtonText()}
					</button>
				{/if}

				<button
					class="btn secondary"
					disabled={!authState.isAuthenticated || isImporting}
					on:click={handleImport}
					title="Import your body composition measurements from Withings. The system will automatically import all historical data if this is your first import, or just recent updates if you have existing data."
				>
					{#if hasExistingData}
						Update Data
					{:else}
						Import Data
					{/if}
				</button>
			</div>

			<!-- Right side buttons -->
			<div class="button-group-right">
				<button class="btn secondary" disabled={!authState.isAuthenticated}> Clear Data </button>

				{#if authState.isAuthenticated}
					<button class="btn secondary" on:click={handleLogout}> Logout </button>
				{/if}
			</div>
		</div>

		<div class={getFeedbackClass()}>
			{getStatusText()}
		</div>

		{#if authState.isAuthenticating}
			<div class="auth-instructions">
				<p>• A new window should open with the Withings authorization page</p>
				<p>• Please complete the authorization in that window</p>
				<p>• If no window opens, check if popups are blocked</p>
			</div>
		{/if}
	</div>
</div>
