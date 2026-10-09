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
async function sendMFLead(lead,receipt) {
  // An opaque POST response cannot confirm storage; the receipt confirms both stages.
  const post = fetch(MF_SCRIPT_URL, {method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'mfLead',...receipt,lead}),signal:AbortSignal.timeout(90000)}).catch(()=>{});
  const deadline = Date.now()+100000;
  while(Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,1500));
    let result;
    try {result=await readMFReceipt(receipt);} catch (_) {continue;}
    if (result && !result.pending) {await post;return result;}
  }
  throw new Error('Tempo esgotado ao consultar o encaminhamento.');
}
