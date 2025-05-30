import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// Mock fetch to handle API calls in tests
global.fetch = vi.fn().mockImplementation((url: string) => {
	// Handle the configuration check URL that's causing the parsing error
	if (url.includes('/api/auth/configure')) {
		return Promise.resolve({
			ok: true,
			json: () =>
				Promise.resolve({
					success: true,
					configured: false
				})
		} as Response);
	}

	// Handle other auth status checks
	if (url.includes('/api/auth/status')) {
		return Promise.resolve({
			ok: true,
			json: () =>
				Promise.resolve({
					success: true,
					authenticated: false
				})
		} as Response);
	}

	// Default fallback
	return Promise.resolve({
		ok: true,
		json: () => Promise.resolve({})
	} as Response);
});

// add more mocks here if you need them
