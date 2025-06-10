import type { Page, Route } from '@playwright/test';

// Define the types for our mock setups
type TDataState = 'standard' | 'empty' | 'loading' | 'error' | false;
type TAuthState = 'loggedIn' | 'loggedOut';

interface MockOptions {
	auth?: TAuthState;
	data?: TDataState;
}

// Helper for our standard data response
const standardData = [
	{
		id: 1,
		Date: '2024-01-15 10:30:00',
		'Weight (kg)': '75.5',
		'Fat mass (kg)': '15.2',
		'Bone mass (kg)': '3.1',
		'Muscle mass (kg)': '32.8',
		'Hydration (kg)': '24.4',
		Comments: 'Test entry 1'
	},
	{
		id: 2,
		Date: '2024-01-14 10:30:00',
		'Weight (kg)': '75.8',
		'Fat mass (kg)': '15.4',
		'Bone mass (kg)': '3.1',
		'Muscle mass (kg)': '32.9',
		'Hydration (kg)': '24.4',
		Comments: 'Test entry 2'
	}
];

const standardCycles = [
	{
		id: 1,
		'Start Date': '2024-01-01',
		'End Date': '2024-01-28',
		'Cycle Name': 'Test Cycle 1',
		Comments: 'Initial mock cycle'
	}
];

// THE NEW, UNIFIED MOCKING FUNCTION
export async function setupMocks(page: Page, options: MockOptions = {}) {
	const { auth = 'loggedOut', data = 'standard' } = options;

	// --- Specific Mocks (Based on options) ---

	// Handle Auth State
	if (auth === 'loggedIn') {
		await page.route('/api/auth/status', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					authenticated: true,
					user: { name: 'Test User', email: 'test@example.com' }
				})
			})
		);
	} else {
		// loggedOut is the default
		await page.route('/api/auth/status', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					authenticated: false
				})
			})
		);
	}

	// Handle Data State for the main data endpoint
	if (data === 'standard') {
		await page.route('**/api/data/raw', (route) => {
			const method = route.request().method();
			if (method === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true, data: standardData })
				});
			} else if (method === 'POST') {
				const newId = Math.floor(Math.random() * 1000) + 100;
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						id: newId,
						message: 'Row added successfully (mocked)'
					})
				});
			} else if (method === 'PUT') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						message: 'Row updated successfully (mocked)'
					})
				});
			} else if (method === 'DELETE') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						message: 'Row deleted successfully (mocked)'
					})
				});
			} else {
				route.fulfill({
					status: 405,
					contentType: 'application/json',
					body: JSON.stringify({ success: false, error: 'Method not allowed' })
				});
			}
		});
	} else if (data === 'empty') {
		await page.route('**/api/data/raw', (route) => {
			const method = route.request().method();
			if (method === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true, data: [] })
				});
			} else if (method === 'POST') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						id: 1,
						message: 'First row added successfully (mocked)'
					})
				});
			} else {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true, message: 'Operation completed (mocked)' })
				});
			}
		});
	} else if (data === 'loading') {
		// Intercept but don't fulfill, causing it to hang until test timeout or manual fulfillment.
		await page.route('**/api/data/raw', () => new Promise(() => {}));
	} else if (data === 'error') {
		await page.route('**/api/data/raw', (route) =>
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Mocked server error: Database connection failed'
				})
			})
		);
	}
	// If data is `false`, we don't mock it, letting it fall to the catch-all.

	// Mock other default endpoints that are always the same
	await page.route('/api/auth/configure', (r) =>
		r.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, configured: true })
		})
	);

	await page.route('**/api/data/cycles', (r) => {
		const method = r.request().method();
		if (method === 'GET') {
			r.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: standardCycles })
			});
		} else if (method === 'PUT') {
			r.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Cycle data saved successfully (mocked)'
				})
			});
		} else {
			r.fulfill({
				status: 405,
				contentType: 'application/json',
				body: JSON.stringify({ success: false, error: `Method ${method} not allowed for cycles` })
			});
		}
	});

	// Mock import endpoints to prevent any real import operations
	await page.route('/api/import/**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Import disabled in test environment'
			})
		});
	});

	await page.route('/api/import/has-data', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ hasData: false })
		});
	});

	// Mock analysis endpoints
	await page.route('**/api/analysis/**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, data: [] })
		});
	});

	// Mock auth endpoints
	await page.route('/api/auth/authenticate', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock auth endpoint - no real authentication in tests'
			})
		});
	});

	await page.route('/api/auth/logout', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				message: 'Logged out (test mode)'
			})
		});
	});

	await page.route('/api/auth/callback', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock callback endpoint - no real callback in tests'
			})
		});
	});

	// --- THE SAFETY NET: CATCH-ALL GOES LAST! ---
	// This is registered AFTER all specific mocks. Due to Playwright's LIFO order,
	// it will be checked FIRST for any request, but since it uses a broad pattern,
	// the more specific routes above will match first, and this will only catch
	// truly unmocked requests.
	await page.route('**/*', (route: Route) => {
		const url = route.request().url();

		// Allow requests to our own test server (for HTML, JS, CSS files)
		if (url.includes('localhost:4174') || url.includes('localhost:4173')) {
			return route.continue();
		}

		// Allow certain static assets and common browser requests
		if (
			url.includes('favicon.ico') ||
			url.includes('.js') ||
			url.includes('.css') ||
			url.includes('.svg')
		) {
			return route.continue();
		}

		// Block and fail the test for any other unmocked request
		console.error(`\n❌ BLOCKED UNMOCKED REQUEST: ${route.request().method()} ${url}\n`);
		return route.abort('blockedbyclient');
	});
}

// Legacy function names for backward compatibility during transition
export async function setupBaseMocks(page: Page) {
	await setupMocks(page, { auth: 'loggedOut', data: 'standard' });
}

export async function mockLoggedInUser(page: Page) {
	// This override approach is more fragile, but kept for compatibility
	await page.route('/api/auth/status', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				authenticated: true,
				user: { name: 'Test User', email: 'test@example.com' }
			})
		})
	);
}

export async function setupStandardDataMocks(page: Page) {
	await setupMocks(page, { auth: 'loggedOut', data: 'standard' });
}

export async function setupEmptyDataMocks(page: Page) {
	await setupMocks(page, { auth: 'loggedOut', data: 'empty' });
}

export async function setupSlowLoadingMocks(page: Page) {
	await setupMocks(page, { auth: 'loggedOut', data: 'loading' });
}

export async function setupErrorMocks(page: Page) {
	await setupMocks(page, { auth: 'loggedOut', data: 'error' });
}
