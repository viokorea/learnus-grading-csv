// Regression: preview only five rows, but download every matched student.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const converter = require('../converter.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
class Element {
  constructor() { this.value = ''; this.files = []; this.children = []; this.events = {}; this.classList = {toggle(){},remove(){},add(){}}; }
  addEventListener(type, fn) { this.events[type] = fn; }
  replaceChildren(...children) { this.children = children; if (children[0]?.value) this.value = children[0].value; }
  appendChild(child) { this.children.push(child); return child; }
  append(child) { this.children.push(child); }
  setAttribute() {}
  removeAttribute() {}
  click() {}
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
const file = {name:'synthetic.csv',size:100,arrayBuffer:async()=>new TextEncoder().encode(converter.csv(csvRows)).buffer};
get('excel').files = [{...file,name:'synthetic.xlsx'}];
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
  await get('excel').events.change();
  await get('form').events.submit({preventDefault(){}});
  assert.equal(get('result').hidden,false);
  assert.equal(get('preview').children.length,5);
  get('download').events.click();
  const exported = converter.parseCsv(await downloaded.text());
  assert.equal(exported.length,7);
  assert.equal(exported[6][2],'2099000005');
  assert.equal(exported[6][5],'사유 A -1점\n사유 B -2점');
  get('csv-preview-file').files=[file];
  await get('csv-preview-file').events.change();
  assert.equal(get('csv-preview-result').hidden,false);
  assert.equal(get('csv-preview-body').children.length,5);
  assert.ok(!html.includes('id="test"')&&!html.includes('id="preview-count"'));
  const guide=html.slice(html.indexOf('id="guide-view"'));
  assert.ok(guide.indexOf('피드백 기능 활성화하기')<guide.indexOf('채점 워크시트 다운로드하기'));
  for (const image of [...html.matchAll(/<img src="([^"]+)"/g)]) assert.ok(fs.existsSync(__dirname+'/../'+image[1]));
  console.log('PASS: five-row previews, full download, preserved newlines, settings-first guide, screenshot assets');
})().catch(e=>{console.error(e);process.exitCode=1});
