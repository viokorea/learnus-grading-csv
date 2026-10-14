const assert = require('node:assert/strict');
const C = require('../converter.js');
const quiz = [
  ['No', '학과', '학년', '학번', '성명'],
  [null, null, null, null, null, '분반', '1번(10점)', '비고(감점요인)', '총점(10점)'],
  [1, '공학', 1, '2099000001', '예제학생 A', '04-02', 4, '파일명 오류 -2점\n선언 오류 -1점\nscanf 코드 오류 -1점\nsizeof 코드 오류 -1점\n형변환 코드 오류 -1점', 4],
  [2, '공학', 1, '2099000002', '예제학생 B', '04-02', 7, '오류 -3점', 7],
  [3, '공학', 1, '2099000003', '다른분반', '04-01', 10, null, 10]
];
const worksheet = [['식별자','이름','학번','성적','최대 성적','피드백','채점 수정일'], ['참가자99990001','예제학생 A','2099000001','','100.00','','2000-01-01 00:00']];
let result = C.convert(quiz, worksheet, '04-02');
assert.equal(result.rows[1][3], '40');
assert.equal(result.rows[1][5], quiz[2][7]);
assert.equal(result.rows[1][0], worksheet[1][0]);
assert.equal(result.rows[1][6], worksheet[1][6]);
assert.equal(result.warnings.length, 1);
assert.deepEqual(C.parseCsv(C.csv(result.rows)), result.rows);
const assignment = quiz.map(r => r.slice());
assignment[1] = [null,null,null,null,null,'분반','1번(5점)','비고(감점요인)','2번(5점)','비고(감점요인)','총점(10점)'];
assignment[2] = [1,'공학',1,'2099000001','예제학생 A','04-02',4,'파일명 오류 -1',3,'출력 오류 -2',7];
assignment.splice(3);
result = C.convert(assignment, worksheet, '04-02');
assert.equal(result.rows[1][3], '70');
assert.equal(result.rows[1][5], '[문제 1]\n파일명 오류 -1\n\n[문제 2]\n출력 오류 -2');
assert.throws(() => C.convert([...quiz, quiz[2]], worksheet, '04-02'), /중복/);
assert.throws(() => C.convert(quiz, [worksheet[0], ['참가자1','없는학생','2099009999','','100','','']], '04-02'), /없습니다/);
const blank = quiz.map(r => r.slice()); blank[2][6] = null;
assert.throws(() => C.convert(blank, worksheet, '04-02'), /점수/);
const mismatch = assignment.map(r => r.slice()); mismatch[2][10] = 8;
assert.throws(() => C.convert(mismatch, worksheet, '04-02'), /총점/);
const noReason = quiz.map(r => r.slice()); noReason[2][7] = '';
assert.throws(() => C.convert(noReason, worksheet, '04-02'), /사유/);
assert.deepEqual(C.parseCsv(C.csv([['a','b'],['comma, "quote"','line1\nline2']])), [['a','b'],['comma, "quote"','line1\nline2']]);
assert.throws(() => C.parseCsv('a,b\n"unclosed'), /닫히지/);
const unfinished=quiz.map(r=>r.slice());unfinished[2][6]=null;unfinished[3][7]='';
const report=C.validate(unfinished,'04-02');
assert.equal(report.ok,false);assert.equal(report.errors.length,2);assert.equal(report.count,2);
assert.equal(C.validate(quiz,'99-99').ok,false);
const full=quiz.map(r=>r.slice());full[2][6]=10;full[2][7]='';full[2][8]=10;
assert.equal(C.validate(full,'04-02').ok,true);
const missingTotal=quiz.map(r=>r.slice());missingTotal[2][8]=null;
assert.equal(C.validate(missingTotal,'04-02').ok,false);
assert.equal(C.matchActivity('3주차Q','Quiz.xlsx','성적-ENG1108.04_02-3 주차 Quiz.csv','04-02').ok,true);
assert.equal(C.matchActivity('3주차A','Assignment.xlsx','성적-3 주차 Quiz.csv','04-02').ok,false);
assert.equal(C.matchActivity('3주차Q','Quiz.xlsx','성적-4 주차 Quiz.csv','04-02').ok,false);
assert.equal(C.matchActivity('3주차Q','Quiz.xlsx','성적-ENG1108.04_01-3 주차 Quiz.csv','04-02').ok,false);
assert.equal(C.matchActivity('3주차Q','Quiz.xlsx','worksheet.csv','04-02').ok,false);
assert.equal(C.matchActivity('3주차Q','Quiz.xlsx','worksheet.csv','04-02',null,'Quiz').ok,true);
assert.equal(C.activityInfo('Quiz_Assignment.xlsx').type,null);
console.log('PASS: quiz, assignment, scaling, CSV multiline, identifiers, missing/duplicate students, score validation');
