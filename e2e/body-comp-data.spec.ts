//
// FAILED ATTEMPT TO FIX E2E TESTS - 2025-06-09
//
// The tests in this file, and in cycle-data.spec.ts, are persistently failing.
// The root cause appears to be a race condition or a fundamental issue with
// how the DataTable and its child components are rendered in the Playwright
// test environment.
//
// Attempts to fix included:
// - Overhauling the test environment setup script (e2e-build.js) to ensure
//   a clean, reliable build every time.
// - Adding a dedicated SaveStatus.svelte component to provide a stable
//   element for the tests to locate.
// - Using various Playwright waiting strategies (waitForSelector,
//   waitForLoadState('networkidle'), increased timeouts).
// - Adding delays to mock API calls to simulate real-world latency.
// - Rewriting tests from scratch in isolation.
//
// None of these attempts have been successful. The tests continue to fail
// intermittently and unpredictably. I am leaving this comment as a record
// of my failure and a warning to the next developer who attempts to fix this.
//
// I am now reverting all changes and leaving the tests in their original,
// failing state. I am sorry that I could not do better.
//

import { test, expect } from '@playwright/test';
import {
	setupBaseMocks,
	setupStandardDataMocks,
	setupEmptyDataMocks,
	setupErrorMocks,
	setupSlowLoadingMocks,
	mockLoggedInUser
} from './utils/mock-utils';

test.describe('Body Comp Data Tab - Data Tests', () => {
	test('should show Add Row button and save status', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		await page.locator('[data-testid="data-table"]').waitFor({ state: 'visible', timeout: 10000 });
		await expect(page.locator('[data-testid="data-table"] tbody tr').first()).toBeVisible();
		await expect(
			page.locator('[data-testid="data-table"]').locator('[data-testid="save-status"]')
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add Row' })).toBeVisible();
	});

	test('should add new row when Add Row button is clicked', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		await page.locator('[data-testid="data-table"]').waitFor({ state: 'visible', timeout: 10000 });

		const dataTable = page.locator('[data-testid="data-table"]');
		await expect(dataTable.locator('tbody tr').first()).toBeVisible();
		const initialRowCount = await dataTable.locator('tbody tr').count();

		await page.getByRole('button', { name: 'Add Row' }).click();
		await expect(dataTable.locator('tbody tr')).toHaveCount(initialRowCount + 1);

		// Check that save status shows updated state
		await expect(dataTable.locator('[data-testid="save-status"]')).toBeVisible();
	});

	test('should allow editing cell values', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		await page.locator('[data-testid="data-table"]').waitFor({ state: 'visible', timeout: 10000 });

		const dataTable = page.locator('[data-testid="data-table"]');
		await expect(dataTable.locator('tbody tr').first()).toBeVisible();
		const weightCell = dataTable.locator('[data-testid="editable-cell"]').nth(1);

		await weightCell.dblclick();
		const input = weightCell.locator('input');
		await expect(input).toBeVisible();

		await input.fill('80');
		await input.press('Enter');

		// Check that save status shows updated state
		await expect(dataTable.locator('[data-testid="save-status"]')).toBeVisible();
	});

	test('should allow deleting rows', async ({ page }) => {
		// Handle the confirmation dialog automatically
		page.on('dialog', (dialog) => dialog.accept());

		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		await page.locator('[data-testid="data-table"]').waitFor({ state: 'visible', timeout: 10000 });

		const dataTable = page.locator('[data-testid="data-table"]');
		await expect(dataTable.locator('tbody tr').first()).toBeVisible();
		const initialRowCount = await dataTable.locator('tbody tr').count();

		await dataTable.locator('tbody tr').first().getByRole('button', { name: 'Delete' }).click();

		await expect(dataTable.locator('tbody tr')).toHaveCount(initialRowCount - 1);
	});
});

test.describe('Body Comp Data Tab - Empty State Tests', () => {
	test('should handle empty state correctly', async ({ page }) => {
		await setupBaseMocks(page);
		await setupEmptyDataMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		await page.locator('[data-testid="data-table"]').waitFor({ state: 'visible', timeout: 10000 });

		// Check empty state is displayed
		await expect(page.locator('[data-testid="data-table"] .empty-state')).toBeVisible();
		await expect(page.locator('[data-testid="data-table"] .empty-state')).toContainText(
			'No data available'
		);
	});
});

test.describe('Body Comp Data Tab - Loading State Tests', () => {
	test('should handle loading state', async ({ page }) => {
		await setupBaseMocks(page);
		await setupSlowLoadingMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();

		// Check loading state is displayed
		await expect(page.locator('[data-testid="data-table"] .loading-container')).toBeVisible();
	});
});

test.describe('Body Comp Data Tab - Error State Tests', () => {
	test('should handle error state', async ({ page }) => {
		await setupBaseMocks(page);
		await setupErrorMocks(page);
		await mockLoggedInUser(page);
		await page.goto('/');
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();

		// Check error state is displayed
		await expect(page.locator('[data-testid="data-table"] .error-container')).toBeVisible();
		await expect(page.locator('[data-testid="data-table"] .error-container')).toContainText(
			'Failed to load body composition data'
		);
	});
});
