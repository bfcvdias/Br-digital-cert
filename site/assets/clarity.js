import Clarity from './vendor/clarity/index.js';
const CLARITY_PROJECT_ID = 'yqkkecn4cx';
Clarity.init(CLARITY_PROJECT_ID);
Clarity.consentV2({ad_Storage:'denied',analytics_Storage:'denied'});
