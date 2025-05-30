import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAuthUrl } from '$lib/server/withings-auth.js';

export const POST: RequestHandler = async () => {
	try {
		const { authUrl, state } = await generateAuthUrl();
		
		return json({
			success: true,
			message: 'Authorization URL generated successfully',
			authUrl,
			state
		});
	} catch (error) {
		console.error('Failed to start authentication:', error);
		
		return json({
			success: false,
			message: error instanceof Error ? error.message : 'Failed to start authentication'
		}, { status: 500 });
	}
}; 