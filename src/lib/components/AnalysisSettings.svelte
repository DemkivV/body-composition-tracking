<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let weightedAverageWindow: number = 7;

	// Event dispatcher for settings changes
	const dispatch = createEventDispatcher<{
		settingsChange: {
			weightedAverageWindow: number;
		};
	}>();

	// Handle slider change
	function handleWindowSizeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const newValue = parseInt(target.value);
		weightedAverageWindow = newValue;

		// Emit settings change event
		dispatch('settingsChange', {
			weightedAverageWindow: newValue
		});
	}
</script>

<div class="settings-container">
	<h3>Settings</h3>

	<div class="slider-container">
		<label for="window-size-slider" class="slider-label"> Weighted Average </label>
		<input
			id="window-size-slider"
			type="range"
			class="slider-input"
			min="1"
			max="14"
			bind:value={weightedAverageWindow}
			on:input={handleWindowSizeChange}
			data-testid="weighted-average-slider"
		/>
		<div class="slider-value" data-testid="slider-value">
			{weightedAverageWindow} {weightedAverageWindow === 1 ? 'day' : 'days'}
		</div>
	</div>
</div>

<style>
	/* Settings container styling - moved from app.css for component encapsulation */
	.settings-container {
		background: var(--gradient-surface);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(148 163 184 / 0.1);
		border-radius: 1rem;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
		padding: 1.5rem;
		margin-bottom: 1rem;
	}

	.settings-container h3 {
		color: #e2e8f0;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 1.5rem 0;
		text-align: center;
	}

	/* Slider container styling */
	.slider-container {
		margin-bottom: 1.5rem;
	}

	.slider-label {
		display: block;
		color: #e2e8f0;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.slider-input {
		width: 100%;
		height: 0.5rem;
		background: #334155;
		border-radius: 0.25rem;
		outline: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}

	.slider-input::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: var(--color-primary-500);
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
		transition: all 0.2s;
	}

	.slider-input::-webkit-slider-thumb:hover {
		background: var(--color-primary-400);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.6);
	}

	.slider-input::-moz-range-thumb {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: var(--color-primary-500);
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
		transition: all 0.2s;
	}

	.slider-input::-moz-range-thumb:hover {
		background: var(--color-primary-400);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.6);
	}

	.slider-value {
		color: #94a3b8;
		font-size: 0.75rem;
		text-align: center;
		margin-top: 0.5rem;
	}
</style>
