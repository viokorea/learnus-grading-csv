'use strict';
const $ = id => document.getElementById(id);
let workbook, result, previewRows;
const values = () => XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value], { header: 1, defval: null, raw: true });
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
function invalidate() { result = null; $('result').hidden = true; }
function ready() { $('convert').disabled = !workbook || !$('sheet').value || !$('section').value || !$('worksheet').files.length; }
function route() {
  const selected = ['convert', 'preview', 'guide'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'convert';
  document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== `${selected}-view`; });
  document.querySelectorAll('[data-view]').forEach(link => { if (link.dataset.view === selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
}
window.addEventListener('hashchange', route); route();
function filename(input, label) {
  const name = $(input).files[0]?.name;
  $(label).textContent = name || '파일을 선택하세요';
  $(label).classList.toggle('loaded', Boolean(name));
}
function selectSections() {
  invalidate();
  try {
    const sections = LearnUsConverter.sections(values());
    $('section').replaceChildren(...sections.map(s => new Option(s, s)));
    if (sections.includes('04-02')) $('section').value = '04-02';
    $('section').disabled = !sections.length;
    status(sections.length ? '시트와 분반을 확인한 뒤 결과를 확인하세요.' : '이 시트에는 학생 명단이 없습니다.');
  } catch (e) { $('section').replaceChildren(new Option('채점 시트를 선택하세요', '')); $('section').disabled = true; status(e.message, true); }
  ready();
}
$('excel').addEventListener('change', async () => {
  invalidate(); workbook = null; $('convert').disabled = true;
  filename('excel', 'excel-name');
  try {
    const file = $('excel').files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) throw Error('엑셀 파일은 20MB 이하로 선택하세요.');
    status('엑셀을 읽고 있습니다.');
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    $('sheet').replaceChildren(...workbook.SheetNames.map(s => new Option(s, s)));
    $('sheet').disabled = false;
    const candidate = workbook.SheetNames.find(n => /\d+주차[QA]$/.test(n) && (() => { try { return LearnUsConverter.sections(XLSX.utils.sheet_to_json(workbook.Sheets[n], {header:1,defval:null,raw:true})).length > 0; } catch { return false; } })());
    if (candidate) $('sheet').value = candidate;
    selectSections();
  } catch (e) { status(e.message || '엑셀을 읽을 수 없습니다.', true); ready(); }
});
$('sheet').addEventListener('change', selectSections);
$('section').addEventListener('change', () => { invalidate(); ready(); });
$('worksheet').addEventListener('change', () => { filename('worksheet', 'worksheet-name'); invalidate(); ready(); });
$('form').addEventListener('submit', async e => {
  e.preventDefault(); invalidate(); $('convert').disabled = true; $('convert').textContent = '확인 중…';
  try {
    const file = $('worksheet').files[0];
    if (file.size > 5 * 1024 * 1024) throw Error('워크시트는 5MB 이하로 선택하세요.');
    const data = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    result = LearnUsConverter.convert(values(), LearnUsConverter.parseCsv(data), $('section').value);
    $('summary').textContent = `${$('section').value} · ${result.preview.length}명`;
    $('warning-count').textContent = `확인할 사항 ${result.warnings.length}건`;
    $('warnings').hidden = !result.warnings.length;
    $('warning-list').replaceChildren(...result.warnings.map(w => { const li = document.createElement('li'); li.textContent = w; return li; }));
    $('sample-note').textContent = `전체 ${result.preview.length}명 중 처음 ${Math.min(5, result.preview.length)}명을 표시합니다.`;
    $('preview').replaceChildren(...result.preview.slice(0, 5).map((r, i) => {
      const tr = document.createElement('tr');
      const cells = Array.from({ length: 4 }, () => tr.appendChild(document.createElement('td')));
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'test-student'; radio.value = i; radio.checked = i === 0; radio.setAttribute('aria-label', `${r.name} 1명 테스트 선택`); cells[0].append(radio);
      cells[1].textContent = r.name; const small = document.createElement('small'); small.textContent = r.id; cells[1].append(small);
      cells[2].textContent = `${r.grade} / ${r.maximum}`; cells[3].textContent = r.feedback;
      return tr;
    }));
    $('result').hidden = false; status(`엑셀 ${result.max}점 만점에서 워크시트 만점으로 환산했습니다. 점수·피드백 외의 열은 유지했습니다.`);
  } catch (e) { status(e.message || '변환에 실패했습니다.', true); }
  $('convert').textContent = '결과 확인'; ready();
});
function download(test) {
  if (!result) return;
  const chosen = Number(document.querySelector('input[name=test-student]:checked').value);
  const rows = test ? [result.rows[0], result.rows[chosen + 1]] : result.rows;
  const blob = new Blob([LearnUsConverter.csv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${$('sheet').value}_${$('section').value}_${test ? '1명테스트' : '전체'}_채점워크시트.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download').addEventListener('click', () => download(false));
$('test').addEventListener('click', () => download(true));

function renderCsvPreview() {
  const [headers, ...students] = previewRows;
  const find = (...names) => headers.findIndex(h => names.includes(h.trim()));
  const name = find('이름', 'Full name'), id = find('학번', 'ID number'), grade = find('성적', 'Grade'), max = find('최대 성적', 'Maximum grade'), feedback = find('피드백', 'Feedback comments');
  if ([name,id,grade,max,feedback].includes(-1)) throw Error('이름·학번·성적·최대 성적·피드백 열이 있는 채점 워크시트를 선택하세요.');
  const count = $('preview-count').value === 'all' ? students.length : Number($('preview-count').value);
  $('csv-preview-summary').textContent = `전체 ${students.length}명 중 ${Math.min(count, students.length)}명`;
  $('csv-preview-body').replaceChildren(...students.slice(0, count).map(r => {
    const tr = document.createElement('tr');
    const cells = Array.from({length:3}, () => tr.appendChild(document.createElement('td')));
    cells[0].textContent = r[name]; const small = document.createElement('small'); small.textContent = r[id]; cells[0].append(small);
    cells[1].textContent = `${r[grade].trim() || '미입력'} / ${r[max]}`;
    cells[2].textContent = r[feedback] || '피드백 없음';
    return tr;
  }));
  $('csv-preview-result').hidden = false;
}
$('csv-preview-file').addEventListener('change', async () => {
  $('csv-preview-result').hidden = true; previewRows = null;
  filename('csv-preview-file', 'csv-preview-name');
  try {
    const file = $('csv-preview-file').files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) throw Error('CSV는 5MB 이하로 선택하세요.');
    const data = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer());
    previewRows = LearnUsConverter.parseCsv(data); renderCsvPreview();
    $('preview-status').textContent = '점수와 피드백을 확인해주세요. CSV의 줄바꿈을 그대로 표시합니다.';
    $('preview-status').classList.remove('error');
  } catch(e) { previewRows = null; $('preview-status').textContent = e.message; $('preview-status').classList.add('error'); }
});
$('preview-count').addEventListener('change', () => { if (previewRows) renderCsvPreview(); });
