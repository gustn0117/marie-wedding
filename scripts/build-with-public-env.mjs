import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const secretPath = process.argv[2];

if (!secretPath) {
  console.error('Build environment secret path is required.');
  process.exit(1);
}

let source;
try {
  source = readFileSync(secretPath, 'utf8');
} catch {
  console.error('Unable to read the BuildKit environment secret.');
  process.exit(1);
}

const publicEnvironment = {};

for (const rawLine of source.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const match = line.match(/^(?:export\s+)?(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!match) continue;

  const [, key, rawValue] = match;
  let value = rawValue.trim();

  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, '').trim();
  }

  publicEnvironment[key] = value;
}

if (Object.keys(publicEnvironment).length === 0) {
  console.error('The build secret does not contain any NEXT_PUBLIC_* variables.');
  process.exit(1);
}

// The secret file is never sourced. Only explicitly matched public variables are
// copied into the Next.js build child process.
const result = spawnSync('npm', ['run', 'build'], {
  env: { ...process.env, ...publicEnvironment },
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to start the build: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
