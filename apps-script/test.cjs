const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync(__dirname+'/Code.gs','utf8');
function harness(status=201, throwNetwork=false) {
  const rows=[[]],cache=new Map(),calls=[];
  let now=1000000, columns=26;
  const props=new Map([['MF_API_KEY','fake-private-key'],['TURNSTILE_SECRET_KEY','private-turnstile-key'],['ABUSE_HASH_SECRET','s'.repeat(32)]]);
  const botCalls=[], usedTokens=new Set();
  let botOverride=null, throwBot=false, budgetUnavailable=false;
  const scriptProps={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>{if(budgetUnavailable)throw Error('quota');props.set(k,v);}};
  const sheet={getMaxColumns:()=>columns,insertColumnsAfter:(after,count)=>{columns+=count;},getLastRow:()=>rows.length,appendRow:r=>rows.push([...r]),getRange:(row,col,count=1,width=1)=>({
    setValue:value=>{rows[row-1] ||= [];rows[row-1][col-1]=value;},
    setValues:values=>{for(let i=0;i<values.length;i++){rows[row-1+i] ||= [];values[i].forEach((value,j)=>rows[row-1+i][col-1+j]=value);}},
    getValues:()=>[rows[row-1].slice(col-1,col-1+width)],
    createTextFinder:value=>({matchEntireCell:()=>({findNext:()=>{const index=rows.findIndex((r,i)=>i>0 && r[col-1]===value);return index<0?null:{getRow:()=>index+1};}})})
  })};
  class Clock extends Date {static now(){return now;}}
  const context={Date:Clock,console:{error:()=>{}},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
    PropertiesService:{getScriptProperties:()=>({...scriptProps})},
    Utilities:{computeHmacSha256Signature:(value,key)=>crypto.createHmac('sha256',key).update(value).digest(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(algorithm,value)=>crypto.createHash('sha256').update(value).digest(),base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url')},
    ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:value=>({value,setMimeType(){return this;}})},
    UrlFetchApp:{fetch:(url,options)=>{
      if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        botCalls.push({url,options}); if(throwBot)throw Error('network');
        const token=options.payload.response, duplicate=usedTokens.has(token);usedTokens.add(token);
        return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(botOverride || {success:!duplicate,hostname:'certificabrasil.ca',action:'mf_lead',cdata:request.requestId})};
      }
      calls.push({url,options,validation:rows.at(-1)[21]});now+=6500;if(throwNetwork)throw Error('network');return{getResponseCode:()=>status,getContentText:()=>JSON.stringify(status===201||status===200?{success:true,ticketNumber:'MF-UAT-001',whatsappUrl:'https://wa.me/15145551234?text=MF-UAT-001',whatsappText:'MF-UAT-001'}:{details:{phone:'invalid'}})};}}
  };
  vm.createContext(context);vm.runInContext(source,context);
  const lead={name:'Teste UAT',phone:'+5511912345678',phone_country:'BR',email:'teste@example.com',city:'montreal',language:'pt',landing_language:'pt',service:'digital-certificate',consent:'on',consent_version:'2026-09-30',page:'https://certificabrasil.ca/'};
  const request={turnstileToken:'valid-challenge-token',action:'mfLead',requestId:'11111111-1111-4111-8111-111111111111',receiptToken:'a'.repeat(64),lead};
  const post=()=>context.doPost({postData:{contents:JSON.stringify(request)}});
  const receipt=()=>JSON.parse(cache.get('mf:'+request.requestId)).result;
  return{context,rows,calls,request,lead,post,receipt,props,botCalls,usedTokens,
    setBot:value=>{botOverride=value;},breakBot:()=>{throwBot=true;},breakBudget:()=>{budgetUnavailable=true;},
    advance:ms=>{now+=ms;},fresh:()=>{request.requestId=crypto.randomUUID();request.receiptToken=crypto.randomBytes(32).toString('hex');request.turnstileToken=crypto.randomUUID();}};
}
test('saves before MF, starts Não válido and confirms Válido with ticket',()=>{
  const h=harness();h.post();assert.equal(h.calls[0].validation,'Não válido');assert.equal(h.rows.length,2);assert.equal(h.rows[1][21],'Válido');assert.equal(h.rows[1][19],'MF-UAT-001');assert.equal(h.receipt().success,true);
  const payload=JSON.parse(h.calls[0].options.payload);assert.equal(payload.phone,'5511912345678');assert.equal(payload.externalId,h.request.requestId);assert.equal(payload.obs['Autorização de atendimento ao clicar em WhatsApp'],true);
});
test('repeated identical request does not duplicate row or successful MF call',()=>{const h=harness();h.post();h.post();assert.equal(h.rows.length,2);assert.equal(h.calls.length,1);});
test('MF errors retain saved row and Não válido',()=>{for(const status of [400,401,403,500,502]){const h=harness(status);h.post();assert.equal(h.receipt().status,status);assert.equal(h.receipt().saved,true);assert.equal(h.rows[1][21],'Não válido');assert.equal(h.rows.length,2);}});
test('retry after MF failure does not duplicate saved lead',()=>{const h=harness(502);h.post();h.request.turnstileToken='new-challenge-token';h.post();assert.equal(h.rows.length,2);assert.equal(h.calls.length,2);});
test('invalid lead does not save or call MF',()=>{const h=harness();h.lead.phone='123';h.post();assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);assert.equal(h.receipt().status,400);});
test('receipt never exposes key or contact data and rejects wrong token',()=>{const h=harness();h.post();const parameter={requestId:h.request.requestId,receiptToken:h.request.receiptToken,callback:'__mfReceipt_'+'a'.repeat(32)};const r=h.context.doGet({parameter});assert.ok(r.value.includes('MF-UAT-001'));assert.ok(!r.value.includes('fake-private-key'));assert.ok(!r.value.includes('teste@example.com'));assert.ok(!r.value.includes('5511912345678'));parameter.receiptToken='b'.repeat(64);assert.ok(h.context.doGet({parameter}).value.includes('pending'));});
test('international numbers have no country restriction; legacy formatted Canadian remains accepted',()=>{const h=harness();for(const phone of ['+1 514 555 1234','+12133734253','+5511912345678','+442079460018','+919876543210','+81312345678'])assert.equal(h.context.isValidLead({...h.lead,phone}),true);});


test("simple form accepts missing email, city, service and message",()=>{const h=harness(); delete h.lead.email;delete h.lead.city;delete h.lead.service;delete h.lead.message;h.post();assert.equal(h.receipt().success,true);const payload=JSON.parse(h.calls[0].options.payload);assert.equal(payload.email,undefined);assert.equal(payload.service,undefined);});

function timingRequest(h,overrides={}) {
  return {action:'mfTiming',requestId:h.request.requestId,receiptToken:h.request.receiptToken,timing:{
    clickToReceiptMs:16000,clickToRedirectMs:21000,receiptToRedirectMs:5000,
    clickToPostSettledMs:20900,lastReceiptQueryMs:3000,receiptPollCount:3,
    outcome:'redirect_started',measuredAt:'2026-10-09T19:30:00.000Z',...overrides
  }};
}
function postTiming(h,r) {return JSON.parse(h.context.doPost({postData:{contents:JSON.stringify(r)}}).value);}
test('API timing captures HTTP errors and thrown network errors',()=>{
  for(const h of [harness(),harness(502),harness(201,true)]){
    h.post();assert.equal(h.rows[1][22],6500);assert.equal(h.receipt().apiDurationMs,6500);
    assert.equal(h.receipt().serverTotalMs,6500);assert.equal(h.receipt().serverPreApiMs,0);assert.equal(h.receipt().serverPostApiMs,0);
  }
});
test('authenticated browser timing updates only its own row and never calls MF again',()=>{
  const h=harness();h.post();const ticket=h.rows[1][19];
  assert.equal(postTiming(h,timingRequest(h,{serverTotalMs:999999})).ok,false);
  assert.equal(postTiming(h,timingRequest(h,{serverTotalMs:1})).ok,true);
  assert.equal(h.rows[1][25],6500);assert.equal(h.rows[1][26],16000);assert.equal(h.rows[1][27],21000);
  assert.equal(h.rows[1][28],5000);assert.equal(h.rows[1][31],3);assert.equal(h.rows[1][33],'redirect_started');
  assert.equal(h.calls.length,1);assert.equal(h.rows[1][19],ticket);assert.equal(h.rows.length,2);
});
test('wrong token, negative values and impossible redirect intervals are rejected',()=>{
  const h=harness();h.post();const wrong=timingRequest(h);wrong.receiptToken='b'.repeat(64);
  for(const r of [wrong,timingRequest(h,{clickToReceiptMs:-1}),timingRequest(h,{receiptToRedirectMs:1})])assert.equal(postTiming(h,r).ok,false);
  assert.equal(h.rows[1][26],undefined);
});
test('late telemetry cannot overwrite a more recent attempt',()=>{
  const h=harness();h.post();assert.equal(postTiming(h,timingRequest(h)).ok,true);
  assert.equal(postTiming(h,timingRequest(h,{measuredAt:'2026-10-09T19:29:00.000Z'})).ok,false);
  assert.equal(h.rows[1][34],'2026-10-09T19:30:00.000Z');
});


test('legacy and unknown actions cannot save or contact MF',()=>{
  for(const action of [undefined,'legacySave','other']){const h=harness();h.request.action=action;h.post();assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);assert.equal(h.botCalls.length,0);}
});
test('malformed, null, array and oversized bodies fail without side effects',()=>{
  for(const body of ['null','[]','{','x'.repeat(16385),'1']){const h=harness();assert.equal(JSON.parse(h.context.doPost({postData:{contents:body}}).value).ok,false);assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);}
});
test('missing token and unconfigured secrets fail closed',()=>{
  for(const key of ['token','TURNSTILE_SECRET_KEY','ABUSE_HASH_SECRET']){const h=harness();if(key==='token')delete h.request.turnstileToken;else h.props.delete(key);h.post();assert.equal(h.receipt().success,false);assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);assert.equal(h.botCalls.length,0);}
});
test('wrong hostname, action, binding, invalid and replayed tokens are rejected',()=>{
  for(const override of [{success:false},{hostname:'evil.example'},{action:'other'},{cdata:'wrong-id'}]){
    const h=harness();h.setBot({success:true,hostname:'certificabrasil.ca',action:'mf_lead',cdata:h.request.requestId,...override});h.post();assert.equal(h.receipt().status,403);assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);
  }
  const h=harness();h.post();h.fresh();h.request.turnstileToken='valid-challenge-token';h.post();assert.equal(h.receipt().status,403);assert.equal(h.rows.length,2);assert.equal(h.calls.length,1);
});
test('verification outage and persistent storage failure do not reach MF',()=>{
  for(const failure of ['breakBot','breakBudget']){const h=harness();h[failure]();h.post();assert.equal(h.receipt().status,503);assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);}
});
test('successful receipt retry needs no second verification or budget reservation',()=>{
  const h=harness();h.post();const state=h.props.get('ABUSE_V1_MF');delete h.request.turnstileToken;h.post();assert.equal(h.calls.length,1);assert.equal(h.botCalls.length,1);assert.equal(h.props.get('ABUSE_V1_MF'),state);
});
test('per-phone hourly budget survives receipt-cache-independent new IDs',()=>{
  const h=harness();for(let i=0;i<4;i++){h.fresh();h.post();}assert.equal(h.receipt().status,429);assert.equal(h.calls.length,3);assert.equal(h.rows.length,4);
  assert.ok(!h.props.get('ABUSE_V1_MF').includes('5511912345678'));h.advance(3600000);h.fresh();h.post();assert.equal(h.receipt().success,true);
});
test('global MF burst and daily budgets bound varying phones and requests',()=>{
  const h=harness();for(let i=0;i<21;i++){h.fresh();h.lead.phone='+551191234'+String(1000+i);h.post();}
  assert.equal(h.receipt().status,429);assert.equal(h.calls.length,20);
  for(let batch=1;batch<5;batch++){h.advance(600000);for(let i=0;i<20;i++){h.fresh();h.lead.phone='+551191234'+String(1000+batch*20+i);h.post();}}
  assert.equal(h.calls.length,100);h.advance(600000);h.fresh();h.post();assert.equal(h.receipt().status,429);assert.equal(h.calls.length,100);
});
test('invalid challenges have a pre-verification burst cap',()=>{
  const h=harness();h.setBot({success:false});for(let i=0;i<61;i++){h.fresh();h.post();}assert.equal(h.receipt().status,429);assert.equal(h.botCalls.length,60);assert.equal(h.rows.length,1);
});
test('structured lead fields fail validation before external verification',()=>{
  const h=harness();h.lead.email={value:'x'};h.post();assert.equal(h.receipt().status,400);assert.equal(h.botCalls.length,0);
});
test('concurrent rejected challenge cannot overwrite an admitted pending receipt',()=>{
  const h=harness();h.context.UrlFetchApp.fetch=()=>{
    h.context.CacheService.getScriptCache().put('mf:'+h.request.requestId,JSON.stringify({token:h.request.receiptToken,result:{saved:true,pending:true}}));
    return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:false})};
  };
  h.post();assert.equal(h.receipt().pending,true);assert.equal(h.receipt().saved,true);assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);
});
