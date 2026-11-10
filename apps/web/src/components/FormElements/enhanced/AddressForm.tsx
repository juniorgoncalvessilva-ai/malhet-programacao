"use client";

import { useEffect } from "react";
import FormInput from "./FormInput";
import { useCepLookup } from "@/hooks/useCepLookup";
import { useFormValidation } from "@/hooks/useFormValidation";
import { addressSchema } from "@/schemas";
import type { AddressFormData } from "@/schemas";

interface AddressFormProps {
  onSubmit: (data: AddressFormData) => void | Promise<void>;
  onError?: (errors: Record<string, string>) => void;
  defaultValues?: Partial<AddressFormData>;
  className?: string;
  showTitle?: boolean;
  title?: string;
  submitButtonText?: string;
  autoFillFromCep?: boolean;
}

export default function AddressForm({
  onSubmit,
  onError,
  defaultValues = {},
  className = "",
  showTitle = true,
  title = "Endereço",
  submitButtonText = "Salvar Endereço",
  autoFillFromCep = true
}: AddressFormProps) {
  
  // Hook do formulário
  const form = useFormValidation<AddressFormData>({
    schema: addressSchema,
    defaultValues: {
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      country: "Brasil",
      ...defaultValues
    },
    onSubmit,
    onError
  });

  // Hook de consulta CEP
  const cepLookup = useCepLookup({
    onSuccess: (addressData) => {
      if (autoFillFromCep) {
        // Preencher automaticamente os campos do endereço
        form.setValue('street', addressData.street);
        form.setValue('neighborhood', addressData.neighborhood);
        form.setValue('city', addressData.city);
        form.setValue('state', addressData.state);
        form.setValue('country', addressData.country);
      }
    },
    onError: (error) => {
      console.warn('Erro na consulta CEP:', error);
      // Não vamos mostrar erro na UI para não interromper o fluxo
      // O usuário pode preencher manualmente
    },
    debounceMs: 800 // Aguardar um pouco mais para evitar muitas consultas
  });

  // Destructure lookupCep function to use as dependency
  const { lookupCep } = cepLookup;

  // Monitorar mudanças no campo CEP
  const currentCep = form.values.cep;
  
  useEffect(() => {
    if (autoFillFromCep && currentCep && currentCep.length >= 8) {
      // Tentar consultar automaticamente quando CEP estiver completo
      const cleanCep = currentCep.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        lookupCep(cleanCep);
      }
    }
  }, [currentCep, autoFillFromCep, lookupCep]);

  // Ícone de loading para CEP
  const CepLoadingIcon = () => (
    <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4m8-8h-4M6 12H2m15.364-6.364l-2.828 2.828M9.464 15.536l-2.828 2.828m0-12.728l2.828 2.828m8.486 8.486l-2.828-2.828" />
    </svg>
  );

  return (
    <div className={`rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark ${className}`}>
      {showTitle && (
        <h2 className="mb-6 text-xl font-semibold text-dark dark:text-white">
          {title}
        </h2>
      )}
      
      <form onSubmit={form.handleSubmit} className="space-y-4">
        {/* CEP com indicador de loading */}
        <div className="relative">
          <FormInput
            name="cep"
            label="CEP"
            placeholder="00000-000"
            formContext={form}
            helpText="Digite o CEP para preenchimento automático"
            icon={cepLookup.loading ? <CepLoadingIcon /> : undefined}
            iconPosition="right"
          />
          
          {/* Feedback da consulta CEP */}
          {autoFillFromCep && (
            <>
              {cepLookup.loading && (
                <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  🔍 Consultando CEP...
                </div>
              )}
              
              {cepLookup.data && !cepLookup.loading && (
                <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                  ✅ Endereço encontrado e preenchido automaticamente
                </div>
              )}
              
              {cepLookup.error && !cepLookup.loading && (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ {cepLookup.error} - Preencha manualmente
                </div>
              )}
            </>
          )}
        </div>

        {/* Logradouro */}
        <FormInput
          name="street"
          label="Logradouro"
          placeholder="Rua, Avenida, etc."
          formContext={form}
          helpText="Nome da rua/avenida"
        />

        {/* Número e Complemento */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            name="number"
            label="Número"
            placeholder="123"
            formContext={form}
            helpText="Número do imóvel"
          />

          <FormInput
            name="complement"
            label="Complemento"
            placeholder="Apto 101, Bloco B"
            formContext={form}
            helpText="Opcional"
          />
        </div>

        {/* Bairro */}
        <FormInput
          name="neighborhood"
          label="Bairro"
          placeholder="Nome do bairro"
          formContext={form}
          helpText="Bairro/distrito"
        />

        {/* Cidade e Estado */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FormInput
              name="city"
              label="Cidade"
              placeholder="São Paulo"
              formContext={form}
              helpText="Cidade"
            />
          </div>

          <FormInput
            name="state"
            label="Estado"
            placeholder="SP"
            formContext={form}
            helpText="UF (2 letras)"
            maxLength={2}
          />
        </div>

        {/* País */}
        <FormInput
          name="country"
          label="País"
          placeholder="Brasil"
          formContext={form}
          helpText="País"
        />

        {/* Informações de estado do formulário */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Estado do Formulário:
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <p>Válido: {form.formState.isValid ? "✅" : "❌"}</p>
                <p>Modificado: {form.formState.isDirty ? "✅" : "❌"}</p>
                <p>Enviando: {form.formState.isSubmitting ? "⏳" : "❌"}</p>
              </div>
              <div>
                <p>CEP consultado: {cepLookup.lastSearchedCep || "Nenhum"}</p>
                <p>Dados CEP: {cepLookup.data ? "✅" : "❌"}</p>
                <p>Erro CEP: {cepLookup.error ? "❌" : "✅"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Botão de submissão */}
        <button
          type="submit"
          disabled={!form.formState.isValid || form.formState.isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {form.formState.isSubmitting ? "Salvando..." : submitButtonText}
        </button>

        {/* Botão para limpar formulário */}
        <button
          type="button"
          onClick={() => {
            form.resetForm();
            cepLookup.clearData();
          }}
          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-dark-3 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          Limpar Formulário
        </button>
      </form>

      {/* Seção de dados consultados (apenas para desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && cepLookup.data && (
        <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <h3 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
            Dados Consultados via CEP:
          </h3>
          <pre className="text-xs text-blue-700 dark:text-blue-300">
            {JSON.stringify(cepLookup.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}