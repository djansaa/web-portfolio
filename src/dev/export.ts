import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ApiCase, ApiDraft, HeaderEntry } from './model';

pdfMake.vfs = pdfFonts as unknown as Record<string, string>;

export type ExportKind = 'docx' | 'pdf';

function hasContent(value: string): boolean { return !!value.trim(); }
function lines(value: string): string[] { return value.replace(/\r\n?/g, '\n').split('\n'); }
function title(draft: ApiDraft): string { return `${draft.mode.toUpperCase()} API Documentation`; }
function label(item: ApiCase, mode: ApiDraft['mode'], index: number): string {
  const detail = mode === 'rest' ? [item.method, item.url].filter(hasContent).join(' ') : item.soapAction || item.url;
  return `Case ${index + 1}${detail ? ` — ${detail}` : ''}`;
}
function metadata(item: ApiCase, mode: ApiDraft['mode']): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (mode === 'rest') {
    if (hasContent(item.method)) rows.push(['Method', item.method]);
    if (hasContent(item.url)) rows.push(['URL', item.url]);
  } else {
    if (hasContent(item.url)) rows.push(['Endpoint', item.url]);
    if (hasContent(item.soapAction)) rows.push(['SOAPAction', item.soapAction]);
  }
  if (hasContent(item.status)) rows.push(['Response status', item.status]);
  return rows;
}
function visibleHeaders(headers: HeaderEntry[]): HeaderEntry[] { return headers.filter((header) => hasContent(header.name) || hasContent(header.value)); }

export function createWordDocument(draft: ApiDraft): Document {
  const children: Paragraph[] = [
    new Paragraph({ text: title(draft), heading: HeadingLevel.TITLE, spacing: { after: 260 } }),
    new Paragraph({ children: [new TextRun({ text: `${draft.cases.length} ${draft.cases.length === 1 ? 'case' : 'cases'}`, color: '687274' })], spacing: { after: 300 } }),
  ];
  draft.cases.forEach((item, index) => {
    children.push(new Paragraph({ text: label(item, draft.mode, index), heading: HeadingLevel.HEADING_1, spacing: { before: index ? 330 : 80, after: 120 }, keepNext: true }));
    for (const [name, value] of metadata(item, draft.mode)) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${name}: `, bold: true }), new TextRun(value)], spacing: { after: 70 } }));
    }
    for (const [side, headers, body] of [
      ['Request', item.requestHeaders, item.requestBody],
      ['Response', item.responseHeaders, item.responseBody],
    ] as const) {
      children.push(new Paragraph({ text: side, heading: HeadingLevel.HEADING_2, spacing: { before: 210, after: 80 }, keepNext: true }));
      const shown = visibleHeaders(headers);
      if (shown.length) {
        children.push(new Paragraph({ text: 'Headers', heading: HeadingLevel.HEADING_3, spacing: { before: 100, after: 55 }, keepNext: true }));
        for (const header of shown) children.push(new Paragraph({ children: [new TextRun({ text: `${header.name || 'Header'}: `, bold: true }), new TextRun(header.value)], spacing: { after: 45 } }));
      }
      children.push(new Paragraph({ text: 'Body', heading: HeadingLevel.HEADING_3, spacing: { before: 100, after: 55 }, keepNext: true }));
      if (!body) children.push(new Paragraph({ children: [new TextRun({ text: '(empty)', color: '87918E' })], spacing: { after: 80 } }));
      else for (const line of lines(body)) children.push(new Paragraph({ children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 16 })], spacing: { after: 0 }, keepLines: true }));
    }
  });
  return new Document({
    creator: 'David Jansa API Documenter',
    title: title(draft),
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 950, bottom: 1000, left: 950 } } }, children }],
  });
}

export function createPdfDefinition(draft: ApiDraft): TDocumentDefinitions {
  const content: Content[] = [
    { text: title(draft), style: 'title' },
    { text: `${draft.cases.length} ${draft.cases.length === 1 ? 'case' : 'cases'}`, style: 'subtitle' },
  ];
  draft.cases.forEach((item, index) => {
    content.push({ text: label(item, draft.mode, index), style: 'caseTitle' });
    for (const [name, value] of metadata(item, draft.mode)) content.push({ text: [{ text: `${name}: `, bold: true }, value], style: 'meta' });
    for (const [side, headers, body] of [
      ['Request', item.requestHeaders, item.requestBody],
      ['Response', item.responseHeaders, item.responseBody],
    ] as const) {
      content.push({ text: side, style: 'sectionTitle' });
      const shown = visibleHeaders(headers);
      if (shown.length) {
        content.push({ text: 'Headers', style: 'subTitle' });
        for (const header of shown) content.push({ text: [{ text: `${header.name || 'Header'}: `, bold: true }, header.value], style: 'meta' });
      }
      content.push({ text: 'Body', style: 'subTitle' });
      content.push({ text: body || '(empty)', style: body ? 'code' : 'empty', preserveLeadingSpaces: true });
    }
  });
  return {
    pageSize: 'A4', pageMargins: [45, 48, 45, 52],
    info: { title: title(draft), author: 'David Jansa API Documenter' },
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1C2429' },
    styles: {
      title: { fontSize: 23, bold: true, margin: [0, 0, 0, 7] },
      subtitle: { fontSize: 9, color: '#687274', margin: [0, 0, 0, 18] },
      caseTitle: { fontSize: 15, bold: true, margin: [0, 20, 0, 8] },
      sectionTitle: { fontSize: 12, bold: true, color: '#426A2B', margin: [0, 13, 0, 6] },
      subTitle: { fontSize: 9, bold: true, margin: [0, 8, 0, 4] },
      meta: { fontSize: 9, margin: [0, 0, 0, 3] },
      code: { fontSize: 8, color: '#303B3A', lineHeight: 1.2, margin: [0, 0, 0, 10] },
      empty: { fontSize: 9, italics: true, color: '#87918E', margin: [0, 0, 0, 10] },
    },
    footer: (currentPage, pageCount) => ({ text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 8, color: '#87918E', margin: [0, 0, 45, 0] }),
  };
}

export function createPdfBlob(draft: ApiDraft): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(createPdfDefinition(draft)).getBlob(resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocument(draft: ApiDraft, kind: ExportKind): Promise<void> {
  const filename = `${draft.mode}-api-documentation.${kind}`;
  if (kind === 'docx') {
    downloadBlob(await Packer.toBlob(createWordDocument(draft)), filename);
  } else {
    downloadBlob(await createPdfBlob(draft), filename);
  }
}
