import { json } from '@sveltejs/kit';
import { importService } from '../../../lib/services/import.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async () => {
	try {
		const result = await importService.importData();
		return json(result);
	} catch (error) {
		console.error('Import API error:', error);
		return json(
			{
				success: false,
				message: 'Internal server error during import'
			},
			{ status: 500 }
		);
	}
};
