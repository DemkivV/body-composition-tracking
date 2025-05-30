import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importService } from '../../../../lib/services/import.js';

export const GET: RequestHandler = async () => {
	try {
		const hasData = await importService.hasExistingData();
		
		return json({
			hasData
		});
	} catch (error) {
		console.error('Error checking existing data:', error);
		
		return json({
			hasData: false
		}, { status: 500 });
	}
}; 