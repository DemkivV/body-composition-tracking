import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { mockDataWriter } from './src/lib/utils/test-data-writer.js';

// === Node.js Built-in Module Mocks ===

// Mock fs module for server-side code
vi.mock('fs', async () => {
	const actual = await vi.importActual('fs');
	return {
		...actual,
		promises: {
			access: vi.fn(),
			readFile: vi.fn(),
			writeFile: vi.fn(),
			mkdir: vi.fn(),
			readdir: vi.fn(),
			stat: vi.fn(),
			rm: vi.fn(),
			copyFile: vi.fn()
		}
	};
});

// === Client Environment Setup ===

// Mock matchMedia for Svelte 5 + jsdom compatibility
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

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
}));

// === Server Environment Setup ===

// Mock fetch for API calls
global.fetch = vi.fn().mockImplementation((url: string) => {
	if (url.includes('/api/auth/configure')) {
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ success: true, configured: false })
		} as Response);
	}

	if (url.includes('/api/auth/status')) {
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ success: true, authenticated: false })
		} as Response);
	}

	return Promise.resolve({
		ok: true,
		json: () => Promise.resolve({})
	} as Response);
});

// Mock console.error to reduce noise (tests can still access if needed)
const mockConsoleError = vi.fn();
global.console.error = mockConsoleError;

// === Test Cleanup ===

beforeEach(() => {
	// Clear data writer mock state
	mockDataWriter.clear();

	// Clear all mocks
	vi.clearAllMocks();
});

// Export for tests that need it
export { mockConsoleError };
