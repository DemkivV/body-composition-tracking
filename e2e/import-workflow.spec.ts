import { test, expect } from '@playwright/test';

// Isolated mock setup functions to prevent race conditions
async function setupBaseMocks(page) {
	// IMPORTANT: Catch-all must come FIRST to prevent production access
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.log(`[TEST] Catch-all intercepted in setupBaseMocks: ${method} ${url}`);
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
				authenticated: false,
				user: null
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
							Comments: 'Test entry 1B'
						},
						{
							id: 2,
							Date: '2024-01-14 10:30:00',
							'Weight (kg)': '75.8',
							'Fat mass (kg)': '15.4',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.9',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 2B'
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

async function setupAuthenticatedMocks(page) {
	// IMPORTANT: Catch-all must come FIRST to prevent production access
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.log(`[TEST] Catch-all intercepted in setupAuthenticatedMocks: ${method} ${url}`);
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
				authenticated: true,
				user: { userId: 'test-user-123' }
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

	// Always mock /api/data/raw
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
							Comments: 'Test entry 1B'
						},
						{
							id: 2,
							Date: '2024-01-14 10:30:00',
							'Weight (kg)': '75.8',
							'Fat mass (kg)': '15.4',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.9',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 2B'
						}
					]
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

async function setupAuthenticatedWithDataMocks(page) {
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

	// Mock authenticated state
	await page.route('/api/auth/status', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				authenticated: true,
				user: { userId: 'test-user-123' }
			})
		});
	});

	// Mock has existing data check - has data
	await page.route('/api/import/has-data', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ hasData: true })
		});
	});

	// Always mock /api/data/raw
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
							Comments: 'Test entry 1B'
						},
						{
							id: 2,
							Date: '2024-01-14 10:30:00',
							'Weight (kg)': '75.8',
							'Fat mass (kg)': '15.4',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.9',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 2B'
						}
					]
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

async function setupUnconfiguredMocks(page) {
	// Mock configuration check - not configured
	await page.route('/api/auth/configure', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				configured: false
			})
		});
	});

	// Always mock other routes even in unconfigured state
	await page.route('/api/auth/status', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				authenticated: false,
				user: null
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

	await page.route('**/api/data/raw', async (route) => {
		await route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'App not configured (test mode)'
			})
		});
	});
}

// Utility function to navigate and wait for page readiness
async function navigateAndWaitForTab(page) {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
}

test.describe('Import Workflow', () => {
	test('should display initial unauthenticated state correctly', async ({ page }) => {
		await setupBaseMocks(page);
		await navigateAndWaitForTab(page);

		// Check that page loads correctly
		await expect(page.locator('h1')).toContainText('Body Composition Tracker');

		// Check that body comp data tab is active by default
		await expect(page.locator('[data-tab="body-comp-data"]')).toHaveClass(/active/);

		// Check that data source is set to Withings
		await expect(page.locator('#data-source')).toHaveValue('withings');

		// Check that authenticate button is visible and enabled
		const authButton = page.locator('button:has-text("Authenticate")').first();
		await expect(authButton).toBeVisible();
		await expect(authButton).toBeEnabled();

		// Check that import button is disabled when not authenticated
		const importButton = page.locator('button:has-text("Import Data")');
		await expect(importButton).toBeVisible();
		await expect(importButton).toBeDisabled();

		// Check status message
		await expect(page.locator('.feedback')).toContainText('Not authenticated yet');
	});

	test('should handle authentication flow correctly', async ({ page }) => {
		await setupBaseMocks(page);

		// Mock authentication request - simulate the auth service response
		await page.route('/api/auth/authenticate', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					authUrl: 'https://auth.withings.com/oauth2/authorize?...'
				})
			});
		});

		// Override window.open to prevent actual popup and immediately simulate success
		await page.addInitScript(() => {
			window.open = () => {
				// Create a mock window object with a mutable closed state
				const mockWindow = {
					closed: false,
					close: function () {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this as any).closed = true;
					},
					focus: () => {}
				};

				// Simulate successful authentication without delay for test reliability
				setTimeout(() => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(mockWindow as any).closed = true;
				}, 500);

				return mockWindow as Window;
			};
		});

		// Mock the auth status to return authenticated after a few calls
		let authStatusCalls = 0;
		await page.route('/api/auth/status', async (route) => {
			authStatusCalls++;
			// Return authenticated after second call
			const authenticated = authStatusCalls > 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					authenticated,
					user: authenticated ? { userId: 'test-user-123' } : null
				})
			});
		});

		await navigateAndWaitForTab(page);

		// Click authenticate button
		const authButton = page.locator('button:has-text("Authenticate")').first();
		await authButton.click();

		// Focus on the end result: successful authentication
		// The intermediate states may be too transient to reliably test
		await expect(page.locator('button:has-text("✓ Authenticated")')).toBeVisible({
			timeout: 10000
		});
		await expect(page.locator('button:has-text("Logout")')).toBeVisible();
		await expect(page.locator('.feedback')).toContainText(
			'Successfully authenticated with Withings'
		);

		// Check that import button is now enabled
		const importButton = page.locator('button:has-text("Import Data")');
		await expect(importButton).toBeEnabled();
	});

	test('should handle successful data import', async ({ page }) => {
		await setupAuthenticatedMocks(page);

		// Mock successful import
		await page.route('/api/import/intelligent', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					importType: 'full',
					recordsProcessed: 25,
					newRecords: 25,
					message:
						'Successfully imported 25 body composition measurements from your Withings account.'
				})
			});
		});

		// Mock updated has data check after import
		let hasDataCalls = 0;
		await page.route('/api/import/has-data', async (route) => {
			hasDataCalls++;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hasData: hasDataCalls > 1 }) // Return true after first call
			});
		});

		await navigateAndWaitForTab(page);

		// Wait for the authenticated state to be reflected in UI
		await expect(page.locator('button:has-text("✓ Authenticated")')).toBeVisible();

		// Click import button
		const importButton = page.locator('button:has-text("Import Data")');
		await expect(importButton).toBeEnabled();
		await importButton.click();

		// Check importing state - the button might be disabled briefly or change to "Update Data"
		// Since the mock completes quickly, we'll check for the end result

		// Wait for import to complete
		await expect(page.locator('.feedback.authenticated')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.feedback')).toContainText(
			'Successfully imported 25 body composition measurements'
		);

		// Button should change to "Update Data" after successful import
		await expect(page.locator('button:has-text("Update Data")')).toBeVisible();
	});

	test('should handle data import errors correctly', async ({ page }) => {
		await setupAuthenticatedMocks(page);

		// Mock import error (matches the actual error message format)
		await page.route('/api/import/intelligent', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Failed to fetch data from Withings API',
					message: 'Error: Failed to fetch data from Withings API'
				})
			});
		});

		await navigateAndWaitForTab(page);

		// Wait for the authenticated state to be reflected in UI
		await expect(page.locator('button:has-text("✓ Authenticated")')).toBeVisible();

		// Click import button
		const importButton = page.locator('button:has-text("Import Data")');
		await expect(importButton).toBeEnabled();
		await importButton.click();

		// Wait for error to appear (matches the actual error format from import-client.ts)
		await expect(page.locator('.feedback.error')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.feedback')).toContainText('HTTP error! status: 500');

		// Import button should be enabled again after error
		await expect(page.locator('button:has-text("Import Data")')).toBeEnabled();
	});

	test('should display correct button text based on data existence', async ({ page }) => {
		await setupAuthenticatedWithDataMocks(page);
		await navigateAndWaitForTab(page);

		// Wait for authenticated state and data existence check
		await expect(page.locator('button:has-text("✓ Authenticated")')).toBeVisible();

		// When data exists, button should say "Update Data"
		await expect(page.locator('button:has-text("Update Data")')).toBeVisible();
	});

	test('should navigate between tabs correctly', async ({ page }) => {
		await setupBaseMocks(page);
		await navigateAndWaitForTab(page);

		// Click on cycle data tab
		await page.locator('[data-tab="cycle-data"]').click();

		// Check that cycle data content is shown
		await expect(page.locator('h2:has-text("Cycle Data")')).toBeVisible();
		await expect(page.locator('.data-container')).toBeVisible();

		// Click on analysis tab
		await page.locator('[data-tab="analysis"]').click();

		// Check that analysis content is shown - wait for charts to load
		await expect(page.locator('.chart-container').first()).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.chart').first()).toBeVisible();

		// Go back to body comp data tab
		await page.locator('[data-tab="body-comp-data"]').click();

		// Check that import section is shown again
		await expect(page.locator('#data-source')).toBeVisible();
		await expect(page.locator('button:has-text("Authenticate")')).toBeVisible();
	});

	test('should handle unconfigured app state', async ({ page }) => {
		await setupUnconfiguredMocks(page);
		await navigateAndWaitForTab(page);

		// Should show configuration section instead of tabs
		await expect(page.locator('h2:has-text("Withings API Configuration")')).toBeVisible();

		// Tabs should not be visible
		await expect(page.locator('[data-tab="body-comp-data"]')).not.toBeVisible();
	});

	test('should handle authentication errors gracefully', async ({ page }) => {
		await setupBaseMocks(page);

		// Mock authentication error
		await page.route('/api/auth/authenticate', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Authentication service unavailable'
				})
			});
		});

		await navigateAndWaitForTab(page);

		// Click authenticate button
		const authButton = page.locator('button:has-text("Authenticate")').first();
		await authButton.click();

		// Check for authentication error - use actual error message
		await expect(page.locator('.feedback.error')).toContainText('Failed to get authorization URL');
	});
});
