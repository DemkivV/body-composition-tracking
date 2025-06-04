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
	test('should redirect to data-import', () => {
		render(Page);
		expect(goto).toHaveBeenCalledWith('/data-import', { replaceState: true });
	});
});
