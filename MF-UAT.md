# CertificaBrasil — encaminhamento MF em UAT

O site atualizado está em `site/`; `functions/` contém o encaminhamento protegido para a API da MF. A configuração de Hosting publica somente `site/`. O código antigo do repositório não deve ser usado para esta publicação.

## Configuração protegida

- Projeto existente: `my-br-digital-service` (confirmar acesso antes de publicar).
- A chave é o segredo Firebase `MF_API_KEY`. Nenhuma chave fica no HTML, JavaScript público ou repositório.
- A URL UAT está em `functions/partner.js` como `MF_API_URL`, com a URL de produção comentada ao lado.
- O país inicial é Canadá (+1), configurado no topo de `site/assets/phone.js`; todos os 245 países/territórios da biblioteca podem ser escolhidos.
- As Cloud Functions exigem um projeto com faturamento habilitado. Não mudar o plano automaticamente.

Após login no Firebase CLI, cadastrar a chave pelo prompt oculto:

```powershell
npx -y firebase-tools@latest functions:secrets:set MF_API_KEY --project my-br-digital-service
```

Publicar primeiro a função e depois o canal de testes (não publicar Hosting de produção enquanto a API aponta para UAT):

```powershell
npm.cmd ci --prefix functions
npx -y firebase-tools@latest deploy --only functions:mfPartnerLead --project my-br-digital-service
npx -y firebase-tools@latest hosting:channel:deploy mf-uat --expires 7d --project my-br-digital-service
```

## Validação

```powershell
node --test functions/test/partner.test.js
```

Verificado localmente: seis testes do servidor; seleção de país; pesquisa; resposta 400; resposta 502 com recuperação do botão; confirmação do ticket; botão WhatsApp; redirecionamento na mesma aba após 3 segundos; tela de celular sem overflow horizontal.

As respostas locais são simuladas. Ainda não foram validados autenticação real da MF, criação de ticket UAT, autorização do domínio/canal de testes nem registro real em planilha. Não declarar UAT pronto antes destes testes.

O Apps Script existente usa `no-cors`: o navegador pode aguardar a transmissão, mas não consegue verificar a resposta nem obter o ID do registro. O mesmo pedido não é reenviado à planilha durante uma tentativa repetida na mesma página; alterações de dados geram novo registro. O identificador `externalId` é omitido porque o fluxo atual não o fornece. Persistência garantida e retomada após recarregar a página exigem uma resposta confirmada do Apps Script, fora desta alteração.

`obs` contém os campos restantes de cidade, idioma, país, consentimento, versão de política e origem. Rótulos visíveis são preservados. Campos de armadilha e credenciais não são encaminhados. Mensagem livre segue o contrato da MF; a página orienta a não enviar documentos, senhas ou dados sensíveis.

SEO e beacon Cloudflare foram preservados. A política de privacidade agora informa o encaminhamento à MF, com versão de consentimento 2026-09-30.

Após aprovação UAT e liberação da MF, trocar `MF_API_URL`, cadastrar a chave de produção, republicar a função e promover o site aprovado para Hosting de produção. A chave enviada no chat deve ser substituída.
