import { test, expect } from '@playwright/test';

test.describe('Raw Data Tab', () => {
	test.beforeEach(async ({ page }) => {
		// Mock configuration check
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

		// Mock auth status check
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

		// Mock has existing data check
		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: false })
			});
		});

		// Mock raw data API with sample data
		await page.route('/api/data/raw', async (route) => {
			if (route.request().method() === 'GET') {
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
								Comments: 'Morning measurement'
							},
							{
								id: 2,
								Date: '2024-01-14 10:30:00',
								'Weight (kg)': '75.8',
								'Fat mass (kg)': '15.4',
								'Bone mass (kg)': '3.1',
								'Muscle mass (kg)': '32.9',
								'Hydration (kg)': '24.4',
								Comments: ''
							}
						]
					})
				});
			} else if (route.request().method() === 'PUT') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
			}
		});

		await page.goto('/');
		await page.waitForSelector('.tab-content', { timeout: 10000 });
	});

	test('should display raw data table when Raw Data tab is clicked', async ({ page }) => {
		// Click on Raw Data tab
		await page.getByRole('tab', { name: 'Raw Data' }).click();

		// Wait for the data container to load
		await expect(page.locator('.data-container')).toBeVisible();

		// Check that the table is displayed
		await expect(page.locator('.data-table')).toBeVisible();

		// Check table headers
		await expect(page.locator('th:has-text("Date")')).toBeVisible();
		await expect(page.locator('th:has-text("Weight (kg)")')).toBeVisible();
		await expect(page.locator('th:has-text("Fat mass (kg)")')).toBeVisible();
		await expect(page.locator('th:has-text("Bone mass (kg)")')).toBeVisible();
		await expect(page.locator('th:has-text("Muscle mass (kg)")')).toBeVisible();
		await expect(page.locator('th:has-text("Hydration (kg)")')).toBeVisible();
		await expect(page.locator('th:has-text("Comments")')).toBeVisible();

		// Check that data rows are displayed
		await expect(page.locator('tbody tr')).toHaveCount(2);

		// Check that the table has input fields (indicating it's interactive)
		await expect(page.locator('tbody input[type="number"]')).toHaveCount(10); // 5 numeric fields × 2 rows
		await expect(page.locator('tbody input[type="text"]')).toHaveCount(2); // Comments field × 2 rows
		await expect(page.locator('tbody input[type="datetime-local"]')).toHaveCount(2); // Date field × 2 rows
	});

	test('should show Add Row button and save status', async ({ page }) => {
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.locator('.data-container')).toBeVisible();

		// Check Add Row button is present
		await expect(page.getByRole('button', { name: 'Add Row' })).toBeVisible();

		// Check save status is displayed
		await expect(page.locator('.save-status')).toBeVisible();
	});

	test('should add new row when Add Row button is clicked', async ({ page }) => {
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.locator('.data-container')).toBeVisible();

		// Count initial rows
		const initialRowCount = await page.locator('tbody tr').count();

		// Click Add Row button
		await page.getByRole('button', { name: 'Add Row' }).click();

		// Wait for new row to be added
		await expect(page.locator('tbody tr')).toHaveCount(initialRowCount + 1);

		// Check that the new row has today's date (approximately)
		const today = new Date();
		const todayStr = today.getFullYear().toString();
		await expect(page.locator('tbody tr').first().locator('input[type="datetime-local"]')).toHaveValue(
			new RegExp(todayStr)
		);

		// Check that save status might show "Saving..." (optional since it's fast)
		const savingStatus = page.locator('.save-status.saving');
		const savedStatus = page.locator('.save-status.saved');
		
		// Either saving or saved status should be visible
		await expect(savingStatus.or(savedStatus)).toBeVisible({ timeout: 3000 });
	});

	test('should allow editing cell values', async ({ page }) => {
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.locator('.data-container')).toBeVisible();

		// Edit weight in first row
		const weightInput = page.locator('tbody tr').first().locator('input[type="number"]').first();
		await weightInput.clear();
		await weightInput.fill('76.0');

		// Verify the value was updated
		await expect(weightInput).toHaveValue('76.0');

		// Check that save status is visible (either saving or saved)
		const savingStatus = page.locator('.save-status.saving');
		const savedStatus = page.locator('.save-status.saved');
		await expect(savingStatus.or(savedStatus)).toBeVisible({ timeout: 3000 });
	});

	test('should allow deleting rows', async ({ page }) => {
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.locator('.data-container')).toBeVisible();

		// Count initial rows
		const initialRowCount = await page.locator('tbody tr').count();

		// Mock the confirm dialog to return true
		page.on('dialog', async (dialog) => {
			expect(dialog.message()).toContain('Are you sure you want to delete this row?');
			await dialog.accept();
		});

		// Click delete button on first row
		await page.locator('tbody tr').first().locator('.action-button.delete').click();

		// Wait for row to be deleted
		await expect(page.locator('tbody tr')).toHaveCount(initialRowCount - 1);

		// Check that save status is visible (either saving or saved)
		const savingStatus = page.locator('.save-status.saving');
		const savedStatus = page.locator('.save-status.saved');
		await expect(savingStatus.or(savedStatus)).toBeVisible({ timeout: 3000 });
	});

	test('should handle empty state correctly', async ({ page }) => {
		// Mock empty data response
		await page.route('/api/data/raw', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						data: []
					})
				});
			}
		});

		await page.goto('/');
		await page.waitForSelector('.tab-content', { timeout: 10000 });
		await page.getByRole('tab', { name: 'Raw Data' }).click();

		// Check empty state is displayed
		await expect(page.locator('.empty-state')).toBeVisible();
		await expect(page.getByText('No data available')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add First Entry' })).toBeVisible();
	});

	test('should handle loading state', async ({ page }) => {
		// Mock slow loading response
		await page.route('/api/data/raw', async (route) => {
			if (route.request().method() === 'GET') {
				// Delay the response to show loading state
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						data: []
					})
				});
			}
		});

		await page.goto('/');
		await page.waitForSelector('.tab-content', { timeout: 10000 });
		await page.getByRole('tab', { name: 'Raw Data' }).click();

		// Check loading state is displayed
		await expect(page.locator('.loading-section')).toBeVisible();
		await expect(page.getByText('Loading data...')).toBeVisible();

		// Wait for loading to complete
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 5000 });
	});

	test('should handle error state', async ({ page }) => {
		// Mock error response
		await page.route('/api/data/raw', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Database connection failed'
					})
				});
			}
		});

		await page.goto('/');
		await page.waitForSelector('.tab-content', { timeout: 10000 });
		await page.getByRole('tab', { name: 'Raw Data' }).click();

		// Check error state is displayed
		await expect(page.locator('.error-container')).toBeVisible();
		await expect(page.getByText('Database connection failed')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
	});

	test('should have proper accessibility attributes', async ({ page }) => {
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.locator('.data-container')).toBeVisible();

		// Check table structure is present (HTML tables have implicit table role)
		await expect(page.locator('.data-table')).toBeVisible();
		await expect(page.locator('thead')).toBeVisible();
		await expect(page.locator('tbody')).toBeVisible();

		// Check delete buttons have aria-labels
		const deleteButtons = page.locator('.action-button.delete');
		const count = await deleteButtons.count();
		for (let i = 0; i < count; i++) {
			await expect(deleteButtons.nth(i)).toHaveAttribute('aria-label', 'Delete row');
		}

		// Check inputs have proper types
		await expect(page.locator('input[type="datetime-local"]')).toHaveCount(2);
		await expect(page.locator('input[type="number"]')).toHaveCount(10); // 5 numeric fields × 2 rows
	});

	test('should maintain responsive design on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.locator('.data-container')).toBeVisible();

		// Check that the table is still accessible on mobile
		await expect(page.locator('.data-table-container')).toBeVisible();
		await expect(page.locator('.data-table')).toBeVisible();

		// Check that Add Row button is still visible
		await expect(page.getByRole('button', { name: 'Add Row' })).toBeVisible();
	});
});
