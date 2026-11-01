import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const specs = readdirSync('tests/e2e').filter((file) => file.endsWith('.spec.ts'));

describe('browser tests stay silent', () => {
  it.each(specs)('%s gets its test from silent.ts', (file) => {
    const source = readFileSync(`tests/e2e/${file}`, 'utf8');
    expect(source).toMatch(/from ["']\.\/silent["']/);
    expect(source).not.toMatch(/import[^;]*\btest\b[^;]*from ["']@playwright\/test["']/);
    expect(source).not.toMatch(/\b(chromium|firefox|webkit)\.launch/);
  });

  it('the config launches every engine muted and headless', () => {
    const config = readFileSync('playwright.config.ts', 'utf8');
    const silent = readFileSync('tests/e2e/silent.ts', 'utf8');
    expect(config).toContain('silentLaunch');
    expect(silent).toContain('--mute-audio');
    expect(silent).toContain('"media.volume_scale": "0.0"');
    expect(silent.match(/headless: true/g)).toHaveLength(3);
  });
});
