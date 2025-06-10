import { expect, test } from '@playwright/test';
import { setupMocks } from './utils/mock-utils';

test('home page has expected title', async ({ page }) => {
	await setupMocks(page, { auth: 'loggedOut', data: 'empty' });

	await page.goto('/');
	// Check for the title content in either SVG or h1 (fallback)
	await expect(page.locator('text="Body Composition Tracker"').first()).toBeVisible();
});
