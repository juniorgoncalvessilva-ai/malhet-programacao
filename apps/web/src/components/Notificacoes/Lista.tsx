'use client';

import { AlertTriangle, Bell, BellRing, CheckCheck, Info, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { type Notificacao, pedirPermissaoAviso, permissaoAviso, quandoFoi, useMarcarLidas, useNotificacoes } from '@/lib/notificacoes';

const ICONE = { info: Info, atencao: AlertTriangle, critico: ShieldAlert } as const;
const COR = { info: 'text-m-accent', atencao: 'text-m-warning', critico: 'text-m-danger' } as const;

/** Lista de notificações (web e celular, spec 076): toque abre a tela do assunto e marca como lida. */
export function ListaNotificacoes({ mobile = false, limite, onAbrir }: { mobile?: boolean; limite?: number; onAbrir?: () => void }) {
  const q = useNotificacoes();
  const marcar = useMarcarLidas();
  const router = useRouter();
  const [perm, setPerm] = useState(permissaoAviso());
  const lista = (q.data ?? []).slice(0, limite ?? 200);
  const naoLidas = (q.data ?? []).filter((n) => !n.lida_em).length;
  const abrir = async (n: Notificacao) => {
    if (!n.lida_em) marcar(n.id).catch(() => undefined);
    const destino = mobile ? n.url_mobile ?? n.url : n.url ?? n.url_mobile;
    onAbrir?.();
    if (destino) router.push(destino);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-m-text-muted">{naoLidas ? `${naoLidas} não lida(s)` : 'Tudo lido'}</span>
        <div className="flex items-center gap-3">
          {perm === 'default' && !limite && (
            <button type="button" onClick={async () => { const r = await pedirPermissaoAviso(); setPerm(r); if (r === 'granted') toast.success('Avisos ligados neste aparelho (com o app aberto)'); }}
              className="flex items-center gap-1 text-[13px] font-semibold text-m-accent"><BellRing size={15} /> Avisar neste aparelho</button>
          )}
          {naoLidas > 0 && <button type="button" onClick={() => marcar()} className="flex items-center gap-1 text-[13px] font-semibold text-m-accent"><CheckCheck size={15} /> Marcar todas como lidas</button>}
        </div>
      </div>
      {q.isLoading && <p className="text-[13px] text-m-text-muted">Carregando…</p>}
      {!q.isLoading && !lista.length && <p className="flex items-center gap-2 py-6 text-[14px] text-m-text-muted"><Bell size={18} /> Nenhuma notificação nos últimos 45 dias.</p>}
      <ul className="flex flex-col">
        {lista.map((n) => {
          const I = ICONE[n.gravidade] ?? Info;
          return (
            <li key={n.id}>
              <button type="button" onClick={() => abrir(n)} className={`flex w-full items-start gap-3 border-b border-m-stroke-subtle px-1 text-left ${mobile ? 'min-h-[64px] py-3' : 'py-2.5'} ${n.lida_em ? 'opacity-70' : ''}`}>
                <I size={19} className={`mt-0.5 shrink-0 ${COR[n.gravidade] ?? ''}`} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`text-[14px] leading-5 ${n.lida_em ? '' : 'font-semibold'}`}>{n.titulo}</span>
                  {n.texto && <span className="line-clamp-2 text-[12.5px] leading-[18px] text-m-text-secondary">{n.texto}</span>}
                  <span className="text-[11.5px] text-m-text-muted">{quandoFoi(n.criada_em)}</span>
                </span>
                {!n.lida_em && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-m-accent" aria-label="não lida" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
