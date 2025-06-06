<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/body-comp-data', { replaceState: true });
	});
</script>

<!-- This page redirects to the body-comp-data tab -->
