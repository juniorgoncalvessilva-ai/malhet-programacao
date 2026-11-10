import { MessageOutlineIcon } from "@/assets/icons";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ShowcaseSection } from "@/components/Layouts/ShowcaseSection";
import { Button } from "@/components/ui/Button";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buttons",
};

export default async function Page() {
  const t = await getTranslations('UIElements');

  return (
    <>
      <Breadcrumb pageName={t('buttons')} />

      <div className="space-y-10">
        <ShowcaseSection title={t('normalButton')}>
          <div className="mb-7.5 flex flex-wrap gap-5 xl:gap-20">
            <Button label={t('button')} variant="primary" />
            <Button label="Button" variant="primary" shape="rounded" />
            <Button label="Button" variant="primary" shape="full" />
            <Button label="Button" variant="outlinePrimary" shape="rounded" />
          </div>

          <div className="mb-7.5 flex flex-wrap gap-5 xl:gap-20">
            <Button label="Button" variant="green" />
            <Button label="Button" variant="green" shape="rounded" />
            <Button label="Button" variant="green" shape="full" />
            <Button label="Button" variant="outlineGreen" shape="rounded" />
          </div>

          <div className="flex flex-wrap gap-5 xl:gap-20">
            <Button label="Button" variant="dark" />
            <Button label="Button" variant="dark" shape="rounded" />
            <Button label="Button" variant="dark" shape="full" />
            <Button label="Button" variant="outlineDark" shape="rounded" />
          </div>
        </ShowcaseSection>

        <ShowcaseSection title={t('buttonWithIcon')}>
          <div className="mb-7.5 flex flex-wrap gap-5 xl:gap-7.5">
            <Button
              label={t('buttonWithIcon')}
              variant="primary"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="green"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="dark"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="outlinePrimary"
              size="small"
              icon={<MessageOutlineIcon />}
            />
          </div>

          <div className="mb-7.5 flex flex-wrap gap-5 xl:gap-7.5">
            <Button
              label={t('buttonWithIcon')}
              variant="primary"
              shape="rounded"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="green"
              shape="rounded"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="dark"
              shape="rounded"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="outlinePrimary"
              shape="rounded"
              size="small"
              icon={<MessageOutlineIcon />}
            />
          </div>

          <div className="flex flex-wrap gap-5 xl:gap-7.5">
            <Button
              label={t('buttonWithIcon')}
              variant="primary"
              shape="full"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="green"
              shape="full"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="dark"
              shape="full"
              size="small"
              icon={<MessageOutlineIcon />}
            />
            <Button
              label={t('buttonWithIcon')}
              variant="outlinePrimary"
              shape="full"
              size="small"
              icon={<MessageOutlineIcon />}
            />
          </div>
        </ShowcaseSection>

        <ShowcaseSection title="WhatsApp Button">
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Botão WhatsApp com Chat Interativo
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Botão que abre um chat simulado do WhatsApp para coleta de dados com validação brasileira.
              </p>
              <div className="flex flex-wrap gap-4">
                <WhatsAppButton 
                  variant="inline" 
                  businessName="Nossa Empresa"
                  welcomeMessage="Olá! Como podemos ajudar você hoje?"
                />
                <WhatsAppButton 
                  variant="inline" 
                  businessName="Suporte Técnico"
                  welcomeMessage="Bem-vindo ao nosso suporte!"
                  showModal={false}
                />
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Funcionalidades
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li>• <strong>Validação de telefone brasileiro:</strong> Aceita celular e fixo com/sem código do país</li>
                <li>• <strong>Interface similar ao WhatsApp:</strong> Design familiar para melhor conversão</li>
                <li>• <strong>Fluxo conversacional:</strong> Coleta nome e telefone de forma natural</li>
                <li>• <strong>Mensagens de erro contextuais:</strong> Feedback claro para correção de dados</li>
                <li>• <strong>Formatação automática:</strong> Telefones são formatados automaticamente</li>
                <li>• <strong>Responsivo:</strong> Funciona perfeitamente em mobile e desktop</li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Exemplos de Telefones Válidos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <strong>Celular:</strong>
                  <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                    <li>(11) 99999-9999</li>
                    <li>11999999999</li>
                    <li>+55 11 99999-9999</li>
                  </ul>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <strong>Fixo:</strong>
                  <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                    <li>(11) 3333-4444</li>
                    <li>1133334444</li>
                    <li>+55 11 3333-4444</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ShowcaseSection>
      </div>
    </>
  );
}
