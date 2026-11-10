import { useState, useCallback, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { useForm, FieldErrors, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  UseFormValidationProps, 
  UseFormValidationReturn, 
  FormValidationState,
  FieldValidationState,
  ValidationConfig 
} from '../types/form-types';

/**
 * Hook customizado para validação de formulários com Zod e React Hook Form
 * 
 * @param schema - Schema Zod para validação
 * @param defaultValues - Valores padrão do formulário
 * @param validationConfig - Configurações de validação
 * @param onSubmit - Função de submissão
 * @param onError - Callback para erros de validação
 */
export function useFormValidation<T extends Record<string, any>>({
  schema,
  defaultValues = {} as Partial<T>,
  validationConfig = {},
  onSubmit,
  onError
}: UseFormValidationProps<T>): UseFormValidationReturn<T> {
  
  // Configurações padrão de validação
  const config: Required<ValidationConfig> = useMemo(() => ({
    validateOnChange: true,
    validateOnBlur: true,
    validateOnSubmit: true,
    debounceMs: 300,
    ...validationConfig
  }), [validationConfig]);

  // Hook do React Hook Form com resolver Zod
  const form = useForm<T>({
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as any,
    mode: config.validateOnChange ? 'onChange' : 'onSubmit',
    reValidateMode: 'onChange',
    criteriaMode: 'firstError'
  });

  const {
    handleSubmit: rhfHandleSubmit,
    formState,
    setValue: rhfSetValue,
    getValues,
    setError: rhfSetError,
    clearErrors,
    reset,
    trigger,
    watch
  } = form;

  // Estado local para controle adicional
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debounceTimeouts, setDebounceTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  // Estado consolidado do formulário
  const formValidationState: FormValidationState = {
    isValid: formState.isValid,
    isSubmitting: isSubmitting || formState.isSubmitting,
    hasErrors: Object.keys(formState.errors).length > 0,
    isDirty: formState.isDirty,
    errors: Object.keys(formState.errors).reduce((acc, key) => {
      const error = formState.errors[key];
      acc[key] = typeof error?.message === 'string' ? error.message : undefined;
      return acc;
    }, {} as Record<string, string | undefined>),
    touchedFields: (formState.touchedFields || {}) as Record<string, boolean>
  };

  // Função debounce para validação
  const debounce = useCallback((func: () => void, delay: number, fieldName: string) => {
    // Limpar timeout existente para este campo
    if (debounceTimeouts[fieldName]) {
      clearTimeout(debounceTimeouts[fieldName]);
    }

    // Criar novo timeout
    const timeoutId = setTimeout(func, delay);
    
    setDebounceTimeouts(prev => ({
      ...prev,
      [fieldName]: timeoutId
    }));
  }, [debounceTimeouts]);

  // Limpar timeouts no cleanup
  useEffect(() => {
    return () => {
      Object.values(debounceTimeouts).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [debounceTimeouts]);

  // Função para setar valor com validação opcional
  const setValue = useCallback((name: keyof T, value: any) => {
    rhfSetValue(name as any, value, { 
      shouldValidate: config.validateOnChange,
      shouldDirty: true,
      shouldTouch: true
    });

    // Validação com debounce se configurado
    if (config.validateOnChange && config.debounceMs > 0) {
      debounce(() => {
        trigger(name as any);
      }, config.debounceMs, String(name));
    }
  }, [rhfSetValue, config, trigger, debounce]);

  // Função para setar erro customizado
  const setError = useCallback((name: keyof T, error: string) => {
    rhfSetError(name as any, { 
      type: 'custom', 
      message: error 
    });
  }, [rhfSetError]);

  // Função para limpar erro específico
  const clearError = useCallback((name: keyof T) => {
    clearErrors(name as any);
  }, [clearErrors]);

  // Função para resetar formulário
  const resetForm = useCallback(() => {
    reset(defaultValues as T);
    setIsSubmitting(false);
    
    // Limpar todos os timeouts
    Object.values(debounceTimeouts).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    setDebounceTimeouts({});
  }, [reset, defaultValues, debounceTimeouts]);

  // Validação de campo individual
  const validateField = useCallback(async (name: keyof T): Promise<boolean> => {
    try {
      const result = await trigger(name as any);
      return result;
    } catch (error) {
      console.error(`Erro ao validar campo ${String(name)}:`, error);
      return false;
    }
  }, [trigger]);

  // Validação do formulário completo
  const validateForm = useCallback(async (): Promise<boolean> => {
    try {
      const result = await trigger();
      return result;
    } catch (error) {
      console.error('Erro ao validar formulário:', error);
      return false;
    }
  }, [trigger]);

  // Handler de submissão
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    const submitHandler = rhfHandleSubmit(
      async (data: T) => {
        try {
          setIsSubmitting(true);
          
          // Validar dados com Zod antes de submeter
          const validatedData = schema.parse(data);
          
          await onSubmit(validatedData);
        } catch (error) {
          console.error('Erro na submissão do formulário:', error);
          
          // Se for erro de validação Zod, mapear para campos
          if (error instanceof z.ZodError) {
            const fieldErrors: Record<string, string> = {};
            
            error.errors.forEach((err) => {
              const path = err.path.join('.');
              fieldErrors[path] = err.message;
              rhfSetError(path as any, { 
                type: 'zodError', 
                message: err.message 
              });
            });
            
            onError?.(fieldErrors);
          }
        } finally {
          setIsSubmitting(false);
        }
      },
      (errors: FieldErrors<T>) => {
        // Callback para erros de validação
        const errorMessages = Object.keys(errors).reduce((acc, key) => {
          const error = errors[key];
          acc[key] = (typeof error?.message === 'string' ? error.message : undefined) || 'Erro de validação';
          return acc;
        }, {} as Record<string, string>);
        
        onError?.(errorMessages);
      }
    );

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    return submitHandler(e);
  }, [rhfHandleSubmit, schema, onSubmit, onError, rhfSetError]);

  // Função para obter props de um campo
  const getFieldProps = useCallback((name: keyof T) => {
    const fieldError = formState.errors[name as string];
    const fieldValue = watch(name as any);
    const isFieldTouched = (formState.touchedFields as any)[name as string];

    return {
      name: String(name),
      value: fieldValue,
      onChange: (value: any) => setValue(name, value),
      onBlur: () => {
        if (config.validateOnBlur) {
          trigger(name as any);
        }
      },
      error: typeof fieldError?.message === 'string' ? fieldError.message : undefined,
      required: true, // Pode ser melhorado para detectar se o campo é obrigatório no schema
      'data-testid': `field-${String(name)}`,
      'aria-invalid': !!fieldError,
      'aria-describedby': fieldError ? `${String(name)}-error` : undefined
    };
  }, [formState.errors, formState.touchedFields, watch, setValue, trigger, config.validateOnBlur]);

  // Função para obter estado de validação de um campo
  const getFieldValidationState = useCallback((name: keyof T): FieldValidationState => {
    const fieldError = formState.errors[name as string];
    const isFieldTouched = (formState.touchedFields as any)[name as string];
    const fieldValue = watch(name as any);

    return {
      isValid: !fieldError,
      isDirty: !!fieldValue && fieldValue !== defaultValues[name],
      isTouched: !!isFieldTouched,
      error: typeof fieldError?.message === 'string' ? fieldError.message : undefined
    };
  }, [formState.errors, formState.touchedFields, watch, defaultValues]);

  return {
    // Valores do formulário
    values: getValues(),
    
    // Estado de validação
    formState: formValidationState,
    
    // Métodos para manipular campos
    setValue,
    setError,
    clearError,
    resetForm,
    
    // Métodos de validação
    validateField,
    validateForm,
    
    // Método de submissão
    handleSubmit,
    
    // Handlers para campos
    getFieldProps,
    getFieldValidationState
  };
}

// Hook simplificado para casos básicos
export function useSimpleFormValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  onSubmit: (data: T) => void | Promise<void>,
  defaultValues?: Partial<T>
) {
  return useFormValidation({
    schema,
    onSubmit,
    defaultValues,
    validationConfig: {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300
    }
  });
}