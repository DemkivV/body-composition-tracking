import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAuthUrl } from '$lib/server/withings-auth.js';

export const GET: RequestHandler = async () => {
	try {
		const { authUrl, state } = await generateAuthUrl();
		
		return json({
			success: true,
			authUrl,
			state
		});
	} catch (error) {
		console.error('Failed to generate auth URL:', error);
		
		return json({
			success: false,
			message: error instanceof Error ? error.message : 'Failed to generate authorization URL'
		}, { status: 500 });
	}
}; 