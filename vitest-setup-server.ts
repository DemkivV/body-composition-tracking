import { vi } from 'vitest';

// Mock console.error to prevent stderr noise in tests
// Tests can still access the mock to verify logging behavior if needed
const mockConsoleError = vi.fn();
global.console.error = mockConsoleError;

// Export the mock so individual tests can access it if needed
export { mockConsoleError }; 