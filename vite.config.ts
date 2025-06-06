import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

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
				'**/.vitest/**',
				// Ignore test files to prevent dev server reloading during test runs
				'**/*.test.*',
				'**/*.spec.*'
			],
			// Disable file watching in test environment
			...(process.env.NODE_ENV === 'test' && { usePolling: false, interval: 0 })
		}
	},
	build: {
		// Set warning limit to 500KB (default) to catch any regressions
		chunkSizeWarningLimit: 500
	},
	test: {
		workspace: [
			{
				extends: './vite.config.ts',
				plugins: [svelteTesting()],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest-setup-server.ts']
				}
			}
		]
	}
});
