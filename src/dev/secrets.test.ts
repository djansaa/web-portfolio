import { describe, expect, it } from 'vitest';
import { applySecretReplacements, countUnresolved, scanSecrets } from './secrets';
import { createDraft, parseDraft, type ApiDraft } from './model';

function restFixture(): ApiDraft {
  const draft = createDraft('rest');
  const item = draft.cases[0];
  item.url = 'https://example.test/items?api_key=url-123&limit=10';
  item.requestHeaders = [{ id: 'auth', name: 'Authorization', value: 'Bearer header-456' }];
  item.responseHeaders = [{ id: 'cookie', name: 'Set-Cookie', value: 'session=cookie-789' }];
  item.requestBody = '{"credentials":{"password":"body-123"},"note":"hello"}';
  item.responseBody = 'token=plain-789';
  return draft;
}

describe('secret review and redacted drafts', () => {
  it('finds known secrets across URL, headers, JSON and plain text', () => {
    const findings = scanSecrets(restFixture());
    expect(new Set(findings.map((finding) => finding.value))).toEqual(new Set(['url-123', 'header-456', 'session=cookie-789', 'body-123', 'plain-789']));
    expect(findings.every((finding) => finding.end > finding.start)).toBe(true);
  });

  it('keeps editor values, uses custom export replacements, and sanitizes saved drafts', () => {
    const original = restFixture();
    const findings = scanSecrets(original);
    const custom = new Map([['url-123', '<api_key1>'], ['header-456', '<auth_token>']]);
    const exported = applySecretReplacements(original, findings, custom, false);
    const saved = applySecretReplacements(original, findings, custom, true);
    expect(original.cases[0].url).toContain('url-123');
    expect(exported.cases[0].url).toContain('<api_key1>');
    expect(exported.cases[0].requestHeaders[0].value).toBe('Bearer <auth_token>');
    expect(exported.cases[0].requestBody).toContain('body-123');
    expect(countUnresolved(findings, custom)).toBeGreaterThan(0);
    const storage = JSON.stringify(saved);
    for (const raw of ['url-123', 'header-456', 'session=cookie-789', 'body-123', 'plain-789']) expect(storage).not.toContain(raw);
    expect(parseDraft(storage, 'rest')).toEqual(saved);
    expect(parseDraft(storage, 'soap')).toBeNull();
  });

  it('finds SOAP XML values and manually supplied unknown values', () => {
    const draft = createDraft('soap');
    draft.cases[0].requestBody = '<Envelope><Password>xml-123</Password><TrackingId>unknown-456</TrackingId></Envelope>';
    const findings = scanSecrets(draft, new Set(['unknown-456']));
    expect(findings.map((finding) => finding.value)).toEqual(expect.arrayContaining(['xml-123', 'unknown-456']));
    const safe = applySecretReplacements(draft, findings, new Map(), true);
    expect(safe.cases[0].requestBody).not.toContain('xml-123');
    expect(safe.cases[0].requestBody).not.toContain('unknown-456');
  });

  it('sanitizes repeated values outside recognized keys', () => {
    const draft = createDraft('rest');
    draft.cases[0].requestHeaders = [{ id: 'auth', name: 'Authorization', value: 'Bearer repeat-123' }];
    draft.cases[0].responseBody = 'Returned marker: repeat-123';
    const findings = scanSecrets(draft);
    expect(findings.filter((finding) => finding.value === 'repeat-123')).toHaveLength(2);
    const stored = JSON.stringify(applySecretReplacements(draft, findings, new Map(), true));
    expect(stored).not.toContain('repeat-123');
  });

  it('allows empty optional fields without false positives', () => {
    expect(scanSecrets(createDraft('rest'))).toEqual([]);
    expect(scanSecrets(createDraft('soap'))).toEqual([]);
  });
});
