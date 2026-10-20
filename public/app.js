import {classify,languageMap,splitSegments,rowsToCSV} from './core.js';
const $=id=>document.getElementById(id);
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model,weights,rows=[];
const examples=[
  ['English','Our team would like to receive more information about the upcoming international conference and the registration process.'],
  ['French','Notre équipe souhaite recevoir davantage d’informations sur la conférence internationale et les modalités d’inscription.'],
  ['Spanish','Nuestro equipo desea recibir más información sobre la conferencia internacional y el proceso de inscripción.'],
  ['Hindi','हमारी टीम आगामी अंतरराष्ट्रीय सम्मेलन और पंजीकरण प्रक्रिया के बारे में अधिक जानकारी प्राप्त करना चाहती है।'],
  ['Mixed sentences','Our team is preparing for an international conference next month.\nNotre équipe prépare une conférence internationale pour le mois prochain.\nहमारी टीम अगले महीने एक अंतरराष्ट्रीय सम्मेलन की तैयारी कर रही है।'],
  ['Too short','Hello']
];
$('examples').innerHTML=examples.map(([name],i)=>`<button type="button" class="sample" data-example="${i}">${name}</button>`).join('');
$('examples').addEventListener('click',e=>{const b=e.target.closest('[data-example]');if(!b)return;$('input').value=examples[Number(b.dataset.example)][1];counter();if(model)analyse();});
function counter(){$('counter').textContent=`${$('input').value.length.toLocaleString()} / 12,000`;}
$('input').addEventListener('input',counter);
$('clear').addEventListener('click',()=>{$('input').value='';counter();$('error').textContent='';$('sentence-section').hidden=true;$('input').focus();});
$('input').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&model)analyse();});
function render(r){
  $('prediction').innerHTML=`<span class="result-status ${r.reasons.length?'review':''}">${esc(r.status)}</span>
  <div class="pred-heading"><h3 class="language-name">${esc(r.language)}</h3><span class="language-code">${esc(r.code)}</span></div>
  <p class="routing-label">Suggested destination: ${esc(r.language)} language desk</p>
  <p class="decision-note">${r.reasons.length?esc(r.reasons.join('. '))+'. Ask a reader to confirm.':'A language suggestion for a human reader to confirm.'}${r.truncated?' Overall prediction uses the first 3,000 characters.':''}</p>
  <p class="tiny-label">TOP MATCHES · SVM SCORES, NOT PROBABILITIES</p><div>${r.top.map(p=>`<div class="rank"><span>${esc(p.name)}</span><b>${p.score.toFixed(3)}</b></div>`).join('')}</div>
  <p class="tiny-label">CHARACTER PATTERNS SUPPORTING THE FIRST MATCH</p><div class="patterns">${r.contributions.map(p=>`<span class="pattern" title="Contribution: ${p.value.toFixed(4)}">${esc(p.gram.replaceAll(' ','·'))}</span>`).join('')||'<span class="small muted">No familiar patterns found.</span>'}</div>
  <p class="result-foot">Score gap ${r.margin.toFixed(3)} · ${(r.coverage*100).toFixed(1)}% feature coverage · ${r.letters} letters</p>`;
}
function analyse(){
  try{
    $('error').textContent='';
    const text=$('input').value,r=classify(text,model,weights);render(r);
    const segments=languageMap(text,model,weights);
    $('sentence-section').hidden=false;
    $('map-count').textContent=`${segments.length} segments`;
    $('sentence-map').innerHTML=segments.map(({index,text,result})=>`<div class="segment"><span class="segment-index">${String(index).padStart(2,'0')}</span><span class="segment-language">${esc(result.language)}<small>${esc(result.status)}</small></span><div class="segment-text" dir="auto">${esc(text)}</div></div>`).join('');
    const langs=[...new Set(segments.filter(s=>!s.result.reasons.length).map(s=>s.result.language))];
    $('map-warning').textContent=segments.length>=80?'Showing the first 80 segments.':langs.length>1?`Different suggested languages appear across segments: ${langs.join(', ')}. This is not a validated measure of within-sentence code-switching.`:'Short or ambiguous segments may need review. Same-sentence mixed languages are not separately labelled.';
  }catch(e){$('error').textContent=e.message;}
}
$('analyse').addEventListener('click',analyse);
$('batch-analyse').addEventListener('click',()=>{
  const lines=$('batch-input').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length||lines.length>50){$('batch-status').textContent='Use between 1 and 50 non-empty lines.';return;}
  try{
    rows=lines.map(text=>({text,result:classify(text,model,weights)}));
    const counts={};for(const row of rows){const label=row.result.reasons.length?'Needs review':row.result.language;counts[label]=(counts[label]||0)+1;}
    $('distribution').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name,n])=>`<span>${esc(name)} <b>${n}</b></span>`).join('');
    $('batch-table').innerHTML=`<table><thead><tr><th>Message</th><th>Language desk</th><th>Status</th><th>Score gap</th></tr></thead><tbody>${rows.map(({text,result})=>`<tr><td dir="auto">${esc(text)}</td><td>${esc(result.language)}</td><td>${esc(result.status)}</td><td>${result.margin.toFixed(3)}</td></tr>`).join('')}</tbody></table>`;
    $('batch-status').textContent=`${rows.length} messages processed locally`;$('export').disabled=false;
  }catch(e){$('batch-status').textContent=e.message;}
});
$('export').addEventListener('click',()=>{if(!rows.length)return;const url=URL.createObjectURL(new Blob([rowsToCSV(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='linguaroute-language-routing.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function load(){
  try{
    const [m,w,p]=await Promise.all([fetch('/model/model.json'),fetch('/model/weights.f32'),fetch('/model/classification-report.json')]);
    if(!m.ok||!w.ok||!p.ok)throw new Error('Model files could not be loaded.');
    model=await m.json();weights=new Float32Array(await w.arrayBuffer());
    if(weights.length!==model.classes.length*model.features)throw new Error('Model weights are incomplete.');
    model.reverseVocabulary=Object.fromEntries(Object.entries(model.vocabulary).map(([g,i])=>[i,g]));
    const metrics=model.metrics,pct=v=>(100*v).toFixed(1)+'%',per=await p.json();
    $('test-accuracy').textContent=pct(metrics.test.accuracy);
    $('comparison').innerHTML=[['Naive Bayes baseline',metrics.baseline.accuracy],['Linear SVM',metrics.test.accuracy]].map(([name,value])=>`<div class="compare-row"><span>${name}</span><b>${pct(value)}</b></div><progress value="${value}" max="1" aria-label="${name} accuracy">${pct(value)}</progress>`).join('');
    $('review-metrics').innerHTML=`<div><strong>${pct(metrics.selective_test.coverage)}</strong><span>test paragraphs suggested</span></div><div><strong>${pct(metrics.selective_test.accepted_accuracy)}</strong><span>accuracy on those suggestions</span></div>`;
    $('language-list').innerHTML=Object.values(model.names).sort().map(name=>`<span>${esc(name)}</span>`).join('');
    $('language-performance').innerHTML=`<table><thead><tr><th>Language</th><th>Precision</th><th>Recall</th><th>F1</th><th>Examples</th></tr></thead><tbody>${Object.entries(model.names).sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=>`<tr><td>${name}</td><td>${pct(per[code].precision)}</td><td>${pct(per[code].recall)}</td><td>${per[code]['f1-score'].toFixed(3)}</td><td>${per[code].support}</td></tr>`).join('')}</tbody></table>`;
    $('load-state').textContent='Ready · 18 languages';$('analyse').disabled=false;$('batch-analyse').disabled=false;
  }catch(e){$('load-state').textContent='Model unavailable';$('error').textContent=e.message+' Reload to retry.';}
}
load();
