import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Política de privacidade pública do Malhet e do app Malhet Campo (spec 091) — link exigido pela Google Play e pela
 * App Store. Descreve o que o sistema realmente guarda (CLAUDE.md: efetivo sem dados sensíveis; exceções com aceite LGPD
 * por finalidade). O contato de privacidade vem de NEXT_PUBLIC_CONTATO_PRIVACIDADE (definido no deploy).
 */
export const metadata: Metadata = {
  title: 'Política de privacidade | Malhet',
  description: 'Como o Malhet e o app Malhet Campo tratam dados pessoais (LGPD).',
};

const ATUALIZADA = '15/11/2026';
const CONTATO = process.env.NEXT_PUBLIC_CONTATO_PRIVACIDADE;

function Secao({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-2 scroll-mt-6">
      <h2 className="text-[18px] font-semibold text-m-text-primary">{titulo}</h2>
      <div className="flex flex-col gap-2 text-[14.5px] leading-6 text-m-text-secondary">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  const contato = CONTATO
    ? <a className="font-semibold text-m-accent underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>
    : <>o canal de privacidade indicado no termo LGPD da obra</>;
  return (
    <main className="min-h-screen bg-m-surface-base px-4 py-10">
      <article className="mx-auto flex max-w-[820px] flex-col gap-7 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-6 sm:p-10">
        <header className="flex flex-col gap-3">
          <img src="/brand/malhet.svg" alt="Malhet" className="h-6 w-auto self-start dark:hidden" />
          <img src="/brand/malhet-escuro.svg" alt="Malhet" className="hidden h-6 w-auto self-start dark:block" />
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.2px] text-m-text-primary">Política de privacidade</h1>
          <p className="text-[13px] text-m-text-muted">Malhet (web) e app Malhet Campo (Android e iPhone) · atualizada em {ATUALIZADA}</p>
        </header>

        <Secao titulo="1. Quem somos e para que serve">
          <p>O Malhet é um sistema de gestão de obras usado por empresas de construção para programar o trabalho das equipes,
            registrar a execução no campo, controlar presença, segurança do trabalho e mobilização de mão de obra. O app
            Malhet Campo é a versão para celular usada no canteiro.</p>
          <p>A empresa responsável pela obra (a contratada que usa o sistema) é a <b>controladora</b> dos dados das pessoas
            da obra. O Malhet trata esses dados em nome dela, como <b>operador</b>, seguindo a Lei Geral de Proteção de Dados
            (Lei 13.709/2018 — LGPD).</p>
          <p>O app é de uso profissional, para maiores de 18 anos. O acesso a cada obra é liberado pelo administrador da obra;
            o app Malhet Campo não tem cadastro aberto ao público.</p>
        </Secao>

        <Secao titulo="2. Que dados tratamos">
          <ul className="list-disc pl-5">
            <li><b>Conta de acesso</b>: e-mail, nome de exibição, foto de perfil e telefone (opcionais) e o papel na obra.</li>
            <li><b>Efetivo da obra</b>: nome, matrícula, número do crachá, função, empresa, situação de mobilização, datas de
              admissão/demissão e dados de jornada e contrato (turno, horas, alojamento). <b>Não guardamos</b> CPF, RG, PIS,
              endereço, telefone pessoal, data de nascimento, filiação, raça/cor ou tipo sanguíneo dos trabalhadores.</li>
            <li><b>Presença</b>: leitura do crachá (código, QR code ou NFC), data, hora e o aparelho que registrou.</li>
            <li><b>Reconhecimento facial</b> (só com consentimento): guardamos apenas o <i>descritor facial</i> — um conjunto
              de números calculado a partir do rosto —, nunca a foto usada para gerá-lo.</li>
            <li><b>Assinaturas</b> (testes de etilômetro, termos): a foto do rosto no momento da assinatura e as coordenadas
              de localização só são guardadas com o aceite da pessoa para cada finalidade; cada evidência tem um código de
              integridade (hash).</li>
            <li><b>Saúde e segurança do trabalho</b>: do ASO guardamos só o tipo, as datas e o resultado (apto/inapto) — nunca
              diagnóstico ou CID —, os treinamentos realizados e os resultados de testes de etilômetro.</li>
            <li><b>Registros de campo</b>: fotos e textos de atividades, ocorrências, restrições, auditorias e planos de ação,
              com data, hora e frente de serviço.</li>
            <li><b>Diagnóstico de erros</b>: quando algo falha no app, ele envia à equipe Malhet a tela e a ação em que
              falhou, a mensagem técnica, a versão, o tipo de aparelho e navegador, a obra e a conta de quem estava usando
              (para podermos responder). Antes de guardar, e-mails, documentos, telefones e números longos (matrícula,
              crachá) são mascarados; o que você digita nos formulários não é enviado. Se você escrever o que estava
              fazendo, o texto vai junto.</li>
          </ul>
        </Secao>

        <Secao titulo="3. Permissões do celular">
          <ul className="list-disc pl-5">
            <li><b>NFC</b>: ler o crachá para registrar presença e assinaturas.</li>
            <li><b>Câmera</b>: fotos de campo, leitura de QR code e, com consentimento, reconhecimento facial.</li>
            <li><b>Localização</b>: só no momento de uma assinatura e só com aceite. O app não acompanha a localização em
              segundo plano.</li>
          </ul>
        </Secao>

        <Secao titulo="4. Para que usamos e com qual base legal">
          <ul className="list-disc pl-5">
            <li>Executar o contrato da obra (programação, apropriação de horas, equipes, mobilização) — art. 7º, V.</li>
            <li>Diagnóstico de erros: corrigir falhas e manter o app funcionando — legítimo interesse, art. 7º, IX.</li>
            <li>Cumprir obrigações legais de saúde e segurança do trabalho (NR-7, NR-1 e normas de treinamento) — art. 7º, II
              e art. 11, II, “a”.</li>
            <li>Descritor facial, foto na assinatura e localização: <b>consentimento</b> específico por finalidade, que pode
              ser recusado ou revogado a qualquer momento sem impedir o trabalho (há outros meios: crachá ou código) — art.
              11, I. Ao revogar, o descritor facial é apagado.</li>
          </ul>
          <p>Não vendemos dados, não usamos para publicidade e não há rastreadores de anúncios no app.</p>
        </Secao>

        <Secao titulo="5. Com quem compartilhamos">
          <ul className="list-disc pl-5">
            <li>Com a empresa responsável pela obra e, quando ela autoriza, com a fiscalização do cliente da obra
              (relatórios de programação, segurança e indicadores).</li>
            <li>Com o sistema de apontamento da obra (Simova), quando integrado: programação, equipes, nomes e crachás.</li>
            <li>Com o serviço de armazenamento em nuvem escolhido pela obra (Google Drive, OneDrive ou Dropbox) apenas para
              documentos e fotos de campo. <b>Dados sensíveis</b> (descritor facial, fotos de assinatura e coordenadas)
              <b> não vão para a nuvem de terceiros</b>.</li>
            <li>Com autoridades, quando exigido por lei.</li>
          </ul>
        </Secao>

        <Secao titulo="6. Segurança e guarda">
          <p>Os dados trafegam sempre por conexão segura (HTTPS), ficam separados por obra e o acesso é limitado pelo papel de
            cada usuário. Acessos a fotos e relatórios de assinatura ficam registrados. O app não faz cópia de segurança dos
            dados do aparelho na nuvem.</p>
          <p>Os dados são mantidos enquanto durar o contrato da obra e pelos prazos exigidos pela legislação trabalhista e de
            segurança do trabalho; depois são excluídos ou anonimizados.</p>
        </Secao>

        <Secao id="exclusao" titulo="7. Seus direitos e como pedir a exclusão">
          <p>Você pode pedir confirmação, acesso, correção, anonimização, portabilidade ou exclusão dos seus dados, e revogar
            consentimentos (art. 18 da LGPD). A revogação do reconhecimento facial e da foto/localização na assinatura também
            pode ser feita no próprio app, com o responsável pela obra.</p>
          <p>Para pedir a exclusão da sua conta ou dos seus dados, fale com o administrador da obra ou escreva para {contato}.
            Registros que a lei obriga a guardar (por exemplo, de segurança do trabalho) são mantidos pelo prazo legal e
            depois excluídos.</p>
        </Secao>

        <Secao titulo="8. Contato e mudanças">
          <p>Dúvidas sobre privacidade: {contato}. Se esta política mudar, a data acima é atualizada e as mudanças importantes
            são avisadas no próprio sistema.</p>
        </Secao>
      </article>
    </main>
  );
}
