'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validatePayload,sendToMF,validWhatsAppUrl,MF_API_URL} = require('../partner');
const input = {name:'Teste UAT',phone:'15145551234',email:'teste@example.com',obs:{'Sua cidade':'Montreal','senha':'never-forward'}};
test('accepts international phones across regions and strips unknown fields', () => {
  for (const phone of ['15145551234','12133734253','5511912345678','442079460018','919876543210','81312345678','27821234567']) {
    const result = validatePayload({...input,phone});
    assert.equal(result.details, undefined, phone);
    assert.equal(result.payload.phone,phone);
    assert.equal(result.payload.obs.senha,undefined);
  }
});
test('rejects invalid phone and email before any API request', () => {
  assert.ok(validatePayload({...input,phone:'0000'}).details.phone);
  assert.ok(validatePayload({...input,email:'broken'}).details.email);
  assert.ok(validatePayload({}).details.name);
});
test('restricts WhatsApp destinations', () => {
  assert.ok(validWhatsAppUrl('https://wa.me/15145551234?text=Teste'));
  for (const url of ['https://evil.example/15145551234','https://wa.me.evil.example/15145551234','javascript:alert(1)','https://user@wa.me/15145551234','https://wa.me/not-a-number']) assert.equal(validWhatsAppUrl(url),false);
});
test('sends JSON with server key and accepts new or duplicate response', async () => {
  for (const status of [200,201]) {
    const result = await sendToMF(input,'test-secret',async (url,options) => {
      assert.equal(url,MF_API_URL);
      assert.equal(options.headers.Authorization,'Bearer test-secret');
      assert.equal(options.headers['Content-Type'],'application/json');
      assert.deepEqual(JSON.parse(options.body),input);
      return {status,json:async()=>({success:true,ticketNumber:'MF-TEST-1',whatsappUrl:'https://wa.me/15145551234',duplicate:status===200})};
    });
    assert.equal(result.status,status); assert.equal(result.body.duplicate,status===200);
  }
});
test('preserves validation errors and service failures',async()=>{
  for (const status of [400,401,403,500,502]) {
    const result=await sendToMF(input,'test-secret',async()=>({status,json:async()=>({details:{phone:'Inválido'}})}));
    assert.equal(result.status,status);
    if (status===400) assert.ok(result.body.details.phone);
  }
});
test('rejects malformed success and propagates network failures',async()=>{
  const result=await sendToMF(input,'test-secret',async()=>({status:201,json:async()=>({success:true,ticketNumber:'MF-1',whatsappUrl:'https://evil.example/'})}));
  assert.equal(result.status,502);
  await assert.rejects(sendToMF(input,'test-secret',async()=>{throw new Error('network');}));
});
