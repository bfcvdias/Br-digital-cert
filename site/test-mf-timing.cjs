const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/assets/mf-transport.js','utf8');
function harness({postDelayed=true,beacon=true}={}) {
  let now=0, resolvePost, reads=0;
  const beacons=[],fetches=[],storage=new Map();
  const context={performance:{now:()=>now},Date,JSON,URL,Blob,Promise,Math,
    crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
    AbortSignal:{timeout:()=>({})},setTimeout:(fn,ms)=>{if(ms===1500){now+=1500;queueMicrotask(fn);}return 1;},clearTimeout:()=>{},
    window:{},sessionStorage:{setItem:(k,v)=>storage.set(k,v)},
    navigator:{sendBeacon:(url,body)=>{beacons.push({url,body});return beacon;}},
    fetch:(url,options)=>{fetches.push({url,options});if(options.keepalive)return Promise.resolve({});return new Promise(resolve=>{resolvePost=()=>{now=20000;resolve({});};if(!postDelayed){now=2000;resolve({});}});},
    document:{createElement:()=>({remove(){}}),head:{append:script=>{reads++;now+=3000;const callback=new URL(script.src).searchParams.get('callback');queueMicrotask(()=>context.window[callback]({status:201,success:true,saved:true,ticketNumber:'TEST',apiDurationMs:6500,serverTotalMs:10000}));}}}
  };
  vm.createContext(context);vm.runInContext(source,context);
  return {context,beacons,fetches,storage,resolvePost:()=>resolvePost(),setNow:value=>now=value,getNow:()=>now};
}
const receipt={requestId:'11111111-1111-4111-8111-111111111111',receiptToken:'a'.repeat(64)};
test('separates receipt arrival from slow opaque POST and measures redirect without waiting for telemetry',async()=>{
  const h=harness();const timing=h.context.beginMFTiming();
  const promise=h.context.sendMFLead({name:'private',phone:'private'},receipt,timing);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(timing.receiptMs,4500);assert.equal(timing.postSettledMs,null);
  h.resolvePost();const result=await promise;assert.equal(timing.postSettledMs,20000);
  h.setNow(20020);const diagnostic=h.context.finishMFTiming(receipt,result,timing,'redirect_started');
  assert.equal(diagnostic.clickToReceiptMs,4500);assert.equal(diagnostic.clickToRedirectMs,20020);
  assert.equal(diagnostic.receiptToRedirectMs,15520);assert.equal(diagnostic.receiptPollCount,1);
  assert.equal(h.beacons.length,1);assert.equal(h.getNow(),20020);
  const stored=h.storage.get('certificabrasil-last-timing');assert.ok(!stored.includes('private'));assert.ok(!stored.includes(receipt.receiptToken));
  const body=JSON.parse(await h.beacons[0].body.text());assert.equal(body.action,'mfTiming');assert.equal(body.timing.clickToRedirectMs,20020);assert.equal(body.lead,undefined);
});
test('beacon rejection uses nonblocking keepalive POST',()=>{
  const h=harness({beacon:false});const timing=h.context.beginMFTiming();timing.receiptMs=2000;h.setNow(2300);
  h.context.finishMFTiming(receipt,{apiDurationMs:1000},timing,'redirect_started');
  assert.equal(h.fetches.length,1);assert.equal(h.fetches[0].options.keepalive,true);
});
test('failed attempt keeps redirect timings absent rather than inventing a zero',()=>{
  const h=harness();const timing=h.context.beginMFTiming();h.setNow(100000);
  const result=h.context.finishMFTiming(receipt,undefined,timing,'failed');
  assert.equal(result.clickToFailureMs,100000);assert.equal(result.clickToRedirectMs,undefined);assert.equal(result.clickToReceiptMs,null);
});
