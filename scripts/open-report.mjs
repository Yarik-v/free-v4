// Cross-platform `npm run report`: opens test-results/latest.html with whatever
// the OS uses to open a file by default (macOS `open`, Windows `start`, else `xdg-open`).
import { spawn } from 'node:child_process';

const path = 'test-results/latest.html';
const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
const args = process.platform === 'win32' ? ['', path] : [path];

spawn(command, args, { shell: process.platform === 'win32', stdio: 'ignore', detached: true }).unref();
