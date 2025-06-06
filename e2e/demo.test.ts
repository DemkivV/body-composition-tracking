import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	// IMPORTANT: Catch-all must come FIRST to prevent production access
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.log(`[TEST] Catch-all intercepted in demo.test.ts: ${method} ${url}`);
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: `Mock endpoint - test intercepted ${method} call to ${url}`
			})
		});
	});

	// Specific mocks override the catch-all
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

	await page.route('/api/auth/status', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				authenticated: false
			})
		});
	});

	await page.route('/api/auth/authenticate', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock auth endpoint - no real authentication in tests'
			})
		});
	});

	await page.route('/api/auth/logout', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				message: 'Logged out (test mode)'
			})
		});
	});

	await page.route('/api/auth/callback', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock callback endpoint - no real callback in tests'
			})
		});
	});

	await page.route('/api/import/has-data', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ hasData: false })
		});
	});

	await page.route('/api/import', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock import endpoint - no real import in tests'
			})
		});
	});

	await page.route('/api/import/all', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock import/all endpoint - no real import in tests'
			})
		});
	});

	await page.route('/api/import/intelligent', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Mock import/intelligent endpoint - no real import in tests'
			})
		});
	});

	// Always mock /api/data/raw to prevent any production data access
	await page.route('**/api/data/raw', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				data: []
			})
		});
	});

	// Cycle data endpoints
	await page.route('**/api/data/cycles', async (route) => {
		const method = route.request().method();
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				data: [],
				message: `Mock cycle endpoint (${method}) - no production access`
			})
		});
	});

	// Analysis endpoints
	await page.route('**/api/analysis/**', async (route) => {
		const method = route.request().method();
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				data: [],
				message: `Mock analysis endpoint (${method}) - no production access`
			})
		});
	});

	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});
