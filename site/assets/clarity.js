import Clarity from './vendor/clarity/index.js';
const CLARITY_PROJECT_ID = 'yqkkecn4cx';
const CONSENT_KEY = 'certificabrasil-analytics-consent-v1';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
let choice = null;
try {
  const saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
  if (saved && ['granted','denied'].includes(saved.analytics) && Number.isFinite(saved.at) && saved.at <= Date.now() && Date.now() - saved.at < MAX_AGE) choice = saved.analytics;
} catch (_) {}
Clarity.init(CLARITY_PROJECT_ID);
function applyConsent() { Clarity.consentV2({ad_Storage:'denied',analytics_Storage:choice === 'granted' ? 'granted' : 'denied'}); }
applyConsent();
const panel = document.querySelector('#cookie-consent');
const preferences = document.querySelector('#cookie-preferences');
const note = document.querySelector('#cookie-choice');
function render() {
  panel.hidden = choice !== null;
  note.textContent = choice === 'granted' ? 'Cookies de análise: aceitos.' : choice === 'denied' ? 'Cookies de análise: recusados.' : 'Cookies de análise desativados até sua escolha.';
}
function choose(value) {
  choice = value;
  try { localStorage.setItem(CONSENT_KEY,JSON.stringify({analytics:value,at:Date.now()})); } catch (_) {}
  applyConsent(); render(); preferences.focus();
}
document.querySelector('#cookie-accept').addEventListener('click',()=>choose('granted'));
document.querySelector('#cookie-reject').addEventListener('click',()=>choose('denied'));
preferences.addEventListener('click',()=>{panel.hidden=false;document.querySelector('#cookie-reject').focus();});
render();
