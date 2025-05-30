import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore, authActions, type AuthState } from './auth';

describe('Auth Store', () => {
	beforeEach(() => {
		authActions.reset();
	});

	it('should initialize with correct default state', () => {
		const state = get(authStore);
		expect(state).toEqual({
			isAuthenticated: false,
			isAuthenticating: false,
			error: null
		});
	});

	it('should set authenticated state correctly', () => {
		authActions.setAuthenticated(true);
		const state = get(authStore);
		
		expect(state.isAuthenticated).toBe(true);
		expect(state.isAuthenticating).toBe(false);
		expect(state.error).toBe(null);
	});

	it('should set authenticating state correctly', () => {
		authActions.setAuthenticating(true);
		const state = get(authStore);
		
		expect(state.isAuthenticating).toBe(true);
		expect(state.error).toBe(null);
	});

	it('should set error state correctly', () => {
		const errorMessage = 'Authentication failed';
		authActions.setError(errorMessage);
		const state = get(authStore);
		
		expect(state.error).toBe(errorMessage);
		expect(state.isAuthenticating).toBe(false);
	});

	it('should reset to initial state', () => {
		// Modify the state first
		authActions.setAuthenticated(true);
		authActions.setError('Some error');
		
		// Then reset
		authActions.reset();
		const state = get(authStore);
		
		expect(state).toEqual({
			isAuthenticated: false,
			isAuthenticating: false,
			error: null
		});
	});

	it('should clear error when setting authenticated', () => {
		authActions.setError('Some error');
		authActions.setAuthenticated(true);
		const state = get(authStore);
		
		expect(state.error).toBe(null);
		expect(state.isAuthenticated).toBe(true);
	});

	it('should clear error when setting authenticating', () => {
		authActions.setError('Some error');
		authActions.setAuthenticating(true);
		const state = get(authStore);
		
		expect(state.error).toBe(null);
		expect(state.isAuthenticating).toBe(true);
	});
}); 