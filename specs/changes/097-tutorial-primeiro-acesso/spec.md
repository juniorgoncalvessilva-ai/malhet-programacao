# 097 — Tutorial do primeiro acesso

## Pedido
"Precisamos criar um tutorial da plataforma para quem acessar a primeira vez."

## Como funciona
- Passeio guiado (`components/Tutorial/Tour.tsx`): escurece a tela, recorta o elemento marcado com `data-tour` e mostra
  um cartão ao lado. Passo sem alvo visível = cartão no centro. Teclado: → avança, ← volta, Esc pula. Sem biblioteca.
- Dois tutoriais (`components/Tutorial/Tutoriais.tsx`), cada um abre sozinho uma vez por conta:
  - **computador** (`Shell`): boas-vindas com o nome da contratada → obra → menu do perfil → Programação vigente → o
    caminho do papel (planejador/admin: Importações → Frentes → Catálogo → Programações; encarregado: usar o celular;
    segurança: grupo SSMA; leitor: indicadores) → memória de cálculo → sino → conta (rever + relatar problema) → fim.
  - **celular** (`MobileShell`): boas-vindas → barra de atalhos → botão do meio (se houver) → offline → Mais → fim.
- Visto (concluído ou pulado) = `PUT /perfil/tutoriais/{chave}`; `GET /perfil` devolve `tutoriais_pendentes`.
  `perfil_usuario.tutoriais` (JSONB, da conta) guarda `{versao, concluido, em}`; `perfil/domain/tutorial.py::TUTORIAIS`
  tem a versão de cada um — subir a versão faz todos verem o novo uma vez.
- Rever: menu da conta (computador) e Mais (celular) › **Ver o tutorial** (`abrirTutorial()`).
- Não abre sozinho testando como outro perfil nem nas telas de super admin.
- Migração 0050 marca o tutorial como visto para as contas que já usavam o sistema (não são "primeiro acesso").

## Aceite
- Conta nova: o passeio abre na vigente, segue o perfil, e não volta depois de pulado/concluído (e2e).
- Celular (iPhone 14): passeio na barra, sem rolagem horizontal.
