'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { validatePayload, sendToMF } = require('./partner');
const MF_API_KEY = defineSecret('MF_API_KEY');

exports.mfPartnerLead = onRequest({region:'us-central1',secrets:[MF_API_KEY],timeoutSeconds:30,maxInstances:3,memory:'256MiB'}, async (req,res) => {
  res.set('Cache-Control','no-store');
  if (req.method !== 'POST') { res.set('Allow','POST'); res.status(405).json({success:false}); return; }
  const origin = req.get('origin');
  const allowed = new Set(['https://certificabrasil.ca','https://www.certificabrasil.ca','https://my-br-digital-service.web.app','https://my-br-digital-service.firebaseapp.com']);
  let preview = false;
  try { const url = new URL(origin); preview = url.protocol === 'https:' && /^my-br-digital-service--mf-uat-[a-z0-9-]+\.web\.app$/.test(url.hostname); } catch (_) {}
  if (!allowed.has(origin) && !preview) { res.status(403).json({success:false}); return; }
  if (!req.is('application/json') || Number(req.get('content-length') || 0) > 16000) { res.status(400).json({success:false,details:{name:'Confira os dados enviados.'}}); return; }
  const validated = validatePayload(req.body);
  if (validated.details) { res.status(400).json({success:false,details:validated.details}); return; }
  try {
    const result = await sendToMF(validated.payload, MF_API_KEY.value(), fetch, origin);
    if (result.status >= 400) console.error('MF encaminhamento recusado', {status:result.status});
    res.status(result.status).json(result.body);
  } catch (_) {
    console.error('MF indisponível: falha de rede ou resposta inválida');
    res.status(502).json({success:false});
  }
});
