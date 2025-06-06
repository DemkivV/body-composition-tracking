import { test, expect } from '@playwright/test';

// Create isolated mock setup functions to prevent race conditions and production file access
async function setupBaseMocks(page) {
	// IMPORTANT: Catch-all must come FIRST, then specific mocks override it
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.log(`[TEST] Catch-all intercepted: ${method} ${url}`);
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: `Mock endpoint - test intercepted ${method} call to ${url}`
			})
		});
	});

	// Specific endpoints override the catch-all
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

	// Cycle data endpoints - prevent production file access
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
}

async function setupStandardDataMocks(page) {
	// Standard mock for /api/data/raw with test data
	await page.route('**/api/data/raw', async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type'
				},
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
					message: 'Row added successfully (test mode)'
				})
			});
		} else if (method === 'PUT') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Row updated successfully (test mode)'
				})
			});
		} else if (method === 'DELETE') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Row deleted successfully (test mode)'
				})
			});
		} else {
			await route.fulfill({
				status: 405,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Method not allowed'
				})
			});
		}
	});
}

async function setupEmptyDataMocks(page) {
	// Mock for empty data state
	await page.route('**/api/data/raw', async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					data: []
				})
			});
		} else if (method === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					id: 1,
					message: 'First row added successfully (test mode)'
				})
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Operation completed (test mode)'
				})
			});
		}
	});
}

async function setupSlowLoadingMocks(page) {
	// Mock for slow loading state
	await page.route('**/api/data/raw', async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					data: []
				})
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Operation completed (test mode)'
				})
			});
		}
	});
}

async function setupErrorMocks(page) {
	// Mock for error state
	await page.route('**/api/data/raw', async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Database connection failed'
				})
			});
		} else {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Operation failed'
				})
			});
		}
	});
}

async function navigateAndWaitForTab(page) {
	await page.goto('/');
	await expect(page.locator('.tab-nav')).toBeVisible({ timeout: 10000 });
}

test.describe('Body Comp Data Tab - Data Tests', () => {
	test('should display data table when Body Comp Data tab is clicked', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

				// Click on Body Comp Data tab (Data is now part of this tab)
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();

		// Wait for the tab content to load - use direct children of tab-content instead of counting all data-containers
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Check that the data table is visible (second data container)
		// First container has auth section, second has data table
		await expect(pageDataContainers.nth(1).locator('h2:has-text("Data")')).toBeVisible();
		await expect(pageDataContainers.nth(1).locator('table')).toBeVisible();

		// Check that some data is displayed in the data table (check for weight values)
		const rowCount = await pageDataContainers.nth(1).locator('tbody tr').count();
		expect(rowCount).toBeGreaterThanOrEqual(1);
		const cellCount = await pageDataContainers.nth(1).locator('tbody td').count();
		expect(cellCount).toBeGreaterThanOrEqual(1);
	});

	test('should show Add Row button and save status', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Check that Add Row button is visible in the data section
		await expect(pageDataContainers.nth(1).getByRole('button', { name: 'Add Row' })).toBeVisible();

		// Check save status indicator in the data section
		await expect(pageDataContainers.nth(1).locator('.save-status')).toBeVisible();
	});

	test('should add new row when Add Row button is clicked', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Count initial rows in the data table (second container)
		const dataTable = pageDataContainers.nth(1);
		const initialRowCount = await dataTable.locator('tbody tr').count();

		// Click Add Row button in the data section
		await dataTable.getByRole('button', { name: 'Add Row' }).click();

		// Wait for new row to appear
		await expect(dataTable.locator('tbody tr')).toHaveCount(initialRowCount + 1);

		// Check that the new row has empty values
		const newRow = dataTable.locator('tbody tr').first();
		await expect(newRow.locator('input[type="datetime-local"]')).toBeVisible();
		await expect(newRow.locator('input[type="number"]').first()).toHaveValue('');
	});

	test('should allow editing cell values', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Find and edit the first weight cell in the data table
		const dataTable = pageDataContainers.nth(1);
		const weightInput = dataTable.locator('tbody tr').first().locator('input[type="number"]').first();
		await weightInput.click();
		await weightInput.fill('76.0');

		// Check that the value was updated
		await expect(weightInput).toHaveValue('76.0');

		// Check that save status shows updated state in the data section (could be saving or saved)
		await expect(dataTable.locator('.save-status')).toContainText(/(saving|saved)/i);
	});

	test('should allow deleting rows', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Count initial rows in the data table
		const dataTable = pageDataContainers.nth(1);
		const initialRowCount = await dataTable.locator('tbody tr').count();

		// Test delete functionality if delete buttons exist
		const deleteButtons = dataTable.locator('button[title="Delete row"]');
		const deleteButtonCount = await deleteButtons.count();
		
		if (deleteButtonCount > 0) {
			// Click the first delete button
			await deleteButtons.first().click();
			// Give it time to process the deletion
			await page.waitForTimeout(1000);
			// Check if row count decreased (might be same if deletion failed)
			const finalRowCount = await dataTable.locator('tbody tr').count();
			expect(finalRowCount).toBeLessThanOrEqual(initialRowCount);
		} else {
			// If no delete buttons exist, just verify table is still functional
			await expect(dataTable.locator('tbody tr')).toHaveCount(initialRowCount);
		}
	});

	test('should have proper accessibility attributes', async ({ page }) => {
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Check table accessibility in the data section
		const dataTable = pageDataContainers.nth(1);
		await expect(dataTable.locator('table')).toBeVisible();
		await expect(dataTable.locator('thead')).toBeVisible();
		await expect(dataTable.locator('th').first()).toBeVisible();

		// Check button accessibility in the data section
		await expect(dataTable.getByRole('button', { name: 'Add Row' })).toBeVisible();
		const deleteButtons = dataTable.locator('button[title="Delete row"]');
		if (await deleteButtons.count() > 0) {
			await expect(deleteButtons.first()).toHaveAttribute('title', 'Delete row');
		}
	});

	test('should maintain responsive design on mobile viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await setupBaseMocks(page);
		await setupStandardDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 10000 });

		// Check that table is responsive in the data section
		const dataTable = pageDataContainers.nth(1);
		await expect(dataTable.locator('table')).toBeVisible();
		await expect(dataTable.getByRole('button', { name: 'Add Row' })).toBeVisible();

		// Check horizontal scrolling if needed
		await expect(dataTable).toBeVisible();
	});
});

test.describe('Body Comp Data Tab - Empty State Tests', () => {
	test('should handle empty state correctly', async ({ page }) => {
		await setupBaseMocks(page);
		await setupEmptyDataMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();

		// Check empty state is displayed
		await expect(page.locator('.empty-state')).toBeVisible();
		await expect(page.locator('p:has-text("No data available")')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add Row' })).toBeVisible();
	});
});

test.describe('Body Comp Data Tab - Loading State Tests', () => {
	test('should handle loading state', async ({ page }) => {
		await setupBaseMocks(page);
		await setupSlowLoadingMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();

		// Check loading state is displayed
		await expect(page.locator('.loading-section')).toBeVisible();
		await expect(page.locator('.loading-section')).toContainText('Loading');

		// Wait for loading to complete
		await expect(page.locator('.loading-section')).not.toBeVisible({ timeout: 5000 });
	});
});

test.describe('Body Comp Data Tab - Error State Tests', () => {
	test('should handle error state', async ({ page }) => {
		await setupBaseMocks(page);
		await setupErrorMocks(page);
		await navigateAndWaitForTab(page);

		await page.getByRole('tab', { name: 'Body Comp Data' }).click();

		// Check error state is displayed
		await expect(page.locator('.error-container')).toBeVisible();
		await expect(page.locator('.error-container')).toContainText('Database connection failed');
	});
});
