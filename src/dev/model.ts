export type ApiMode = 'rest' | 'soap';
export type BodyFormat = 'json' | 'xml' | 'text';
export type HeaderSide = 'request' | 'response';

export interface HeaderEntry {
  id: string;
  name: string;
  value: string;
}

export interface ApiCase {
  id: string;
  method: string;
  url: string;
  soapAction: string;
  status: string;
  requestHeaders: HeaderEntry[];
  responseHeaders: HeaderEntry[];
  requestBody: string;
  responseBody: string;
  requestFormat: BodyFormat;
  responseFormat: BodyFormat;
}

export interface ApiDraft {
  version: 1;
  mode: ApiMode;
  cases: ApiCase[];
}

export type FieldKind = 'url' | 'soapAction' | 'status' | 'requestBody' | 'responseBody' | 'requestHeader' | 'responseHeader';

export interface FieldRef {
  caseId: string;
  kind: FieldKind;
  headerId?: string;
}

export const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createCase(mode: ApiMode): ApiCase {
  return {
    id: newId(),
    method: mode === 'soap' ? 'POST' : 'GET',
    url: '', soapAction: '', status: '',
    requestHeaders: [], responseHeaders: [],
    requestBody: '', responseBody: '',
    requestFormat: mode === 'soap' ? 'xml' : 'json',
    responseFormat: mode === 'soap' ? 'xml' : 'json',
  };
}

export function createDraft(mode: ApiMode): ApiDraft {
  return { version: 1, mode, cases: [createCase(mode)] };
}

export function getField(draft: ApiDraft, ref: FieldRef): string {
  const item = draft.cases.find((entry) => entry.id === ref.caseId);
  if (!item) return '';
  if (ref.kind === 'requestHeader' || ref.kind === 'responseHeader') {
    const entries = ref.kind === 'requestHeader' ? item.requestHeaders : item.responseHeaders;
    return entries.find((entry) => entry.id === ref.headerId)?.value ?? '';
  }
  return item[ref.kind];
}

export function setField(draft: ApiDraft, ref: FieldRef, value: string): void {
  const item = draft.cases.find((entry) => entry.id === ref.caseId);
  if (!item) return;
  if (ref.kind === 'requestHeader' || ref.kind === 'responseHeader') {
    const entries = ref.kind === 'requestHeader' ? item.requestHeaders : item.responseHeaders;
    const header = entries.find((entry) => entry.id === ref.headerId);
    if (header) header.value = value;
    return;
  }
  item[ref.kind] = value;
}

export function fieldLabel(draft: ApiDraft, ref: FieldRef): string {
  const number = draft.cases.findIndex((entry) => entry.id === ref.caseId) + 1;
  const item = draft.cases[number - 1];
  if (ref.kind === 'requestHeader' || ref.kind === 'responseHeader') {
    const entries = ref.kind === 'requestHeader' ? item?.requestHeaders : item?.responseHeaders;
    const name = entries?.find((entry) => entry.id === ref.headerId)?.name || 'Header';
    return `Case ${number} · ${ref.kind === 'requestHeader' ? 'Request' : 'Response'} · ${name}`;
  }
  const labels: Record<Exclude<FieldKind, 'requestHeader' | 'responseHeader'>, string> = {
    url: draft.mode === 'soap' ? 'Endpoint' : 'URL',
    soapAction: 'SOAPAction', status: 'Status',
    requestBody: 'Request body', responseBody: 'Response body',
  };
  return `Case ${number} · ${labels[ref.kind]}`;
}

export function isBodyFormat(value: unknown): value is BodyFormat {
  return value === 'json' || value === 'xml' || value === 'text';
}

export function parseDraft(raw: string | null, mode: ApiMode): ApiDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const draft = value as Partial<ApiDraft>;
    if (draft.version !== 1 || draft.mode !== mode || !Array.isArray(draft.cases)) return null;
    const cases: ApiCase[] = draft.cases.filter((item): item is ApiCase => {
      if (!item || typeof item !== 'object') return false;
      const entry = item as ApiCase;
      return typeof entry.id === 'string' && typeof entry.method === 'string' && typeof entry.url === 'string' &&
        typeof entry.soapAction === 'string' && typeof entry.status === 'string' &&
        typeof entry.requestBody === 'string' && typeof entry.responseBody === 'string' &&
        isBodyFormat(entry.requestFormat) && isBodyFormat(entry.responseFormat) &&
        Array.isArray(entry.requestHeaders) && Array.isArray(entry.responseHeaders) &&
        [...entry.requestHeaders, ...entry.responseHeaders].every((header) =>
          header && typeof header.id === 'string' && typeof header.name === 'string' && typeof header.value === 'string');
    });
    return { version: 1, mode, cases: cases.length ? cases : [createCase(mode)] };
  } catch {
    return null;
  }
}
