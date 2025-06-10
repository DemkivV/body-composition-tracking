import type { Page } from '@playwright/test';

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
		'Weight (kg)': '86.67',
		'Fat mass (kg)': '11.86',
		'Bone mass (kg)': '3.70',
		'Muscle mass (kg)': '71.11',
		'Hydration (kg)': '50.60',
		Comments: 'Test entry 1'
	},
	{
		id: 2,
		Date: '2024-01-14 10:30:00',
		'Weight (kg)': '86.91',
		'Fat mass (kg)': '12.71',
		'Bone mass (kg)': '3.67',
		'Muscle mass (kg)': '70.53',
		'Hydration (kg)': '50.03',
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

	// --- Specific API Mocks Go First ---

	// CRITICAL: Always set up configuration endpoint first
	await page.route('/api/auth/configure', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				configured: true
			})
		});
	});

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
		// For loading state, we need to delay the response significantly but eventually respond
		await page.route('**/api/data/raw', async (route) => {
			// Wait 5 seconds to show loading state, then respond with data
			await new Promise((resolve) => setTimeout(resolve, 5000));
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: [] })
			});
		});
	} else if (data === 'error') {
		await page.route('**/api/data/raw', (route) =>
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Server error'
				})
			})
		);
	}

	// Handle cycles data based on data state
	if (data === 'error') {
		await page.route('**/api/data/cycles', (r) => {
			r.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ success: false, error: 'Server error' })
			});
		});
	} else if (data === 'empty') {
		await page.route('**/api/data/cycles', (r) => {
			const method = r.request().method();
			if (method === 'GET') {
				r.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true, data: [] })
				});
			} else {
				r.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true, message: 'Operation completed (mocked)' })
				});
			}
		});
	} else if (data === 'loading') {
		await page.route('**/api/data/cycles', async (r) => {
			await new Promise((resolve) => setTimeout(resolve, 5000));
			r.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: [] })
			});
		});
	} else {
		// Standard or default case
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
	}

	// Mock import endpoints
	await page.route('/api/import/has-data', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ hasData: false })
		});
	});

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

	// Mock analysis endpoints
	await page.route('**/api/analysis/**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, data: [] })
		});
	});

	// Mock other auth endpoints
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

	// --- INTELLIGENT CATCH-ALL GOES LAST ---
	// This creates a "default deny" policy that defers to specific handlers first
	// Using route.fallback() for proper LIFO handling in Playwright
	await page.route('**/*', (route) => {
		const request = route.request();
		const url = request.url();

		// For API calls, defer to more specific handlers first
		// If no specific handler matches, this will potentially fail the test
		if (url.includes('/api/')) {
			return route.fallback();
		}

		// For non-API calls, check if it's an asset from our test server
		const urlObj = new URL(url);
		if (urlObj.hostname === 'localhost' && urlObj.port === '4173') {
			// It's a JS/CSS/HTML file from our own test server. Let it load.
			return route.fallback();
		}

		// Allow requests to other common local development ports as well
		if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
			const port = urlObj.port;
			if (['3000', '4173', '5173', '8080', '8000', '3001', '4174'].includes(port) || !port) {
				return route.fallback();
			}
		}

		// This is a third-party call (analytics, fonts, etc.). BLOCK IT.
		console.error(`\n❌ BLOCKED UNMOCKED 3RD-PARTY REQUEST: ${request.method()} ${url}\n`);
		return route.fulfill({
			status: 418, // I'm a teapot - a fun, obvious error code for this
			contentType: 'text/plain',
			body: `Request to ${url} was blocked by the test safety net.`
		});
	});
}

// Legacy function names for backward compatibility during transition
export async function setupBaseMocks(page: Page) {
	// Just call the unified function with defaults
	await setupMocks(page, { auth: 'loggedOut', data: 'standard' });
}

export async function mockLoggedInUser(_page: Page) {
	// Just override the auth status specifically
	await _page.route('/api/auth/status', (route) =>
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

export async function setupStandardDataMocks(_page: Page) {
	// This is now handled by setupBaseMocks, so this is a no-op to avoid conflicts
	// The data mocking is already done in setupBaseMocks
	return;
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
