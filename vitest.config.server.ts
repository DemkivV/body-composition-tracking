import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
		name: 'server',
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/**/*.svelte.test.{js,ts}', 'src/**/*.svelte.spec.{js,ts}'],
		setupFiles: ['./vitest-setup-server.ts'],
		watch: false
	}
});
