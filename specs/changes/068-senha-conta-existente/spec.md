# 068 — Usuário criado no acesso não conseguia entrar (conta que já existia)

## Problema
Liberar o acesso de um e-mail que **já tinha conta** (cadastro feito pela própria pessoa, tentativa anterior, outra obra)
ignorava a "senha inicial" digitada: o acesso era criado, mas a senha não mudava — o login respondia 401 (e-mail ou
senha inválidos). Conta criada pelo "Cadastrar" que nunca confirmou o e-mail (sem servidor de e-mail) ficava travada (403).
"Alterar" o papel também apagava as páginas liberadas.

## Solução
- Conta que já existe + senha preenchida → a senha passa a valer (`ContasAuthKit.redefinir_senha`: mesma regra de força
  do auth-kit, hash do kit, confirma o e-mail se faltava e encerra as sessões abertas). Resposta traz `senha_redefinida`.
- Quem pode redefinir: o super admin sempre; o admin da obra só a de quem não é super admin e só tem acesso a obras que
  ele também administra (não toma a conta de quem está em outra obra). Fora disso: erro explicando.
- Conta existente sem e-mail confirmado e sem senha preenchida → erro pedindo a senha (antes ficava travada sem aviso).
- "Alterar" sem mandar páginas mantém as páginas liberadas.
- Tela de Acessos: campo "Senha (conta nova ou redefinir)" e aviso do que aconteceu (criada, redefinida ou conta antiga).
- Teste: `tests/test_auth.py::test_conta_que_ja_existia_entra_com_a_senha_do_admin`.
