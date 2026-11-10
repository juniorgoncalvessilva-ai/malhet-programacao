"use client";

import { useState } from "react";
import { X, Send, Phone, User, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface WhatsAppIconProps {
  className?: string;
  size?: number;
}

function WhatsAppIcon({ className = "", size = 24 }: WhatsAppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488"/>
    </svg>
  );
}

interface WhatsAppButtonProps {
  endpoint?: string;
  businessName?: string;
  welcomeMessage?: string;
  variant?: 'floating' | 'inline';
  showModal?: boolean;
}

interface FormData {
  name: string;
  phone: string;
}

interface ValidationError {
  field: 'name' | 'phone';
  message: string;
}

export function WhatsAppButton({ 
  endpoint = "/api/whatsapp-contact",
  businessName = "Nossa Empresa",
  welcomeMessage = "Olá! Como podemos ajudar você?",
  variant = 'floating',
  showModal = true
}: WhatsAppButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'name' | 'phone' | 'success'>('welcome');
  const [formData, setFormData] = useState<FormData>({ name: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  // Brazilian phone validation
  const validateBrazilianPhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 11) {
      const areaCode = cleanPhone.substring(0, 2);
      const firstDigit = cleanPhone.substring(2, 3);
      return parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && firstDigit === '9';
    } else if (cleanPhone.length === 10) {
      const areaCode = cleanPhone.substring(0, 2);
      const firstDigit = cleanPhone.substring(2, 3);
      return parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && ['2', '3', '4', '5'].includes(firstDigit);
    } else if (cleanPhone.length === 13) {
      const countryCode = cleanPhone.substring(0, 2);
      const areaCode = cleanPhone.substring(2, 4);
      const firstDigit = cleanPhone.substring(4, 5);
      return countryCode === '55' && parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && firstDigit === '9';
    } else if (cleanPhone.length === 12) {
      const countryCode = cleanPhone.substring(0, 2);
      const areaCode = cleanPhone.substring(2, 4);
      const firstDigit = cleanPhone.substring(4, 5);
      return countryCode === '55' && parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && ['2', '3', '4', '5'].includes(firstDigit);
    }
    
    return false;
  };

  const formatBrazilianPhone = (phone: string): string => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 11) {
      return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 7)}-${cleanPhone.substring(7)}`;
    } else if (cleanPhone.length === 10) {
      return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 6)}-${cleanPhone.substring(6)}`;
    } else if (cleanPhone.length === 13) {
      return `+55 (${cleanPhone.substring(2, 4)}) ${cleanPhone.substring(4, 9)}-${cleanPhone.substring(9)}`;
    } else if (cleanPhone.length === 12) {
      return `+55 (${cleanPhone.substring(2, 4)}) ${cleanPhone.substring(4, 8)}-${cleanPhone.substring(8)}`;
    }
    
    return phone;
  };

  const handleNext = async () => {
    setValidationError(null);
    
    if (currentStep === 'welcome') {
      setCurrentStep('name');
    } else if (currentStep === 'name') {
      const nameValue = inputValue.trim();
      if (nameValue.length < 2) {
        setValidationError({
          field: 'name',
          message: 'Por favor, digite um nome válido com pelo menos 2 caracteres.'
        });
        return;
      }
      setFormData(prev => ({ ...prev, name: nameValue }));
      setInputValue('');
      setCurrentStep('phone');
    } else if (currentStep === 'phone') {
      const phoneValue = inputValue.trim();
      
      if (!phoneValue) {
        setValidationError({
          field: 'phone',
          message: 'Por favor, digite seu telefone.'
        });
        return;
      }
      
      if (!validateBrazilianPhone(phoneValue)) {
        setValidationError({
          field: 'phone',
          message: 'Por favor, digite um telefone brasileiro válido. Exemplos: (11) 99999-9999 ou (11) 3333-4444'
        });
        return;
      }
      
      const formattedPhone = formatBrazilianPhone(phoneValue);
      setFormData(prev => ({ ...prev, phone: formattedPhone }));
      
      if (showModal) {
        setIsLoading(true);
        try {
          // Simulate API call for demo
          await new Promise(resolve => setTimeout(resolve, 1000));
          setCurrentStep('success');
        } catch (error) {
          setValidationError({
            field: 'phone',
            message: 'Erro ao enviar dados. Tente novamente.'
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        setCurrentStep('success');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  const resetChat = () => {
    setCurrentStep('welcome');
    setFormData({ name: '', phone: '' });
    setInputValue('');
    setValidationError(null);
    setIsOpen(false);
  };

  const getCurrentMessage = () => {
    switch (currentStep) {
      case 'welcome':
        return welcomeMessage;
      case 'name':
        return "Qual é o seu nome?";
      case 'phone':
        return '';
      case 'success':
        return `Obrigado ${formData.name}! Entraremos em contato em breve pelo telefone ${formData.phone}.`;
      default:
        return welcomeMessage;
    }
  };

  const getInputPlaceholder = () => {
    switch (currentStep) {
      case 'name':
        return "Digite seu nome...";
      case 'phone':
        return "Ex: (11) 99999-9999";
      default:
        return "Digite uma mensagem...";
    }
  };

  const getInputIcon = () => {
    switch (currentStep) {
      case 'name':
        return <User className="h-4 w-4 text-gray-400" />;
      case 'phone':
        return <Phone className="h-4 w-4 text-gray-400" />;
      default:
        return <WhatsAppIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const shouldShowInput = currentStep !== 'welcome' && currentStep !== 'success';
  const shouldShowSendButton = shouldShowInput && inputValue.trim() && !isLoading;

  // Inline button for UI showcase
  if (variant === 'inline') {
    return (
      <div className="inline-block">
        <Button
          onClick={() => setIsOpen(true)}
          variant="green"
          shape="full"
          size="small"
          className="relative"
          icon={<WhatsAppIcon className="h-4 w-4" />}
          label="WhatsApp"
        />
        
        {/* Modal */}
        {showModal && isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative w-80 max-w-[calc(100vw-2rem)] mx-4">
              <div className="rounded-lg bg-white shadow-2xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between bg-green-500 px-4 py-3 rounded-t-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
                      <WhatsAppIcon className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{businessName}</h3>
                      <p className="text-xs text-green-100">Online agora</p>
                    </div>
                  </div>
                  <button
                    onClick={resetChat}
                    className="h-8 w-8 p-0 text-white hover:bg-green-600 rounded transition-colors flex items-center justify-center"
                    aria-label="Fechar chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-start space-x-2">
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <WhatsAppIcon className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 max-w-[80%] shadow-sm">
                      <p className="text-sm text-gray-800 dark:text-gray-200">{getCurrentMessage()}</p>
                    </div>
                  </div>

                  {formData.name && (
                    <div className="flex justify-end">
                      <div className="bg-green-500 rounded-lg px-3 py-2 max-w-[80%]">
                        <p className="text-sm text-white">{formData.name}</p>
                      </div>
                    </div>
                  )}

                  {formData.name && currentStep === 'phone' && (
                    <div className="flex items-start space-x-2 mt-3">
                      <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <WhatsAppIcon className="h-3 w-3 text-white" />
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 max-w-[80%] shadow-sm">
                        <p className="text-sm text-gray-800 dark:text-gray-200">{`Olá ${formData.name}! Qual é o seu telefone para contato?`}</p>
                      </div>
                    </div>
                  )}

                  {formData.phone && (currentStep === 'success') && (
                    <div className="flex justify-end">
                      <div className="bg-green-500 rounded-lg px-3 py-2 max-w-[80%]">
                        <p className="text-sm text-white">{formData.phone}</p>
                      </div>
                    </div>
                  )}

                  {validationError && (
                    <div className="flex items-start space-x-2 mt-3">
                      <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <WhatsAppIcon className="h-3 w-3 text-white" />
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 max-w-[80%] shadow-sm">
                        <p className="text-sm text-red-800 dark:text-red-200">{validationError.message}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  {currentStep === 'welcome' ? (
                    <Button
                      onClick={handleNext}
                      variant="green"
                      shape="rounded"
                      className="w-full"
                      label="Iniciar Conversa"
                    />
                  ) : currentStep === 'success' ? (
                    <div className="flex items-center justify-center text-green-600 dark:text-green-400">
                      <Check className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">Mensagem enviada!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 relative">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          {getInputIcon()}
                        </div>
                        <input
                          type={currentStep === 'phone' ? 'tel' : 'text'}
                          value={inputValue}
                          onChange={(e) => {
                            setInputValue(e.target.value);
                            if (validationError) {
                              setValidationError(null);
                            }
                          }}
                          onKeyPress={handleKeyPress}
                          placeholder={getInputPlaceholder()}
                          className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                            validationError 
                              ? 'border-red-300 focus:ring-red-500 dark:border-red-600' 
                              : 'border-gray-300 focus:ring-green-500 dark:border-gray-600'
                          }`}
                          disabled={isLoading}
                          autoFocus
                        />
                      </div>
                      {shouldShowSendButton && (
                        <Button
                          onClick={handleNext}
                          variant="green"
                          shape="rounded"
                          size="small"
                          className="px-3"
                          disabled={isLoading}
                          icon={<Send className="h-4 w-4" />}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Floating button (default behavior)
  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          shape="full"
          className="group relative h-14 w-14 bg-green-500 p-0 shadow-lg transition-all duration-300 hover:bg-green-600 hover:scale-110 hover:shadow-xl text-white border-none"
          aria-label="Abrir chat do WhatsApp"
          icon={<WhatsAppIcon className="h-6 w-6 text-white" />}
        >
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 animate-ping"></div>
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500"></div>
        </Button>
      </div>

      {/* Modal remains the same as inline version */}
      {/* ... (same modal code as above) ... */}
    </>
  );
}