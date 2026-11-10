"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useToast } from "@/hooks/use-toast";

export default function DialogsPage() {
  const [isControlledOpen, setIsControlledOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const t = useTranslations('UIElements');
  const tDialog = useTranslations('Dialog');
  const { success, error } = useToast();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email) {
      success(tDialog('userCreated'));
      setFormData({ name: '', email: '' });
    } else {
      error(tDialog('fillAllFields'));
    }
  };

  return (
    <>
      <Breadcrumb pageName={t('dialogs')} />

      <div className="space-y-8">
        
        {/* Tamanhos */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('differentSizes')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {['sm', 'md', 'lg', 'xl', '2xl'].map((size) => (
              <Dialog key={size}>
                <DialogTrigger asChild>
                  <Button variant="outlinePrimary" size="small" label={size.toUpperCase()} />
                </DialogTrigger>
                <DialogContent size={size as any}>
                  <DialogHeader>
                    <DialogTitle>Modal {size.toUpperCase()}</DialogTitle>
                    <DialogDescription>
                      Este é um modal de tamanho {size}. Você pode ajustar o conteúdo conforme necessário.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Conteúdo do modal. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                      Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outlinePrimary" label={tDialog('cancel')} />
                    <Button label={tDialog('confirm')} />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>

        {/* Modal de Confirmação */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('confirmationModal')}
          </h3>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="green" label={tDialog('deleteItem')} />
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>{tDialog('confirmDeletion')}</DialogTitle>
                <DialogDescription>
                  {tDialog('confirmDeletionDescription')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outlinePrimary" label={tDialog('cancel')} />
                <Button variant="green" label={tDialog('delete')} onClick={() => {
                  success(tDialog('itemDeleted'));
                }} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Modal Controlado */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('controlledModal')}
          </h3>
          
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {tDialog('controlledDescription')}
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsControlledOpen(true)}
                label={tDialog('openModal')}
              />
              <Button 
                variant="outlinePrimary" 
                onClick={() => setIsControlledOpen(false)}
                label={tDialog('closeModal')}
              />
            </div>
          </div>

          <Dialog open={isControlledOpen} onOpenChange={setIsControlledOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tDialog('controlledModalTitle')}</DialogTitle>
                <DialogDescription>
                  Este modal é controlado por estado externo. Status atual: {isControlledOpen ? tDialog('open') : tDialog('closed')}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tDialog('controlledContent')}
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsControlledOpen(false)} label={tDialog('close')} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Modal com Formulário */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('formModal')}
          </h3>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button label={tDialog('addUser')} />
            </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>{tDialog('newUser')}</DialogTitle>
                <DialogDescription>
                  {tDialog('newUserDescription')}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tDialog('name')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={tDialog('namePlaceholder')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tDialog('email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={tDialog('emailPlaceholder')}
                  />
                </div>
                
                <DialogFooter>
                  <Button variant="outlinePrimary" type="button" label={tDialog('cancel')} />
                  <Button type="submit" label={tDialog('saveUser')} />
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Posicionamento */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('positioning')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { position: 'center', label: tDialog('center') },
              { position: 'top', label: tDialog('top') },
              { position: 'bottom', label: tDialog('bottom') }
            ].map(({ position, label }) => (
              <Dialog key={position}>
                <DialogTrigger asChild>
                  <Button variant="outlinePrimary" label={label} />
                </DialogTrigger>
                <DialogContent position={position as any}>
                  <DialogHeader>
                    <DialogTitle>Modal no {label}</DialogTitle>
                    <DialogDescription>
                      Este modal está posicionado no {label.toLowerCase()} da tela.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button label={tDialog('ok')} />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>

        {/* Código de Exemplo */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('codeExample')}
          </h3>
          
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// Dialog básico
<Dialog>
  <DialogTrigger asChild>
    <Button label="Abrir Modal" />
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
      <DialogDescription>Descrição</DialogDescription>
    </DialogHeader>
    <div>Conteúdo</div>
    <DialogFooter>
      <Button variant="outlinePrimary" label="Cancelar" />
      <Button label="Confirmar" />
    </DialogFooter>
  </DialogContent>
</Dialog>

// Dialog controlado
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent size="lg">
    <DialogHeader>
      <DialogTitle>Modal Controlado</DialogTitle>
    </DialogHeader>
    <div>Conteúdo...</div>
  </DialogContent>
</Dialog>`}
            </pre>
          </div>
        </div>

      </div>
    </>
  );
}