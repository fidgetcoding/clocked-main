#!/usr/bin/env node
// Runs the real-backend tests: a throwaway local Supabase stack with a random project_id, a real
// `db push`, locally served edge functions against a fake AI provider, and a real browser. It
// never touches hosted Supabase and removes everything it created when it finishes.
//
//   npm run test:stack
//
// Needs Docker and the Supabase CLI. SUPABASE_BIN overrides the CLI path, and DOCKER_HOST is
// honoured for anyone running Docker somewhere other than the default socket.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WORK = join(ROOT, '.stack-test');
const STACK = join(WORK, 'stack');
const SUPABASE = process.env.SUPABASE_BIN || 'supabase';
const PROJECT_ID = `clocked-test-${randomBytes(4).toString('hex')}`;
const NETWORK = `supabase_network_${PROJECT_ID}`;
const FAKE_AI = `${PROJECT_ID}-fake-ai`;
// STACK_PORT_OFFSET moves every port, so that two runs on one machine can't reach each other's stack
const PORT_OFFSET = Number(process.env.STACK_PORT_OFFSET || 0);
const port = (value) => String(value + PORT_OFFSET);
const FAKE_AI_PORT = port(57399);
const APP_PORT = port(57337);
const NO_BACKEND_PORT = port(57338);
const PROD_PORT = port(57339);
const PROD_NO_BACKEND_PORT = port(57340);
const AI_BASE_URL = `http://${FAKE_AI}:8080/v1/`;

const background = [];
const results = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  return result;
}

function step(name, fn) {
  console.log(`\n=== ${name}`);
  return fn();
}

async function waitFor(check, label, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const reachable = (url) => () => fetch(url).then(() => true, () => false);

function startBackground(command, args, options = {}) {
  const child = spawn(command, args, { cwd: ROOT, stdio: 'ignore', detached: true, ...options });
  background.push(child);
  return child;
}

function stopBackground(child) {
  if (child.exitCode !== null) return;
  try {
    process.kill(-child.pid);
  } catch {
    child.kill();
  }
}

async function serveFunctions(envFile, logName) {
  const log = join(WORK, logName);
  writeFileSync(log, '');
  const { openSync } = await import('node:fs');
  const out = openSync(log, 'a');
  const child = startBackground(SUPABASE, ['functions', 'serve', '--workdir', STACK, '--env-file', envFile], {
    stdio: ['ignore', out, out],
  });
  await waitFor(() => readFileSync(log, 'utf8').includes('Serving functions'), 'functions to serve');
  await new Promise((done) => setTimeout(done, 2000));
  return child;
}

function vitest(file, env) {
  run('npx', ['vitest', 'run', '--config', 'vitest.stack.config.ts', file], { env: { ...process.env, ...env } });
}

function readStackEnv() {
  const output = execFileSync(SUPABASE, ['status', '-o', 'env', '--workdir', STACK], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const values = {};
  for (const line of output.split('\n')) {
    const at = line.indexOf('=');
    if (at > 0) values[line.slice(0, at)] = line.slice(at + 1).replace(/^"|"$/g, '');
  }
  return values;
}

function teardown() {
  console.log('\n=== Teardown');
  background.forEach(stopBackground);
  spawnSync('docker', ['rm', '-f', FAKE_AI], { stdio: 'ignore' });
  spawnSync(SUPABASE, ['stop', '--no-backup', '--workdir', STACK], { stdio: 'ignore' });
  const left = spawnSync('docker', ['volume', 'ls', '-q', '--filter', `name=${PROJECT_ID}`], { encoding: 'utf8' }).stdout.trim();
  console.log(left ? `Left behind: ${left}` : `Removed ${PROJECT_ID}: no containers or volumes left.`);
  rmSync(WORK, { recursive: true, force: true });
}

async function main() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(join(STACK, 'supabase/migrations'), { recursive: true });

  writeFileSync(
    join(STACK, 'supabase/config.toml'),
    readFileSync(join(ROOT, 'tests/stack/config.toml'), 'utf8')
      .replace('__PROJECT_ID__', PROJECT_ID)
      .replace(/\b57\d{3}\b/g, (value) => port(Number(value))),
  );
  cpSync(join(ROOT, 'supabase/functions'), join(STACK, 'supabase/functions'), { recursive: true });
  cpSync(join(ROOT, 'tests/stack/env-probe'), join(STACK, 'supabase/functions/env-probe'), { recursive: true });

  step(`Start an empty stack (${PROJECT_ID})`, () => run(SUPABASE, ['start', '--workdir', STACK]));

  step('Apply every migration with a real db push', () => {
    cpSync(join(ROOT, 'supabase/migrations'), join(STACK, 'supabase/migrations'), { recursive: true });
    run(SUPABASE, ['db', 'push', '--local', '--yes', '--workdir', STACK]);
  });

  const stack = readStackEnv();
  const testEnv = {
    STACK_API_URL: stack.API_URL,
    STACK_ANON_KEY: stack.ANON_KEY,
    STACK_PUBLISHABLE_KEY: stack.PUBLISHABLE_KEY,
    STACK_SERVICE_ROLE_KEY: stack.SERVICE_ROLE_KEY,
    STACK_MAIL_URL: stack.MAILPIT_URL || stack.INBUCKET_URL,
    STACK_FAKE_AI_URL: `http://127.0.0.1:${FAKE_AI_PORT}`,
    STACK_APP_URL: `http://127.0.0.1:${APP_PORT}`,
    STACK_NO_BACKEND_URL: `http://127.0.0.1:${NO_BACKEND_PORT}`,
    STACK_PROD_URL: `http://127.0.0.1:${PROD_PORT}`,
    STACK_PROD_NO_BACKEND_URL: `http://127.0.0.1:${PROD_NO_BACKEND_PORT}`,
  };

  writeFileSync(join(WORK, 'test-env.json'), JSON.stringify({ ...testEnv, PROJECT_ID, FAKE_AI }));

  step('Database, policies and storage', () => vitest('tests/stack/database.test.ts', testEnv));

  step('Start the fake AI provider', () => {
    run('docker', [
      'run', '-d', '--name', FAKE_AI, '--network', NETWORK,
      '-p', `127.0.0.1:${FAKE_AI_PORT}:8080`,
      '-v', `${join(ROOT, 'tests/stack/fake-ai.mjs')}:/fake-ai.mjs:ro`,
      'node:22-alpine', 'node', '/fake-ai.mjs',
    ]);
  });
  await waitFor(reachable(`${testEnv.STACK_FAKE_AI_URL}/requests`), 'the fake AI provider');

  const noKeyEnv = join(WORK, 'functions-no-key.env');
  writeFileSync(noKeyEnv, `AI_BASE_URL=${AI_BASE_URL}\n`);
  const noKey = await serveFunctions(noKeyEnv, 'functions-no-key.log');
  step('Edge functions with no AI key', () => vitest('tests/stack/functions-no-key.test.ts', testEnv));
  stopBackground(noKey);
  await new Promise((done) => setTimeout(done, 2000));

  const withKeyEnv = join(WORK, 'functions-with-key.env');
  writeFileSync(withKeyEnv, `AI_API_KEY=fake-key-not-real\nAI_BASE_URL=${AI_BASE_URL}\nAI_MODEL=fake-model\nAI_TIMEOUT_MS=3000\n`);
  await serveFunctions(withKeyEnv, 'functions-with-key.log');
  step('Edge functions with fake AI credentials', () => vitest('tests/stack/functions.test.ts', testEnv));

  step('Build the app, connected and with no backend', () => {
    run('npx', ['vite', 'build', '--outDir', join(WORK, 'dist-backend'), '--emptyOutDir'], {
      env: { ...process.env, VITE_E2E_POSE_FEED: '1', VITE_SUPABASE_URL: stack.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: stack.PUBLISHABLE_KEY },
    });
    const noBackendEnv = { ...process.env, VITE_E2E_POSE_FEED: '1' };
    delete noBackendEnv.VITE_SUPABASE_URL;
    delete noBackendEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
    run('npx', ['vite', 'build', '--outDir', join(WORK, 'dist-no-backend'), '--emptyOutDir'], { env: noBackendEnv });
    // What Vercel builds, with no test switches, for tests/e2e/walkthrough.spec.ts
    const prodEnv = { ...noBackendEnv };
    delete prodEnv.VITE_E2E_POSE_FEED;
    run('npx', ['vite', 'build', '--outDir', join(WORK, 'dist-prod-no-backend'), '--emptyOutDir'], { env: prodEnv });
    run('npx', ['vite', 'build', '--outDir', join(WORK, 'dist-prod'), '--emptyOutDir'], {
      env: { ...prodEnv, VITE_SUPABASE_URL: stack.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: stack.PUBLISHABLE_KEY },
    });
  });

  startBackground('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', APP_PORT, '--strictPort', '--outDir', join(WORK, 'dist-backend')]);
  startBackground('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', NO_BACKEND_PORT, '--strictPort', '--outDir', join(WORK, 'dist-no-backend')]);
  startBackground('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', PROD_PORT, '--strictPort', '--outDir', join(WORK, 'dist-prod')]);
  startBackground('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', PROD_NO_BACKEND_PORT, '--strictPort', '--outDir', join(WORK, 'dist-prod-no-backend')]);
  await waitFor(reachable(testEnv.STACK_PROD_URL), 'the production build');
  await waitFor(reachable(testEnv.STACK_PROD_NO_BACKEND_URL), 'the no-backend production build');
  await waitFor(reachable(testEnv.STACK_APP_URL), 'the connected app');
  await waitFor(reachable(testEnv.STACK_NO_BACKEND_URL), 'the no-backend app');

  step('Real browser, including clicking the real email link', () => {
    run('npx', ['playwright', 'test', ...process.argv.slice(2)], { env: { ...process.env, ...testEnv } });
  });
}

const KEEP = process.env.STACK_KEEP === '1';
let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(`\n${error.message}`);
  const log = join(WORK, 'functions-with-key.log');
  if (existsSync(log)) console.error(readFileSync(log, 'utf8').split('\n').slice(-30).join('\n'));
} finally {
  // STACK_KEEP=1 leaves everything running so you can rerun one test file against it
  if (!KEEP) teardown();
}
console.log(failed ? '\nStack tests failed.' : '\nStack tests passed.');
process.exit(failed ? 1 : 0);
