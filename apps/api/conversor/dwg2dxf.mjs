// Spec 123 — DWG → DXF no servidor do Malhet. Programa separado (GPL-3.0-or-later, como o LibreDWG que ele usa):
// a API em Python chama `node dwg2dxf.mjs entrada.dwg saida.dxf` e lê o DXF. Nada disto vai ao navegador.
// Saída: 0 = convertido; 2 = não é DWG que o LibreDWG leia; 3 = leu, mas não gerou DXF.
import { readFileSync, writeFileSync } from 'node:fs';
import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';

const [, , entrada, saida] = process.argv;
if (!entrada || !saida) { console.error('uso: node dwg2dxf.mjs entrada.dwg saida.dxf'); process.exit(64); }
const buf = readFileSync(entrada);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const lib = await LibreDwg.create();
const data = lib.dwg_read_data(ab, Dwg_File_Type.DWG);
if (!data) { console.error('DWG ilegível'); process.exit(2); }
const versao = lib.dwg_get_version_type(data);
lib.dwg_free(data);
const dxf = lib.dwg_write_dxf(ab);
if (!dxf || !dxf.length) { console.error('sem DXF'); process.exit(3); }
writeFileSync(saida, dxf);
console.log(JSON.stringify({ versao: versao?.description ?? null, bytes: dxf.length }));
