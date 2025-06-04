import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Mock the configuration check to return configured=true
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
	});

	test('should display the main page with correct elements', async ({ page }) => {
		// Mock the auth status to return not authenticated initially
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

		// Mock has existing data check - needed by AuthSection component
		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: false })
			});
		});

		// Navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for the loading state to complete
		await page.waitForSelector('.tab-content', { timeout: 10000 });

		// Check page title - updated for new routing structure
		await expect(page).toHaveTitle('Data Import - Body Composition Tracker');

		// Check main heading
		await expect(page.getByRole('heading', { name: 'Body Composition Tracker' })).toBeVisible();

		// Check tab navigation - these should be visible once configured
		await expect(page.getByRole('tab', { name: 'Data Import' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Raw Data' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Analysis' })).toBeVisible();

		// Check that Data Import tab is active by default
		await expect(page.getByRole('tab', { name: 'Data Import' })).toHaveClass(/active/);
	});

	test('should display authentication section in Data Import tab', async ({ page }) => {
		// Mock the auth status to return not authenticated initially
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

		// Mock has existing data check - needed by AuthSection component
		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: false })
			});
		});

		// Navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for the loading state to complete
		await page.waitForSelector('.tab-content', { timeout: 10000 });

		// Check data source selector
		await expect(page.getByLabel('Data Source:')).toBeVisible();
		await expect(page.locator('select#data-source option[selected]')).toHaveText('Withings API');

		// Check authentication buttons
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Import Data' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Clear Data' })).toBeVisible();

		// Check that Import Data and Clear Data buttons are disabled initially
		await expect(page.getByRole('button', { name: 'Import Data' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Clear Data' })).toBeDisabled();

		// Check authentication status - updated to match current text
		await expect(
			page.getByText(
				'Not authenticated yet. Click "Authenticate" to connect to your Withings account.'
			)
		).toBeVisible();
	});

	test('should navigate between tabs correctly', async ({ page }) => {
		// Mock configuration check - app is configured
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

		// Mock authentication status check
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

		// Mock the raw data API to provide test data for charts
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
								Comments: 'Test entry 1'
							},
							{
								id: 2,
								Date: '2024-01-14 10:30:00',
								'Weight (kg)': '75.8',
								'Fat mass (kg)': '15.4',
								'Bone mass (kg)': '3.1',
								'Muscle mass (kg)': '32.9',
								'Hydration (kg)': '24.4',
								Comments: 'Test entry 2'
							}
						]
					})
				});
			}
		});

		// Navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for the loading state to complete
		await page.waitForSelector('.tab-content', { timeout: 10000 });

		// Verify we're on the data-import page initially
		await expect(page).toHaveURL('/data-import');

		// Click on Raw Data tab
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page).toHaveURL('/raw-data');
		await expect(page.getByRole('heading', { name: 'Raw Data' })).toBeVisible();
		await expect(page.locator('.data-container')).toBeVisible();

		// Click on Analysis tab
		await page.getByRole('tab', { name: 'Analysis' }).click();
		await expect(page).toHaveURL('/analysis');

		// Wait for charts to load and be visible
		await expect(page.locator('.chart-container').first()).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.chart').first()).toBeVisible();

		// Click back to Data Import tab
		await page.getByRole('tab', { name: 'Data Import' }).click();
		await expect(page).toHaveURL('/data-import');
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();
	});

	test('should show popup blocked error when window.open fails', async ({ page }) => {
		// Setup basic status check
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

		// Mock has existing data check - needed by AuthSection component
		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: false })
			});
		});

		// Setup auth endpoint
		await page.route('/api/auth/authenticate', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Authorization URL generated successfully',
					authUrl: 'https://account.withings.com/oauth2/authorize'
				})
			});
		});

		// Mock window.open to simulate popup failure
		await page.addInitScript(() => {
			window.open = function (_url, _target, _features) {
				return null; // Simulate popup blocked
			};
		});

		// Now navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for page to load
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();

		// Click authenticate button
		await page.getByRole('button', { name: 'Authenticate' }).click();

		// Should show popup blocked error
		await expect(
			page.getByText('Failed to open authentication window. Please check if popups are blocked.')
		).toBeVisible({
			timeout: 5000
		});
	});

	test('should handle successful authentication flow', async ({ page }) => {
		let statusCallCount = 0;

		// Intercept the status check - first call returns false, then true after auth
		await page.route('/api/auth/status', async (route) => {
			statusCallCount++;
			const authenticated = statusCallCount > 3; // Simulate auth success after a few checks

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					authenticated
				})
			});
		});

		// Mock has existing data check - needed by AuthSection component
		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: false })
			});
		});

		// Setup auth endpoint
		await page.route('/api/auth/authenticate', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Authorization URL generated successfully',
					authUrl: 'https://account.withings.com/oauth2/authorize'
				})
			});
		});

		// Mock window.open to simulate successful popup
		await page.addInitScript(() => {
			window.open = function (url, _target, _features) {
				// Return a mock window that simulates being open then closed
				const mockWindow = {
					closed: false,
					close: function () {
						this.closed = true;
					},
					focus: () => {},
					blur: () => {},
					location: { href: url }
				};

				// Simulate window closing after some time
				setTimeout(() => {
					mockWindow.closed = true;
				}, 3000);

				return mockWindow as Window;
			};
		});

		// Now navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for page to load
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();

		// Click authenticate button
		await page.getByRole('button', { name: 'Authenticate' }).click();

		// Wait for authentication to complete and show success message
		await expect(page.getByText('Successfully authenticated with Withings!')).toBeVisible({
			timeout: 10000
		});

		// Verify the button shows authenticated state
		await expect(page.getByRole('button', { name: '✓ Authenticated' })).toBeVisible();
	});

	test('should show error state when authentication API fails', async ({ page }) => {
		// Intercept the auth status check to return not authenticated
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

		// Mock has existing data check - needed by AuthSection component
		await page.route('/api/import/has-data', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: false })
			});
		});

		// Intercept the auth API call to return an error
		await page.route('/api/auth/authenticate', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					message: 'Authentication failed'
				})
			});
		});

		// Now navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for the page to load
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();

		// Click the authenticate button
		await page.getByRole('button', { name: 'Authenticate' }).click();

		// Should show error message
		await expect(page.getByText('Authentication failed')).toBeVisible({
			timeout: 5000
		});
	});

	test('should maintain responsive design on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to the page after setting up all mocks
		await page.goto('/');

		// Wait for the loading state to complete
		await page.waitForSelector('.tab-content', { timeout: 10000 });

		// Check that the layout still works
		await expect(page.getByRole('heading', { name: 'Body Composition Tracker' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Data Import' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();

		// Tab navigation should still work
		await page.getByRole('tab', { name: 'Raw Data' }).click();
		await expect(page.getByRole('heading', { name: 'Raw Data' })).toBeVisible();
	});
});
