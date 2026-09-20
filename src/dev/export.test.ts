import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { createPdfBlob, createWordDocument } from './export';
import { createCase, createDraft } from './model';

describe('document exports', () => {
  it('builds one Word and PDF file with ordered REST cases and replacement text', async () => {
    const draft = createDraft('rest');
    const first = draft.cases[0];
    first.method = 'POST';
    first.url = 'https://example.test/orders';
    first.requestHeaders = [{ id: 'h1', name: 'Authorization', value: 'Bearer <token1>' }];
    first.requestBody = '{\n  "id": 1\n}';
    first.responseBody = '{"ok":true}';
    const second = createCase('rest');
    second.method = 'GET';
    second.url = 'https://example.test/orders/1';
    second.responseBody = '{"id":1}';
    draft.cases.push(second);

    const word = await Packer.toBlob(createWordDocument(draft));
    expect(word.size).toBeGreaterThan(1000);
    const zipped = await JSZip.loadAsync(await word.arrayBuffer());
    const xml = await zipped.file('word/document.xml')!.async('string');
    expect(xml.indexOf('Case 1')).toBeLessThan(xml.indexOf('Case 2'));
    expect(xml).toContain('&lt;token1&gt;');
    expect(xml).toContain('Response');

    const pdf = await createPdfBlob(draft);
    expect(pdf.size).toBeGreaterThan(1000);
    const signature = new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 8));
    expect(signature).toContain('%PDF-');
  });

  it('builds a long SOAP document with empty optional fields', async () => {
    const draft = createDraft('soap');
    draft.cases[0].requestBody = `<Envelope>${'<Item>value</Item>'.repeat(240)}</Envelope>`;
    draft.cases[0].responseBody = '<Envelope><Result>OK</Result></Envelope>';
    const word = await Packer.toBlob(createWordDocument(draft));
    const pdf = await createPdfBlob(draft);
    expect(word.size).toBeGreaterThan(1000);
    expect(pdf.size).toBeGreaterThan(1000);
  });
});
