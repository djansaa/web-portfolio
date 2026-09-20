import xmlFormat from 'xml-formatter';
import type { BodyFormat } from './model';

export type FormatResult = { ok: true; value: string } | { ok: false; error: string };

export function formatBody(value: string, format: BodyFormat): FormatResult {
  if (format === 'text' || !value.trim()) return { ok: true, value };
  if (format === 'json') {
    try {
      return { ok: true, value: JSON.stringify(JSON.parse(value), null, 2) };
    } catch {
      return { ok: false, error: 'Invalid JSON. Check syntax and try again.' };
    }
  }
  const parsed = new DOMParser().parseFromString(value, 'application/xml');
  if (parsed.querySelector('parsererror')) return { ok: false, error: 'Invalid XML. Check syntax and try again.' };
  try {
    return { ok: true, value: xmlFormat(value, { indentation: '  ', collapseContent: true, lineSeparator: '\n' }) };
  } catch {
    return { ok: false, error: 'XML could not be formatted. The original text is unchanged.' };
  }
}
