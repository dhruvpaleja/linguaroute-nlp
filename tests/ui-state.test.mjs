// Runs the real event handlers against a minimal DOM surface. No browser/network
// is used; model files are the actual exported files supplied to the application.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const model=JSON.parse(await readFile(new URL('../public/model/model.json',import.meta.url),'utf8'));
const weightBytes=await readFile(new URL('../public/model/weights.f32',import.meta.url));
const report=JSON.parse(await readFile(new URL('../public/model/classification-report.json',import.meta.url),'utf8'));
class Element{
  constructor(id=''){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.disabled=false;this.hidden=false;this.events=new Map();}
  addEventListener(name,handler){this.events.set(name,handler);}
  emit(name,event={}){if(name==='click'&&this.disabled)return;return this.events.get(name)?.({target:this,...event});}
  focus(){}
  click(){if(this.href)downloads.push({href:this.href,name:this.download});else this.emit('click');}
}
const elements=new Map(),downloads=[],blobs=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},createElement(){return new Element();}};
const $=id=>document.getElementById(id);
$('analyse').disabled=true;$('batch-analyse').disabled=true;$('export').disabled=true;
globalThis.fetch=async path=>({ok:true,
  json:async()=>path.includes('classification-report')?report:model,
  arrayBuffer:async()=>weightBytes.buffer.slice(weightBytes.byteOffset,weightBytes.byteOffset+weightBytes.byteLength)});
URL.createObjectURL=blob=>{const key=`blob:test-${blobs.size+1}`;blobs.set(key,blob);return key;};
URL.revokeObjectURL=()=>{};
await import('../public/app.js');
for(let i=0;i<20&&$('analyse').disabled;i++)await new Promise(resolve=>setImmediate(resolve));
assert.equal($('analyse').disabled,false,'Real app model-loading path should finish');
const english='Our team is preparing for an international conference and needs information about registration.';

test('editing or clearing single text invalidates visible prediction and sentence map',()=>{
  $('input').value=english;$('analyse').emit('click');
  assert.ok($('prediction').innerHTML.includes('English'));assert.equal($('sentence-section').hidden,false);
  $('input').value='Changed';$('input').emit('input');
  assert.equal($('prediction').innerHTML.includes('language-name'),false);
  assert.equal($('sentence-section').hidden,true);assert.equal($('sentence-map').innerHTML,'');
  $('input').value=english;$('analyse').emit('click');$('clear').emit('click');
  assert.equal($('input').value,'');assert.equal($('prediction').innerHTML.includes('language-name'),false);
});
test('empty analysis cannot retain the previous prediction',()=>{
  $('input').value=english;$('analyse').emit('click');
  $('input').value='   ';$('analyse').emit('click');
  assert.match($('error').textContent,/Enter some text/);
  assert.equal($('prediction').innerHTML.includes('language-name'),false);
  assert.equal($('sentence-section').hidden,true);
});
test('editing a batch immediately revokes prior CSV and table',()=>{
  $('batch-input').value=english;$('batch-analyse').emit('click');
  assert.equal($('export').disabled,false);assert.ok($('batch-table').innerHTML.includes('English'));
  $('batch-input').value='Different data';$('batch-input').emit('input');
  assert.equal($('export').disabled,true);assert.equal($('batch-table').innerHTML,'');
  const before=downloads.length;$('export').emit('click');assert.equal(downloads.length,before);
});
test('invalid replacement batch clears old export for empty, line-count and per-message limits',()=>{
  for(const value of ['', 'Hello\n'.repeat(51), 'x'.repeat(12001)]){
    $('batch-input').value=english;$('batch-analyse').emit('click');
    assert.equal($('export').disabled,false);
    $('batch-input').value=value;$('batch-analyse').emit('click');
    assert.equal($('export').disabled,true);assert.equal($('batch-table').innerHTML,'');
    assert.ok($('batch-status').textContent.length>0);
  }
});
test('export contains the current successful batch and UTF-8 BOM for multilingual Excel text',async()=>{
  const text='हमारी टीम आगामी अंतरराष्ट्रीय सम्मेलन के बारे में अधिक जानकारी प्राप्त करना चाहती है।';
  $('batch-input').value=text;$('batch-analyse').emit('click');$('export').emit('click');
  const record=downloads.at(-1);assert.equal(record.name,'linguaroute-language-routing.csv');
  const blob=blobs.get(record.href),bytes=new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);
  const content=await blob.text();assert.ok(content.includes(text));assert.equal(content.includes(english),false);
});
