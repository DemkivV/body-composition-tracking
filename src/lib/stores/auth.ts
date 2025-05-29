import { writable, type Writable } from 'svelte/store';

export interface AuthState {
	isAuthenticated: boolean;
	isAuthenticating: boolean;
	error: string | null;
}

const initialState: AuthState = {
	isAuthenticated: false,
	isAuthenticating: false,
	error: null
};

export const authStore: Writable<AuthState> = writable(initialState);

export const authActions = {
	setAuthenticated: (authenticated: boolean) => {
		authStore.update(state => ({
			...state,
			isAuthenticated: authenticated,
			isAuthenticating: false,
			error: authenticated ? null : state.error
		}));
	},

	setAuthenticating: (authenticating: boolean) => {
		authStore.update(state => ({
			...state,
			isAuthenticating: authenticating,
			error: authenticating ? null : state.error
		}));
	},

	setError: (error: string) => {
		authStore.update(state => ({
			...state,
			isAuthenticating: false,
			error
		}));
	},

	reset: () => {
		authStore.set(initialState);
	}
}; 