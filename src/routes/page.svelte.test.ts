import { describe, test, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/svelte';

// Mock the navigation module
vi.mock('$app/navigation', () => {
	const mockGoto = vi.fn();
	return {
		goto: mockGoto
	};
});

import Page from './+page.svelte';
import { goto } from '$app/navigation';

describe('/+page.svelte', () => {
	test('should redirect to body-comp-data', () => {
		render(Page);
		expect(goto).toHaveBeenCalledWith('/body-comp-data', { replaceState: true });
	});
});
