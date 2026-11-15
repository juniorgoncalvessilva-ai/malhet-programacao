# Spec 091 — App nativo pronto para publicar (Google Play; base para a App Store)

## Pedido
"Não consegui gerar o número D-U-N-S ainda… faça os ajustes propostos e deixe o app pronto para ser publicado assim que
tiver o número."

## Entregas
1. **Assinatura e versão** (`apps/mobile/android/app/build.gradle`): release assinado pela chave de upload lida de
   variáveis de ambiente (`ANDROID_KEYSTORE_FILE/PASSWORD`, `ANDROID_KEY_ALIAS/PASSWORD`) — nenhuma chave no git;
   `versionCode`/`versionName` de `VERSAO_CODIGO`/`VERSAO_NOME`.
2. **Workflow App nativo**: além do APK de teste, gera o `.aab` (`bundleRelease`) a cada mudança; com o secret
   `ANDROID_KEYSTORE_BASE64` ele sai assinado; disparo manual `publicar` envia à Play (faixa internal/alpha/production;
   fechado e produção como rascunho) com `PLAY_SERVICE_ACCOUNT_JSON`.
3. **Marca**: ícones (legado, redondo, adaptativo com fundo #284E4F), splash Android/iOS e ícone do iPhone gerados a
   partir dos SVG da marca nas mesmas dimensões do projeto; fontes em `apps/mobile/assets/`; ícone 512 e gráfico de
   recursos 1024×500 da loja em `apps/mobile/loja/`.
4. **Privacidade**: `allowBackup=false` e `usesCleartextTraffic=false` (dados do aparelho não vão ao backup do Google);
   página pública `/[locale]/privacidade` fiel ao que o sistema guarda (efetivo sem dados sensíveis; descritor facial,
   foto e coordenadas da assinatura só com aceite; ASO só resultado), com seção de exclusão (`#exclusao`) e contato por
   `NEXT_PUBLIC_CONTATO_PRIVACIDADE`; link no login.
5. **Sem cadastro aberto no app**: dentro do app nativo o login não oferece "Criar conta" e `/auth/cadastro` volta ao
   login — conta só pelo administrador da obra (a loja não exige exclusão de conta dentro do app).
6. **Roteiro** `docs/play-store.md`: conta de organização (D-U-N-S), chave, secrets, criação do app, primeiro envio
   manual, ficha da loja (textos prontos), formulários de conteúdo e Data safety, notas para a revisão, envio automático.

## Fica para quando houver conta
Capturas de tela com obra de demonstração (nomes fictícios), conta de teste para a revisão, envio do primeiro .aab.
