// Regression: preview only five rows, but download every matched student.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const converter = require('../converter.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
class Element {
  constructor() { this.value = ''; this.files = []; this.children = []; this.events = {}; this.attributes={};this.scrolled=false;const classes=new Set();this.classList = {toggle(){},remove(c){classes.delete(c)},add(c){classes.add(c)},contains(c){return classes.has(c)}}; }
  addEventListener(type, fn) { this.events[type] = fn; }
  replaceChildren(...children) { this.children = children; if (children[0]?.value) this.value = children[0].value; }
  appendChild(child) { this.children.push(child); return child; }
  append(child) { this.children.push(child); }
  setAttribute(k,v) {this.attributes[k]=v;}
  removeAttribute() {}
  click() {}
  scrollIntoView() {this.scrolled=true;}
}
const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
const get = id => { assert.ok(elements.has(id), `Missing HTML element: ${id}`); return elements.get(id); };
const rows = [['No','학과','학년','학번','성명'],[null,null,null,null,null,'분반','1번(10점)','비고(감점요인)','총점(10점)']];
const csvRows = [['식별자','이름','학번','성적','최대 성적','피드백']];
for (let i=0;i<6;i++) {
  const id = '209900000' + i;
  rows.push([i,'예제',1,id,'가상 학생 '+i,'04-02',7,'사유 A -1점\n사유 B -2점',7]);
  csvRows.push(['참가자999'+i,'가상 학생 '+i,id,'','100','']);
}
const file = {name:'성적-ENG1108.04_02-3 주차 Quiz.csv',size:100,arrayBuffer:async()=>new TextEncoder().encode(converter.csv(csvRows)).buffer};
get('excel').files = [{...file,name:'Quiz_3주차.xlsx'}];
get('worksheet').files = [file];
let downloaded;
const context = {console,TextDecoder,Blob,setTimeout(){},Option:function(label,value){this.value=value},
  LearnUsConverter:converter,location:{hash:''},window:{addEventListener(){}},
  document:{getElementById:get,querySelectorAll(){return []},createElement(){return new Element()}},
  XLSX:{read(){return {SheetNames:['3주차Q'],Sheets:{'3주차Q':{}}}},utils:{sheet_to_json(){return rows}}},
  URL:{createObjectURL(blob){downloaded=blob;return 'blob:synthetic'},revokeObjectURL(){}}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/../app.js','utf8'),context);
(async()=>{
  assert.equal(get('worksheet-stage').hidden,true);
  assert.equal(get('excel-target').classList.contains('next-action'),true);
  await get('excel').events.change();
  assert.equal(get('sheet-target').classList.contains('next-action'),true);
  get('sheet').value='3주차Q';get('sheet').events.change();
  assert.equal(get('section-target').classList.contains('next-action'),true);
  get('section').value='04-02';get('section').events.change();
  assert.equal(get('validate').classList.contains('next-action'),true);
  assert.equal(get('convert').disabled,true);
  assert.equal(get('worksheet').disabled,true);
  get('validate').events.click();
  assert.equal(get('validation-symbol').textContent,'✓');
  assert.equal(get('validation-result').attributes['data-state'],'success');
  assert.equal(get('worksheet-stage').hidden,false);
  assert.equal(get('worksheet-stage').scrolled,true);
  assert.equal(get('worksheet').disabled,false);
  await get('worksheet').events.change();
  assert.equal(get('convert').disabled,false);
  assert.equal(get('convert').classList.contains('next-action'),true);
  await get('form').events.submit({preventDefault(){}});
  assert.equal(get('result').hidden,false);
  assert.equal(get('preview').children.length,5);
  assert.equal(get('download').classList.contains('next-action'),true);
  get('download').events.click();
  const exported = converter.parseCsv(await downloaded.text());
  assert.equal(exported.length,7);
  assert.equal(exported[6][2],'2099000005');
  assert.equal(exported[6][5],'사유 A -1점\n사유 B -2점');
  get('csv-preview-file').files=[file];
  await get('csv-preview-file').events.change();
  assert.equal(get('csv-preview-result').hidden,false);
  assert.equal(get('csv-preview-body').children.length,5);
  get('worksheet').files=[{...file,name:'성적-ENG1108.04_02-3 주차 Assignment.csv'}];
  await get('worksheet').events.change();
  assert.equal(get('convert').disabled,true);
  get('worksheet').files=[{...file,name:'unknown.csv'}];
  await get('worksheet').events.change();
  assert.equal(get('convert').disabled,true);
  get('csv-type').value='Quiz';get('csv-type').events.change();
  assert.equal(get('convert').disabled,true);
  get('activity-confirm').checked=true;get('activity-confirm').events.change();
  assert.equal(get('convert').disabled,false);
  get('section').events.change();
  assert.equal(get('convert').disabled,true);
  assert.equal(get('worksheet').disabled,true);
  assert.equal(get('worksheet-stage').hidden,true);
  rows[2][6]=null; rows[3][7]='';
  get('validate').events.click();
  assert.equal(get('worksheet').disabled,true);
  assert.equal(get('validation-errors').children.length,2);
  assert.equal(get('validation-symbol').textContent,'!');
  assert.equal(get('excel-target').classList.contains('next-action'),true);
  assert.ok(!html.includes('id="test"')&&!html.includes('id="preview-count"'));
  const guide=html.slice(html.indexOf('id="guide-view"'));
  assert.ok(guide.indexOf('피드백 기능 활성화하기')<guide.indexOf('채점 워크시트 다운로드하기'));
  for (const image of [...html.matchAll(/<img src="([^"]+)"/g)]) assert.ok(fs.existsSync(__dirname+'/../'+image[1]));
  console.log('PASS: validation gate, kind matching, unknown-file confirmation, selection invalidation, five-row previews, full download, guide assets');
})().catch(e=>{console.error(e);process.exitCode=1});
