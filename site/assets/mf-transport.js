/* Requests send contact data by POST; the read-only receipt contains no contact data. */
const MF_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyft5lhViodQg1cGJYL_Hn5XyW4dhkVeZeIgmPTD1XVqQbLbPybp0wwq04IVL9uZpxA/exec';
function readMFReceipt(receipt) {
  return new Promise((resolve,reject) => {
    const name = '__mfReceipt_' + crypto.randomUUID().replace(/-/g,'');
    const script = document.createElement('script');
    const url = new URL(MF_SCRIPT_URL);
    url.searchParams.set('requestId',receipt.requestId);
    url.searchParams.set('receiptToken',receipt.receiptToken);
    url.searchParams.set('callback',name);
    let timer;
    function cleanup() {clearTimeout(timer); delete window[name]; script.remove();}
    window[name] = result => {cleanup();resolve(result);};
    script.onerror = () => {cleanup();reject(new Error('Não foi possível consultar o encaminhamento.'));};
    timer = setTimeout(()=>{cleanup();reject(new Error('Consulta indisponível.'));},15000);
    script.src = url.href; script.referrerPolicy='no-referrer';document.head.append(script);
  });
}
// All client durations use a monotonic clock. No contact data is retained in timing logs.
function beginMFTiming(clickedAt = performance.now()) {
  return {clickedAt, pollCount:0, postSettledMs:null, receiptMs:null, receiptQueryMs:null};
}
function elapsedMF(timing) { return Math.max(0, Math.round(performance.now() - timing.clickedAt)); }
function finishMFTiming(receipt, result, timing, outcome) {
  const values = {
    clickToReceiptMs:timing.receiptMs,
    clickToPostSettledMs:timing.postSettledMs,
    lastReceiptQueryMs:timing.receiptQueryMs,
    receiptPollCount:timing.pollCount,
    outcome,
    measuredAt:new Date().toISOString()
  };
  values.serverPreApiMs = result && result.serverPreApiMs;
  values.serverPostApiMs = result && result.serverPostApiMs;
  values.serverTotalMs = result && result.serverTotalMs;
  if (outcome === 'redirect_started') {
    values.clickToRedirectMs = elapsedMF(timing);
    values.receiptToRedirectMs = Math.max(0, values.clickToRedirectMs - timing.receiptMs);
  } else values.clickToFailureMs = elapsedMF(timing);
  const diagnostic = { ...values, apiDurationMs:result && result.apiDurationMs,
    serverPreApiMs:result && result.serverPreApiMs,
    serverPostApiMs:result && result.serverPostApiMs,
    serverTotalMs:result && result.serverTotalMs };
  window.certificaBrasilTiming = diagnostic;
  try { sessionStorage.setItem('certificabrasil-last-timing', JSON.stringify(diagnostic)); } catch (_) {}
  // Non-blocking delivery: measurements must never add another wait before WhatsApp.
  const body = JSON.stringify({action:'mfTiming', ...receipt, timing:values});
  try {
    const queued = typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(MF_SCRIPT_URL, new Blob([body], {type:'text/plain;charset=utf-8'}));
    if (!queued) fetch(MF_SCRIPT_URL, {method:'POST', mode:'no-cors', keepalive:true,
      headers:{'Content-Type':'text/plain;charset=utf-8'}, body}).catch(()=>{});
  } catch (_) {}
  return diagnostic;
}
async function sendMFLead(lead,receipt,timing = beginMFTiming(), turnstileToken) {
  // An opaque POST response cannot confirm storage; the receipt confirms both stages.
  const post = fetch(MF_SCRIPT_URL, {method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'mfLead',...receipt,lead,turnstileToken}),signal:AbortSignal.timeout(90000)})
    .catch(()=>{}).then(()=>{ timing.postSettledMs = elapsedMF(timing); });
  const deadline = Date.now()+100000;
  while(Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,1500));
    let result;
    const queryStartedAt = performance.now();
    timing.pollCount++;
    try {result=await readMFReceipt(receipt);} catch (_) {continue;}
    timing.receiptQueryMs = Math.max(0, Math.round(performance.now() - queryStartedAt));
    if (result && !result.pending) {
      timing.receiptMs = elapsedMF(timing);
      // Preserve current behavior while measuring any delay from this extra await.
      await post; return result;
    }
  }
  throw new Error('Tempo esgotado ao consultar o encaminhamento.');
}

