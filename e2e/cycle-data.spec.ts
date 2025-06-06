import { test, expect } from '@playwright/test';

async function setupCompleteMocks(page) {
	// Mock all API endpoints
	await page.route('/api/auth/configure', async (route) => {
		await route.fulfill({
			json: { success: true, configured: true }
		});
	});

	await page.route('/api/auth/status', async (route) => {
		await route.fulfill({
			json: { success: true, authenticated: true }
		});
	});

	await page.route('/api/import/has-data', async (route) => {
		await route.fulfill({
			json: { success: true, hasData: true }
		});
	});

	await page.route('/api/data/raw', async (route) => {
		await route.fulfill({
			json: { success: true, data: [] }
		});
	});

	// Mock the cycles API endpoint
	await page.route('/api/data/cycles', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({
				json: {
					success: true,
					data: [
						{
							id: 0,
							'Start Date': '2025-06-01',
							'End Date': '2025-06-20',
							'Cycle Name': 'Meso 2025.06',
							Comments: ''
						},
						{
							id: 1,
							'Start Date': '2025-05-01',
							'End Date': '2025-05-20',
							'Cycle Name': 'Meso 2025.05',
							Comments: ''
						}
					]
				}
			});
		} else if (route.request().method() === 'PUT') {
			await route.fulfill({
				json: { success: true }
			});
		}
	});
}

test.describe('Cycle Data Tab', () => {
	test('should not get stuck in endless loading loop', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// TDD Test: This should catch endless loading loops
		// The loading state should resolve within 3 seconds
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 3000 });

		// Verify the actual content loaded
		await expect(page.locator('h2:has-text("Cycle Data")')).toBeVisible();
		await expect(page.locator('table')).toBeVisible();
	});

	test('should handle API failures gracefully without endless loading', async ({ page }) => {
		// Setup auth mocks but make cycles API fail
		await page.route('/api/auth/configure', async (route) => {
			await route.fulfill({
				json: { success: true, configured: true }
			});
		});

		await page.route('/api/auth/status', async (route) => {
			await route.fulfill({
				json: { success: true, authenticated: true }
			});
		});

		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				json: { success: true, hasData: true }
			});
		});

		await page.route('/api/data/raw', async (route) => {
			await route.fulfill({
				json: { success: true, data: [] }
			});
		});

		// Make cycles API fail to test error handling
		await page.route('/api/data/cycles', async (route) => {
			await route.fulfill({
				status: 500,
				json: { success: false, error: 'Server error' }
			});
		});

		await page.goto('/cycle-data');

		// Should not be stuck in loading
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 3000 });

		// Should show error message or retry button (use first one to avoid strict mode violation)
		await expect(page.locator('.error-container').first()).toBeVisible();
	});



	test('should display cycle data table when Cycle Data tab is clicked', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/');

		// Click on Cycle Data tab
		await page.click('[data-tab="cycle-data"]');

		// Verify we're on the cycle data page
		await expect(page).toHaveURL('/cycle-data');

		// Verify the cycle data table is displayed
		await expect(page.locator('h2:has-text("Cycle Data")')).toBeVisible();
		await expect(page.locator('table')).toBeVisible();

		// Verify table headers
		await expect(page.locator('th:has-text("Start Date")')).toBeVisible();
		await expect(page.locator('th:has-text("End Date")')).toBeVisible();
		await expect(page.locator('th:has-text("Cycle Name")')).toBeVisible();
		await expect(page.locator('th:has-text("Comments")')).toBeVisible();
	});

	test('should show Add Row button and save status', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// Verify Add Row button is present
		await expect(page.locator('button:has-text("Add Row")')).toBeVisible();

		// Verify save status is shown
		await expect(page.locator('.save-status')).toBeVisible();
	});

	test('should display existing cycle data', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// Wait for table to load
		await expect(page.locator('table')).toBeVisible();
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 5000 });

		// Check that we have the expected number of rows from mock data
		await expect(page.locator('table tbody tr')).toHaveCount(2);

		// Verify that inputs are present (structure test - data loading tested elsewhere)
		await expect(page.locator('input[type="date"]')).toHaveCount(4); // 2 rows × 2 date fields
		await expect(page.locator('input[type="text"]')).toHaveCount(4); // 2 rows × 2 text fields
	});

	test('should add new row when Add Row button is clicked', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// Wait for initial data to load
		await expect(page.locator('table tbody tr')).toHaveCount(2);

		// Click Add Row button
		await page.click('button:has-text("Add Row")');

		// Verify a new row was added
		await expect(page.locator('table tbody tr')).toHaveCount(3);
	});

	test('should allow editing cell values', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// Wait for table to load
		await expect(page.locator('table')).toBeVisible();
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 5000 });

		// Check that we have the expected number of rows from mock data
		await expect(page.locator('table tbody tr')).toHaveCount(2);

		// Test editing by using the first text input (cycle name field)
		const cycleNameInput = page.locator('input[type="text"]').first();
		await expect(cycleNameInput).toBeVisible();

		// Edit the cycle name
		await cycleNameInput.fill('Updated Cycle Name');

		// Verify the input now has the updated value
		await expect(cycleNameInput).toHaveValue('Updated Cycle Name');
	});

	test('should allow deleting rows', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// Wait for initial data to load
		await expect(page.locator('table tbody tr')).toHaveCount(2);

		// Set up dialog handler to confirm deletion
		page.on('dialog', (dialog) => dialog.accept());

		// Click delete button for first row
		await page.locator('.action-button.delete').first().click();

		// Verify row was deleted
		await expect(page.locator('table tbody tr')).toHaveCount(1);
	});

	test('should have proper accessibility attributes', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/cycle-data');

		// Check delete button accessibility
		const deleteButton = page.locator('.action-button.delete').first();
		await expect(deleteButton).toHaveAttribute('aria-label', 'Delete row');
		await expect(deleteButton).toHaveAttribute('title', 'Delete row');
	});

	test('should navigate between tabs correctly', async ({ page }) => {
		await setupCompleteMocks(page);
		await page.goto('/');

		// Navigate to Cycle Data
		await page.click('[data-tab="cycle-data"]');
		await expect(page).toHaveURL('/cycle-data');
		await expect(page.locator('[data-tab="cycle-data"]')).toHaveClass(/active/);

		// Navigate back to Raw Data
		await page.click('[data-tab="raw-data"]');
		await expect(page).toHaveURL('/raw-data');
		await expect(page.locator('[data-tab="raw-data"]')).toHaveClass(/active/);

		// Navigate to Analysis
		await page.click('[data-tab="analysis"]');
		await expect(page).toHaveURL('/analysis');
		await expect(page.locator('[data-tab="analysis"]')).toHaveClass(/active/);
	});
});
