import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForToken } from '$lib/server/withings-auth.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { code, state } = await request.json();
		
		if (!code || !state) {
			return json({
				success: false,
				message: 'Missing authorization code or state parameter'
			}, { status: 400 });
		}

		const token = await exchangeCodeForToken(code, state);
		
		return json({
			success: true,
			message: 'Successfully authenticated with Withings!',
			authenticated: true
		});
	} catch (error) {
		console.error('OAuth callback failed:', error);
		
		return json({
			success: false,
			message: error instanceof Error ? error.message : 'Authentication failed'
		}, { status: 400 });
	}
}; 