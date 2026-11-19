# 111 — Link dos líderes: o encarregado confere e corrige a própria equipe

## Por quê
As equipes do Malhet ficam desatualizadas: gente que foi para outro encarregado continua na equipe antiga e quem chegou
não aparece. Quem sabe disso é o encarregado no campo — sem conta do Malhet.

## O que muda
### Link da obra (`lideres/`, `/equipe/<codigo>`)
- Um link por obra (`lider_portal.codigo`, 12 caracteres aleatórios) para o grupo do WhatsApp; "Link novo" invalida o
  anterior; dá para desligar.
- Entra com a **matrícula** e a senha. A primeira é **123456** e, no primeiro acesso, ele cria a dele (6–20 caracteres,
  diferente de 123456; `validar_nova_senha`). Senha guardada com Argon2; sessão JWT de 12 h com chave própria e a
  `versao` do acesso (redefinir/trocar/bloquear derruba a sessão). 5 senhas erradas = espera de 15 min (`Tentativas`).
- Quem entra: encarregado de equipe ativa (pelo crachá/matrícula), responsável e supervisor das equipes, e os líderes
  cadastrados. Cada um vê as equipes que lidera (`equipes_do_lider`).
- Na equipe: "Não está comigo" → escolhe o encarregado (equipe) para onde foi, ou "não sei / saiu da obra";
  "Trazer alguém" → busca por matrícula ou nome no efetivo (mostra a equipe atual) e traz. Tudo pelo `Alocador`
  (spec 107): sai da outra equipe, movimento no histórico ("líder 115184") e aviso no sino do Planejamento.
- Rotas públicas `/portal/{codigo}` (cabeçalho `X-Portal-Token`), fora do contador global de mudanças: a rota marca a obra.

### Acesso dos líderes (`/app/lideres`, Planejamento)
- Link com "Copiar mensagem" e "Enviar no WhatsApp", link novo, ligar/desligar.
- "Quem mais lidera equipe?": inclui líder **sem a função de encarregado** (pessoa do efetivo) e escolhe as equipes que
  ele controla (`lider_acesso.equipes`).
- Lista de quem pode entrar (encarregado/responsável/supervisor/cadastrado), equipes, situação da senha (nunca entrou,
  senha inicial, senha própria, bloqueado) e último acesso; redefinir para 123456, bloquear/liberar, tirar cadastrado.
  Encarregados com matrícula fora do efetivo aparecem num aviso (não conseguem entrar).

## Aceite
- `tests/test_portal_lider.py`: regras; fluxo completo (entrar, criar senha, ver equipe, trazer, transferir para outro
  encarregado e "não sei", histórico, líder cadastrado, bloqueio, redefinir, link novo); bloqueio por tentativas.
- e2e: Planejamento abre a tela (23 líderes); no celular o encarregado 115184 entra com 123456, cria a senha, informa a
  transferência de um funcionário e o traz de volta pela busca; a tela mostra "Com senha própria" e o último acesso.
