"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/Button";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useState } from "react";
import { useTranslations } from 'next-intl';

export default function ToastsPage() {
  const { toast, success, error, warning, info, loading, dismiss } = useToast();
  const [promiseLoading, setPromiseLoading] = useState(false);
  const t = useTranslations('UIElements');
  const tToast = useTranslations('Toast');

  const handlePromiseDemo = async () => {
    setPromiseLoading(true);
    
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.3) {
          resolve("Sucesso!");
        } else {
          reject("Erro!");
        }
      }, 2000);
    });

    loading(tToast('processing'), promise);
    
    try {
      await promise;
    } catch (error) {
      // Tratado pelo toast
    } finally {
      setPromiseLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName={t('toasts')} />

      <div className="space-y-8">
        
        {/* Tipos Básicos */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('basicTypes')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="primary"
              onClick={() => success(tToast('successOperation'))}
              label={tToast('successToast')}
            />
            
            <Button 
              variant="green"
              onClick={() => error(tToast('errorProcessing'))}
              label={tToast('errorToast')}
            />
            
            <Button 
              variant="outlinePrimary"
              onClick={() => warning(tToast('warningNotSaved'))}
              label={tToast('warningToast')}
            />
            
            <Button 
              variant="outlineGreen"
              onClick={() => info(tToast('updateAvailable'))}
              label={tToast('infoToast')}
            />
          </div>
        </div>

        {/* Toast com Título e Descrição */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('withTitleDescription')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Button onClick={() => toast({
              title: tToast('emailSent'),
              description: tToast('emailSentDescription'),
              variant: "success"
            })}
              label={tToast('completeToast')}
            />
            
            <Button onClick={() => toast({
              title: tToast('connectionFailed'),
              description: tToast('connectionFailedDescription'),
              variant: "error",
              duration: 8000
            })}
              label={tToast('customDuration')}
            />
          </div>
        </div>

        {/* Toast com Ações */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('withActions')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Button onClick={() => toast({
              title: tToast('fileSent'),
              description: tToast('fileSentDescription'),
              variant: "success",
              action: {
                label: tToast('viewFile'),
                onClick: () => success(tToast('openingFile'))
              }
            })}
              label={tToast('withAction')}
            />
            
            <Button onClick={() => toast({
              title: tToast('confirmDeletion'),
              description: tToast('confirmDeletionDescription'),
              variant: "warning",
              duration: 10000,
              action: {
                label: tToast('confirm'),
                onClick: () => error(tToast('itemDeleted'))
              },
              cancel: {
                label: tToast('cancel'),
                onClick: () => info(tToast('actionCancelled'))
              }
            })}
              label={tToast('withConfirmation')}
            />
          </div>
        </div>

        {/* Promise Toast */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('withPromise')}
          </h3>
          
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {tToast('promiseDescription')}
            </p>
            
            <Button 
              onClick={handlePromiseDemo}
              disabled={promiseLoading}
              label={promiseLoading ? tToast('processing') : tToast('testPromiseToast')}
            />
          </div>
        </div>

        {/* Controles */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('controls')}
          </h3>
          
          <div className="flex gap-4">
            <Button 
              variant="outlineDark"
              onClick={() => dismiss()}
              label={tToast('closeAll')}
            />
            
            <Button 
              variant="primary"
              onClick={() => {
                for (let i = 1; i <= 5; i++) {
                  setTimeout(() => {
                    success(`Toast ${i} de 5`);
                  }, i * 500);
                }
              }}
              label={tToast('multipleToasts')}
            />
          </div>
        </div>

        {/* Posicionamento */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('differentPositions')}
          </h3>
          
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Button size="small" onClick={() => {
              info(tToast('defaultPosition'));
            }}
              label={tToast('topRight')}
            />
            
            <Button size="small" onClick={() => {
              info(tToast('changePosition'));
            }}
              label={tToast('otherPositions')}
            />
          </div>
          
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {tToast('positionNote')}
          </p>
        </div>

        {/* Código de Exemplo */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('codeExample')}
          </h3>
          
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// Hook de uso
const { toast, success, error } = useToast();

// Toast simples
success("Operação realizada!");

// Toast completo
toast({
  title: "Email enviado",
  description: "Sucesso ao enviar",
  variant: "success",
  action: {
    label: "Ver",
    onClick: () => console.log("Ver email")
  }
});

// Toast com promise
loading("Salvando...", 
  fetch('/api/save')
    .then(() => success("Salvo!"))
    .catch(() => error("Erro!"))
);`}
            </pre>
          </div>
        </div>

      </div>
    </>
  );
}