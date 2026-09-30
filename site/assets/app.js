/* Partner authentication is held by the server, never in public JavaScript. */

const CONFIG = {
  leadWebhookUrl: "https://script.google.com/macros/s/AKfycbyft5lhViodQg1cGJYL_Hn5XyW4dhkVeZeIgmPTD1XVqQbLbPybp0wwq04IVL9uZpxA/exec",
  brand: "Certifica Brasil Québec"
};

const copy = {
  pt: { metaTitle:"Certifica Brasil Québec | Certificados digitais e documentos brasileiros no Quebec", metaDescription:"Certificados digitais e documentos brasileiros para brasileiros no Quebec, com atendimento remoto em português.", notice:"Atendimento remoto para brasileiros em Montreal e Cidade de Quebec",noticeCta:"Falar com a equipe",navServices:"Serviços",navHow:"Como funciona",navFaq:"Perguntas",headerCta:"Começar",heroEyebrow:"PARA BRASILEIROS NO QUÉBEC",heroTitle:"Seus documentos do Brasil, <span>resolvidos daqui.</span>",heroText:"Orientação clara para certificados digitais e serviços documentais remotos, com atendimento em português.",heroCta:"Solicitar atendimento",heroSecondary:"Entenda o processo <span>→</span>",locations:"Montreal · Cidade de Quebec · atendimento remoto",trustOneTitle:"Em português",trustOneText:"Atendimento claro, do início ao fim",trustTwoTitle:"Atendimento remoto",trustTwoText:"De onde você estiver no Québec",trustThreeTitle:"Próximo passo claro",trustThreeText:"Seu pedido segue para WhatsApp",servicesEyebrow:"COMO PODEMOS AJUDAR",servicesTitle:"O suporte certo para o seu momento.",servicesText:"Conte o que você precisa. A equipe avalia o seu caso e explica os próximos passos.",service1Title:"Certificado digital",service1Text:"Orientação para solicitar e utilizar certificados digitais brasileiros à distância.",service2Title:"Documentos e procurações",service2Text:"Ajuda para entender os requisitos de documentos, autorizações e procurações.",service3Title:"Apostila e uso no exterior",service3Text:"Orientação inicial para documentos brasileiros que serão usados fora do Brasil.",service4Title:"Outro serviço documental",service4Text:"Não encontrou o que procura? Envie uma breve descrição para a equipe.",learnMore:"Tenho interesse <span>→</span>",servicesNote:"A disponibilidade e os requisitos de cada serviço são confirmados pela equipe antes do atendimento.",howEyebrow:"SIMPLES E DIRETO",howTitle:"Você explica. Nós organizamos o próximo passo.",howText:"O formulário ajuda a equipe a chegar ao WhatsApp já entendendo sua necessidade.",howCta:"Começar agora",step1Title:"Envie seu pedido",step1Text:"Informe o serviço, cidade e a melhor forma de contato.",step2Title:"Receba orientação inicial",step2Text:"Seu resumo chega à equipe pelo WhatsApp.",step3Title:"Confirme os requisitos",step3Text:"A equipe confirma documentos, elegibilidade e próximos passos para seu caso.",trustEyebrow:"FEITO PARA A COMUNIDADE",trustTitle:"Uma conversa mais clara, desde o primeiro contato.",trustText:"Seu pedido é registrado com idioma, cidade, serviço e origem. Isso facilita o acompanhamento pela equipe e evita que você repita informações.",trustList1:"Preferência de idioma registrada",trustList2:"Resumo do pedido enviado ao WhatsApp",trustList3:"Sem promessas de prazo ou resultado antes da análise",credCardTitle:"Atendimento com contexto local",credCardText:"Para brasileiros construindo a vida no Québec.",faqEyebrow:"DÚVIDAS FREQUENTES",faqTitle:"Antes de começar",faq1Q:"O atendimento é presencial?",faq1A:"O site foi pensado para iniciar o atendimento remotamente. A equipe confirmará quais etapas, se houver, exigem uma ação específica no seu caso.",faq2Q:"O atendimento é em português?",faq2A:"Sim. O atendimento inicial é realizado em português.",faq3Q:"O certificado ou documento será aceito em qualquer situação?",faq3A:"A aceitação depende do documento, do emissor e da finalidade. A equipe deve confirmar a aplicabilidade e os requisitos antes de qualquer contratação.",faq4Q:"O que acontece depois que envio o formulário?",faq4A:"Você será direcionado ao WhatsApp com um resumo do pedido. A equipe poderá então confirmar os detalhes e os próximos passos.",formEyebrow:"VAMOS CONVERSAR",formTitle:"Conte o que você precisa.",formText:"Leva menos de dois minutos. Depois, você segue para uma conversa no WhatsApp com seu pedido já resumido.",privacyTitle:"Seus dados, com propósito",privacyText:"Usamos seus dados para responder ao pedido e acompanhar sua origem. Não inclua documentos sensíveis neste formulário.",labelName:"Nome completo",labelPhone:"Telefone / WhatsApp",labelEmail:"E-mail",labelCity:"Sua cidade",labelLanguage:"Idioma de preferência",labelService:"Qual serviço você procura?",labelMessage:"Como podemos ajudar? (opcional)",selectPlaceholder:"Selecione",cityOther:"Outra cidade",consent:"Concordo que a equipe registre meus dados para responder a este pedido e me contate pelo WhatsApp ou e-mail.",submit:"Continuar para o WhatsApp",formFootnote:"Ao continuar, você abrirá o WhatsApp. Não envie documentos sensíveis até receber orientação da equipe.",footerPrivacy:"Privacidade e consentimento",footerNote:"Informações gerais; requisitos e aplicabilidade devem ser confirmados para cada caso.",configError:"Antes de publicar, configure o número do WhatsApp no arquivo assets/app.js." },
};

const lang = "pt";
const t = copy[lang];

document.documentElement.lang = lang === "pt" ? "pt-BR" : lang === "fr" ? "fr-CA" : "en-CA";
document.documentElement.dataset.lang = lang;
document.title = t.metaTitle;
document.querySelector('meta[name="description"]').content = t.metaDescription;
document.querySelectorAll("[data-i18n]").forEach(el => { if(t[el.dataset.i18n]) el.textContent = t[el.dataset.i18n].replace(/<[^>]*>/g, ""); });
document.querySelectorAll("[data-i18n-html]").forEach(el => { if(t[el.dataset.i18nHtml]) el.innerHTML = t[el.dataset.i18nHtml]; });
document.querySelector("#year").textContent = new Date().getFullYear();
document.querySelector('select[name="language"]').value = lang;


const serviceSelect = document.querySelector('select[name="service"]');
document.querySelectorAll("[data-service]").forEach(link => link.addEventListener("click", () => serviceSelect.value = link.dataset.service));
const params = new URLSearchParams(window.location.search);
const utmMap = {utm_source:"source",utm_campaign:"campaign",utm_medium:"medium",utm_term:"term"};
Object.entries(utmMap).forEach(([query,field]) => document.querySelector(`[name="${field}"]`).value = params.get(query) || "direct");
document.querySelector('[name="landing_language"]').value = lang;

let submitting = false;
let savedLeadSignature = null;
const mfReceipts = new Map();
document.querySelector("#lead-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget, status = document.querySelector("#form-status");
  if (submitting) return;
  if (form.elements.website.value) return;
  const fullPhone = window.validateLeadPhone();
  if (!fullPhone) { form.reportValidity(); return; }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const lead = Object.fromEntries(new FormData(form).entries());
  lead.phone = fullPhone;
  lead.timestamp = new Date().toISOString(); lead.page = location.href;
  lead.brand = CONFIG.brand;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  submitting = true; button.disabled = true; button.textContent = "Enviando...";
  form.setAttribute('aria-busy', 'true'); status.replaceChildren(); status.classList.remove('form-status-success');
  const payload = {
    name: lead.name.trim(), phone: fullPhone.replace(/\D/g, ''),
    pageUrl: location.href,
    obs: {
      'Sua cidade': form.elements.city.selectedOptions[0].textContent,
      'Idioma de preferência': form.elements.language.selectedOptions[0].textContent,
      'Li e aceito a Política de Privacidade.': form.elements.consent.checked,
      'País / código internacional': form.elements.phone_country.value,
      'Origem': lead.source, 'Campanha': lead.campaign, 'Meio': lead.medium,
      'Termo': lead.term, 'Idioma da página': lead.landing_language,
      'Versão da política de privacidade': lead.consent_version
    }
  };
  if (lead.email?.trim()) payload.email = lead.email.trim();
  if (lead.service) payload.service = serviceSelect.selectedOptions[0].textContent;
  if (lead.message?.trim()) payload.message = lead.message.trim();
  const signature = JSON.stringify(payload);
  let success = false;
  try {
    let receipt = mfReceipts.get(signature);
    if (!receipt) {
      receipt = {requestId:crypto.randomUUID(),receiptToken:[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("")};
      mfReceipts.set(signature,receipt);
    }
    const result = await sendMFLead(lead,receipt);
    if (result.saved) savedLeadSignature = signature;
    if (result.status === 400) {
      const labels = {name:'Nome completo',phone:'Telefone / WhatsApp',email:'E-mail',service:'Serviço',message:'Mensagem'};
      const details = result.details;
      const fields = Array.isArray(details) ? details.map(item => typeof item === 'string' ? item : item.field || item.path?.[0]) : details && typeof details === 'object' ? Object.keys(details) : [];
      const names = [...new Set(fields.map(field => labels[field]).filter(Boolean))];
      status.textContent = names.length ? `Confira os dados: ${names.join(', ')}.` : 'Confira nome, WhatsApp com DDD e e-mail e tente novamente.';
      console.error('MF: dados inválidos', {status: 400, fields: fields.filter(field => labels[field])});
      return;
    }
    if (![200,201].includes(result.status) || result.success !== true || !result.ticketNumber) throw new Error(`MF: HTTP ${result.status}`);
    const url = new URL(result.whatsappUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'wa.me' || !/^\/\d{8,15}\/?$/.test(url.pathname) || url.username || url.password || url.port) throw new Error('MF: link do WhatsApp inválido');
    const ticketNumber = String(result.ticketNumber);
    let whatsappText = url.searchParams.get('text') || result.whatsappText || '';
    if (!whatsappText.includes(ticketNumber)) whatsappText = [whatsappText, `Olá! Meu número de atendimento é ${ticketNumber}.`].filter(Boolean).join('\n');
    url.searchParams.set('text',whatsappText);
    const confirmation = document.createElement('p');
    confirmation.textContent = 'Pedido confirmado. Seu número de atendimento: ';
    const ticket = document.createElement('strong'); ticket.textContent = String(result.ticketNumber);
    confirmation.append(ticket);
    const link = document.createElement('a'); link.className = 'button'; link.href = url.href; link.textContent = 'Falar com a MF no WhatsApp';
    status.append(confirmation, link);
    status.classList.add('form-status-success'); status.tabIndex = -1; status.focus();
    success = true;
    setTimeout(() => { window.location.href = url.href; }, 3000);
  } catch (error) {
    console.error('Falha no encaminhamento MF', error instanceof Error ? error.message : 'Falha de rede');
    status.textContent = savedLeadSignature === signature
      ? 'Recebemos seus dados, mas não conseguimos concluir o encaminhamento agora. Tente novamente em instantes.'
      : 'Não conseguimos enviar seus dados agora. Tente novamente em instantes.';
  } finally {
    form.removeAttribute('aria-busy');
    if (!success) { submitting = false; button.disabled = false; button.textContent = originalText; }
    else button.textContent = 'Pedido enviado';
  }
});

const visualCopy = {pt:{welcomeTitle:"Você não precisa resolver tudo sozinho.",welcomeText:"Comece com uma conversa.",cityCaption:"Montreal, Québec"}};
document.querySelectorAll("[data-i18n=welcomeTitle],[data-i18n=welcomeText],[data-i18n=cityCaption]").forEach(el => {
  el.textContent = visualCopy.pt[el.dataset.i18n];
});
const ptOverrides = {
  heroText:"Orientação clara para certificados digitais e serviços documentais remotos, com um atendimento simples e direto.",
  trustOneTitle:"Atendimento próximo",
  trustOneText:"Para brasileiros no Québec",
  trustText:"Seu pedido é registrado com cidade, serviço e origem. Isso facilita o acompanhamento pela equipe e evita que você repita informações.",
  trustList1:"Atendimento organizado para o seu pedido."
};
document.querySelectorAll("[data-i18n]").forEach(el => {
  if (ptOverrides[el.dataset.i18n]) el.textContent = ptOverrides[el.dataset.i18n];
});



