import { authActions } from '../stores/auth';

interface AuthResponse {
	success: boolean;
	message?: string;
	authenticated?: boolean;
	authUrl?: string;
	state?: string;
}

class AuthService {
	private authWindow: Window | null = null;
	private pollInterval: number | null = null;

	/**
	 * Check authentication status with the server
	 */
	async checkStatus(): Promise<AuthResponse> {
		try {
			const response = await fetch('/api/auth/status');
			const data: AuthResponse = await response.json();

			if (data.success) {
				authActions.setAuthenticated(data.authenticated || false);
			} else {
				authActions.setError(data.message || 'Failed to check authentication status');
			}

			return data;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Network error';
			authActions.setError(message);
			throw error;
		}
	}

	/**
	 * Start the OAuth authentication flow
	 */
	async authenticate(): Promise<AuthResponse> {
		try {
			authActions.setAuthenticating(true);
			authActions.setError(null);

			// Get authorization URL from server
			const response = await fetch('/api/auth/authenticate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const data: AuthResponse = await response.json();

			if (!data.success || !data.authUrl) {
				throw new Error(data.message || 'Failed to get authorization URL');
			}

			// Open authorization URL in popup window
			this.authWindow = window.open(
				data.authUrl,
				'withings-auth',
				'width=600,height=700,scrollbars=yes,resizable=yes'
			);

			if (!this.authWindow) {
				throw new Error(
					'Failed to open authentication window. Please check if popups are blocked.'
				);
			}

			// Monitor for successful authentication
			this.startAuthPolling();

			return data;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Authentication failed';
			authActions.setError(message);
			authActions.setAuthenticating(false);
			throw error;
		}
	}

	/**
	 * Poll for authentication completion
	 */
	private startAuthPolling(): void {
		this.pollInterval = window.setInterval(async () => {
			try {
				// Check if auth window was closed
				if (this.authWindow?.closed) {
					this.stopAuthPolling();
					authActions.setAuthenticating(false);

					// Check if authentication was successful
					const statusResponse = await this.checkStatus();
					if (!statusResponse.authenticated) {
						authActions.setError('Authentication was cancelled or failed');
					}
					return;
				}

				// Check authentication status
				const statusResponse = await this.checkStatus();
				if (statusResponse.authenticated) {
					this.stopAuthPolling();
					this.authWindow?.close();
					authActions.setAuthenticating(false);
				}
			} catch (error) {
				console.error('Auth polling error:', error);
			}
		}, 1000); // Poll every second
	}

	/**
	 * Stop authentication polling
	 */
	private stopAuthPolling(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval);
			this.pollInterval = null;
		}
	}

	/**
	 * Logout user
	 */
	async logout(): Promise<AuthResponse> {
		try {
			const response = await fetch('/api/auth/logout', {
				method: 'POST'
			});

			const data: AuthResponse = await response.json();

			if (data.success) {
				authActions.reset();
			} else {
				authActions.setError(data.message || 'Logout failed');
			}

			return data;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Logout failed';
			authActions.setError(message);
			throw error;
		}
	}
}

export const authService = new AuthService();
