/** Nome padrão da equipe (spec 107) — a mesma conta de `equipes/domain/alocacao.py::nome_padrao`, para a prévia. */
export interface ConfigNomeEquipe {
  modelo_nome: string; digitos: number; proximo_numero: number; exemplo: string; disciplinas: string[]; fora_do_padrao: string[];
}

export const limparDisciplina = (t: string) => t.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, 60);

export function nomeEquipe(modelo: string, numero: number, disciplina: string, digitos = 1): string {
  return modelo.replace('{n}', String(numero).padStart(Math.max(1, Math.min(digitos, 4)), '0'))
    .replace('{disciplina}', limparDisciplina(disciplina)).slice(0, 120);
}

/** O mesmo que o servidor recusa (`validar_modelo`), para avisar antes de salvar. */
export function problemaDoModelo(modelo: string): string | null {
  const m = modelo.trim();
  if (m.split('{n}').length !== 2) return 'O padrão precisa ter {n} (o número automático) uma vez.';
  if (m.split('{disciplina}').length > 2) return '{disciplina} só pode aparecer uma vez.';
  if (m.length > 60) return 'Padrão longo demais (até 60 caracteres).';
  if (/\{(?!n\}|disciplina\})/.test(m)) return 'Use só {n} e {disciplina} entre chaves.';
  return null;
}
