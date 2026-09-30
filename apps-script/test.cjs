const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync(__dirname+'/Code.gs','utf8');
function harness(status=201) {
  const rows=[[]],cache=new Map(),calls=[];
  const sheet={getLastRow:()=>rows.length,appendRow:r=>rows.push([...r]),getRange:(row,col,count=1,width=1)=>({
    setValues:values=>{for(let i=0;i<values.length;i++){rows[row-1+i] ||= [];values[i].forEach((value,j)=>rows[row-1+i][col-1+j]=value);}},
    getValues:()=>[rows[row-1].slice(col-1,col-1+width)],
    createTextFinder:value=>({matchEntireCell:()=>({findNext:()=>{const index=rows.findIndex((r,i)=>i>0 && r[col-1]===value);return index<0?null:{getRow:()=>index+1};}})})
  })};
  const context={console:{error:()=>{}},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'fake-private-key'})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(algorithm,value)=>crypto.createHash('sha256').update(value).digest(),base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url')},
    ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:value=>({value,setMimeType(){return this;}})},
    UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options,validation:rows.at(-1)[21]});return{getResponseCode:()=>status,getContentText:()=>JSON.stringify(status===201||status===200?{success:true,ticketNumber:'MF-UAT-001',whatsappUrl:'https://wa.me/15145551234?text=MF-UAT-001',whatsappText:'MF-UAT-001'}:{details:{phone:'invalid'}})};}}
  };
  vm.createContext(context);vm.runInContext(source,context);
  const lead={name:'Teste UAT',phone:'+5511912345678',phone_country:'BR',email:'teste@example.com',city:'montreal',language:'pt',landing_language:'pt',service:'digital-certificate',consent:'on',consent_version:'2026-09-30',page:'https://certificabrasil.ca/'};
  const request={action:'mfLead',requestId:'11111111-1111-4111-8111-111111111111',receiptToken:'a'.repeat(64),lead};
  const post=()=>context.doPost({postData:{contents:JSON.stringify(request)}});
  const receipt=()=>JSON.parse(cache.get('mf:'+request.requestId)).result;
  return{context,rows,calls,request,lead,post,receipt};
}
test('saves before MF, starts Não válido and confirms Válido with ticket',()=>{
  const h=harness();h.post();assert.equal(h.calls[0].validation,'Não válido');assert.equal(h.rows.length,2);assert.equal(h.rows[1][21],'Válido');assert.equal(h.rows[1][19],'MF-UAT-001');assert.equal(h.receipt().success,true);
  const payload=JSON.parse(h.calls[0].options.payload);assert.equal(payload.phone,'5511912345678');assert.equal(payload.externalId,h.request.requestId);assert.equal(payload.obs['Autorização de atendimento ao clicar em WhatsApp'],true);
});
test('repeated identical request does not duplicate row or successful MF call',()=>{const h=harness();h.post();h.post();assert.equal(h.rows.length,2);assert.equal(h.calls.length,1);});
test('MF errors retain saved row and Não válido',()=>{for(const status of [400,401,403,500,502]){const h=harness(status);h.post();assert.equal(h.receipt().status,status);assert.equal(h.receipt().saved,true);assert.equal(h.rows[1][21],'Não válido');assert.equal(h.rows.length,2);}});
test('retry after MF failure does not duplicate saved lead',()=>{const h=harness(502);h.post();h.post();assert.equal(h.rows.length,2);assert.equal(h.calls.length,2);});
test('invalid lead does not save or call MF',()=>{const h=harness();h.lead.phone='123';h.post();assert.equal(h.rows.length,1);assert.equal(h.calls.length,0);assert.equal(h.receipt().status,400);});
test('receipt never exposes key or contact data and rejects wrong token',()=>{const h=harness();h.post();const parameter={requestId:h.request.requestId,receiptToken:h.request.receiptToken,callback:'__mfReceipt_'+'a'.repeat(32)};const r=h.context.doGet({parameter});assert.ok(r.value.includes('MF-UAT-001'));assert.ok(!r.value.includes('fake-private-key'));assert.ok(!r.value.includes('teste@example.com'));assert.ok(!r.value.includes('5511912345678'));parameter.receiptToken='b'.repeat(64);assert.ok(h.context.doGet({parameter}).value.includes('pending'));});
test('international numbers have no country restriction; legacy formatted Canadian remains accepted',()=>{const h=harness();for(const phone of ['+1 514 555 1234','+12133734253','+5511912345678','+442079460018','+919876543210','+81312345678'])assert.equal(h.context.isValidLead({...h.lead,phone}),true);});


test("simple form accepts missing email, city, service and message",()=>{const h=harness(); delete h.lead.email;delete h.lead.city;delete h.lead.service;delete h.lead.message;h.post();assert.equal(h.receipt().success,true);const payload=JSON.parse(h.calls[0].options.payload);assert.equal(payload.email,undefined);assert.equal(payload.service,undefined);});
