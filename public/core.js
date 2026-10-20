export function normalize(text){return Array.from(String(text).normalize('NFC').toLowerCase().replace(/\s+/gu,' ').trim()).slice(0,3000).join('');}
export function ngrams(text){
  const chars=Array.from(normalize(text)),grams=[];
  for(const n of [2,3,4])for(let i=0;i<=chars.length-n;i++)grams.push(chars.slice(i,i+n).join(''));
  return grams;
}
export function vectorize(text,model){
  const grams=ngrams(text),counts=new Map();let matched=0;
  for(const g of grams){const i=model.vocabulary[g];if(Number.isInteger(i)){counts.set(i,(counts.get(i)||0)+1);matched++;}}
  const entries=[...counts].map(([i,n])=>[i,(1+Math.log(n))*model.idf[i]]);
  const norm=Math.sqrt(entries.reduce((sum,[,v])=>sum+v*v,0))||1;
  return {entries:entries.map(([i,v])=>[i,v/norm]),coverage:matched/Math.max(grams.length,1),total:grams.length};
}
export function classify(text,model,weights){
  if(typeof text!=='string'||!text.trim())throw new Error('Enter some text first.');
  if(text.length>12000)throw new Error('Use up to 12,000 characters per document.');
  if(weights.length!==model.features*model.classes.length)throw new Error('Model weights are incomplete.');
  const cleaned=normalize(text),{entries,coverage,total}=vectorize(cleaned,model);
  const scores=model.classes.map((code,c)=>({code,name:model.names[code],index:c,
    score:entries.reduce((s,[i,v])=>s+weights[c*model.features+i]*v,model.bias[c])})).sort((a,b)=>b.score-a.score);
  const top=scores[0],margin=top.score-scores[1].score,letters=(cleaned.match(/\p{L}/gu)||[]).length;
  const reasons=[];
  if(letters<model.policy.min_letters)reasons.push('Too short: fewer than 30 letters');
  if(coverage<model.policy.min_feature_coverage)reasons.push('Few familiar character patterns');
  if(top.score<model.policy.score_floor)reasons.push('Low model decision score');
  if(margin<model.policy.margin_floor)reasons.push('The leading languages have similar scores');
  const reverse=model.reverseVocabulary||Object.fromEntries(Object.entries(model.vocabulary).map(([g,i])=>[i,g]));
  const contributions=entries.map(([i,v])=>({gram:reverse[i],value:weights[top.index*model.features+i]*v}))
    .filter(r=>r.value>0).sort((a,b)=>b.value-a.value).slice(0,8);
  return {language:top.name,code:top.code,top:scores.slice(0,3),scores,margin,coverage,letters,
    totalFeatures:total,activeFeatures:entries.length,contributions,reasons,
    status:reasons.length?'Review needed':'Suggested language',truncated:Array.from(text).length>3000};
}
export function splitSegments(text){
  return String(text).split(/(?:\r?\n)+|(?<=[.!?])(?:\s+|$)|(?<=[。！？।؟])\s*/u).map(t=>t.trim()).filter(Boolean).slice(0,80);
}
export function languageMap(text,model,weights){
  return splitSegments(text).map((text,i)=>({index:i+1,text,result:classify(text,model,weights)}));
}
export function classifyBatch(text,model,weights){
  if(typeof text!=='string'||text.length>600000)throw new Error('Use up to 600,000 characters in one batch.');
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length||lines.length>50)throw new Error('Use between 1 and 50 non-empty lines.');
  return lines.map((text,index)=>{
    try{return {text,result:classify(text,model,weights)};}
    catch(error){throw new Error(`Message ${index+1}: ${error.message}`);}
  });
}
export function csvCell(value){let s=String(value);if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function rowsToCSV(rows){return ['Text,Language,ISO code,Status,Decision score,Score gap',
  ...rows.map(({text,result})=>[text,result.language,result.code,result.status,result.top[0].score.toFixed(4),result.margin.toFixed(4)].map(csvCell).join(','))].join('\r\n');}
