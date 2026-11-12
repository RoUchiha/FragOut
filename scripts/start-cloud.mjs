import {spawn} from 'node:child_process';
import {DatabaseUnavailable,openConfiguredDatabase} from '../src/lib/database.ts';

async function verifyStorage() {
  if (!process.env.FRAGOUT_DATABASE_URL?.trim()) {
    throw new Error('Set FRAGOUT_DATABASE_URL in the server environment.');
  }
  const db = openConfiguredDatabase();
  try {
    const status = await db.get(
      'SELECT current_user AS role, current_schema() AS schema, (SELECT version FROM schema_migrations WHERE version = 1) AS version'
    );
    if (status?.role !== 'fragout_app' || status?.schema !== 'fragout' || status?.version !== 1) {
      throw new Error('Use the FragOut database role and apply the cloud migration first.');
    }
  } finally {
    await db.close();
  }
}

try {
  await verifyStorage();
  console.log('FragOut connected to its private cloud database over TLS.');
  if (!process.argv.includes('--check')) {
    const origin = new URL(process.env.FRAGOUT_PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || '');
    if (origin.protocol !== 'https:' || origin.username || origin.password ||
        origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('Set FRAGOUT_PUBLIC_ORIGIN to the public HTTPS origin.');
    }
    const port = Number(process.env.PORT ?? 10000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Set PORT to a valid port.');

    const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', String(port)], {
      stdio: 'inherit',
      windowsHide: true,
      env: {...process.env, FRAGOUT_PUBLIC_ORIGIN: origin.origin},
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => next.kill(signal));
    process.exitCode = await new Promise((resolve, reject) => {
      next.once('error', reject);
      next.once('exit', code => resolve(code ?? 1));
    });
  }
} catch (error) {
  console.error(error instanceof DatabaseUnavailable
    ? 'Cloud database connection failed. Check the session pooler URL, role, and vault key in docs/CLOUD.md.'
    : error.message);
  process.exitCode = 1;
}
