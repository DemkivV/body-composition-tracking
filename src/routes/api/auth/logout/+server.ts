import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearAuthentication } from '$lib/server/withings-auth.js';

export const POST: RequestHandler = async () => {
	try {
		await clearAuthentication();

		return json({
			success: true,
			message: 'Successfully logged out'
		});
	} catch (error) {
		console.error('Failed to logout:', error);

		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Logout failed'
			},
			{ status: 500 }
		);
	}
};
