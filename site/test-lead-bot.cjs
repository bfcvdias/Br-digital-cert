const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/assets/lead-bot.js','utf8');
function harness(configured=true){
  const options=[],removed=[];let executed=0;
  const context={window:{turnstile:{render:(node,config)=>{options.push(config);return 'widget';},execute:()=>{executed++;},remove:id=>removed.push(id)}},
    document:{getElementById:()=>({})},setTimeout:()=>1,clearTimeout:()=>{}};
  vm.createContext(context);vm.runInContext(configured?source.replace("const SITE_KEY = '';","const SITE_KEY = 'real-public-site-key';"):source,context);
  return {context,options,removed,get executed(){return executed;}};
}
test('unconfigured widget fails closed without loading or sending anything',async()=>{
  const h=harness(false);await assert.rejects(h.context.window.getLeadBotToken('id'));assert.equal(h.options.length,0);
});
test('widget binds action and request ID; retries obtain a fresh token',async()=>{
  const h=harness();const first=h.context.window.getLeadBotToken('request-one');await Promise.resolve();
  assert.equal(h.options[0].action,'mf_lead');assert.equal(h.options[0].cData,'request-one');assert.equal(h.executed,1);
  h.options[0].callback('token-one');assert.equal(await first,'token-one');assert.deepEqual(h.removed,['widget']);
  const second=h.context.window.getLeadBotToken('request-one');await Promise.resolve();h.options[1].callback('token-two');assert.equal(await second,'token-two');
});
test('challenge errors reject without a submission token',async()=>{
  const h=harness();const promise=h.context.window.getLeadBotToken('id');await Promise.resolve();h.options[0]['error-callback']();await assert.rejects(promise);assert.equal(h.removed.length,1);
});
test('transport sends challenge only in POST, never in receipt URL or telemetry',async()=>{
  const transport=fs.readFileSync(__dirname+'/assets/mf-transport.js','utf8');
  assert.match(transport,/JSON.stringify\(\{action:'mfLead',\.\.\.receipt,lead,turnstileToken\}\)/);
  assert.doesNotMatch(transport.slice(0,transport.indexOf('function beginMFTiming')),/searchParams.set\([^\n]*turnstile/);
  const page=fs.readFileSync(__dirname+'/index.html','utf8');assert.match(page,/lead-bot.js\?v=20261022-security/);
});
