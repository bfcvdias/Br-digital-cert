const MF_API_URL = 'https://www.mfcertificados.com/api/partners/leads';
// Produção: https://www.mfcertificados.com/api/partners/leads
const MF_API_KEY_PROPERTY = 'MF_API_KEY';
const CODIGO_DO_PAIS_PADRAO = '1';
const SHEET_ID = '14k9uVaAwEX_-QGnd4P0xl_dMWqnFdK_6AFb8U80aGl4';
const SHEET_NAME = 'Leads';
const POLICY_VERSION = '2026-09-30';
const ALLOWED_CITIES = ['montreal', 'quebec-city', 'other'];
const ALLOWED_SERVICES = ['digital-certificate', 'documents', 'apostille', 'other'];

function doPost(e) {
  const serverStartedAt = Date.now();
  let request;
  try { request = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch (_) { return response({ok:false}); }
  if (request.action === 'mfTiming') return saveMFTiming(request);
  if (request.action !== 'mfLead') return legacySave(request);
  if (!validReceipt(request.requestId, request.receiptToken)) return response({ok:false});
  const cache = CacheService.getScriptCache();
  const cacheKey = 'mf:' + request.requestId;
  const previous = cache.get(cacheKey);
  if (previous) {
    const receipt = JSON.parse(previous);
    if (receipt.token !== request.receiptToken) return response({ok:false});
    if (receipt.result.success || receipt.result.pending) return response({ok:true});
  }
  let saved = false, row, sheet, apiDurationMs = null, apiStartedAt = null, apiCompletedAt = null;
  function finish(result) {
    // This is the latest actual MF request duration, not the browser's total wait.
    if (apiDurationMs !== null) {
      result.apiDurationMs = apiDurationMs;
      if (saved && row && sheet) {
        try { sheet.getRange(row,23).setValue(apiDurationMs); }
        catch (_) { console.error('Falha ao registrar tempo da API MF'); }
      }
    }
    if (saved && row && sheet && !result.pending) {
      try {sheet.getRange(row,21,1,2).setValues([[result.success?'Encaminhado à MF PRD':'Falha MF ('+result.status+')',result.success?'Válido':'Não válido']]);} catch (_) {}
    }
    // Same server clock for every stage; never subtract browser and server timestamps.
    const receiptReadyAt = Date.now();
    result.serverTotalMs = Math.max(0, receiptReadyAt - serverStartedAt);
    if (apiStartedAt !== null) result.serverPreApiMs = Math.max(0, apiStartedAt - serverStartedAt);
    if (apiCompletedAt !== null) result.serverPostApiMs = Math.max(0, receiptReadyAt - apiCompletedAt);
    cache.put(cacheKey, JSON.stringify({token:request.receiptToken,result:result}), 600);
    return response({ok:result.success === true});
  }
  const lead = request.lead;
  if (!isValidLead(lead)) return finish({status:400,success:false,saved:false,details:leadErrors(lead)});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return finish({status:502,success:false,saved:false});
  try {
    const current = cache.get(cacheKey);
    if (current) {
      const receipt = JSON.parse(current);
      if (receipt.token !== request.receiptToken) return response({ok:false});
      if (receipt.result.success || receipt.result.pending) return response({ok:true});
    }
    sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    ensureHeaders(sheet);
    const match = sheet.getLastRow() > 1 ? sheet.getRange(2,17,sheet.getLastRow()-1,1).createTextFinder(request.requestId).matchEntireCell(true).findNext() : null;
    const signature = digest(JSON.stringify(toMF(lead, request.requestId)));
    if (match) {
      row = match.getRow();
      const existing = sheet.getRange(row,18,1,2).getValues()[0];
      if (existing[0] !== digest(request.receiptToken) || existing[1] !== signature) return finish({status:400,success:false,saved:false,details:{name:'Envio alterado. Atualize a página e tente novamente.'}});
    } else {
      sheet.appendRow([
        new Date(),clean(lead.name,120),clean(lead.phone,32),clean(lead.email,254),
        clean(lead.city,40),clean(lead.language,8),clean(lead.service,80),clean(lead.message,2000),
        clean(lead.source,120),clean(lead.campaign,160),clean(lead.medium,80),clean(lead.term,160),
        clean(lead.landing_language,8),clean(lead.page,2000),'Sim',clean(lead.consent_version || POLICY_VERSION,40),
        request.requestId,digest(request.receiptToken),signature,'','Salvo; encaminhamento pendente','Não válido'
      ]);
      row = sheet.getLastRow();
    }
    SpreadsheetApp.flush();
    saved = true;
    cache.put(cacheKey,JSON.stringify({token:request.receiptToken,result:{pending:true,saved:true}}),600);
  } catch (_) {
    console.error('Falha no registro da planilha');
    return finish({status:502,success:false,saved:false});
  } finally { lock.releaseLock(); }
  try {
    const key = PropertiesService.getScriptProperties().getProperty(MF_API_KEY_PROPERTY);
    if (!key) return finish({status:401,success:false,saved:saved});
    const fetchOptions = {
      method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+key,Origin:'https://certificabrasil.ca'},
      payload:JSON.stringify(toMF(lead,request.requestId)),muteHttpExceptions:true,followRedirects:false
    };
    let upstream;
    apiStartedAt = Date.now();
    try {
      upstream = UrlFetchApp.fetch(MF_API_URL, fetchOptions);
    } finally {
      // Capture HTTP failures and thrown network errors without timing Sheet writes.
      apiCompletedAt = Date.now();
      apiDurationMs = Math.max(0, apiCompletedAt - apiStartedAt);
    }
    const status = upstream.getResponseCode();
    let data;
    try { data = JSON.parse(upstream.getContentText()); } catch (_) { data = {}; }
    if (status === 400) return finish({status:400,success:false,saved:true,details:safeDetails(data.details)});
    if ([200,201].indexOf(status) < 0 || data.success !== true || !data.ticketNumber || !validWhatsApp(data.whatsappUrl)) {
      console.error('Falha MF HTTP '+status);
      return finish({status:[401,403,500,502].indexOf(status)>=0?status:502,success:false,saved:true});
    }
    sheet.getRange(row,20,1,3).setValues([[clean(data.ticketNumber,120),'Encaminhado à MF PRD','Válido']]);
    return finish({status:status,success:true,saved:true,ticketNumber:String(data.ticketNumber),whatsappUrl:data.whatsappUrl,whatsappText:typeof data.whatsappText === 'string'?data.whatsappText:'',duplicate:data.duplicate === true});
  } catch (_) {
    console.error('Falha temporária no encaminhamento MF');
    return finish({status:502,success:false,saved:saved});
  }
}

// Read-only receipt. No contact data or API credentials are returned by JSONP.
function doGet(e) {
  const p = e && e.parameter || {};
  if (!/^__mfReceipt_[a-f0-9]{32}$/.test(p.callback || '') || !validReceipt(p.requestId,p.receiptToken)) return response({ok:false});
  const raw = CacheService.getScriptCache().get('mf:'+p.requestId);
  const receipt = raw ? JSON.parse(raw) : null;
  const result = receipt && receipt.token === p.receiptToken ? receipt.result : {pending:true};
  const json = JSON.stringify(result).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return ContentService.createTextOutput(p.callback+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function toMF(lead, id) {
  const serviceNames = {'digital-certificate':'Certificado digital',documents:'Documentos e procurações',apostille:'Apostila e uso no exterior',other:'Outro serviço documental'};
  const cityNames = {montreal:'Montreal','quebec-city':'Cidade de Quebec',other:'Outra cidade'};
  const payload = {name:lead.name.trim(),phone:String(lead.phone).replace(/\D/g,''),pageUrl:lead.page,externalId:id,obs:{
    'Idioma de preferência':'Português',
    'Autorização de atendimento ao clicar em WhatsApp':lead.consent === 'on',
    'País / código internacional':lead.phone_country || '',
    'Origem':lead.source || 'direct','Campanha':lead.campaign || 'direct','Meio':lead.medium || 'direct','Termo':lead.term || 'direct',
    'Idioma da página':lead.landing_language,'Versão da política de privacidade':lead.consent_version || POLICY_VERSION
  }};
  if (lead.email && lead.email.trim()) payload.email = lead.email.trim();
  if (lead.service) payload.service = serviceNames[lead.service];
  if (lead.message && lead.message.trim()) payload.message = lead.message.trim();
  return payload;
}
function legacySave(lead) {
  if (!isValidLead(lead)) return response({ok:false});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return response({ok:false});
  try {
    const cache = CacheService.getScriptCache(), fingerprint = 'legacy:'+digest(lead.email+'|'+lead.phone);
    if (cache.get(fingerprint)) return response({ok:false});
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    ensureHeaders(sheet);
    sheet.appendRow([new Date(),clean(lead.name,120),clean(lead.phone,32),clean(lead.email,254),clean(lead.city,40),clean(lead.language,8),clean(lead.service,80),clean(lead.message,2000),clean(lead.source,120),clean(lead.campaign,160),clean(lead.medium,80),clean(lead.term,160),clean(lead.landing_language,8),clean(lead.page,2000),'Sim',clean(lead.consent_version||POLICY_VERSION,40)]);
    cache.put(fingerprint,'1',60);
    return response({ok:true});
  } catch (_) {return response({ok:false});} finally {lock.releaseLock();}
}
function ensureHeaders(sheet) {
  if (sheet.getMaxColumns() < 36) sheet.insertColumnsAfter(sheet.getMaxColumns(),36-sheet.getMaxColumns());
  sheet.getRange(1,15,1,22).setValues([['Consentimento registrado','Versão da política','ID do registro','Comprovante hash','Pedido hash','Atendimento MF','Encaminhamento MF','Validação','Tempo API MF (ms)',
    'Servidor antes da API (ms)','Servidor após API até recibo (ms)','Servidor até publicar recibo (ms)',
    'Clique até receber ticket (ms)','Clique até iniciar WhatsApp (ms)','Ticket recebido até WhatsApp (ms)',
    'Clique até POST terminar (ms)','Última consulta de recibo (ms)','Consultas de recibo',
    'Clique até falha (ms)','Resultado da medição','Medição no navegador (UTC)','Medição registrada']]);
}

// Best-effort telemetry for this lead only; it never calls MF or changes lead status.
function saveMFTiming(request) {
  if (!validReceipt(request.requestId,request.receiptToken)) return response({ok:false});
  const raw = CacheService.getScriptCache().get('mf:'+request.requestId);
  const receipt = raw ? JSON.parse(raw) : null;
  if (!receipt || receipt.token !== request.receiptToken || !receipt.result.saved) return response({ok:false});
  const t = request.timing;
  if (!t || typeof t !== 'object' || ['redirect_started','failed'].indexOf(t.outcome)<0) return response({ok:false});
  const durationFields = ['serverPreApiMs','serverPostApiMs','serverTotalMs','clickToReceiptMs','clickToRedirectMs',
    'receiptToRedirectMs','clickToPostSettledMs','lastReceiptQueryMs','clickToFailureMs'];
  for (const field of durationFields) {
    if (t[field] != null && (!Number.isInteger(t[field]) || t[field]<0 || t[field]>600000)) return response({ok:false});
  }
  if (!Number.isInteger(t.receiptPollCount) || t.receiptPollCount<0 || t.receiptPollCount>1000 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t.measuredAt || '')) return response({ok:false});
  if (t.outcome === 'redirect_started' && (!receipt.result.success || t.clickToReceiptMs == null ||
      t.clickToRedirectMs == null || t.receiptToRedirectMs == null || t.clickToRedirectMs<t.clickToReceiptMs ||
      t.receiptToRedirectMs!==t.clickToRedirectMs-t.clickToReceiptMs)) return response({ok:false});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return response({ok:false});
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (sheet.getLastRow()<2) return response({ok:false});
    const match = sheet.getRange(2,17,sheet.getLastRow()-1,1).createTextFinder(request.requestId).matchEntireCell(true).findNext();
    if (!match || sheet.getRange(match.getRow(),18).getValues()[0][0] !== digest(request.receiptToken)) return response({ok:false});
    ensureHeaders(sheet);
    const row = match.getRow();
    const previouslyMeasuredAt = sheet.getRange(row,35).getValues()[0][0];
    // Late arrival from an earlier retry must not overwrite a newer attempt.
    if (typeof previouslyMeasuredAt==='string' && previouslyMeasuredAt>t.measuredAt) return response({ok:false});
    const value = field => t[field] == null ? '' : t[field];
    // Authoritative server durations come from the authenticated cached result, not the browser.
    const serverValue = field => receipt.result[field] == null ? '' : receipt.result[field];
    sheet.getRange(row,24,1,13).setValues([[
      serverValue('serverPreApiMs'),serverValue('serverPostApiMs'),serverValue('serverTotalMs'),
      value('clickToReceiptMs'),value('clickToRedirectMs'),value('receiptToRedirectMs'),
      value('clickToPostSettledMs'),value('lastReceiptQueryMs'),t.receiptPollCount,
      value('clickToFailureMs'),t.outcome,t.measuredAt,new Date()
    ]]);
    return response({ok:true});
  } catch (_) {console.error('Falha ao registrar medição do navegador'); return response({ok:false});}
  finally {lock.releaseLock();}
}
function leadErrors(lead) {
  const details = {};
  if (!lead || typeof lead !== 'object') return {name:'Confira os dados.'};
  if (!isText(lead.name,120)) details.name = 'Informe seu nome.';
  if (lead.email && (!isText(lead.email,254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim()))) details.email = 'Confira seu e-mail.';
  if (!/^\+[\d\s().-]+$/.test(String(lead.phone || '')) || !/^[1-9]\d{7,14}$/.test(String(lead.phone || '').replace(/\D/g,''))) details.phone = 'Informe o número internacional com DDD.';
  if (lead.service && ALLOWED_SERVICES.indexOf(lead.service) < 0) details.service = 'Escolha o serviço.';
  if (String(lead.message || '').length>2000) details.message = 'Use até 2000 caracteres.';
  if (lead.city && ALLOWED_CITIES.indexOf(lead.city)<0 || lead.consent!=='on' || lead.language!=='pt' || lead.landing_language!=='pt' || lead.website) details.name = 'Confira cidade e consentimento.';
  if (!/^https:\/\/(?:www\.)?certificabrasil\.ca(?:[/?#]|$)/.test(String(lead.page || ''))) details.name='Origem não autorizada.';
  return details;
}
function isValidLead(lead) {return Object.keys(leadErrors(lead)).length === 0;}
function safeDetails(details) {
  const safe = {}, labels = ['name','phone','email','service','message'];
  const source = details && details.fieldErrors || details || {};
  if (Array.isArray(source)) source.forEach(function(item){const field=item && (item.field || item.path && item.path[0]);if(labels.indexOf(field)>=0)safe[field]='Confira este campo.';});
  else labels.forEach(function(field){if(source[field])safe[field]='Confira este campo.';});
  return Object.keys(safe).length?safe:{phone:'Confira nome, telefone e e-mail.'};
}
function validReceipt(id,token) {return /^[a-f0-9-]{36}$/.test(id || '') && /^[a-f0-9]{64}$/.test(token || '');}
function validWhatsApp(value) {return /^https:\/\/wa\.me\/[1-9]\d{7,14}(?:\?[^\s]*)?$/.test(value || '');}
function digest(value) {return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value));}
function isText(value,max) {return typeof value==='string' && value.trim().length>0 && value.length<=max;}
function clean(value,max) {const text=String(value || '').trim().slice(0,max);return /^[=+\-@]/.test(text)?"'"+text:text;}
function response(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

// Owner-only setup action: requests the external-request scope without sending lead data.
function authorizeMF() { UrlFetchApp.getRequest(MF_API_URL, {method:'post'}); }


