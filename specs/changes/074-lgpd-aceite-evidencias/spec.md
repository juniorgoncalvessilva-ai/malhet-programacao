# 074 — LGPD: aceite do colaborador e relatório de assinaturas (foto facial, data/hora, logos, coordenadas)

## Pedido
Coletar o aceite de LGPD do colaborador e gerar o relatório de assinaturas com as fotos do reconhecimento facial, data e
hora, logo da empresa e coordenadas de localização, para auditoria.

## Pesquisa (base do desenho)
- Biometria é dado pessoal sensível (LGPD art. 5º II); consentimento para dado sensível é **específico e destacado, por
  finalidade** (art. 11 I). No emprego o consentimento precisa ser **livre** (desequilíbrio empregado × empregador) →
  quem não aceita usa crachá ou assina na tela, **sem prejuízo**.
- Revogação a qualquer momento (art. 8º §5º); direitos do titular (art. 18); registro das operações e segurança (arts. 37 e 46).
- ANPD: regulamentação de biometria em andamento (tomada de subsídios 2025); para biometria em monitoramento recomenda-se
  manter RIPD — **recomendação para a empresa**, fora do sistema.
- Assinatura eletrônica (Lei 14.063/2020): a avançada se liga ao signatário de forma unívoca e permite detectar alteração
  posterior → evidência com **hash SHA-256**, data/hora do aparelho e da chegada, meio (rosto/crachá/tela), dispositivo e
  coordenadas.

## O que muda
- **Termo versionado por obra** (`lgpd_termo`): texto padrão em linguagem simples (controlador = contratada da Marca da obra,
  finalidades, quem acessa, prazo, direitos, contato), 3 finalidades separadas: reconhecimento facial, foto no momento
  da assinatura (depende do facial) e localização. Nova versão = "termo novo a apresentar" para quem aceitou a anterior.
- **Aceite/recusa** (`lgpd_aceite`): colhido no celular (`/m/lgpd` ou na hora do etilômetro), SIM/NÃO por finalidade, nada
  pré-marcado, assinado por crachá ou na tela (também a recusa), versão + hash do texto aceito, coordenadas só se autorizou
  localização. Idempotente (`id_local`), vale na hora no aparelho (base do celular traz `lgpd` por pessoa e o termo).
  Recusa do facial apaga o rosto cadastrado; cadastro de rosto de quem recusou/revogou é bloqueado.
- **Revogação** (web): vale dali para frente, apaga o rosto; o já registrado continua como prova.
- **Evidência de cada assinatura** (`assinatura_evidencia`): etilômetro (colaborador, início e fim do responsável) e termo.
  Foto do rosto (recorte, até 360 px) **só com aceite de foto**; coordenadas **só com aceite de localização** — sem aceite o
  servidor descarta e anota. Hash SHA-256 de metadados + foto, conferido a cada consulta ("íntegra"/"alterada").
- **Relatório de assinaturas** (`/app/lgpd`): filtros, meio, distância facial, dispositivo, coordenadas com link do mapa e
  precisão, foto sob demanda ou todas, assinatura desenhada, integridade; impressão/PDF com as logos da obra, período,
  quem gerou e quando.
- **Registro de acessos** (`assinatura_acesso`): cada foto aberta e cada impressão do relatório.
- Acesso: colher = segurança ou encarregado+; ver relatório/fotos/revogar = segurança, planejamento, admin; publicar termo = admin.

## Testes
`tests/test_lgpd.py`. e2e: celular sem internet colhe aceite (com GPS) e recusa (assinada na tela) → sobe → relatório web
com coordenadas só de quem autorizou e as duas íntegras.
