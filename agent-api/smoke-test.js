const path = require('path');
const { spawnSync } = require('child_process');

const child = spawnSync(process.execPath, [path.join(__dirname, 'vugg-agent.js')], {
  input: `${JSON.stringify({ cmd: 'help' })}\n`,
  encoding: 'utf8',
  timeout: 10000,
  windowsHide: true,
});

if (child.error) throw child.error;
if (child.status !== 0) {
  throw new Error(`agent CLI exited ${child.status}: ${child.stderr || child.stdout}`);
}
const lines = child.stdout.trim().split(/\r?\n/).filter(Boolean);
if (lines.length !== 1) throw new Error(`expected one JSON response, received ${lines.length}`);
const response = JSON.parse(lines[0]);
if (response.ok !== true || !response.commands?.start || !response.commands?.finish) {
  throw new Error(`invalid help response: ${child.stdout}`);
}
console.log('agent-api smoke: PASS');
