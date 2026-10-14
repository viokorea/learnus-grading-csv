'use strict';
const $ = id => document.getElementById(id);
let workbook, result, previewRows, validated = false, sourceRejected = false, revision = 0, highlighted = null;
const values = () => XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value], { header: 1, defval: null, raw: true });
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
function invalidate(resetValidation = true) {
  revision++;
  result = null; $('result').hidden = true; $('activity-confirm').checked = false;
  if (resetValidation) {
    validated = false; sourceRejected=false; $('validation-result').hidden = false;
    $('validation-result').setAttribute('data-state','pending'); $('validation-symbol').textContent='—';
    $('validation-summary').textContent='검증 결과를 기다리고 있습니다'; $('validation-summary').className='';
    $('validation-detail').textContent='왼쪽에서 시트·분반을 선택한 뒤 검증하기를 누르세요.';
    $('validation-errors').replaceChildren();
  }
}
function hint(id, message) {
  $('next-hint').textContent=message;
  if(highlighted!==id) {
    if(highlighted) $(highlighted).classList.remove('next-action');
    if(id) $(id).classList.add('next-action');
    highlighted=id;
  }
}
function reveal(id) {
  const reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(typeof $(id).scrollIntoView==='function') $(id).scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
}
function activity() {
  const file = $('worksheet').files[0];
  $('activity-check').hidden = !validated || !file;
  if (!validated || !file) return null;
  const source = LearnUsConverter.activityInfo($('sheet').value).type || LearnUsConverter.activityInfo($('excel').files[0]?.name).type;
  const target = LearnUsConverter.activityInfo(file.name).type;
  if (source) $('excel-type').value = source;
  if (target) $('csv-type').value = target;
  $('excel-type').disabled = Boolean(source); $('csv-type').disabled = Boolean(target);
  const matched = LearnUsConverter.matchActivity($('sheet').value, $('excel').files[0]?.name, file.name, $('section').value, $('excel-type').value, $('csv-type').value);
  const label = info => `${info.type || '종류 미확인'}${info.week === null ? ' · 주차 미확인' : ' · '+info.week+'주차'}`;
  $('activity-status').textContent = [`엑셀: ${label(matched.source)} / CSV: ${label(matched.target)}`, ...matched.errors, ...matched.warnings].join('\n');
  $('activity-status').className = matched.ok ? '' : 'error';
  $('activity-confirm-label').hidden = !matched.warnings.length;
  return matched;
}
function ready() {
  $('validate').disabled = !workbook || !$('sheet').value || !$('section').value;
  $('worksheet-stage').hidden = !validated;
  $('worksheet').disabled = !validated;
  const matched = activity();
  $('convert').disabled = !validated || !matched?.ok || (matched.warnings.length > 0 && !$('activity-confirm').checked);
  if(result) hint('download','다음: 위의 5명과 안내 사항을 확인하고 전체 CSV를 다운로드하세요.');
  else if(!workbook) hint('excel-target','다음: 채점 엑셀 파일을 선택하세요.');
  else if(!$('sheet').value) hint('sheet-target','다음: 채점할 시트를 선택하세요.');
  else if(!$('section').value) hint('section-target','다음: 채점할 분반을 선택하세요.');
  else if(sourceRejected) hint('excel-target','다음: 오류를 수정한 엑셀 파일을 다시 선택하세요.');
  else if(!validated) hint('validate','다음: 시트·분반을 확인하고 검증하기를 누르세요.');
  else if(!$('worksheet').files.length) hint('worksheet-target','다음: 아래에서 LearnUs 채점 워크시트 CSV를 선택하세요.');
  else if(!matched?.ok) hint('activity-check','다음: 활동 종류·주차·분반이 일치하는지 확인하세요.');
  else if(matched.warnings.length&&!$('activity-confirm').checked) hint('activity-confirm-label','다음: 자동 확인이 어려운 항목을 확인하고 체크하세요.');
  else hint('convert','다음: 변환 결과 확인을 눌러 미리보기를 확인하세요.');
}
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
  if(!$('sheet').value) { $('section').replaceChildren(new Option('시트를 선택하세요','')); $('section').disabled=true; status('채점할 시트를 선택하세요.'); ready(); return; }
  try {
    const sections = LearnUsConverter.sections(values());
    $('section').replaceChildren(new Option('분반을 선택하세요',''),...sections.map(s => new Option(s, s)));
    $('section').value='';
    $('section').disabled = !sections.length;
    $('excel-type').value = '';
    status(sections.length ? '시트와 분반을 확인한 뒤 검증하기를 누르세요.' : '이 시트에는 학생 명단이 없습니다.');
  } catch (e) { $('section').replaceChildren(new Option('채점 시트를 선택하세요', '')); $('section').disabled = true; status(e.message, true); }
  ready();
}
$('excel').addEventListener('change', async () => {
  invalidate(); workbook = null; $('convert').disabled = true;
  const version=revision;
  $('sheet').replaceChildren(new Option('엑셀을 먼저 선택하세요','')); $('sheet').disabled=true;
  $('section').replaceChildren(new Option('시트를 선택하세요','')); $('section').disabled=true;
  ready();
  filename('excel', 'excel-name');
  try {
    const file = $('excel').files[0];
    if (!file) { ready(); return; }
    if (file.size > 20 * 1024 * 1024) throw Error('엑셀 파일은 20MB 이하로 선택하세요.');
    status('엑셀을 읽고 있습니다.');
    const bytes=await file.arrayBuffer();
    if(version!==revision) return;
    workbook = XLSX.read(bytes, { type: 'array' });
    $('sheet').replaceChildren(new Option('채점 시트를 선택하세요',''),...workbook.SheetNames.map(s => new Option(s, s)));
    $('sheet').value='';
    $('sheet').disabled = false;
    selectSections();
  } catch (e) { status(e.message || '엑셀을 읽을 수 없습니다.', true); ready(); }
});
$('sheet').addEventListener('change', selectSections);
$('section').addEventListener('change', () => { invalidate(); status('분반이 바뀌었습니다. 다시 검증해주세요.'); ready(); });
$('worksheet').addEventListener('change', () => { filename('worksheet', 'worksheet-name'); $('csv-type').value=''; invalidate(false); ready(); });
$('validate').addEventListener('click', () => {
  invalidate();
  try {
    const checked = LearnUsConverter.validate(values(), $('section').value);
    validated = checked.ok; sourceRejected=!checked.ok;
    $('validation-summary').textContent = checked.ok ? `검증 통과 · ${$('section').value} ${checked.count}명` : `검증 실패 · ${checked.errors.length}건`;
    $('validation-summary').className = checked.ok ? 'success' : 'error';
    $('validation-result').setAttribute('data-state',checked.ok?'success':'error');
    $('validation-symbol').textContent=checked.ok?'✓':'!';
    $('validation-detail').textContent=checked.ok?'모든 문제의 점수·감점 사유·총점을 확인했습니다. 아래에서 LearnUs 워크시트를 연결하세요.':'아래 항목을 수정한 엑셀로 다시 검증하세요.';
    $('validation-errors').replaceChildren(...checked.errors.map(e => { const li=document.createElement('li'); li.textContent=`${e.row ? e.row+'행 · ' : ''}${e.name} ${e.id} · ${e.message}`; return li; }));
    $('validation-result').hidden=false;
    status(checked.ok ? '점수와 사유 검증을 통과했습니다. 같은 활동의 워크시트 CSV를 선택하세요.' : '누락 항목을 수정해 엑셀을 다시 선택하세요.');
  } catch(e) { validated=false; sourceRejected=true; $('validation-summary').textContent=e.message; $('validation-summary').className='error'; $('validation-result').setAttribute('data-state','error'); $('validation-symbol').textContent='!'; $('validation-detail').textContent='파일과 선택한 시트를 확인하세요.'; $('validation-errors').replaceChildren(); $('validation-result').hidden=false; status('검증에 실패했습니다.',true); }
  ready();
  if(validated) reveal('worksheet-stage');
});
for(const id of ['excel-type','csv-type']) $(id).addEventListener('change',()=>{invalidate(false);ready();});
$('activity-confirm').addEventListener('change',()=>{revision++;result=null;$('result').hidden=true;ready();});
$('form').addEventListener('submit', async e => {
  e.preventDefault(); result=null; $('result').hidden=true; $('convert').disabled = true; $('convert').textContent = '확인 중…';
  const version=revision;
  try {
    const matched=activity();
    if(!validated || !matched?.ok || (matched.warnings.length && !$('activity-confirm').checked)) throw Error('엑셀 검증과 활동 종류 확인을 먼저 완료하세요.');
    const file = $('worksheet').files[0];
    if (file.size > 5 * 1024 * 1024) throw Error('워크시트는 5MB 이하로 선택하세요.');
    const data = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if(version!==revision) throw Error('입력 파일이나 선택 항목이 바뀌었습니다. 다시 확인해주세요.');
    result = LearnUsConverter.convert(values(), LearnUsConverter.parseCsv(data), $('section').value);
    $('summary').textContent = `${$('section').value} · ${result.preview.length}명`;
    $('warning-count').textContent = `확인할 사항 ${result.warnings.length}건`;
    $('warnings').hidden = !result.warnings.length;
    $('warning-list').replaceChildren(...result.warnings.map(w => { const li = document.createElement('li'); li.textContent = w; return li; }));
    $('sample-note').textContent = `전체 ${result.preview.length}명 중 처음 ${Math.min(5, result.preview.length)}명을 표시합니다.`;
    $('preview').replaceChildren(...result.preview.slice(0, 5).map(r => {
      const tr = document.createElement('tr');
      const cells = Array.from({ length: 3 }, () => tr.appendChild(document.createElement('td')));
      cells[0].textContent = r.name; const small = document.createElement('small'); small.textContent = r.id; cells[0].append(small);
      cells[1].textContent = `${r.grade} / ${r.maximum}`; cells[2].textContent = r.feedback;
      return tr;
    }));
    $('result').hidden = false; status(`엑셀 ${result.max}점 만점에서 워크시트 만점으로 환산했습니다. 점수·피드백 외의 열은 유지했습니다.`);
    reveal('result');
  } catch (e) { status(e.message || '변환에 실패했습니다.', true); }
  $('convert').textContent = '변환 결과 확인'; ready();
});
function download() {
  if (!result) return;
  const blob = new Blob([LearnUsConverter.csv(result.rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${$('sheet').value}_${$('section').value}_전체_채점워크시트.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download').addEventListener('click', download);
ready();

function renderCsvPreview() {
  const [headers, ...students] = previewRows;
  const find = (...names) => headers.findIndex(h => names.includes(h.trim()));
  const name = find('이름', 'Full name'), id = find('학번', 'ID number'), grade = find('성적', 'Grade'), max = find('최대 성적', 'Maximum grade'), feedback = find('피드백', 'Feedback comments');
  if ([name,id,grade,max,feedback].includes(-1)) throw Error('이름·학번·성적·최대 성적·피드백 열이 있는 채점 워크시트를 선택하세요.');
  const count = 5;
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
