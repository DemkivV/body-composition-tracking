import { test, expect } from '@playwright/test';

// Isolated mock setup functions to prevent race conditions and production file access
async function setupBaseMocks(page) {
	// IMPORTANT: Catch-all must come FIRST to prevent production access
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.log(`[TEST] Catch-all intercepted in auth.spec.ts: ${method} ${url}`);
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

	// Cycle data endpoints
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
							Comments: 'Test entry 1A'
						},
						{
							id: 2,
							Date: '2024-01-14 10:30:00',
							'Weight (kg)': '75.8',
							'Fat mass (kg)': '15.4',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.9',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 2A'
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

async function setupAuthenticatedMocks(page) {
	// IMPORTANT: Catch-all must come FIRST to prevent production access
	await page.route('**/api/**', async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		console.log(`[TEST] Catch-all intercepted in setupAuthenticatedMocks auth.spec.ts: ${method} ${url}`);
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

	// Cycle data endpoints
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
							Comments: 'Test entry 1A'
						},
						{
							id: 2,
							Date: '2024-01-14 10:30:00',
							'Weight (kg)': '75.8',
							'Fat mass (kg)': '15.4',
							'Bone mass (kg)': '3.1',
							'Muscle mass (kg)': '32.9',
							'Hydration (kg)': '24.4',
							Comments: 'Test entry 2A'
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

async function setupFailureMocks(page) {
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

	// Mock auth status failure
	await page.route('/api/auth/status', async (route) => {
		await route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Server error'
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

	// Always mock /api/data/raw
	await page.route('**/api/data/raw', async (route) => {
		await route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: 'Server error (test mode)'
			})
		});
	});
}

// Utility function to navigate and wait for page readiness
async function navigateAndWaitForTab(page) {
	await page.goto('/');
	await page.waitForSelector('.tab-content', { timeout: 10000 });
}

test.describe('Authentication Flow', () => {
	test('should display the main page with correct elements', async ({ page }) => {
		await setupBaseMocks(page);
		await navigateAndWaitForTab(page);

		// Check page title - updated for new routing structure
		await expect(page).toHaveTitle('Body Comp Data - Body Composition Tracker');

		// Check main heading
		await expect(page.getByRole('heading', { name: 'Body Composition Tracker' })).toBeVisible();

		// Check tab navigation - these should be visible once configured
		await expect(page.getByRole('tab', { name: 'Body Comp Data' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Cycle Data' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Analysis' })).toBeVisible();

		// Check that Body Comp Data tab is active by default
		await expect(page.getByRole('tab', { name: 'Body Comp Data' })).toHaveClass(/active/);
	});

	test('should display authentication section in Body Comp Data tab', async ({ page }) => {
		await setupBaseMocks(page);
		await navigateAndWaitForTab(page);

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
		await setupBaseMocks(page);
		await navigateAndWaitForTab(page);

		// Verify we're on the body-comp-data page initially
		await expect(page).toHaveURL('/body-comp-data');

		// Click on Cycle Data tab
		await page.getByRole('tab', { name: 'Cycle Data' }).click();
		await expect(page).toHaveURL('/cycle-data');
		await expect(page.getByRole('heading', { name: 'Cycle Data' })).toBeVisible();
		await expect(page.locator('.data-container')).toBeVisible();

		// Click on Analysis tab
		await page.getByRole('tab', { name: 'Analysis' }).click();
		await expect(page).toHaveURL('/analysis');
		// Wait for charts to load and be visible
		await expect(page.locator('.chart-container').first()).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.chart').first()).toBeVisible();

		// Navigate back to Body Comp Data
		await page.getByRole('tab', { name: 'Body Comp Data' }).click();
		await expect(page).toHaveURL('/body-comp-data');
		// Verify we're back on the body comp data page by checking for authentication button
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();
	});

	test('should show popup blocked error when window.open fails', async ({ page }) => {
		await setupBaseMocks(page);

		// Mock authentication request
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

		// Override window.open to return null (simulating popup blocker)
		await page.addInitScript(() => {
			window.open = () => null;
		});

		await navigateAndWaitForTab(page);

		// Click authenticate button
		const authButton = page.getByRole('button', { name: 'Authenticate' });
		await authButton.click();

		// Check for popup blocked error - use actual error message
		await expect(page.locator('.feedback.error')).toContainText(
			'Failed to open authentication window. Please check if popups are blocked.'
		);
	});

	test('should handle successful authentication flow', async ({ page }) => {
		await setupBaseMocks(page);

		// Mock authentication request
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

		// Override window.open to prevent actual popup
		await page.addInitScript(() => {
			window.open = () => {
				const mockWindow = {
					closed: false,
					close: function () {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this as any).closed = true;
					},
					focus: () => {}
				};

				setTimeout(() => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(mockWindow as any).closed = true;
				}, 500);

				return mockWindow as Window;
			};
		});

		// Mock progressive auth status responses
		let authStatusCalls = 0;
		await page.route('/api/auth/status', async (route) => {
			authStatusCalls++;
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
		const authButton = page.getByRole('button', { name: 'Authenticate' });
		await authButton.click();

		// Wait for authentication to complete
		await expect(page.getByRole('button', { name: '✓ Authenticated' })).toBeVisible({
			timeout: 10000
		});
		await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
		await expect(page.locator('.feedback')).toContainText(
			'Successfully authenticated with Withings'
		);

		// Check that import button is now enabled
		const importButton = page.getByRole('button', { name: 'Import Data' });
		await expect(importButton).toBeEnabled();
	});

	test('should show error state when authentication API fails', async ({ page }) => {
		await setupFailureMocks(page);
		await navigateAndWaitForTab(page);

		// The auth section is now in the first data container of the Body Comp Data tab
		const tabContent = page.locator('.tab-content');
		const pageDataContainers = tabContent.locator('> .data-container');
		await expect(pageDataContainers).toHaveCount(2, { timeout: 10000 });
		const authSection = pageDataContainers.nth(0);

		// Check that error state is displayed for API failure - use actual error message
		await expect(authSection.locator('.feedback.error')).toBeVisible();
		await expect(authSection.locator('.feedback')).toContainText('Failed to check authentication status');
	});

	test('should handle authentication API error gracefully', async ({ page }) => {
		await setupBaseMocks(page);

		// Mock authentication request failure
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
		const authButton = page.getByRole('button', { name: 'Authenticate' });
		await authButton.click();

		// Check for authentication error - use actual error message
		await expect(page.locator('.feedback.error')).toContainText('Failed to get authorization URL');
	});

	test('should handle logout correctly', async ({ page }) => {
		await setupAuthenticatedMocks(page);

		// Mock logout request
		await page.route('/api/auth/logout', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					message: 'Successfully logged out'
				})
			});
		});

		// Mock auth status to return unauthenticated after logout
		let logoutCalled = false;
		await page.route('/api/auth/status', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					authenticated: !logoutCalled,
					user: logoutCalled ? null : { userId: 'test-user-123' }
				})
			});
		});

		await navigateAndWaitForTab(page);

		// Should show authenticated state initially
		await expect(page.getByRole('button', { name: '✓ Authenticated' })).toBeVisible();

		// Click logout button
		const logoutButton = page.getByRole('button', { name: 'Logout' });
		logoutCalled = true;
		await logoutButton.click();

		// Should return to unauthenticated state
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();
		await expect(page.locator('.feedback')).toContainText('Not authenticated yet');
	});

	test('should maintain responsive design on mobile viewport', async ({ page }) => {
		await setupBaseMocks(page);

		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await navigateAndWaitForTab(page);

		// Check that main elements are visible on mobile
		await expect(page.getByRole('heading', { name: 'Body Composition Tracker' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Body Comp Data' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Authenticate' })).toBeVisible();

		// Check that tab navigation works on mobile
		await page.getByRole('tab', { name: 'Cycle Data' }).click();
		const tabContent = page.locator('.tab-content');
		await expect(tabContent.locator('.data-container').first()).toBeVisible();
	});
});
