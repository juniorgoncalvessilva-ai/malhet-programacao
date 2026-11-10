import { useState, useCallback } from 'react';

// Tipos para resposta da API ViaCEP
export interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
}

// Interface para dados normalizados
export interface AddressData {
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

// Estado do hook
export interface CepLookupState {
  data: AddressData | null;
  loading: boolean;
  error: string | null;
  lastSearchedCep: string | null;
}

// Configurações do hook
interface UseCepLookupOptions {
  onSuccess?: (data: AddressData) => void;
  onError?: (error: string) => void;
  debounceMs?: number;
}

/**
 * Hook para consulta de CEP usando a API do ViaCEP
 * 
 * @param options - Configurações opcionais do hook
 * @returns Objeto com estado da consulta e função de busca
 */
export function useCepLookup(options: UseCepLookupOptions = {}) {
  const { onSuccess, onError, debounceMs = 500 } = options;

  const [state, setState] = useState<CepLookupState>({
    data: null,
    loading: false,
    error: null,
    lastSearchedCep: null
  });

  // Função para normalizar o CEP (remove caracteres especiais)
  const normalizeCep = useCallback((cep: string): string => {
    return cep.replace(/\D/g, '');
  }, []);

  // Função para validar formato do CEP
  const isValidCepFormat = useCallback((cep: string): boolean => {
    const cleanCep = normalizeCep(cep);
    return cleanCep.length === 8 && /^\d{8}$/.test(cleanCep);
  }, [normalizeCep]);

  // Função para normalizar dados da API para nosso formato
  const normalizeApiResponse = useCallback((apiData: CepData): AddressData => {
    return {
      cep: apiData.cep,
      street: apiData.logradouro || '',
      complement: apiData.complemento || '',
      neighborhood: apiData.bairro || '',
      city: apiData.localidade || '',
      state: apiData.uf || '',
      country: 'Brasil'
    };
  }, []);

  // Função principal de busca
  const lookupCep = useCallback(async (cep: string): Promise<AddressData | null> => {
    // Validar formato
    if (!isValidCepFormat(cep)) {
      const error = 'CEP deve ter 8 dígitos';
      setState(prev => ({ ...prev, error, loading: false }));
      onError?.(error);
      return null;
    }

    const cleanCep = normalizeCep(cep);
    
    // Evitar busca repetida
    if (cleanCep === state.lastSearchedCep && state.data) {
      return state.data;
    }

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      lastSearchedCep: cleanCep
    }));

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const apiData: CepData = await response.json();

      // ViaCEP retorna { erro: true } para CEPs não encontrados
      if ('erro' in apiData) {
        throw new Error('CEP não encontrado');
      }

      const normalizedData = normalizeApiResponse(apiData);

      setState(prev => ({
        ...prev,
        data: normalizedData,
        loading: false,
        error: null
      }));

      onSuccess?.(normalizedData);
      return normalizedData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar CEP';
      
      setState(prev => ({
        ...prev,
        data: null,
        loading: false,
        error: errorMessage
      }));

      onError?.(errorMessage);
      return null;
    }
  }, [isValidCepFormat, normalizeCep, state.lastSearchedCep, state.data, normalizeApiResponse, onSuccess, onError]);

  // Função para busca com debounce
  const lookupCepDebounced = useCallback((cep: string) => {
    // Para simplicidade, vamos implementar um debounce básico
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const timeoutId = setTimeout(() => {
      lookupCep(cep);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [lookupCep, debounceMs]);

  // Função para limpar o estado
  const clearData = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      lastSearchedCep: null
    });
  }, []);

  // Função para resetar apenas o erro
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // Estado atual
    data: state.data,
    loading: state.loading,
    error: state.error,
    lastSearchedCep: state.lastSearchedCep,
    
    // Funções
    lookupCep,
    lookupCepDebounced,
    clearData,
    clearError,
    
    // Utilitários
    isValidCepFormat,
    normalizeCep,
    
    // Estado completo (para casos avançados)
    state
  };
}

// Hook simplificado para casos básicos
export function useSimpleCepLookup() {
  return useCepLookup({
    debounceMs: 300
  });
}