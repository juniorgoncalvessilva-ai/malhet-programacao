# 036 — Interface pelo tipo de aparelho (celular × computador)

- `src/lib/dispositivo/interface.tsx`: **celular** = navegador móvel (iPhone, iPod, Android "Mobile"…) ou tela com toque
  e menos de 768 px; tablet e computador ficam no **completo**.
- `AdequarInterface` nos layouts de `/app` (completo) e `/m` (campo): se o aparelho pede a outra interface, redireciona
  para a tela equivalente (`rotaDoCampo` / `rotaDoCompleto`: programações/vigente ↔ lançar, restrições ↔ restrições,
  desvios ↔ ocorrências; o resto vai para o início de cada uma) antes de desenhar.
- A escolha manual vale e fica guardada no navegador (`malhet.interface`): "Completo" na barra do celular grava
  "completo"; "App de campo (celular)" no menu grava "campo". No celular, o app completo mostra a faixa "Abrir o app de
  campo".
