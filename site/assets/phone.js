/* Country metadata and validation are supplied by the locally hosted library. */
const CODIGO_DO_PAIS_PADRAO = '1';
const PAIS_PADRAO = 'CA';
(() => {
  const lib = window.libphonenumber;
  const input = document.querySelector('[name="phone"]');
  const control = document.querySelector('#phone-country');
  const menu = document.querySelector('#country-menu');
  const search = document.querySelector('#country-search');
  const list = document.querySelector('#country-options');
  const countryField = document.querySelector('[name="phone_country"]');
  const help = document.querySelector('#phone-format');
  const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  const flag = code => String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const priority = ['CA', 'US', 'BR'];
  const countries = lib.getCountries().map(code => ({ code, name: names.of(code), dial: lib.getCountryCallingCode(code) }));
  countries.sort((a, b) => {
    const ai = priority.indexOf(a.code), bi = priority.indexOf(b.code);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  let selected = countries.some(c => c.code === PAIS_PADRAO) ? PAIS_PADRAO : countries.find(c => c.dial === CODIGO_DO_PAIS_PADRAO).code;
  function close(restore = false) {
    menu.hidden = true;
    control.setAttribute('aria-expanded', 'false');
    if (restore) control.focus();
  }
  function choose(code) {
    selected = code;
    const country = countries.find(c => c.code === code);
    countryField.value = code;
    control.textContent = `${flag(code)} +${country.dial} ▾`;
    control.setAttribute('aria-label', `País: ${country.name}, código +${country.dial}`);
    help.textContent = 'Inclua o DDD/código de área. Você também pode colar um número completo com + e o código do país.';
    input.placeholder = code === 'BR' ? '11 91234 5678' : code === 'CA' || code === 'US' ? '514 555 1234' : 'DDD e número';
    input.setCustomValidity('');
    document.querySelector('#form-status').textContent = '';
  }
  function render() {
    const query = normalize(search.value.trim());
    list.replaceChildren();
    countries.filter(c => normalize(`${c.name} ${c.code} +${c.dial}`).includes(query)).forEach(c => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'country-option';
      button.textContent = `${flag(c.code)} (+${c.dial}) ${c.name}`;
      button.setAttribute('aria-pressed', String(c.code === selected));
      button.addEventListener('click', () => { choose(c.code); close(); input.focus(); });
      list.append(button);
    });
    if (!list.children.length) list.textContent = 'Nenhum país encontrado.';
  }
  control.addEventListener('click', () => {
    if (!menu.hidden) { close(); return; }
    menu.hidden = false;
    control.setAttribute('aria-expanded', 'true');
    search.value = ''; render(); search.focus();
  });
  search.addEventListener('input', render);
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (event.key === 'ArrowDown' && event.target === search) { event.preventDefault(); list.querySelector('button')?.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.country-picker')) close(); });
  document.addEventListener('focusin', event => { if (!event.target.closest('.country-picker')) close(); });
  input.addEventListener('input', () => {
    input.setCustomValidity('');
    const raw = input.value.trim();
    if (raw.startsWith('+')) {
      const parsed = lib.parsePhoneNumberFromString(raw);
      if (parsed?.country) choose(parsed.country);
    }
  });
  window.validateLeadPhone = () => {
    const raw = input.value.trim();
    let parsed;
    if (/^[+\d\s().-]+$/.test(raw)) {
      try { parsed = lib.parsePhoneNumberFromString(raw, { defaultCountry: selected, extract: false }); } catch (_) {}
    }
    if (!parsed || !parsed.isValid() || parsed.ext) {
      input.setCustomValidity('Informe um WhatsApp válido, incluindo o DDD/código de área do país escolhido.');
      return null;
    }
    if (parsed.country) choose(parsed.country);
    input.setCustomValidity('');
    return parsed.number;
  };
  choose(selected);
})();
