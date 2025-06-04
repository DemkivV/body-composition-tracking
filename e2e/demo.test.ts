import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	// Set up basic mocks to prevent any API calls
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

	await page.route('/api/import/has-data', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ hasData: false })
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

	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});
