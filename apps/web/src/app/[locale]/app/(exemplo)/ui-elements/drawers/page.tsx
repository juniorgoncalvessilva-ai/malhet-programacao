"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/Button";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useToast } from "@/hooks/use-toast";

export default function DrawersPage() {
  const [isControlledOpen, setIsControlledOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"top" | "bottom" | "left" | "right">("right");
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const t = useTranslations('UIElements');
  const tDrawer = useTranslations('Drawer');
  const { success, error } = useToast();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.message) {
      success(tDrawer('messageSent'));
      setFormData({ name: '', email: '', message: '' });
    } else {
      error(tDrawer('fillAllFields'));
    }
  };

  return (
    <>
      <Breadcrumb pageName={t('drawers')} />

      <div className="space-y-8">
        
        {/* Direções */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('directions')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { side: 'left', label: tDrawer('left'), icon: '←' },
              { side: 'right', label: tDrawer('right'), icon: '→' },
              { side: 'top', label: tDrawer('top'), icon: '↑' },
              { side: 'bottom', label: tDrawer('bottom'), icon: '↓' }
            ].map(({ side, label, icon }) => (
              <Drawer key={side}>
                <DrawerTrigger asChild>
                  <Button variant="outlinePrimary" label={`${icon} ${label}`} />
                </DrawerTrigger>
                <DrawerContent side={side as any}>
                  <DrawerHeader>
                    <DrawerTitle>Drawer {label}</DrawerTitle>
                    <DrawerDescription>
                      Este drawer desliza desde {label.toLowerCase()}. Pode conter qualquer conteúdo.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Conteúdo do drawer. Este é um espaço flexível onde você pode adicionar 
                      formulários, listas, navegação ou qualquer outro tipo de conteúdo.
                    </p>
                  </div>
                  <DrawerFooter>
                    <Button variant="outlinePrimary" label={tDrawer('cancel')} />
                    <Button label={tDrawer('confirm')} />
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            ))}
          </div>
        </div>

        {/* Tamanhos */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('differentSizes')}
          </h3>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {['sm', 'md', 'lg', 'xl', 'full'].map((size) => (
              <Drawer key={size}>
                <DrawerTrigger asChild>
                  <Button variant="primary" size="small" label={size.toUpperCase()} />
                </DrawerTrigger>
                <DrawerContent side="right" size={size as any}>
                  <DrawerHeader>
                    <DrawerTitle>Drawer {size.toUpperCase()}</DrawerTitle>
                    <DrawerDescription>
                      Este drawer tem tamanho {size}. O conteúdo se adapta automaticamente.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="py-4 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Conteúdo do drawer tamanho {size}. Lorem ipsum dolor sit amet, 
                      consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut 
                      labore et dolore magna aliqua.
                    </p>
                  </div>
                  <DrawerFooter>
                    <Button label={tDrawer('close')} />
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            ))}
          </div>
        </div>

        {/* Drawer de Navegação */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('navigationDrawer')}
          </h3>
          
          <Drawer>
            <DrawerTrigger asChild>
              <Button label={tDrawer('openNavigation')} />
            </DrawerTrigger>
            <DrawerContent side="left" size="md">
              <DrawerHeader>
                <DrawerTitle>{tDrawer('navigation')}</DrawerTitle>
                <DrawerDescription>
                  {tDrawer('navigationDescription')}
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="py-4 flex-1">
                <nav className="space-y-2">
                  {[
                    { title: 'Dashboard', href: '/', icon: '📊' },
                    { title: 'Usuários', href: '/users', icon: '👥' },
                    { title: 'Produtos', href: '/products', icon: '📦' },
                    { title: 'Pedidos', href: '/orders', icon: '🛒' },
                    { title: 'Relatórios', href: '/reports', icon: '📈' },
                    { title: 'Configurações', href: '/settings', icon: '⚙️' },
                  ].map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      className="flex items-center space-x-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {item.title}
                      </span>
                    </a>
                  ))}
                </nav>
              </div>
              
              <DrawerFooter>
                <Button label={tDrawer('close')} />
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Drawer Controlado */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('controlledDrawer')}
          </h3>
          
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {tDrawer('controlledDescription')}
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsControlledOpen(true)}
                label={tDrawer('openDrawer')}
              />
              <Button 
                variant="outlinePrimary" 
                onClick={() => setIsControlledOpen(false)}
                label={tDrawer('closeDrawer')}
              />
            </div>
            
            <div className="flex gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tDrawer('direction')}:
              </label>
              <select 
                value={selectedSide} 
                onChange={(e) => setSelectedSide(e.target.value as any)}
                className="px-2 py-1 border border-gray-300 rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="left">{tDrawer('left')}</option>
                <option value="right">{tDrawer('right')}</option>
                <option value="top">{tDrawer('top')}</option>
                <option value="bottom">{tDrawer('bottom')}</option>
              </select>
            </div>
          </div>

          <Drawer open={isControlledOpen} onOpenChange={setIsControlledOpen}>
            <DrawerContent side={selectedSide}>
              <DrawerHeader>
                <DrawerTitle>{tDrawer('controlledDrawerTitle')}</DrawerTitle>
                <DrawerDescription>
                  Este drawer é controlado externamente. Direção: {tDrawer(selectedSide)}. 
                  Status: {isControlledOpen ? tDrawer('open') : tDrawer('closed')}
                </DrawerDescription>
              </DrawerHeader>
              <div className="py-4 flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tDrawer('controlledContent')}
                </p>
              </div>
              <DrawerFooter>
                <Button onClick={() => setIsControlledOpen(false)} label={tDrawer('close')} />
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Drawer com Formulário */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('formDrawer')}
          </h3>
          
          <Drawer>
            <DrawerTrigger asChild>
              <Button label={tDrawer('sendMessage')} />
            </DrawerTrigger>
            <DrawerContent side="right" size="lg">
              <DrawerHeader>
                <DrawerTitle>{tDrawer('contactForm')}</DrawerTitle>
                <DrawerDescription>
                  {tDrawer('contactFormDescription')}
                </DrawerDescription>
              </DrawerHeader>
              
              <form onSubmit={handleFormSubmit} className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tDrawer('name')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={tDrawer('namePlaceholder')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tDrawer('email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={tDrawer('emailPlaceholder')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tDrawer('message')}
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={tDrawer('messagePlaceholder')}
                  />
                </div>
                
                <DrawerFooter>
                  <Button variant="outlinePrimary" type="button" label={tDrawer('cancel')} />
                  <Button type="submit" label={tDrawer('sendMessage')} />
                </DrawerFooter>
              </form>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Código de Exemplo */}
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
          <h3 className="mb-6 text-xl font-semibold text-dark dark:text-white">
            {t('codeExample')}
          </h3>
          
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// Drawer básico
<Drawer>
  <DrawerTrigger asChild>
    <Button label="Abrir Drawer" />
  </DrawerTrigger>
  <DrawerContent side="right">
    <DrawerHeader>
      <DrawerTitle>Título</DrawerTitle>
      <DrawerDescription>Descrição</DrawerDescription>
    </DrawerHeader>
    <div>Conteúdo</div>
    <DrawerFooter>
      <Button variant="outlinePrimary" label="Cancelar" />
      <Button label="Confirmar" />
    </DrawerFooter>
  </DrawerContent>
</Drawer>

// Drawer controlado
const [open, setOpen] = useState(false);

<Drawer open={open} onOpenChange={setOpen}>
  <DrawerContent side="left" size="lg">
    <DrawerHeader>
      <DrawerTitle>Drawer Controlado</DrawerTitle>
    </DrawerHeader>
    <div>Conteúdo...</div>
  </DrawerContent>
</Drawer>

// Diferentes direções
<DrawerContent side="top">    // Desliza do topo
<DrawerContent side="bottom"> // Desliza do rodapé  
<DrawerContent side="left">   // Desliza da esquerda
<DrawerContent side="right">  // Desliza da direita`}
            </pre>
          </div>
        </div>

      </div>
    </>
  );
}