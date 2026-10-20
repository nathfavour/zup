import { describe, test, expect } from 'bun:test';
import { CliEngine } from './engine';

describe('@zup/cli Terminal Engine Protocol Primitives', () => {
  test('zup help returns command reference listing', async () => {
    const lines = await CliEngine.execute('zup help');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].text).toContain('--- zup CLI Commands Reference ---');
    expect(lines.some((l) => l.text.includes('zup identity list'))).toBe(true);
    expect(lines.some((l) => l.text.includes('zup stats'))).toBe(true);
  });

  test('unknown command returns error message', async () => {
    const lines = await CliEngine.execute('zup unknown_command_foo');
    expect(lines.length).toBe(1);
    expect(lines[0].type).toBe('error');
    expect(lines[0].text).toContain("Unknown command: 'zup unknown_command_foo'");
  });

  test('non-zup command returns command not found', async () => {
    const lines = await CliEngine.execute('foo bar');
    expect(lines.length).toBe(1);
    expect(lines[0].type).toBe('error');
    expect(lines[0].text).toContain('zup: command not found: foo');
  });

  test('empty string returns empty array', async () => {
    const lines = await CliEngine.execute('   ');
    expect(lines).toEqual([]);
  });

  test('zup relays executes and returns connection pool status', async () => {
    const lines = await CliEngine.execute('zup relays');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].text).toContain('--- Active Relay Connection Pool');
  });

  test('zup telemetry executes and reports local-first metric totals', async () => {
    const lines = await CliEngine.execute('zup telemetry');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].text).toContain('--- Local Telemetry Engine');
  });

  test('zup stats executes and reports system metrics', async () => {
    const lines = await CliEngine.execute('zup stats');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].text).toContain('--- zup Workspace System Status & Metrics ---');
  });

  test('zup export-telemetry executes and produces JSON export payload', async () => {
    const lines = await CliEngine.execute('zup export-telemetry');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.text.includes('[EXPORT] Prepared local telemetry data'))).toBe(true);
  });
});
