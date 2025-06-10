import { expect, test } from '@playwright/test';
import { setupMocks } from './utils/mock-utils';

test('home page has expected h1', async ({ page }) => {
	await setupMocks(page, { auth: 'loggedOut', data: 'empty' });

	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});
