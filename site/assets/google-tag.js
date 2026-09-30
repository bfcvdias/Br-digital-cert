const GOOGLE_TAG_ID = 'G-FGFEH4Y7W4';
const DISABLE_KEY = 'ga-disable-' + GOOGLE_TAG_ID;
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
window[DISABLE_KEY] = true;
window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
let configured = false;
export function setGoogleConsent(granted) {
  window[DISABLE_KEY] = !granted;
  window.gtag('consent','update',{analytics_storage:granted?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  if (!granted || configured) return;
  configured = true;
  window.gtag('js',new Date());
  window.gtag('config',GOOGLE_TAG_ID,{allow_google_signals:false,allow_ad_personalization_signals:false});
  const script = document.createElement('script');
  script.id = 'google-analytics-tag'; script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_TAG_ID;
  document.head.append(script);
}
