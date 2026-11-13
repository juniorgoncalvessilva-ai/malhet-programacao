// Copia só os 3 modelos do reconhecimento facial usados na presença (detector leve, pontos do rosto leve e o
// descritor) do pacote @vladmandic/face-api para public/models/face — servidos e guardados pelo service worker para
// funcionar sem internet. Não vão para o git (vêm do npm em cada build).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const origem = join('node_modules', '@vladmandic', 'face-api', 'model');
const destino = join('public', 'models', 'face');
const arquivos = ['tiny_face_detector_model', 'face_landmark_68_tiny_model', 'face_recognition_model'];
if (!existsSync(origem)) {
  console.warn('[modelos-face] pacote @vladmandic/face-api não encontrado: a leitura facial fica indisponível');
  process.exit(0);
}
mkdirSync(destino, { recursive: true });
for (const a of arquivos) {
  cpSync(join(origem, `${a}-weights_manifest.json`), join(destino, `${a}-weights_manifest.json`));
  cpSync(join(origem, `${a}.bin`), join(destino, `${a}.bin`));
}
console.log(`[modelos-face] ${arquivos.length} modelos em ${destino}`);
