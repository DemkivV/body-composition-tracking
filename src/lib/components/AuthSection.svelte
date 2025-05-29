<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '../stores/auth';
	import { authService } from '../services/auth';

	// Reactive state from store
	$: authState = $authStore;

	onMount(async () => {
		// Check authentication status when component mounts
		try {
			await authService.checkStatus();
		} catch (error) {
			// Error is already handled by the service, this is just to prevent unhandled rejections
		}
	});

	async function handleAuthenticate() {
		try {
			await authService.authenticate();
		} catch (error) {
			// Error is already handled by the service and stored in the auth store
			// This catch block just prevents unhandled promise rejections
		}
	}

	async function handleLogout() {
		await authService.logout();
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
		if (authState.error) {
			return authState.error;
		}
		
		if (authState.isAuthenticating) {
			return 'Opening Withings authorization page...';
		}
		
		if (authState.isAuthenticated) {
			return 'Successfully authenticated with Withings!';
		}
		
		return 'Not authenticated yet. Click "Authenticate" to connect to your Withings account.';
	}

	function getStatusClass(): string {
		if (authState.error) {
			return 'status error';
		}
		
		if (authState.isAuthenticated) {
			return 'status authenticated';
		}
		
		if (authState.isAuthenticating) {
			return 'status authenticating';
		}
		
		return 'status not-authenticated';
	}
</script>

<div class="space-y-6">
	<div class="data-source-row">
		<label for="data-source" class="form-label">
			Data Source:
		</label>
		<select
			id="data-source"
			class="form-select flex-1"
		>
			<option value="withings" selected>Withings API</option>
		</select>
	</div>

	<div class="space-y-4">
		<div class="button-group">
			{#if authState.isAuthenticated}
				<button
					class="btn authenticated"
					disabled={true}
				>
					✓ Authenticated
				</button>
				
				<button
					class="btn secondary"
					on:click={handleLogout}
				>
					Logout
				</button>
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
				disabled={!authState.isAuthenticated}
			>
				Import Data
			</button>
			
			<button
				class="btn secondary"
				disabled={!authState.isAuthenticated}
			>
				Clear Data
			</button>
		</div>

		<div class={getStatusClass()}>
			{getStatusText()}
		</div>

		{#if authState.isAuthenticating}
			<div class="text-slate-300 text-sm">
				<p>• A new window should open with the Withings authorization page</p>
				<p>• Please complete the authorization in that window</p>
				<p>• If no window opens, check if popups are blocked</p>
			</div>
		{/if}
	</div>
</div> 