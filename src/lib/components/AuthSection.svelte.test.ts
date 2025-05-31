import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AuthSection from './AuthSection.svelte';
import { authActions } from '../stores/auth.js';
import { authService } from '../services/auth.js';
import { importClientService } from '../services/import-client.js';

// Mock the services
vi.mock('../services/auth.js', () => ({
	authService: {
		checkStatus: vi.fn(),
		authenticate: vi.fn(),
		logout: vi.fn()
	}
}));

vi.mock('../services/import-client.js', () => ({
	importClientService: {
		hasExistingData: vi.fn(),
		intelligentImport: vi.fn()
	}
}));

const mockAuthService = vi.mocked(authService);
const mockImportClientService = vi.mocked(importClientService);

describe('AuthSection Component', () => {
	beforeEach(() => {
		authActions.reset();
		vi.clearAllMocks();

		// Setup default mock behavior
		mockImportClientService.hasExistingData.mockResolvedValue(false);
	});

	it('should render with initial state', async () => {
		mockAuthService.checkStatus.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockResolvedValueOnce({
			success: true,
			authenticated: false
		});
		mockAuthService.authenticate.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockResolvedValueOnce({
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

		// Import and Clear buttons should be enabled when authenticated
		const importButton = screen.getByRole('button', { name: 'Import Data' });
		const clearButton = screen.getByRole('button', { name: 'Clear Data' });
		expect(importButton).not.toBeDisabled();
		expect(clearButton).not.toBeDisabled();
	});

	it('should call logout when logout button is clicked', async () => {
		mockAuthService.checkStatus.mockResolvedValueOnce({
			success: true,
			authenticated: false
		});
		mockAuthService.logout.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockResolvedValueOnce({
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
		mockAuthService.checkStatus.mockRejectedValueOnce(mockError);

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

	it('should handle import data functionality', async () => {
		mockAuthService.checkStatus.mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		const mockImportResult = {
			success: true,
			message: 'Successfully imported 5 measurements.',
			count: 5,
			total_unified: 10
		};

		mockImportClientService.intelligentImport.mockResolvedValue(mockImportResult);

		render(AuthSection);

		// Set authenticated state to enable import button
		authActions.setAuthenticated(true);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Import Data' })).not.toBeDisabled();
		});

		const importButton = screen.getByRole('button', { name: 'Import Data' });
		await fireEvent.click(importButton);

		// Wait for completion and check result
		await waitFor(() => {
			expect(screen.getByText('Successfully imported 5 measurements.')).toBeInTheDocument();
		});

		expect(mockImportClientService.intelligentImport).toHaveBeenCalledOnce();
	});

	it('should show Update Data button when existing data is available', async () => {
		mockAuthService.checkStatus.mockResolvedValueOnce({
			success: true,
			authenticated: false
		});

		// Mock existing data
		mockImportClientService.hasExistingData.mockResolvedValue(true);

		render(AuthSection);

		// Set authenticated state to show Update button
		authActions.setAuthenticated(true);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Update Data' })).toBeInTheDocument();
		});

		// Button should not be disabled when authenticated
		const updateButton = screen.getByRole('button', { name: 'Update Data' });
		expect(updateButton).not.toBeDisabled();
	});
});
