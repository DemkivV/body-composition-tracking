import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setWithingsCredentials, hasWithingsCredentials } from '$lib/server/config.js';

export const GET: RequestHandler = async () => {
	try {
		const hasCredentials = await hasWithingsCredentials();

		return json({
			success: true,
			configured: hasCredentials
		});
	} catch (error) {
		console.error('Failed to check configuration status:', error);

		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Failed to check configuration status'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { clientId, clientSecret, redirectUri } = await request.json();

		if (!clientId || !clientSecret) {
			return json(
				{
					success: false,
					message: 'Client ID and Client Secret are required'
				},
				{ status: 400 }
			);
		}

		await setWithingsCredentials(clientId, clientSecret, redirectUri);

		return json({
			success: true,
			message: 'Withings API credentials configured successfully'
		});
	} catch (error) {
		console.error('Failed to configure credentials:', error);

		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Failed to configure credentials'
			},
			{ status: 500 }
		);
	}
};
