<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/data-import', { replaceState: true });
	});
</script>

<!-- This page redirects to the data-import tab -->
