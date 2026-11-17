/** Envio do resumo do dia (spec 101): copiar, WhatsApp por link e compartilhar texto + fotos pelo celular. */

/** Link do WhatsApp com o texto pronto (abre o app no celular ou o WhatsApp Web no computador). */
export const linkWhatsapp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** Acima disso o WhatsApp pode cortar o texto do link: melhor copiar e colar. */
export const LIMITE_LINK = 6000;
export const longoParaLink = (texto: string) => encodeURIComponent(texto).length > LIMITE_LINK;

export async function copiarTexto(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
  } catch { // navegador sem permissão de área de transferência (http, iframe): seleção antiga
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
}

/** O aparelho compartilha arquivos (Android/iPhone)? Aí o texto e as fotos vão juntos para o WhatsApp. */
export function podeCompartilharFotos(): boolean {
  try {
    const f = new File([new Uint8Array([0xff, 0xd8])], 'x.jpg', { type: 'image/jpeg' });
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [f] });
  } catch { return false; }
}

export async function compartilhar(texto: string, fotos: File[]): Promise<'ok' | 'cancelado'> {
  try {
    await navigator.share(fotos.length ? { text: texto, files: fotos } : { text: texto });
    return 'ok';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelado';
    throw e;
  }
}
