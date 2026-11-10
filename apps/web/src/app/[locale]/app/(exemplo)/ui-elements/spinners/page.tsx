"use client";

import { Spinner, LoadingOverlay } from "@/components/ui/spinner";
import { Button } from "@/components/ui/Button";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useState } from "react";
import { useTranslations } from 'next-intl';

export default function SpinnersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const t = useTranslations('UIElements');
  const tSpinner = useTranslations('Spinner');

  const handleTestLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 3000);
  };

  const handleButtonLoading = () => {
    setButtonLoading(true);
    setTimeout(() => setButtonLoading(false), 2000);
  };

  return (
    <>
      <Breadcrumb pageName={t('spinners')} />

      <div className="space-y-8">
        
        {/* Variantes */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('variants')}
          </h3>
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
            <div className="text-center">
              <h4 className="mb-4 font-medium text-dark dark:text-white">{tSpinner('variant.ring')}</h4>
              <div className="flex justify-center">
                <Spinner variant="ring" />
              </div>
            </div>
            
            <div className="text-center">
              <h4 className="mb-4 font-medium text-dark dark:text-white">{tSpinner('variant.dots')}</h4>
              <div className="flex justify-center">
                <Spinner variant="dots" />
              </div>
            </div>
            
            <div className="text-center">
              <h4 className="mb-4 font-medium text-dark dark:text-white">{tSpinner('variant.pulse')}</h4>
              <div className="flex justify-center">
                <Spinner variant="pulse" />
              </div>
            </div>
            
            <div className="text-center">
              <h4 className="mb-4 font-medium text-dark dark:text-white">{tSpinner('variant.bars')}</h4>
              <div className="flex justify-center">
                <Spinner variant="bars" />
              </div>
            </div>
            
            <div className="text-center">
              <h4 className="mb-4 font-medium text-dark dark:text-white">{tSpinner('variant.bounce')}</h4>
              <div className="flex justify-center">
                <Spinner variant="bounce" />
              </div>
            </div>
          </div>
        </div>

        {/* Tamanhos */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Tamanhos
          </h3>
          
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">XS</p>
              <Spinner size="xs" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">SM</p>
              <Spinner size="sm" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">MD</p>
              <Spinner size="md" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">LG</p>
              <Spinner size="lg" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">XL</p>
              <Spinner size="xl" />
            </div>
          </div>
        </div>

        {/* Cores */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Cores
          </h3>
          
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Primary</p>
              <Spinner color="primary" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Success</p>
              <Spinner color="success" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Warning</p>
              <Spinner color="warning" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Error</p>
              <Spinner color="error" />
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Gray</p>
              <Spinner color="gray" />
            </div>
          </div>
        </div>

        {/* Com Texto */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Spinner com Texto
          </h3>
          
          <div className="flex flex-col items-center gap-6">
            <Spinner text="Carregando..." />
            <Spinner variant="dots" text="Processando dados..." />
            <Spinner variant="bars" text="Enviando arquivo..." size="lg" />
          </div>
        </div>

        {/* Em Botões */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Spinner em Botões
          </h3>
          
          <div className="flex flex-wrap gap-4">
            <Button 
              label={buttonLoading ? 'Enviando...' : 'Enviar'}
              onClick={handleButtonLoading}
              disabled={buttonLoading}
              icon={buttonLoading ? <Spinner size="sm" color="white" /> : undefined}
              className="flex items-center gap-2"
            />
            
            <Button 
              label={buttonLoading ? 'Salvando...' : 'Salvar'}
              variant="outlinePrimary"
              disabled={buttonLoading}
              icon={buttonLoading ? <Spinner size="sm" variant="dots" /> : undefined}
              className="flex items-center gap-2"
            />
          </div>
        </div>

        {/* Loading Overlay */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Loading Overlay
          </h3>
          
          <div className="space-y-4">
            <Button 
              label="Testar Loading Overlay"
              onClick={handleTestLoading}
            />
            
            <LoadingOverlay isLoading={isLoading} text="Carregando dados...">
              <div className="h-40 rounded-lg bg-gray-100 p-6 dark:bg-gray-800">
                <h4 className="mb-2 font-medium text-dark dark:text-white">
                  Conteúdo da Página
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Este conteúdo será coberto pelo overlay quando estiver carregando.
                  Clique no botão acima para testar o comportamento.
                </p>
              </div>
            </LoadingOverlay>
          </div>
        </div>

        {/* Código de Exemplo */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            Código de Exemplo
          </h3>
          
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// Spinner básico
<Spinner />

// Spinner com variante e tamanho
<Spinner variant="dots" size="lg" />

// Spinner com texto
<Spinner text="Carregando..." />

// Em botão
<Button disabled={loading}>
  {loading && <Spinner size="sm" color="white" />}
  {loading ? 'Enviando...' : 'Enviar'}
</Button>

// Loading overlay
<LoadingOverlay isLoading={loading} text="Carregando...">
  <div>Conteúdo</div>
</LoadingOverlay>`}
            </pre>
          </div>
        </div>

      </div>
    </>
  );
}