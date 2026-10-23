/* Public site key only. Configure a real free Turnstile widget before rollout. */
(() => {
  const SITE_KEY = '';
  let loading;
  function load() {
    if (window.turnstile) return Promise.resolve();
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { script.remove(); loading = null; reject(new Error('Verificação indisponível.')); }, 20000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error('Verificação indisponível.')); };
      document.head.append(script);
    });
    return loading;
  }
  window.getLeadBotToken = async requestId => {
    // Lazy load on a valid form submission; never transmit name, phone or email.
    if (!SITE_KEY || /^[123]x000000/.test(SITE_KEY)) throw new Error('Verificação de segurança indisponível.');
    await load();
    const container = document.getElementById('lead-bot-check');
    return new Promise((resolve, reject) => {
      let widget, settled = false;
      const finish = (error, token) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (widget !== undefined) window.turnstile.remove(widget);
        error ? reject(error) : resolve(token);
      };
      const timer = setTimeout(() => finish(new Error('Verificação expirada. Tente novamente.')), 120000);
      try {
        widget = window.turnstile.render(container, {
          sitekey:SITE_KEY, action:'mf_lead', cData:requestId,
          execution:'execute', appearance:'interaction-only', language:'pt-br',
          callback:token => finish(null, token),
          'error-callback':() => finish(new Error('Não foi possível verificar o envio.')),
          'expired-callback':() => finish(new Error('Verificação expirada. Tente novamente.'))
        });
        window.turnstile.execute(widget);
      } catch (error) { finish(error); }
    });
  };
})();
