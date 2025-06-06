import { beforeEach } from 'vitest';
import { mockDataWriter } from './src/lib/utils/test-data-writer.js';

// Clear mock state before each test for any tests using the data writer mock
beforeEach(() => {
	mockDataWriter.clear();
});
