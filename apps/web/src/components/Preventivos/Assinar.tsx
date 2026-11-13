'use client';

import { Eraser, List, Nfc, PenLine, ScanFace, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { LeitorCodigo, LeitorFacial, LeitorNfc } from '@/components/Mobile/Leitores';
import { avisar, temNfc } from '@/lib/presenca/leitores';
import type { PessoaBase } from '@/lib/presenca/offline';
import type { Assinatura } from '@/lib/preventivos';

type ModoLeitura = 'nfc' | 'codigo' | 'rosto' | 'lista' | 'tela';
const ROTULO: Record<ModoLeitura, [string, typeof Nfc]> = { nfc: ['Crachá', Nfc], codigo: ['Código', ScanLine], rosto: ['Rosto', ScanFace], lista: ['Lista', List], tela: ['Na tela', PenLine] };

function Abas({ modos, modo, onTrocar }: { modos: ModoLeitura[]; modo: ModoLeitura; onTrocar: (m: ModoLeitura) => void }) {
  return (
    <div role="tablist" aria-label="Como identificar" className="grid gap-1.5 rounded-[16px] border border-m-stroke bg-m-surface-raised p-1" style={{ gridTemplateColumns: `repeat(${modos.length}, minmax(0,1fr))` }}>
      {modos.map((m) => {
        const [r, I] = ROTULO[m];
        return (
          <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => onTrocar(m)}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[12px] text-[12px] font-semibold ${modo === m ? 'bg-m-accent-strong text-m-on-accent' : 'text-m-text-secondary'}`}>
            <I size={19} aria-hidden="true" />{r}
          </button>
        );
      })}
    </div>
  );
}

interface Busca { porCodigo: (c: string) => PessoaBase | null; porNfc: (s: string | null, t: string[]) => PessoaBase | null }

/** Identificar quem vai fazer o teste: crachá (NFC/QR/código), rosto ou busca na lista. */
export function IdentificarPessoa({ pessoas, limite, busca, onPessoa, rosto = true }: {
  pessoas: PessoaBase[]; limite: number; busca: Busca; onPessoa: (p: PessoaBase, leitura: string) => void; rosto?: boolean;
}) {
  const [modo, setModo] = useState<ModoLeitura>(() => (temNfc() ? 'nfc' : 'codigo'));
  const [texto, setTexto] = useState('');
  const achou = (p: PessoaBase | null, leitura: string, bruto: string) => {
    if (!p) { avisar('erro'); toast.error(`Crachá ${bruto} não cadastrado. Cadastre em Presença ou busque pela lista.`); return; }
    avisar('ok'); onPessoa(p, leitura);
  };
  const t = texto.trim().toLowerCase();
  const lista = t.length < 2 ? [] : pessoas.filter((p) => p.nome.toLowerCase().includes(t) || (p.matricula ?? '').includes(t)).slice(0, 30);
  return (
    <div className="flex flex-col gap-2.5">
      <Abas modos={rosto ? ['nfc', 'codigo', 'rosto', 'lista'] : ['nfc', 'codigo', 'lista']} modo={modo} onTrocar={setModo} />
      {modo === 'nfc' && <LeitorNfc onLer={(s, tx) => achou(busca.porNfc(s, tx), 'nfc', s ?? tx[0] ?? '?')} />}
      {modo === 'codigo' && <LeitorCodigo onLer={(c, meio) => achou(busca.porCodigo(c), meio, c)} />}
      {modo === 'rosto' && <LeitorFacial pessoas={pessoas.filter((p) => p.lgpd?.biometria !== false)} limite={limite} onLer={(p) => achou(p, 'facial', p.nome)} />}
      {modo === 'lista' && (
        <div className="flex flex-col rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised p-3">
          <input autoFocus aria-label="Buscar colaborador" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome ou matrícula (2 letras ou mais)"
            className="h-12 rounded-[12px] border border-m-stroke bg-m-surface-field px-3 text-[15px]" />
          {lista.map((p) => (
            <button key={p.id} type="button" onClick={() => achou(p, 'manual', p.nome)} className="flex min-h-[52px] flex-col justify-center border-b border-m-stroke-subtle text-left last:border-0">
              <span className="text-[15px] font-medium">{p.nome}</span><span className="text-[12px] text-m-text-muted">{[p.matricula, p.funcao].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Assinatura de uma pessoa já identificada (spec 073): pelo rosto (comparado com o rosto cadastrado dela), pelo crachá
 * (tem de ser o crachá dela) ou desenhando na tela. `meios` limita as formas (o responsável assina só com o crachá).
 */
export function Assinar({ pessoa, limite, busca, meios = ['rosto', 'nfc', 'codigo', 'tela'], onAssinar }: {
  pessoa: PessoaBase; limite: number; busca: Busca; meios?: ModoLeitura[]; onAssinar: (a: Assinatura, foto?: Blob | null) => void;
}) {
  // rosto só com o rosto cadastrado e sem recusa/revogação no termo LGPD; a foto do momento só com o aceite dela (spec 074)
  const podeRosto = !!pessoa.face && !(pessoa.lgpd && ['recusado', 'revogado'].includes(pessoa.lgpd.situacao)) && pessoa.lgpd?.biometria !== false;
  const disponiveis = meios.filter((m) => m !== 'rosto' || podeRosto);
  const [modo, setModo] = useState<ModoLeitura>(() => disponiveis.find((m) => m === 'rosto') ?? (temNfc() && disponiveis.includes('nfc') ? 'nfc' : disponiveis.find((m) => m !== 'nfc') ?? disponiveis[0]));
  const agora = () => new Date().toISOString();
  const conferir = (p: PessoaBase | null, meio: 'nfc' | 'qr' | 'codigo', codigo: string) => {
    if (p?.id !== pessoa.id) { avisar('erro'); toast.error(p ? `Esse crachá é de ${p.nome}, não de ${pessoa.nome}` : 'Crachá não reconhecido'); return; }
    avisar('ok'); onAssinar({ meio, hora: agora(), codigo });
  };
  return (
    <div className="flex flex-col gap-2.5">
      {disponiveis.length > 1 && <Abas modos={disponiveis} modo={modo} onTrocar={setModo} />}
      {!podeRosto && meios.includes('rosto') && <span className="text-[12px] text-m-text-muted">{pessoa.nome.split(' ')[0]} {pessoa.face ? 'não autorizou o reconhecimento facial' : 'não tem rosto cadastrado'} — assine com o crachá ou na tela.</span>}
      {modo === 'rosto' && <LeitorFacial pessoas={[pessoa]} limite={limite} capturar={!!pessoa.lgpd?.foto_assinatura}
        onLer={(_, x) => { avisar('ok'); onAssinar({ meio: 'facial', hora: agora(), distancia: x.distancia }, x.foto); }} />}
      {modo === 'nfc' && <LeitorNfc onLer={(s, t) => conferir(busca.porNfc(s, t), 'nfc', s ?? t[0] ?? '')} />}
      {modo === 'codigo' && <LeitorCodigo onLer={(c, meio) => conferir(busca.porCodigo(c), meio, c)} />}
      {modo === 'tela' && <AssinaturaTela onPronto={(d) => onAssinar({ meio: 'desenho', hora: agora(), desenho: d })} />}
    </div>
  );
}

/** Assinatura desenhada com o dedo: vira uma imagem pequena (PNG ~ 360×140) guardada com o teste. */
function AssinaturaTela({ onPronto }: { onPronto: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tracos, setTracos] = useState(0);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    const ajustar = () => { const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; ctx.scale(2, 2); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; };
    ajustar();
    let desenhando = false;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const down = (e: PointerEvent) => { desenhando = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: PointerEvent) => { if (!desenhando) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const up = () => { if (desenhando) setTracos((n) => n + 1); desenhando = false; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); };
  }, []);
  const limpar = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setTracos(0); };
  const pronto = () => {
    const c = ref.current!; const out = document.createElement('canvas'); out.width = 360; out.height = 140;
    const o = out.getContext('2d')!; o.fillStyle = '#fff'; o.fillRect(0, 0, 360, 140); o.drawImage(c, 0, 0, 360, 140);
    onPronto(out.toDataURL('image/png'));
  };
  return (
    <div className="flex flex-col gap-2">
      <canvas ref={ref} aria-label="Área para assinar com o dedo" className="h-[160px] w-full touch-none rounded-[14px] border-2 border-dashed border-m-stroke-strong bg-white" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={limpar} className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-m-stroke text-[14px] font-semibold"><Eraser size={16} /> Limpar</button>
        <button type="button" disabled={!tracos} onClick={pronto} className="h-12 rounded-full bg-m-accent-strong text-[14px] font-semibold text-m-on-accent disabled:opacity-40">Confirmar assinatura</button>
      </div>
    </div>
  );
}
