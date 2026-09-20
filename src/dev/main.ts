import { applySecretReplacements, countUnresolved, defaultPlaceholders, scanSecrets, type Finding } from './secrets';
import { createCase, createDraft, fieldLabel, isBodyFormat, newId, parseDraft, type ApiCase, type ApiDraft, type ApiMode, type HeaderEntry, type HeaderSide } from './model';
import { formatBody } from './format';
import type { ExportKind } from './export';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
const caseList = required<HTMLElement>('#case-list');
const findingsElement = required<HTMLElement>('#findings');
const findingCount = required<HTMLElement>('#finding-count');
const saveStatus = required<HTMLElement>('#save-status');
const workspaceTitle = required<HTMLElement>('#workspace-title');
const manualValue = required<HTMLInputElement>('#manual-value');
const warningDialog = required<HTMLDialogElement>('#export-warning');
const warningText = required<HTMLElement>('#warning-text');

const storageKey = (mode: ApiMode): string => `api-documenter:v1:${mode}`;
function load(mode: ApiMode): ApiDraft {
  try { return parseDraft(localStorage.getItem(storageKey(mode)), mode) ?? createDraft(mode); }
  catch { return createDraft(mode); }
}
const drafts: Record<ApiMode, ApiDraft> = { rest: load('rest'), soap: load('soap') };
const replacements: Record<ApiMode, Map<string, string>> = { rest: new Map(), soap: new Map() };
const manualValues: Record<ApiMode, Set<string>> = { rest: new Set(), soap: new Set() };
let mode: ApiMode = 'rest';
let findings: Finding[] = [];
let findingGroups: Array<{ value: string; items: Finding[] }> = [];
let saveTimer: number | undefined;

const draft = (): ApiDraft => drafts[mode];
const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

function meaningful(item: ApiCase): boolean {
  return !!(item.url.trim() || item.soapAction.trim() || item.status.trim() || item.requestBody.trim() || item.responseBody.trim() ||
    [...item.requestHeaders, ...item.responseHeaders].some((header) => header.name.trim() || header.value.trim()));
}

function setSaveStatus(text: string): void { saveStatus.textContent = text; }
function persistCurrent(): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = undefined;
  const current = draft();
  const currentFindings = scanSecrets(current, manualValues[mode]);
  const safe = applySecretReplacements(current, currentFindings, replacements[mode], true);
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify(safe));
    setSaveStatus('Saved locally');
  } catch {
    setSaveStatus('Could not save locally');
  }
}
function scheduleSave(): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  setSaveStatus('Saving locally…');
  saveTimer = window.setTimeout(persistCurrent, 250);
}

function input(caseId: string, field: string, value: string, extra = ''): string {
  return `data-case-id="${esc(caseId)}" data-bind="${esc(field)}" ${extra} value="${esc(value)}"`;
}
function headerRow(caseId: string, side: HeaderSide, header: HeaderEntry): string {
  return `<div class="header-row">
    <input aria-label="${side} header name" placeholder="Name" ${input(caseId, `${side}HeaderName`, header.name, `data-header-id="${esc(header.id)}"`)} />
    <input class="field-control" aria-label="${side} header value" placeholder="Value" ${input(caseId, `${side}HeaderValue`, header.value, `data-header-id="${esc(header.id)}"`)} />
    <button class="icon-button" type="button" aria-label="Remove ${side} header" title="Remove header" data-action="remove-header" data-case-id="${esc(caseId)}" data-side="${side}" data-header-id="${esc(header.id)}">×</button>
  </div>`;
}
function messagePanel(item: ApiCase, side: HeaderSide): string {
  const headers = side === 'request' ? item.requestHeaders : item.responseHeaders;
  const body = side === 'request' ? item.requestBody : item.responseBody;
  const format = side === 'request' ? item.requestFormat : item.responseFormat;
  const bodyField = side === 'request' ? 'requestBody' : 'responseBody';
  const formatField = side === 'request' ? 'requestFormat' : 'responseFormat';
  return `<section class="message-panel" aria-label="${side} section">
    <div class="message-top"><h3>${side}</h3><div class="format-control"><select aria-label="${side} body format" data-case-id="${esc(item.id)}" data-bind="${formatField}"><option value="json" ${format === 'json' ? 'selected' : ''}>JSON</option><option value="xml" ${format === 'xml' ? 'selected' : ''}>XML</option><option value="text" ${format === 'text' ? 'selected' : ''}>Text</option></select><button class="mini-button" type="button" data-action="format" data-side="${side}" data-case-id="${esc(item.id)}">Format</button></div></div>
    <div class="headers-head"><span class="field-label">Headers <span class="optional">(optional)</span></span><button class="inline-link" type="button" data-action="add-header" data-side="${side}" data-case-id="${esc(item.id)}">＋ Add header</button></div>
    <div class="header-list">${headers.map((header) => headerRow(item.id, side, header)).join('')}</div>
    <label class="field"><span class="field-label">Body</span><textarea class="field-control" spellcheck="false" placeholder="Paste ${side} body here" data-case-id="${esc(item.id)}" data-bind="${bodyField}">${esc(body)}</textarea></label>
    <div class="format-error" data-error-case="${esc(item.id)}" data-error-side="${side}" role="status"></div>
  </section>`;
}
function caseCard(item: ApiCase, index: number, count: number): string {
  const summary = mode === 'rest' ? `${item.method} ${item.url || 'Untitled request'}` : item.soapAction || item.url || 'Untitled SOAP request';
  const metadata = mode === 'rest' ? `<div class="meta-grid">
      <label class="field"><span class="field-label">Method</span><select data-case-id="${esc(item.id)}" data-bind="method">${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((method) => `<option ${item.method === method ? 'selected' : ''}>${method}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">URL</span><input class="field-control" type="text" placeholder="https://api.example.com/items" ${input(item.id, 'url', item.url)} /></label>
      <label class="field"><span class="field-label">Status</span><input class="field-control" type="text" placeholder="200 OK" ${input(item.id, 'status', item.status)} /></label>
    </div>` : `<div class="meta-grid soap">
      <label class="field"><span class="field-label">Endpoint</span><input class="field-control" type="text" placeholder="https://example.com/service" ${input(item.id, 'url', item.url)} /></label>
      <label class="field"><span class="field-label">SOAPAction (optional)</span><input class="field-control" type="text" placeholder="urn:GetItems" ${input(item.id, 'soapAction', item.soapAction)} /></label>
      <label class="field"><span class="field-label">Status</span><input class="field-control" type="text" placeholder="200 OK" ${input(item.id, 'status', item.status)} /></label>
    </div>`;
  return `<article class="case-card" data-card-id="${esc(item.id)}"><div class="case-header"><div class="case-heading"><span class="case-number">${String(index + 1).padStart(2, '0')}</span><span class="case-title" data-title-id="${esc(item.id)}">${esc(summary)}</span></div><div class="case-actions"><button class="icon-button" type="button" title="Move up" aria-label="Move case ${index + 1} up" data-action="move-up" data-case-id="${esc(item.id)}" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" title="Move down" aria-label="Move case ${index + 1} down" data-action="move-down" data-case-id="${esc(item.id)}" ${index === count - 1 ? 'disabled' : ''}>↓</button><button class="icon-button" type="button" title="Remove case" aria-label="Remove case ${index + 1}" data-action="remove-case" data-case-id="${esc(item.id)}">×</button></div></div><div class="case-content">${metadata}<div class="message-grid">${messagePanel(item, 'request')}${messagePanel(item, 'response')}</div></div></article>`;
}

function renderEditor(): void {
  workspaceTitle.textContent = `${mode.toUpperCase()} document`;
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  caseList.innerHTML = draft().cases.length
    ? draft().cases.map((item, index) => caseCard(item, index, draft().cases.length)).join('')
    : '<div class="empty-state"><strong>No cases yet</strong>Add a case to start documenting this API.</div>';
}

function maskedPreview(value: string): string {
  if (value.length < 6) return '••••';
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}
function renderFindings(): void {
  findings = scanSecrets(draft(), manualValues[mode]);
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) groups.set(finding.value, [...(groups.get(finding.value) ?? []), finding]);
  findingGroups = [...groups].map(([value, items]) => ({ value, items }));
  findingCount.textContent = String(findings.length);
  findingsElement.innerHTML = findingGroups.length ? findingGroups.map(({ value, items }, index) => {
    const selected = replacements[mode].get(value) ?? '';
    const suggested = defaultPlaceholders(findings).get(value) ?? '<secret1>';
    return `<div class="finding-card"><div class="finding-top"><span class="finding-type">${items[0].type.replace('_', ' ')}</span><span class="finding-occurrences">${items.length} ${items.length === 1 ? 'match' : 'matches'}</span></div><div class="finding-preview" title="Value hidden in review panel">${esc(maskedPreview(value))}</div>${items.map((finding, occurrence) => `<button class="finding-location" type="button" data-finding-index="${index}" data-occurrence-index="${occurrence}">Go to ${esc(fieldLabel(draft(), finding.ref))} ↗</button>`).join('')}<input class="finding-replacement" type="text" aria-label="Replacement for ${esc(fieldLabel(draft(), items[0].ref))}" placeholder="${esc(suggested)}" value="${esc(selected)}" data-replacement-index="${index}" autocomplete="off" /><div class="finding-hint">Leave blank to keep original in export.</div></div>`;
  }).join('') : '<div class="findings-empty"><strong>Nothing flagged yet</strong>Detected values will appear here as you add data.</div>';
}
function refresh(): void { renderFindings(); scheduleSave(); }

function boundElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-bind]') : null;
}
function updateBound(target: HTMLElement): void {
  const caseId = target.dataset.caseId;
  const bind = target.dataset.bind;
  if (!caseId || !bind) return;
  const item = draft().cases.find((entry) => entry.id === caseId);
  if (!item) return;
  const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  if (bind === 'requestHeaderName' || bind === 'requestHeaderValue' || bind === 'responseHeaderName' || bind === 'responseHeaderValue') {
    const headers = bind.startsWith('request') ? item.requestHeaders : item.responseHeaders;
    const header = headers.find((entry) => entry.id === target.dataset.headerId);
    if (header) header[bind.endsWith('Name') ? 'name' : 'value'] = value;
  } else if (bind === 'requestFormat' || bind === 'responseFormat') {
    if (isBodyFormat(value)) item[bind] = value;
  } else if (bind === 'method' || bind === 'url' || bind === 'soapAction' || bind === 'status' || bind === 'requestBody' || bind === 'responseBody') {
    item[bind] = value;
  }
  if (bind === 'method' || bind === 'url' || bind === 'soapAction') {
    const title = caseList.querySelector<HTMLElement>(`[data-title-id="${caseId}"]`);
    if (title) title.textContent = mode === 'rest' ? `${item.method} ${item.url || 'Untitled request'}` : item.soapAction || item.url || 'Untitled SOAP request';
  }
  if (bind === 'requestBody' || bind === 'responseBody') {
    const side = bind === 'requestBody' ? 'request' : 'response';
    const error = caseList.querySelector<HTMLElement>(`[data-error-case="${caseId}"][data-error-side="${side}"]`);
    if (error) error.textContent = '';
  }
  refresh();
}

caseList.addEventListener('input', (event) => {
  const target = boundElement(event.target);
  if (target) updateBound(target);
});
caseList.addEventListener('change', (event) => {
  const target = boundElement(event.target);
  if (target) updateBound(target);
});
caseList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const caseId = button.dataset.caseId;
  const index = draft().cases.findIndex((item) => item.id === caseId);
  if (index < 0) return;
  const item = draft().cases[index];
  if (action === 'move-up' && index > 0) [draft().cases[index - 1], draft().cases[index]] = [draft().cases[index], draft().cases[index - 1]];
  else if (action === 'move-down' && index < draft().cases.length - 1) [draft().cases[index + 1], draft().cases[index]] = [draft().cases[index], draft().cases[index + 1]];
  else if (action === 'remove-case') draft().cases.splice(index, 1);
  else if (action === 'add-header') {
    const side = button.dataset.side as HeaderSide;
    (side === 'request' ? item.requestHeaders : item.responseHeaders).push({ id: newId(), name: '', value: '' });
  } else if (action === 'remove-header') {
    const side = button.dataset.side as HeaderSide;
    const headers = side === 'request' ? item.requestHeaders : item.responseHeaders;
    const headerIndex = headers.findIndex((header) => header.id === button.dataset.headerId);
    if (headerIndex >= 0) headers.splice(headerIndex, 1);
  } else if (action === 'format') {
    const side = button.dataset.side as HeaderSide;
    const bodyKey = side === 'request' ? 'requestBody' : 'responseBody';
    const formatKey = side === 'request' ? 'requestFormat' : 'responseFormat';
    const result = formatBody(item[bodyKey], item[formatKey]);
    const error = caseList.querySelector<HTMLElement>(`[data-error-case="${caseId}"][data-error-side="${side}"]`);
    if (!result.ok) { if (error) error.textContent = result.error; return; }
    item[bodyKey] = result.value;
    const body = [...caseList.querySelectorAll<HTMLTextAreaElement>('textarea[data-bind]')].find((element) => element.dataset.caseId === caseId && element.dataset.bind === bodyKey);
    if (body) body.value = result.value;
    if (error) error.textContent = 'Formatted.';
    refresh();
    return;
  } else return;
  renderEditor();
  refresh();
});

required<HTMLButtonElement>('#add-case').addEventListener('click', () => {
  const item = createCase(mode);
  draft().cases.push(item);
  renderEditor();
  refresh();
  caseList.querySelector<HTMLElement>(`[data-card-id="${item.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => tab.addEventListener('click', () => {
  const next = tab.dataset.mode as ApiMode;
  if (next !== 'rest' && next !== 'soap' || next === mode) return;
  persistCurrent();
  mode = next;
  renderEditor();
  renderFindings();
  setSaveStatus('Saved locally');
}));
required<HTMLButtonElement>('#clear-draft').addEventListener('click', () => {
  if (!window.confirm(`Clear the ${mode.toUpperCase()} draft on this device?`)) return;
  drafts[mode] = createDraft(mode);
  replacements[mode].clear();
  manualValues[mode].clear();
  renderEditor();
  refresh();
});
findingsElement.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-finding-index]');
  if (!target) return;
  const finding = findingGroups[Number(target.dataset.findingIndex)]?.items[Number(target.dataset.occurrenceIndex)];
  if (!finding) return;
  const control = [...caseList.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.field-control')].find((element) => {
    const bind = element.dataset.bind;
    if (element.dataset.caseId !== finding.ref.caseId || element.dataset.headerId !== finding.ref.headerId) return false;
    return bind === finding.ref.kind || bind === `${finding.ref.kind.replace('Header', '')}HeaderValue`;
  });
  if (!control) return;
  control.scrollIntoView({ behavior: 'smooth', block: 'center' });
  control.focus();
  control.setSelectionRange(finding.start, finding.end);
});
findingsElement.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  if (!target.matches('[data-replacement-index]')) return;
  const group = findingGroups[Number(target.dataset.replacementIndex)];
  if (!group) return;
  if (target.value.trim()) replacements[mode].set(group.value, target.value);
  else replacements[mode].delete(group.value);
  scheduleSave();
});
required<HTMLButtonElement>('#add-manual').addEventListener('click', () => {
  const value = manualValue.value.trim();
  if (!value) { manualValue.focus(); return; }
  if (!draft().cases.some((item) => [item.url, item.soapAction, item.status, item.requestBody, item.responseBody, ...item.requestHeaders.map((header) => header.value), ...item.responseHeaders.map((header) => header.value)].some((field) => field.includes(value)))) {
    manualValue.setCustomValidity('This value was not found in the current document.');
    manualValue.reportValidity();
    return;
  }
  manualValue.setCustomValidity('');
  manualValues[mode].add(value);
  manualValue.value = '';
  refresh();
});
manualValue.addEventListener('input', () => manualValue.setCustomValidity(''));

async function exportCurrent(kind: ExportKind): Promise<void> {
  if (!draft().cases.some(meaningful)) { setSaveStatus('Add content before exporting'); return; }
  findings = scanSecrets(draft(), manualValues[mode]);
  const unresolved = countUnresolved(findings, replacements[mode]);
  if (unresolved) {
    warningText.textContent = `${unresolved} possible ${unresolved === 1 ? 'secret is' : 'secrets are'} still in the export. You can go back and add replacements, or continue with the original values.`;
    warningDialog.showModal();
    const proceed = await new Promise<boolean>((resolve) => warningDialog.addEventListener('close', () => resolve(warningDialog.returnValue === 'continue'), { once: true }));
    if (!proceed) return;
  }
  try {
    setSaveStatus('Preparing download…');
    const { downloadDocument } = await import('./export');
    await downloadDocument(applySecretReplacements(draft(), findings, replacements[mode], false), kind);
    setSaveStatus('Download ready');
  } catch (error) {
    console.error(error);
    setSaveStatus('Export failed. Please try again.');
  }
}
required<HTMLButtonElement>('#export-docx').addEventListener('click', () => { void exportCurrent('docx'); });
required<HTMLButtonElement>('#export-pdf').addEventListener('click', () => { void exportCurrent('pdf'); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) persistCurrent(); });
window.addEventListener('beforeunload', () => { if (saveTimer) persistCurrent(); });
const year = document.querySelector<HTMLElement>('#year');
if (year) year.textContent = String(new Date().getFullYear());
renderEditor();
renderFindings();
