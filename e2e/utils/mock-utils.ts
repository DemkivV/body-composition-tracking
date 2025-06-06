import type { Page } from '@playwright/test';

// Centralized base mocks for consistent test setup across all E2E tests.
export async function setupBaseMocks(page: Page) {
	// CRITICAL: Catch-all MUST come FIRST to prevent any unmocked API calls from reaching the server.
	// This is the primary safety net against data corruption.
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.error(`[E2E-CATCH-ALL] Blocked unmocked API call: ${method} ${url}`);
		await route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: `[E2E Test Error] This API endpoint was not mocked: ${method} ${url}`
			})
		});
	});

	// Mock essential auth endpoints for a default "logged out" state.
	await page.route('/api/auth/configure', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, configured: true })
		});
	});

	await page.route('/api/auth/status', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, authenticated: false })
		});
	});

	// For most tests, import endpoints should be disabled.
	await page.route('/api/import/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Import disabled in this test environment'
			})
		});
	});

	// Mock data endpoints that don't involve writing data.
	await page.route('**/api/data/cycles', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, data: [] })
		});
	});

	await page.route('**/api/analysis/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, data: [] })
		});
	});
}

// Mocks for tests that require a standard set of pre-existing data.
export async function setupStandardDataMocks(page: Page) {
	await page.route('**/api/data/raw', async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					data: [
						{
							id: 1,
							Date: '2024-01-15 10:30:00',
							'Weight (kg)': '75.5',
							'Fat mass (kg)': '15.2',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.8',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 1C'
						},
						{
							id: 2,
							Date: '2024-01-14 10:30:00',
							'Weight (kg)': '75.8',
							'Fat mass (kg)': '15.4',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.9',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 2C'
						}
					]
				})
			});
		} else if (method === 'POST') {
			const newId = Math.floor(Math.random() * 1000) + 100;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					id: newId,
					message: 'Row added successfully (mocked)'
				})
			});
		} else if (method === 'PUT') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Row updated successfully (mocked)'
				})
			});
		} else if (method === 'DELETE') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Row deleted successfully (mocked)'
				})
			});
		} else {
			await route.fulfill({
				status: 405,
				contentType: 'application/json',
				body: JSON.stringify({ success: false, error: 'Method not allowed' })
			});
		}
	});
}

// Mocks for testing the "empty state" UI.
export async function setupEmptyDataMocks(page: Page) {
	await page.route('**/api/data/raw', async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: [] })
			});
		} else if (method === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					id: 1,
					message: 'First row added successfully (mocked)'
				})
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, message: 'Operation completed (mocked)' })
			});
		}
	});
}

// Mocks for testing loading spinners and UI loading states.
export async function setupSlowLoadingMocks(page: Page) {
	await page.route('**/api/data/raw', async (route) => {
		if (route.request().method() === 'GET') {
			await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network latency
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: [] })
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, message: 'Operation completed (mocked)' })
			});
		}
	});
}

// Mocks for testing error handling and UI error states.
export async function setupErrorMocks(page: Page) {
	await page.route('**/api/data/raw', async (route) => {
		await route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mocked server error: Database connection failed'
			})
		});
	});
}
