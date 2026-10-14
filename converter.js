(function (root) {
  'use strict';
  const text = value => String(value ?? '').trim();
  const fail = message => { throw new Error(message); };
  function parseCsv(input) {
    input = input.replace(/^\uFEFF/, '');
    const rows = []; let row = [], field = '', quoted = false, closed = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { quoted = false; closed = true; }
        else field += ch;
      } else if (ch === '"') {
        if (field || closed) fail('CSV 따옴표 형식이 올바르지 않습니다.');
        quoted = true;
      } else if (ch === ',' || ch === '\n' || ch === '\r') {
        row.push(field); field = ''; closed = false;
        if (ch !== ',') {
          if (ch === '\r' && input[i + 1] === '\n') i++;
          if (row.some(v => v !== '')) rows.push(row);
          row = [];
        }
      } else {
        if (closed) fail('CSV 따옴표 뒤에 잘못된 문자가 있습니다.');
        field += ch;
      }
    }
    if (quoted) fail('CSV 따옴표가 닫히지 않았습니다.');
    if (field || row.length || closed) { row.push(field); rows.push(row); }
    if (rows.length < 2) fail('채점 워크시트에 학생 행이 없습니다.');
    if (rows.some(r => r.length !== rows[0].length)) fail('CSV 열 개수가 행마다 다릅니다.');
    return rows;
  }
  function csv(rows) {
    return '\uFEFF' + rows.map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
  }
  function schema(rows) {
    // Header candidates are read cell by cell: avoid concatenating student data into a header.
    const find = pattern => {
      for (const row of rows.slice(0, 8)) {
        const col = row.findIndex(v => pattern.test(text(v)));
        if (col >= 0) return col;
      }
      return -1;
    };
    const id = find(/^학번$/), name = find(/^(성명|이름)$/), section = find(/^분반$/);
    const problems = [];
    let total = -1;
    for (const row of rows.slice(0, 8)) row.forEach((v, i) => {
      const match = text(v).match(/^(\d+)번\s*\(\s*(\d+(?:\.\d+)?)\s*점\s*\)/);
      if (match && !problems.some(p => p.col === i)) {
        if (!/비고|감점|피드백/.test(text(row[i + 1]))) fail(`${match[1]}번 문제 옆의 감점 사유 열을 찾지 못했습니다.`);
        problems.push({ col: i, reason: i + 1, number: match[1], max: Number(match[2]) });
      }
      if (/^총점/.test(text(v))) total = i;
    });
    if ([id, name, section].includes(-1) || !problems.length) fail('학번·성명·분반과 “1번(10점)” 형태의 점수 열이 필요합니다.');
    const max = problems.reduce((n, p) => n + p.max, 0);
    if (!(max > 0)) fail('문제 배점이 올바르지 않습니다.');
    return { id, name, section, problems, total, max };
  }
  function sections(rows) {
    const s = schema(rows);
    return [...new Set(rows.filter(r => /^\d{10}$/.test(text(r[s.id]))).map(r => text(r[s.section])).filter(Boolean))];
  }
  function validate(rows, selectedSection) {
    const s = schema(rows), students = new Map();
    const errors = []; let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (text(r[s.section]) !== selectedSection) continue;
      count++;
      const id = text(r[s.id]);
      const add = message => errors.push({ row: i + 1, id, name: text(r[s.name]), message });
      if (!/^\d{10}$/.test(id)) add('학번이 비었거나 10자리 숫자가 아닙니다.');
      if (!text(r[s.name])) add('학생 이름이 비었습니다.');
      if (students.has(id)) add('학번이 중복되었습니다.');
      let validScores = true;
      let score = 0; const reasons = [];
      for (const p of s.problems) {
        const value = r[p.col], reason = text(r[p.reason]);
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > p.max) {
          add(`${p.number}번 점수가 비었거나 숫자가 아니거나 배점(0~${p.max})을 벗어났습니다.`);
          validScores = false;
        } else {
          if (value < p.max && !reason) add(`${p.number}번 감점 사유가 없습니다.`);
          score += value;
        }
        if (reason) reasons.push(s.problems.length > 1 ? `[문제 ${p.number}]\n${reason}` : reason);
      }
      if (s.total >= 0) {
        if (typeof r[s.total] !== 'number' || !Number.isFinite(r[s.total])) add('총점이 비었거나 숫자가 아닙니다. Excel에서 계산 후 저장하세요.');
        else if (validScores && Math.abs(r[s.total] - score) > 1e-8) add('문제 점수 합계와 총점이 다릅니다. Excel에서 계산 후 다시 저장하세요.');
      }
      students.set(id, { id, name: text(r[s.name]), score, feedback: reasons.join('\n\n') || '감점 없음' });
    }
    if (!count) errors.push({row:null,id:'',name:'',message:'선택한 분반에 학생이 없습니다. 비어 있는 시트인지 확인하세요.'});
    return { ok: errors.length === 0, count, errors, max:s.max, students };
  }
  function activityInfo(value) {
    value = text(value).normalize('NFC');
    const quiz=/quiz|퀴즈|\d+\s*주차\s*Q(?:\b|_)/i.test(value), assignment=/assignment|어사인먼트|과제|\d+\s*주차\s*A(?:\b|_)/i.test(value);
    const type=quiz===assignment?null:quiz?'Quiz':'Assignment';
    const week = value.match(/(\d+)\s*주차/i)?.[1] ?? null;
    const section = value.match(/ENG\d+\.(\d{2})[_-](\d{2})/i);
    return {type,week:week===null?null:Number(week),section:section?section[1]+'-'+section[2]:null};
  }
  function matchActivity(sheetName, excelName, csvName, selectedSection, manualExcelType, manualCsvType) {
    const sheet=activityInfo(sheetName), excel=activityInfo(excelName), csv=activityInfo(csvName);
    const source={type:sheet.type||excel.type||manualExcelType||null,week:sheet.week??excel.week};
    const target={...csv,type:csv.type||manualCsvType||null};
    const errors=[],warnings=[];
    if (!['Quiz','Assignment'].includes(source.type) || !['Quiz','Assignment'].includes(target.type)) errors.push('종류를 자동 확인할 수 없는 파일은 Quiz 또는 Assignment를 직접 선택하세요.');
    else if (source.type!==target.type) errors.push(`종류 불일치: 엑셀은 ${source.type}, CSV는 ${target.type}입니다.`);
    if(source.week!==null&&target.week!==null&&source.week!==target.week) errors.push(`주차 불일치: 엑셀은 ${source.week}주차, CSV는 ${target.week}주차입니다.`);
    if(target.section&&target.section!==selectedSection) errors.push(`분반 불일치: 선택한 분반은 ${selectedSection}, CSV 파일명은 ${target.section}입니다.`);
    if(source.week===null||target.week===null) warnings.push('파일명에서 양쪽 주차를 모두 확인할 수 없습니다. 같은 활동의 워크시트인지 확인하세요.');
    if(!csv.type||(!sheet.type&&!excel.type)) warnings.push('파일 종류를 직접 선택했습니다. 실제 활동과 일치하는지 확인하세요.');
    return {ok:errors.length===0,source,target,errors,warnings};
  }
  function convert(rows, worksheetRows, selectedSection) {
    const checked=validate(rows,selectedSection);
    if(!checked.ok) {const e=checked.errors[0];fail(`${e.row?e.row+'행 ':''}${e.id}: ${e.message} (총 ${checked.errors.length}건)`);}
    const students=checked.students;
    const [headers, ...original] = worksheetRows;
    const col = (...names) => headers.findIndex(h => names.includes(text(h)));
    const idCol = col('학번', 'ID number'), participant = col('식별자', 'Identifier'), gradeCol = col('성적', 'Grade'), maxCol = col('최대 성적', 'Maximum grade'), feedbackCol = col('피드백', 'Feedback comments');
    if ([idCol, participant, gradeCol, maxCol, feedbackCol].includes(-1)) fail('LearnUs 채점 워크시트 CSV의 식별자·학번·성적·최대 성적·피드백 열이 필요합니다.');
    const seen = new Set(), participantIds = new Set(), output = [], preview = [], warnings = [];
    for (const r of original) {
      const id = text(r[idCol]), key = text(r[participant]);
      if (!id || !key || seen.has(id) || participantIds.has(key)) fail(`워크시트 식별자가 없거나 중복입니다: ${id}`);
      seen.add(id); participantIds.add(key);
      const student = students.get(id);
      if (!student) fail(`워크시트 학생 ${id}가 선택한 분반 엑셀에 없습니다. 해당 분반의 워크시트인지 확인하세요.`);
      const maximum = Number(r[maxCol]);
      if (!Number.isFinite(maximum) || maximum <= 0) fail(`${id}: 워크시트 최대 성적이 올바르지 않습니다.`);
      const changed = r.slice(), grade = Number((student.score / checked.max * maximum).toFixed(8));
      changed[gradeCol] = String(grade); changed[feedbackCol] = student.feedback;
      if (text(r[gradeCol]) || text(r[feedbackCol])) warnings.push(`${student.name} (${id}): 기존 점수 또는 피드백을 교체합니다.`);
      output.push(changed); preview.push({ ...student, grade, maximum });
    }
    for (const [id, student] of students) if (!seen.has(id)) warnings.push(`${student.name} (${id}): 워크시트에 없어 제외했습니다.`);
    if (!output.length) fail('변환할 학생이 없습니다.');
    return { rows: [headers, ...output], preview, warnings, max: checked.max };
  }
  const api = { parseCsv, csv, schema, sections, validate, activityInfo, matchActivity, convert };
  if (typeof module !== 'undefined') module.exports = api;
  else root.LearnUsConverter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
