import { describe, expect, it } from 'vitest';
import { formatBody } from './format';

describe('body formatting', () => {
  it('indents valid JSON without changing data', () => {
    const result = formatBody('{"outer":{"items":[1,2]}}', 'json');
    expect(result.ok).toBe(true);
    if (result.ok) expect(JSON.parse(result.value)).toEqual({ outer: { items: [1, 2] } });
  });

  it('reports invalid JSON and keeps plain text as entered', () => {
    expect(formatBody('{"broken":', 'json').ok).toBe(false);
    expect(formatBody('  plain\n text ', 'text')).toEqual({ ok: true, value: '  plain\n text ' });
  });
});
