// Spec 122: fontes do Excalidraw (marcação sobre a foto) servidas pelo próprio Malhet em public/excalidraw/fonts — sem
// depender de CDN e guardadas pelo service worker para marcar a foto sem internet. Não vão para o git (vêm do npm).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const origem = join('node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod', 'fonts');
const destino = join('public', 'excalidraw', 'fonts');
const familias = ['Excalifont', 'Virgil', 'Nunito', 'Liberation', 'Cascadia', 'Assistant'];
if (!existsSync(origem)) {
  console.warn('[excalidraw] pacote não encontrado: a marcação sobre a foto usa as fontes do sistema');
  process.exit(0);
}
mkdirSync(destino, { recursive: true });
for (const f of familias) if (existsSync(join(origem, f))) cpSync(join(origem, f), join(destino, f), { recursive: true });
console.log(`[excalidraw] fontes em ${destino}`);
