import { test, expect } from '@playwright/test';
import { setupMocks } from './utils/mock-utils.js';

// Helper function to navigate and wait for tab to be interactive
async function navigateAndWaitForTab(page) {
	await page.goto('/');

	// Wait for the main body composition tab to be visible
	const bodyCompTab = page.getByRole('tab', { name: 'Body Comp Data' });
	await expect(bodyCompTab).toBeVisible();

	// Click the tab
	await bodyCompTab.click();

	// Wait for the content to load
	await expect(page.locator('.tab-content')).toBeVisible();
}

test.describe('Authentication flow', () => {
	test('should show logged out state by default', async ({ page }) => {
		await setupMocks(page, { auth: 'loggedOut', data: 'standard' });
		await page.goto('/');

		// Wait for authentication section to be visible
		await expect(page.locator('.auth-section')).toBeVisible();

		// Should show not authenticated state
		await expect(page.getByText('Not authenticated yet')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();
	});

	test('should show logged in state when authenticated', async ({ page }) => {
		await setupMocks(page, { auth: 'loggedIn', data: 'standard' });
		await page.goto('/');

		// Wait for authentication section to be visible
		await expect(page.locator('.auth-section')).toBeVisible();

		// Should show authenticated state
		await expect(page.getByText('Successfully authenticated with Withings')).toBeVisible();
		await expect(page.getByRole('button', { name: '✓ Authenticated' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
	});

	test('should handle authentication error gracefully', async ({ page }) => {
		// Custom mock for auth error
		await page.route('/api/auth/configure', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					configured: true
				})
			});
		});

		await page.route('/api/auth/status', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Server error'
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

		await page.route('**/api/data/raw', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Server error (test mode)'
				})
			});
		});

		// Add the safety net catch-all
		await page.route('**/*', (route) => {
			const url = route.request().url();
			if (url.includes('localhost:4174') || url.includes('localhost:4173')) {
				return route.continue();
			}
			if (
				url.includes('favicon.ico') ||
				url.includes('.js') ||
				url.includes('.css') ||
				url.includes('.svg')
			) {
				return route.continue();
			}
			console.error(`\n❌ BLOCKED UNMOCKED REQUEST: ${route.request().method()} ${url}\n`);
			return route.abort('blockedbyclient');
		});

		await page.goto('/');

		// Wait for authentication section to be visible
		await expect(page.locator('.auth-section')).toBeVisible();

		// Should show error state
		await expect(page.getByText('Server error')).toBeVisible();
	});
});

test.describe('Data table functionality', () => {
	test('should show data table when logged in', async ({ page }) => {
		await setupMocks(page, { auth: 'loggedIn', data: 'standard' });
		await navigateAndWaitForTab(page);

		// Should show data table with test data
		await expect(page.getByText('Test entry 1')).toBeVisible();
		await expect(page.getByText('Test entry 2')).toBeVisible();
	});

	test('should show empty state when no data', async ({ page }) => {
		await setupMocks(page, { auth: 'loggedIn', data: 'empty' });
		await navigateAndWaitForTab(page);

		// Should show data table or empty state message
		const hasDataTable = await page
			.locator('[data-testid="data-table"]')
			.isVisible()
			.catch(() => false);
		const hasEmptyMessage = await page
			.getByText('No data available')
			.isVisible()
			.catch(() => false);

		// Either data table (with empty state) or empty message should be visible
		expect(hasDataTable || hasEmptyMessage).toBe(true);
	});

	test('should handle data loading error', async ({ page }) => {
		await setupMocks(page, { auth: 'loggedIn', data: 'error' });
		await navigateAndWaitForTab(page);

		// Should show error state or error message
		const hasErrorContainer = await page
			.locator('.error-container')
			.isVisible()
			.catch(() => false);
		const hasErrorMessage = await page
			.getByText('error', { exact: false })
			.isVisible()
			.catch(() => false);

		// Either error container or error message should be visible
		expect(hasErrorContainer || hasErrorMessage).toBe(true);
	});
});
