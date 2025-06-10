import { promises as fs } from 'fs';

async function globalTeardown() {
	try {
		await fs.rm('test-results/temp-data', { recursive: true, force: true });
		console.log('[GLOBAL-TEARDOWN] Cleaned up test data directory');
	} catch (error) {
		console.log('[GLOBAL-TEARDOWN] Cleanup note:', error.message);
	}
}

export default globalTeardown;
