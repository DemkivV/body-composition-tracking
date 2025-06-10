import { execSync } from 'child_process';
import path from 'path';

function setup() {
	const projectRoot = process.cwd();
	const testScript = path.join(projectRoot, 'scripts', 'run-tests.js');
	execSync(`node ${testScript}`, { stdio: 'inherit' });
}

export default setup;
