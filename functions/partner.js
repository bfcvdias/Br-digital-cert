'use strict';
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');
const MF_API_URL = 'https://mf-certificados-git-claude-partner-lead-endpoint-7vpm7q-mf-cert.vercel.app/api/partners/leads';
// Produção: https://www.mfcertificados.com/api/partners/leads
const CODIGO_DO_PAIS_PADRAO = '1';

function validatePayload(body) {
  const details = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {details: {name: 'Informe os dados do formulário.'}};
  const payload = {};
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200) details.name = 'Informe o nome completo.';
  else payload.name = body.name.trim();
  const raw = typeof body.phone === 'string' ? body.phone.trim() : '';
  // The browser submits a complete international number consisting of digits only.
  const number = /^\d{8,15}$/.test(raw) ? parsePhoneNumberFromString(`+${raw}`, {extract:false}) : undefined;
  if (!number?.isValid() || number.ext) details.phone = 'Informe o telefone com código do país e DDD.';
  else payload.phone = number.number.slice(1);
  for (const [key, max] of [['email',254],['service',200],['message',4000],['externalId',200]]) {
    if (body[key] == null || body[key] === '') continue;
    if (typeof body[key] !== 'string' || body[key].length > max) details[key] = 'Confira este campo.';
    else if (body[key].trim()) payload[key] = body[key].trim();
  }
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) details.email = 'Confira o e-mail.';
  if (typeof body.pageUrl === 'string' && body.pageUrl.length <= 2048) {
    try { const url = new URL(body.pageUrl); if (['https:', 'http:'].includes(url.protocol)) payload.pageUrl = url.href; } catch (_) {}
  }
  if (body.obs && typeof body.obs === 'object' && !Array.isArray(body.obs)) {
    payload.obs = {};
    const allowed = ['Sua cidade','Idioma de preferência','Li a Política de Privacidade e autorizo o registro dos meus dados para responder a este pedido e entrar em contato por WhatsApp ou e-mail.','País / código internacional','Origem','Campanha','Meio','Termo','Idioma da página','Versão da política de privacidade'];
    for (const key of allowed) {
      const value = body.obs[key];
      if (typeof value === 'boolean' || typeof value === 'string' && value.length <= 500) payload.obs[key] = value;
    }
  }
  return Object.keys(details).length ? {details} : {payload};
}

function validWhatsAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'wa.me' && !url.username && !url.password && !url.port && /^\/\d{8,15}\/?$/.test(url.pathname);
  } catch (_) { return false; }
}

async function sendToMF(payload, key, fetcher = fetch, origin) {
  const headers = {'Content-Type':'application/json',Authorization:`Bearer ${key}`};
  if (origin) headers.Origin = origin;
  const response = await fetcher(MF_API_URL, {
    method:'POST', redirect:'error', headers,
    body:JSON.stringify(payload), signal:AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (response.status === 400) return {status:400, body:{success:false, details:data.details || {name:'Confira os dados informados.'}}};
  if (![200,201].includes(response.status)) return {status:[401,403,500,502].includes(response.status) ? response.status : 502, body:{success:false}};
  if (data.success !== true || !['string','number'].includes(typeof data.ticketNumber) || !String(data.ticketNumber).trim() || !validWhatsAppUrl(data.whatsappUrl)) return {status:502,body:{success:false}};
  return {status:response.status,body:{success:true,ticketNumber:data.ticketNumber,whatsappUrl:data.whatsappUrl,duplicate:data.duplicate === true}};
}
module.exports = { MF_API_URL, CODIGO_DO_PAIS_PADRAO, validatePayload, validWhatsAppUrl, sendToMF };
