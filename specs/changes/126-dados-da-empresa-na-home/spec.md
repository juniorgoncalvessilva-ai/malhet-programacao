# 126 — "O que é da obra fica com a obra": a guarda dos dados na home

## Por quê
Decisão do usuário: o Malhet não pode vazar dados nem arquivos da empresa — **nenhuma IA externa (nem Claude, nem outra API de
terceiros)**; quando houver assistente, ele roda em servidor do Malhet ou da empresa. Isso precisa estar dito na home, com a voz da
marca, e na política de privacidade.

## Copy (ato 6 de 7, "A guarda", `#guarda`, menu "Seus dados")
Manchete (acende): "Projeto, contrato e a foto do canteiro são patrimônio da empresa. **O que é da obra fica com a obra.**" — eco
da assinatura "O que foi decidido, fica." Apoio: "Registro só tem valor se for seu."
Seis compromissos, **só o que o sistema já faz** (cada um com lastro):

| Frase | Lastro |
|---|---|
| Seus arquivos, no seu lugar. | módulo `arquivos/` — acervo por obra, disco do Malhet ou Drive/OneDrive/Dropbox da empresa |
| O projeto é lido aqui dentro. | DWG → DXF no conversor do próprio servidor (spec 123), quantidades com ezdxf (spec 124) |
| Nada vira matéria-prima de ninguém. | não há chamada a serviço de IA externo; política atualizada |
| Rosto não vira foto guardada. | só o descritor com aceite (spec 063); sensível não vai à nuvem (spec 082/074) |
| Cada acesso deixa rastro. | `documento_leitura`, `exclusao_registro`, `assinatura_acesso` |
| Cada obra é uma obra. | `obra_id` em toda tabela, papel por obra |

Regras de marca mantidas: voz direta, sem número não confirmado, IA nunca na manchete (aparece só como compromisso, no 3º cartão).
Ícones lucide 1.75, verde da marca, cartões em grade 3×2 (empilham no celular, sem rolagem lateral). Link para a política.

## Política de privacidade (`/privacidade`, atualizada 22/11/2026)
Seção 5 ganha: não enviamos projetos, contratos, documentos, fotos nem dados de pessoas a serviços externos de IA (nem para
responder, nem para treinar); DWG/DXF lidos no próprio servidor; um assistente, se houver, roda em servidor do Malhet ou da
empresa, e a política muda antes.

## Fica registrado (para a spec do assistente)
Modelo local (Ollama/llama.cpp) pede servidor com GPU ou bastante memória — a KVM1 não roda. Decidir a infraestrutura antes.
