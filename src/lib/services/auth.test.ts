import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authService } from './auth';
import { authActions } from '../stores/auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window object for server environment
const mockWindow = {
	open: vi.fn(),
	setInterval: vi.fn(),
	clearInterval: vi.fn()
};

// Define window globally for server tests
Object.defineProperty(globalThis, 'window', {
	value: mockWindow,
	writable: true
});

describe('AuthService', () => {
	beforeEach(() => {
		authActions.reset();
		vi.clearAllMocks();
		mockWindow.open.mockClear();
		mockWindow.setInterval.mockClear();
		mockWindow.clearInterval.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('checkStatus', () => {
		it('should check authentication status successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					authenticated: true
				})
			});

			const result = await authService.checkStatus();

			expect(mockFetch).toHaveBeenCalledWith('/api/auth/status');
			expect(result).toEqual({
				success: true,
				authenticated: true
			});
		});

		it('should handle authentication status error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: false,
					authenticated: false,
					message: 'Status check failed'
				})
			});

			const result = await authService.checkStatus();

			expect(result).toEqual({
				success: false,
				authenticated: false,
				message: 'Status check failed'
			});
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(authService.checkStatus()).rejects.toThrow('Network error');
		});
	});

	describe('authenticate', () => {
		it('should start authentication flow successfully', async () => {
			const mockAuthWindow = { closed: false };
			mockWindow.open.mockReturnValueOnce(mockAuthWindow);
			mockWindow.setInterval.mockReturnValueOnce(123);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					authUrl: 'https://account.withings.com/oauth2_user/authorize2?...',
					state: 'abc123'
				})
			});

			const result = await authService.authenticate();

			expect(mockFetch).toHaveBeenCalledWith('/api/auth/authenticate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			expect(mockWindow.open).toHaveBeenCalledWith(
				'https://account.withings.com/oauth2_user/authorize2?...',
				'withings-auth',
				'width=600,height=700,scrollbars=yes,resizable=yes'
			);

			expect(mockWindow.setInterval).toHaveBeenCalled();

			expect(result).toEqual({
				success: true,
				authUrl: 'https://account.withings.com/oauth2_user/authorize2?...',
				state: 'abc123'
			});
		});

		it('should handle authentication URL generation failure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: false,
					message: 'Failed to generate auth URL'
				})
			});

			await expect(authService.authenticate()).rejects.toThrow('Failed to generate auth URL');
		});

		it('should handle popup blocked', async () => {
			mockWindow.open.mockReturnValueOnce(null);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					authUrl: 'https://account.withings.com/oauth2_user/authorize2?...',
					state: 'abc123'
				})
			});

			await expect(authService.authenticate()).rejects.toThrow(
				'Failed to open authentication window. Please check if popups are blocked.'
			);
		});

		it('should handle fetch errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(authService.authenticate()).rejects.toThrow('Network error');
		});
	});

	describe('logout', () => {
		it('should logout successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					message: 'Successfully logged out'
				})
			});

			const result = await authService.logout();

			expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
				method: 'POST'
			});

			expect(result).toEqual({
				success: true,
				message: 'Successfully logged out'
			});
		});

		it('should handle logout failure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: false,
					message: 'Logout failed'
				})
			});

			const result = await authService.logout();

			expect(result).toEqual({
				success: false,
				message: 'Logout failed'
			});
		});

		it('should handle network errors during logout', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(authService.logout()).rejects.toThrow('Network error');
		});
	});
}); 