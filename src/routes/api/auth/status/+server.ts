import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthenticated } from '$lib/server/withings-auth.js';

export const GET: RequestHandler = async () => {
	try {
		const authenticated = await isAuthenticated();
		
		return json({
			success: true,
			authenticated
		});
	} catch (error) {
		console.error('Failed to check auth status:', error);
		
		return json({
			success: false,
			authenticated: false,
			message: error instanceof Error ? error.message : 'Failed to check authentication status'
		}, { status: 500 });
	}
}; 