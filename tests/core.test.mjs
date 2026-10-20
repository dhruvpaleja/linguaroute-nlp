import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,ngrams,classify,languageMap,splitSegments,rowsToCSV} from '../public/core.js';
const model=JSON.parse(await readFile(new URL('../public/model/model.json',import.meta.url)));
const buffer=await readFile(new URL('../public/model/weights.f32',import.meta.url));
const weights=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4);
const fixtures=JSON.parse(await readFile(new URL('../evaluation/parity-fixtures.json',import.meta.url)));
test('exported model reproduces Python decisions and all 18 class scores on 60 held-out paragraphs',()=>{
  for(const fixture of fixtures){
    const r=classify(fixture.text,model,weights);
    assert.equal(r.code,fixture.predicted);
    for(const candidate of r.scores)assert.ok(Math.abs(candidate.score-fixture.scores[candidate.index])<1e-5,
      `score mismatch for ${candidate.code}`);
  }
});
test('Unicode normalization preserves accents and codepoint boundaries',()=>{
  assert.equal(normalize('  CAFE\u0301\nभारत  '),'café भारत');
  assert.deepEqual(ngrams('a😀b'),['a😀','😀b','a😀b']);
  assert.equal(Array.from(normalize('😀'.repeat(3002))).length,3000);
});
test('blank, oversized or incomplete model inputs fail explicitly',()=>{
  assert.throws(()=>classify('',model,weights),/Enter/);
  assert.throws(()=>classify('x'.repeat(12001),model,weights),/12,000/);
  assert.throws(()=>classify('Hello world',model,new Float32Array(1)),/incomplete/);
});
test('very short text and unseen symbols require human review',()=>{
  for(const text of ['Hello','12345678','😀😎🚀','あいうえお']){
    const result=classify(text,model,weights);
    assert.equal(result.status,'Review needed');
  }
});
test('sentence map separates Latin and Devanagari boundaries without losing text',()=>{
  assert.deepEqual(splitSegments('First sentence. Deuxième phrase!\nतीसरा वाक्य। चौथा वाक्य।'),
    ['First sentence.','Deuxième phrase!','तीसरा वाक्य।','चौथा वाक्य।']);
  assert.equal(languageMap('Hello.\nBonjour.',model,weights).length,2);
  assert.equal(splitSegments('Hello.\n'.repeat(100)).length,80);
  assert.equal(splitSegments('Visit example.com for more information.').length,1);
});
test('representative natural-language demo sentences predict their language',()=>{
  for(const [expected,text] of [
    ['eng','Our team would like to receive more information about the upcoming international conference and the registration process.'],
    ['fra','Notre équipe souhaite recevoir davantage d’informations sur la conférence internationale et les modalités d’inscription.'],
    ['spa','Nuestro equipo desea recibir más información sobre la conferencia internacional y el proceso de inscripción.'],
    ['hin','हमारी टीम आगामी अंतरराष्ट्रीय सम्मेलन और पंजीकरण प्रक्रिया के बारे में अधिक जानकारी प्राप्त करना चाहती है।']
  ])assert.equal(classify(text,model,weights).code,expected);
});
test('all returned scores and explanations are finite; contribution terms exist in input',()=>{
  const text='Este mensaje está escrito en español y solicita más información sobre el proceso de inscripción.';
  const r=classify(text,model,weights);
  assert.equal(r.scores.length,18);assert.ok(r.coverage>=0&&r.coverage<=1);
  for(const item of r.scores)assert.ok(Number.isFinite(item.score));
  for(const item of r.contributions){assert.ok(normalize(text).includes(item.gram));assert.ok(item.value>0);}
});
test('CSV export quotes messages and prevents spreadsheet formula injection',()=>{
  const result=classify('This is a complete English message about a conference.',model,weights);
  const csv=rowsToCSV([{text:'=HYPERLINK("bad")',result}]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.equal(csv.split('\r\n').length,2);
});
test('selected train and official test have no exact normalized text overlap',async()=>{
  const read=async name=>(await readFile(new URL('../data/'+name,import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
  const [train,heldout]=await Promise.all([read('train-selected.jsonl'),read('test-selected.jsonl')]);
  const keys=new Set(heldout.map(r=>normalize(r.text)));
  assert.equal(heldout.length,9000);
  assert.equal(new Set(train.map(r=>r.label)).size,18);
  for(const row of train)assert.ok(!keys.has(normalize(row.text)));
});
