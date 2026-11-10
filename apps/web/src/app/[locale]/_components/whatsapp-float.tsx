"use client";

import { useState } from "react";
import { X, MessageCircle, Send, Phone, User, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "./whatsapp-icon";

interface WhatsAppFloatProps {
  endpoint?: string;
  businessName?: string;
  welcomeMessage?: string;
}

interface FormData {
  name: string;
  phone: string;
}

interface ValidationError {
  field: 'name' | 'phone';
  message: string;
}

export function WhatsAppFloat({ 
  endpoint = "/api/whatsapp-contact",
  businessName = "Nosso Time",
  welcomeMessage = "Olá! Como podemos ajudar você?"
}: WhatsAppFloatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'name' | 'phone' | 'success'>('welcome');
  const [formData, setFormData] = useState<FormData>({ name: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  // Brazilian phone validation
  const validateBrazilianPhone = (phone: string): boolean => {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Brazilian phone patterns:
    // Mobile: 11 digits (country code + area code + 9 + 8 digits) - 5511999999999
    // Mobile without country code: 11 digits (area code + 9 + 8 digits) - 11999999999
    // Landline: 10 digits (area code + 8 digits) - 1133334444
    // Landline with country code: 12 digits - 551133334444
    
    // Accept formats:
    // 11 digits: area code + mobile (11987654321)
    // 10 digits: area code + landline (1133334444)
    // 13 digits: country code + area code + mobile (5511987654321)
    // 12 digits: country code + area code + landline (551133334444)
    
    if (cleanPhone.length === 11) {
      // Mobile number with area code (11987654321)
      const areaCode = cleanPhone.substring(0, 2);
      const firstDigit = cleanPhone.substring(2, 3);
      return parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && firstDigit === '9';
    } else if (cleanPhone.length === 10) {
      // Landline with area code (1133334444)
      const areaCode = cleanPhone.substring(0, 2);
      const firstDigit = cleanPhone.substring(2, 3);
      return parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && ['2', '3', '4', '5'].includes(firstDigit);
    } else if (cleanPhone.length === 13) {
      // Mobile with country code (5511987654321)
      const countryCode = cleanPhone.substring(0, 2);
      const areaCode = cleanPhone.substring(2, 4);
      const firstDigit = cleanPhone.substring(4, 5);
      return countryCode === '55' && parseInt(areaCode) >= 11 && parseInt(areaCode) <= 99 && firstDigit === '9';
    } else if (cleanPhone.length === 12) {
      // Landline with country code (551133334444)
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
      // 11987654321 -> (11) 98765-4321
      return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 7)}-${cleanPhone.substring(7)}`;
    } else if (cleanPhone.length === 10) {
      // 1133334444 -> (11) 3333-4444
      return `(${cleanPhone.substring(0, 2)}) ${cleanPhone.substring(2, 6)}-${cleanPhone.substring(6)}`;
    } else if (cleanPhone.length === 13) {
      // 5511987654321 -> +55 (11) 98765-4321
      return `+55 (${cleanPhone.substring(2, 4)}) ${cleanPhone.substring(4, 9)}-${cleanPhone.substring(9)}`;
    } else if (cleanPhone.length === 12) {
      // 551133334444 -> +55 (11) 3333-4444
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
      setIsLoading(true);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formattedPhone,
            timestamp: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          setCurrentStep('success');
        } else {
          console.error('Failed to submit form');
          setValidationError({
            field: 'phone',
            message: 'Erro ao enviar dados. Tente novamente.'
          });
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        setValidationError({
          field: 'phone',
          message: 'Erro de conexão. Verifique sua internet e tente novamente.'
        });
      } finally {
        setIsLoading(false);
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
        return ''; // Phone message will be shown separately in chat
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
        return <MessageCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const shouldShowInput = currentStep !== 'welcome' && currentStep !== 'success';
  const shouldShowSendButton = shouldShowInput && inputValue.trim() && !isLoading;

  return (
    <>
      {/* Floating Button */}
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

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 max-w-[calc(100vw-3rem)] sm:w-96">
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
                        // Clear validation error when user starts typing
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
      )}
    </>
  );
}