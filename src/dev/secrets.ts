import { getField, setField, type ApiDraft, type FieldRef } from './model';

export type SecretType = 'api_key' | 'token' | 'password' | 'cookie' | 'secret';
export interface Finding {
  id: string;
  ref: FieldRef;
  start: number;
  end: number;
  value: string;
  type: SecretType;
}

const secretName = /(authorization|proxyauthorization|cookie|setcookie|apikey|accesskey|accesstoken|refreshtoken|authtoken|token|password|passwd|clientsecret|secretkey|privatekey)/;
const normalized = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function typeForName(name: string): SecretType {
  const key = normalized(name);
  if (key.includes('password') || key.includes('passwd')) return 'password';
  if (key.includes('cookie')) return 'cookie';
  if (key.includes('apikey') || key.includes('accesskey')) return 'api_key';
  if (key.includes('token') || key.includes('authorization')) return 'token';
  return 'secret';
}

function isSecretName(name: string): boolean { return secretName.test(normalized(name)); }
function cleanCandidate(value: string): boolean { return !!value.trim() && !/^<[^>]+>$/.test(value.trim()); }

export function scanSecrets(draft: ApiDraft, manualValues: ReadonlySet<string> = new Set()): Finding[] {
  const findings: Finding[] = [];
  const add = (ref: FieldRef, start: number, end: number, type: SecretType): void => {
    const field = getField(draft, ref);
    const value = field.slice(start, end);
    if (!cleanCandidate(value)) return;
    if (findings.some((item) => item.ref.caseId === ref.caseId && item.ref.kind === ref.kind && item.ref.headerId === ref.headerId && item.start <= start && item.end >= end)) return;
    findings.push({ id: `${ref.caseId}:${ref.kind}:${ref.headerId ?? ''}:${start}:${end}`, ref, start, end, value, type });
  };

  for (const item of draft.cases) {
    const fields: FieldRef[] = [
      { caseId: item.id, kind: 'url' }, { caseId: item.id, kind: 'soapAction' },
      { caseId: item.id, kind: 'status' }, { caseId: item.id, kind: 'requestBody' },
      { caseId: item.id, kind: 'responseBody' },
      ...item.requestHeaders.map((header) => ({ caseId: item.id, kind: 'requestHeader' as const, headerId: header.id })),
      ...item.responseHeaders.map((header) => ({ caseId: item.id, kind: 'responseHeader' as const, headerId: header.id })),
    ];

    for (const ref of fields) {
      const source = getField(draft, ref);
      if (!source) continue;

      if (ref.kind === 'requestHeader' || ref.kind === 'responseHeader') {
        const list = ref.kind === 'requestHeader' ? item.requestHeaders : item.responseHeaders;
        const name = list.find((header) => header.id === ref.headerId)?.name ?? '';
        if (isSecretName(name)) {
          const auth = /^(?:Bearer|Basic)\s+(.+)$/i.exec(source.trim());
          if (auth) {
            const start = source.indexOf(auth[1]);
            add(ref, start, start + auth[1].length, typeForName(name));
          } else add(ref, 0, source.length, typeForName(name));
        }
      }

      if (ref.kind === 'url') {
        const query = /[?&]([^=&#]+)=([^&#]*)/g;
        for (const match of source.matchAll(query)) {
          let name = match[1];
          try { name = decodeURIComponent(name); } catch { /* Keep the original key. */ }
          if (isSecretName(name)) {
            const start = (match.index ?? 0) + match[0].length - match[2].length;
            add(ref, start, start + match[2].length, typeForName(name));
          }
        }
      }

      const json = /"([^"\\]+)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
      for (const match of source.matchAll(json)) {
        if (!isSecretName(match[1])) continue;
        const start = (match.index ?? 0) + match[0].length - 1 - match[2].length;
        add(ref, start, start + match[2].length, typeForName(match[1]));
      }

      const xmlElement = /<([\w:.-]+)(?:\s[^>]*)?>([^<]+)<\/\1>/g;
      for (const match of source.matchAll(xmlElement)) {
        if (!isSecretName(match[1])) continue;
        const start = (match.index ?? 0) + match[0].indexOf(match[2]);
        add(ref, start, start + match[2].length, typeForName(match[1]));
      }
      const xmlAttribute = /([\w:.-]+)\s*=\s*(["'])(.*?)\2/g;
      for (const match of source.matchAll(xmlAttribute)) {
        if (!isSecretName(match[1])) continue;
        const start = (match.index ?? 0) + match[0].length - 1 - match[3].length;
        add(ref, start, start + match[3].length, typeForName(match[1]));
      }

      const assignment = /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|client[_-]?secret|secret[_-]?key)\b\s*[:=]\s*(["']?)([^\s,;&"']+)\2/gi;
      for (const match of source.matchAll(assignment)) {
        const start = (match.index ?? 0) + match[0].lastIndexOf(match[3]);
        add(ref, start, start + match[3].length, typeForName(match[1]));
      }
      const inlineHeader = /\b(Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*([^\r\n]+)/gi;
      for (const match of source.matchAll(inlineHeader)) {
        const value = match[2].trim();
        const auth = /^(?:Bearer|Basic)\s+(.+)$/i.exec(value);
        const token = auth?.[1] ?? value;
        const start = (match.index ?? 0) + match[0].lastIndexOf(token);
        add(ref, start, start + token.length, typeForName(match[1]));
      }
      const bearer = /\b(?:Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{8,})/gi;
      for (const match of source.matchAll(bearer)) {
        const start = (match.index ?? 0) + match[0].length - match[1].length;
        add(ref, start, start + match[1].length, 'token');
      }
      const jwt = /\b(eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;
      for (const match of source.matchAll(jwt)) add(ref, match.index ?? 0, (match.index ?? 0) + match[1].length, 'token');

      for (const value of manualValues) {
        if (!value) continue;
        let offset = 0;
        while ((offset = source.indexOf(value, offset)) !== -1) {
          add(ref, offset, offset + value.length, 'secret');
          offset += value.length;
        }
      }
    }
  }
  // Once a value is recognized, find its other occurrences even when their fields
  // do not carry a recognizable key (for example, the same token in a log body).
  const recognized = new Map(findings.map((finding) => [finding.value, finding.type]));
  for (const item of draft.cases) {
    const refs: FieldRef[] = [
      { caseId: item.id, kind: 'url' }, { caseId: item.id, kind: 'soapAction' },
      { caseId: item.id, kind: 'status' }, { caseId: item.id, kind: 'requestBody' },
      { caseId: item.id, kind: 'responseBody' },
      ...item.requestHeaders.map((header) => ({ caseId: item.id, kind: 'requestHeader' as const, headerId: header.id })),
      ...item.responseHeaders.map((header) => ({ caseId: item.id, kind: 'responseHeader' as const, headerId: header.id })),
    ];
    for (const ref of refs) {
      const source = getField(draft, ref);
      for (const [value, type] of recognized) {
        let offset = 0;
        while ((offset = source.indexOf(value, offset)) !== -1) {
          add(ref, offset, offset + value.length, type);
          offset += value.length;
        }
      }
    }
  }
  return findings.sort((a, b) => a.ref.caseId.localeCompare(b.ref.caseId) || a.start - b.start);
}

export function defaultPlaceholders(findings: readonly Finding[]): Map<string, string> {
  const values = new Map<string, string>();
  const counts: Record<SecretType, number> = { api_key: 0, token: 0, password: 0, cookie: 0, secret: 0 };
  for (const finding of findings) {
    if (!values.has(finding.value)) values.set(finding.value, `<${finding.type}${++counts[finding.type]}>`);
  }
  return values;
}

export function applySecretReplacements(draft: ApiDraft, findings: readonly Finding[], replacements: ReadonlyMap<string, string>, forStorage: boolean): ApiDraft {
  const clone: ApiDraft = structuredClone(draft);
  const defaults = defaultPlaceholders(findings);
  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = `${finding.ref.caseId}:${finding.ref.kind}:${finding.ref.headerId ?? ''}`;
    const group = grouped.get(key) ?? [];
    group.push(finding);
    grouped.set(key, group);
  }
  for (const group of grouped.values()) {
    const ref = group[0].ref;
    let value = getField(clone, ref);
    let previousStart = Infinity;
    for (const finding of group.sort((a, b) => b.start - a.start || b.end - a.end)) {
      if (finding.end > previousStart) continue;
      const chosen = replacements.get(finding.value)?.trim();
      const replacement = chosen && chosen !== finding.value ? chosen : forStorage ? defaults.get(finding.value) : undefined;
      if (replacement) value = `${value.slice(0, finding.start)}${replacement}${value.slice(finding.end)}`;
      previousStart = finding.start;
    }
    setField(clone, ref, value);
  }
  return clone;
}

export function countUnresolved(findings: readonly Finding[], replacements: ReadonlyMap<string, string>): number {
  return findings.filter((finding) => {
    const replacement = replacements.get(finding.value)?.trim();
    return !replacement || replacement === finding.value;
  }).length;
}
