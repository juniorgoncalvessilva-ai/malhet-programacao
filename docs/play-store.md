# Publicar o Malhet Campo na Google Play (spec 091)

Tudo o que é técnico já está pronto no repositório. Este roteiro é o que falta fazer **quando o D-U-N-S sair**, na ordem.

## O que já está pronto
- **Pacote da Play (.aab)**: o workflow *App nativo* gera `malhet-campo-play-aab` a cada mudança em `apps/mobile`
  (Actions › App nativo › Artifacts). Sem a chave nos secrets ele sai sem assinatura (só confere o build); com a chave,
  sai assinado e pronto para enviar.
- **Versão automática**: `versionCode` = número da execução do workflow (sempre sobe), `versionName` = `1.0.<execução>`.
- **Ícone, ícone adaptativo e tela de abertura** com a marca (Android e iPhone), fontes em `apps/mobile/assets/`.
- **Imagens da loja**: `apps/mobile/loja/icone-play-512.png` e `apps/mobile/loja/grafico-recursos-1024x500.png`.
- **Política de privacidade pública**: `https://malhet.com/pt-BR/privacidade` (seção de exclusão em `#exclusao`).
- **Sem backup na nuvem do Google** (`allowBackup=false`), só HTTPS, sem cadastro aberto dentro do app (a conta é
  liberada pelo administrador da obra — por isso a loja não exige exclusão de conta dentro do app).
- **Envio pela Play**: o mesmo workflow tem o disparo manual *publicar* (faixa interna, fechada ou produção).

## 1. Conta de desenvolvedor (depende do D-U-N-S)
1. Play Console › criar conta de **organização** (US$ 25, uma vez) com o D-U-N-S da empresa.
   Conta de organização não precisa do teste fechado de 12 pessoas × 14 dias exigido de contas pessoais novas.
2. Confirmar o site e o e-mail de contato do desenvolvedor.

## 2. Chave de upload (uma vez — guarde fora do git e faça cópia segura)
```bash
keytool -genkey -v -keystore malhet-upload.jks -alias malhet -keyalg RSA -keysize 2048 -validity 10000
```
```bash
base64 -w0 malhet-upload.jks > malhet-upload.jks.b64
```
No GitHub (repositório › Settings › Secrets and variables › Actions):

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | conteúdo de `malhet-upload.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `malhet` |
| `ANDROID_KEY_PASSWORD` | senha da chave (se for a mesma, pode repetir) |

E em **Variables**: `CONTATO_PRIVACIDADE` = e-mail do canal de privacidade/encarregado (DPO) da empresa — aparece na
política pública (próximo deploy do web).

Depois rode *App nativo* (Run workflow) e baixe o artifact `malhet-campo-play-aab` — agora assinado.

## 3. Criar o app na Play Console
- Nome **Malhet Campo**, idioma padrão **Português (Brasil)**, tipo **App**, **Gratuito**.
- **Play App Signing**: aceitar (o Google guarda a chave de assinatura; a nossa é só a de upload).
- **O primeiro .aab é enviado à mão** pela Console (Teste interno › Criar versão › enviar o arquivo). O Google só libera
  o envio automático depois do primeiro.

### Ficha da loja
- **Nome**: Malhet Campo
- **Descrição curta** (até 80): `Programação da obra, presença por crachá NFC e segurança no canteiro.`
- **Descrição completa**:
  > O Malhet Campo é o app de canteiro do Malhet, sistema de gestão de obras. Encarregados, planejamento e segurança
  > usam o celular para:
  > • ver a programação vigente da equipe e lançar o realizado do dia;
  > • registrar a presença lendo o crachá por NFC, QR code ou reconhecimento facial (com consentimento);
  > • abrir ocorrências e restrições com fotos datadas da frente de serviço;
  > • fazer auditorias de segurança e acompanhar o plano de ação 5W2H;
  > • aplicar o teste de etilômetro com assinatura do colaborador;
  > • trabalhar sem internet: tudo fica no aparelho e é enviado quando o sinal volta.
  > O acesso é liberado pelo administrador da obra. Uso profissional.
- **Ícone**: `apps/mobile/loja/icone-play-512.png` · **Gráfico de recursos**: `apps/mobile/loja/grafico-recursos-1024x500.png`
- **Capturas de tela** (mínimo 2, celular): geradas com uma obra de demonstração **com nomes fictícios** — nunca com o
  efetivo real (peça e eu gero).
- **Categoria**: Produtividade (ou Empresa) · **E-mail de contato**: o da empresa · **Política**: link acima.

### Conteúdo do app (formulários)
| Formulário | Resposta |
|---|---|
| Acesso ao app | Precisa de login: criar uma conta de teste numa obra de demonstração e informar e-mail/senha. |
| Anúncios | Não contém anúncios. |
| Classificação de conteúdo | Utilitário/produtividade; sem violência, sexo, drogas, jogos de azar (classificação Livre). |
| Público-alvo | 18 anos ou mais; não é direcionado a crianças. |
| App de notícias / governo / financeiro / saúde | Não. |
| Exclusão de dados | Contas criadas pelo administrador da obra; pedido pelo link `https://malhet.com/pt-BR/privacidade#exclusao`. |

### Segurança dos dados (Data safety)
- Dados **criptografados em trânsito**: sim (HTTPS). Pedido de **exclusão**: sim (link acima).
- **Compartilhados com terceiros**: não (a empresa da obra é a controladora; não há venda nem anúncios).
- **Coletados** (todos para *Funcionalidade do app* e *Gerenciamento da conta*; nenhum para anúncios ou analytics):

| Tipo na Play | O que é no Malhet | Obrigatório? |
|---|---|---|
| Informações pessoais › Nome, E-mail | conta e efetivo da obra | sim |
| Informações pessoais › IDs de usuário | matrícula e crachá | sim |
| Fotos e vídeos › Fotos | fotos de campo; foto do rosto na assinatura | fotos de campo sim; rosto **opcional** (aceite LGPD) |
| Local › Local exato | coordenadas no momento da assinatura | **opcional** (aceite LGPD) |
| Saúde e condicionamento › Informações de saúde | resultado do ASO (apto/inapto) e do etilômetro | sim (obrigação legal de SST) |
| Informações pessoais › Outras (biométricas) | descritor facial (sem a foto) | **opcional** (consentimento) |
| Atividade no app › Interações | lançamentos, ocorrências, auditorias | sim |

> O Google Analytics do kit fica **desligado** (só liga com `NEXT_PUBLIC_GA_ENABLED=true`). Se um dia ligar, a Data
> safety e a política precisam declarar *Analytics*.

### Notas para a revisão
> App de uso profissional em canteiros de obra. Recursos nativos: leitura de crachá por NFC (plugin próprio), câmera
> para fotos e QR code, funcionamento offline. Use a conta de teste informada em "Acesso ao app" — abre a obra de
> demonstração. Reconhecimento facial e localização só são usados com o consentimento do trabalhador (LGPD).

## 4. Envio automático (depois do primeiro envio manual)
1. Google Cloud: criar uma **conta de serviço**, gerar a chave JSON.
2. Play Console › Usuários e permissões › convidar o e-mail da conta de serviço com permissão de **lançar versões**.
3. Secret `PLAY_SERVICE_ACCOUNT_JSON` = conteúdo do JSON.
4. Actions › **App nativo** › Run workflow › marcar **publicar** e escolher a faixa:
   `internal` (teste interno, até 100 pessoas por e-mail, liberado na hora) → `alpha` (teste fechado) → `production`.
   Fechado e produção entram como **rascunho** para você conferir e enviar na Console.

## Lembretes
- Mudanças nas telas chegam ao app **sem nova versão** (o app abre o Malhet publicado). Nova versão na loja só quando
  mudar algo em `apps/mobile` (plugin NFC, permissões, ícone).
- Nunca envie a chave `.jks` ou as senhas por chat/e-mail nem as coloque no git.
- iPhone: ver `docs/app-nativo.md` (conta Apple Developer, TestFlight).
