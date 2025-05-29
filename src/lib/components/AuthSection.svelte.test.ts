import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AuthSection from './AuthSection.svelte';
import { authActions } from '../stores/auth';
import { authService } from '../services/auth';

// Mock the auth service
vi.mock('../services/auth', () => ({
	authService: {
		checkStatus: vi.fn(),
		authenticate: vi.fn(),
		logout: vi.fn()
	}
}));

describe('AuthSection Component', () => {
	beforeEach(() => {
		authActions.reset();
		vi.clearAllMocks();
	});

	it('should render with initial state', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		render(AuthSection);

		// Check if data source selector is present
		expect(screen.getByLabelText('Data Source:')).toBeInTheDocument();
		expect(screen.getByText('Withings API')).toBeInTheDocument();

		// Check if buttons are present
		expect(screen.getByRole('button', { name: 'Authenticate' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Import Data' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Clear Data' })).toBeInTheDocument();

		// Check if status message is present
		await waitFor(() => {
			expect(screen.getByText(/Not authenticated yet/)).toBeInTheDocument();
		});

		// Verify that checkStatus was called on mount
		expect(authService.checkStatus).toHaveBeenCalledOnce();
	});

	it('should call authenticate when authenticate button is clicked', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});
		(authService.authenticate as any).mockResolvedValueOnce({
			success: true,
			authUrl: 'https://withings.com/auth',
			state: 'abc123'
		});

		render(AuthSection);

		const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
		await fireEvent.click(authenticateButton);

		expect(authService.authenticate).toHaveBeenCalledOnce();
	});

	it('should show authenticating state with instructions', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		render(AuthSection);

		// Set authenticating state
		authActions.setAuthenticating(true);

		await waitFor(() => {
			expect(screen.getByText(/Opening Withings authorization page/)).toBeInTheDocument();
		});

		// Check that instructions are shown
		expect(screen.getByText(/A new window should open/)).toBeInTheDocument();
		expect(screen.getByText(/Please complete the authorization/)).toBeInTheDocument();
		expect(screen.getByText(/If no window opens/)).toBeInTheDocument();

		// Button should be disabled during authentication and have correct text
		const authenticateButton = screen.getByRole('button', { name: 'Authenticating...' });
		expect(authenticateButton).toBeDisabled();
	});

	it('should show authenticated state with logout button', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		render(AuthSection);

		// Set authenticated state
		authActions.setAuthenticated(true);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: '✓ Authenticated' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
			expect(screen.getByText('Successfully authenticated with Withings!')).toBeInTheDocument();
		});

		// Authenticated button should be disabled
		const authenticatedButton = screen.getByRole('button', { name: '✓ Authenticated' });
		expect(authenticatedButton).toBeDisabled();

		// Import and Clear buttons should be enabled
		const importButton = screen.getByRole('button', { name: 'Import Data' });
		const clearButton = screen.getByRole('button', { name: 'Clear Data' });
		expect(importButton).not.toBeDisabled();
		expect(clearButton).not.toBeDisabled();
	});

	it('should call logout when logout button is clicked', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});
		(authService.logout as any).mockResolvedValueOnce({
			success: true,
			message: 'Successfully logged out'
		});

		render(AuthSection);

		// Set authenticated state first
		authActions.setAuthenticated(true);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
		});

		const logoutButton = screen.getByRole('button', { name: 'Logout' });
		await fireEvent.click(logoutButton);

		expect(authService.logout).toHaveBeenCalledOnce();
	});

	it('should show error state', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		render(AuthSection);

		// Set error state
		const errorMessage = 'Authentication failed';
		authActions.setError(errorMessage);

		await waitFor(() => {
			expect(screen.getByText(errorMessage)).toBeInTheDocument();
		});
	});

	it('should have correct button states for unauthenticated user', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		render(AuthSection);

		await waitFor(() => {
			const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
			const importButton = screen.getByRole('button', { name: 'Import Data' });
			const clearButton = screen.getByRole('button', { name: 'Clear Data' });

			expect(authenticateButton).not.toBeDisabled();
			expect(importButton).toBeDisabled();
			expect(clearButton).toBeDisabled();
		});
	});

	it('should apply correct CSS classes for different states', async () => {
		(authService.checkStatus as any).mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		render(AuthSection);

		// Test unauthenticated state
		await waitFor(() => {
			const authenticateButton = screen.getByRole('button', { name: 'Authenticate' });
			expect(authenticateButton).toHaveClass('btn');
		});

		// Test authenticated state
		authActions.setAuthenticated(true);
		await waitFor(() => {
			const authButton = screen.getByRole('button', { name: '✓ Authenticated' });
			expect(authButton).toHaveClass('btn', 'authenticated');
		});
	});

	it('should handle service errors gracefully', async () => {
		const mockError = new Error('Network error');
		(authService.checkStatus as any).mockRejectedValueOnce(mockError);

		// Suppress console errors for this test
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		try {
			render(AuthSection);

			// Component should not crash and should still render
			expect(screen.getByLabelText('Data Source:')).toBeInTheDocument();
		} finally {
			consoleSpy.mockRestore();
		}
	});
}); 