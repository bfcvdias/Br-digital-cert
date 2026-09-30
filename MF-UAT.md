# CertificaBrasil — integração MF UAT

O site de produção certificabrasil.ca usa site/. Somente a API MF usa UAT. Firebase Hosting publica os arquivos estáticos; Apps Script salva na planilha e encaminha à MF. Esta integração não usa Cloud Functions nem exige Blaze.

## Configuração

Projeto Firebase: my-br-digital-service. Código protegido: apps-script/Code.gs. A chave fica somente na propriedade privada MF_API_KEY do Apps Script. MF_API_URL aponta para UAT e tem a URL de produção comentada ao lado. O país inicial é Canadá (+1); a lista pesquisável inclui todos os países/territórios da biblioteca, com Canadá, Estados Unidos e Brasil primeiro.

## Fluxo

1. Valida formato internacional e regras do plano telefônico no navegador. Isso não confirma a existência de conta WhatsApp.
2. Grava na planilha com Validação = Não válido antes do envio à MF.
3. Envia telefone só com dígitos; mapeia os demais campos e usa externalId para identificar o registro. Repetições idênticas na mesma página não duplicam a linha.
4. Com sucesso HTTP 200/201, ticket e link WhatsApp válidos, registra Atendimento MF, Encaminhamento MF e Validação = Válido.
5. Redireciona imediatamente na mesma aba ao WhatsApp após confirmação do servidor; a mensagem inclui o ticket. O ticket permanece registrado na planilha e não é mostrado na tela.
6. Em falha, preserva o registro como Não válido, informa o problema e permite nova tentativa.

O POST transmite os dados ao Apps Script. Como a resposta é opaca, uma consulta JSONP somente de leitura confirma a gravação e o encaminhamento usando UUID e token aleatório de 256 bits. O comprovante não retorna os campos do formulário nem a chave e expira após dez minutos.

O formulário usa somente Nome, Telefone / WhatsApp e E-mail opcional. O aviso junto do botão explica a autorização de registro e encaminhamento à MF; o clique registra o consentimento. Cidade e mensagem foram removidas; serviço só é preenchido quando a pessoa usa um link de interesse no site. A política mantém contato e retenção de 12 meses e informa o encaminhamento à MF. SEO e Cloudflare Analytics foram preservados.

## Verificação

Executar node apps-script/test.cjs. Oito testes cobrem ordem de gravação, estados, erros, repetição e proteção dos comprovantes. Testes locais da interface usam respostas simuladas e verificaram mensagem com ticket e redirecionamento.

Em 30/09/2026, Apps Script versão 5 foi publicado no endpoint existente. O teste real salvou um registro sintético, mas MF UAT retornou HTTP 504 FUNCTION_INVOCATION_TIMEOUT em duas verificações. O site trata esse retorno como falha temporária. Depois, o teste completo pelo site publicado foi bem-sucedido: MF retornou BRN-oe46171, a planilha registrou Atendimento MF e Validação = Válido e o navegador redirecionou ao WhatsApp da MF com o ticket na mensagem. Os erros anteriores permanecem registrados como Não válido.

Publicar somente Hosting no projeto my-br-digital-service. Para mudar a API para produção, trocar MF_API_URL, cadastrar a chave de produção na propriedade privada e publicar uma nova versão do mesmo Apps Script. A chave compartilhada no chat deve ser substituída.

Apps Script versão 6 e Hosting publicados com o formulário simplificado em 30/09/2026.

Atualização: o chamado permanece somente na planilha. O WhatsApp recebe uma saudação sem número de ticket. Durante o envio, o site mostra processamento e, após sete segundos, informa que continua aguardando a MF.
