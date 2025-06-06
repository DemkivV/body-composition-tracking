import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), svelteTesting()],
	server: {
		watch: {
			ignored: [
				'**/.tmp/**',
				'**/test-results/**',
				'**/test-data/**',
				'**/e2e-build/**',
				'**/coverage/**',
				'**/.vitest/**'
			],
			usePolling: false,
			interval: 0
		},
		hmr: false
	},
	build: {
		chunkSizeWarningLimit: 500
	},
	test: {
		name: 'client',
		environment: 'jsdom',
		clearMocks: true,
		include: ['src/**/*.svelte.test.{js,ts}', 'src/**/*.svelte.spec.{js,ts}'],
		exclude: ['src/lib/server/**'],
		setupFiles: ['./vitest-setup-client.ts'],
		watch: false
	}
});
