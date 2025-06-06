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
		// Prevent any server from starting during isolated tests
		hmr: false
	},
	build: {
		chunkSizeWarningLimit: 500
	},
	test: {
		workspace: ['./vitest.config.client.ts', './vitest.config.server.ts'],
		environment: 'node',
		globals: false,
		// Prevent any file watching during tests
		watch: false,
		// Ensure tests run in complete isolation
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true
			}
		}
	},
	define: {
		'import.meta.vitest': 'undefined'
	}
});
