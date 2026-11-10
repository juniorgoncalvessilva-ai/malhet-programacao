import { z } from "zod";
import { type HTMLInputTypeAttribute } from "react";
import { 
  userRegistrationSchema,
  userProfileSchema,
  contactSchema,
  loginSchema,
  addressSchema 
} from "../schemas/form-schemas";

// ==========================================
// TIPOS BASE PARA FORMULÁRIOS
// ==========================================

// Estado de validação de um campo
export interface FieldValidationState {
  isValid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  error?: string;
}

// Estado geral do formulário
export interface FormValidationState {
  isValid: boolean;
  isSubmitting: boolean;
  hasErrors: boolean;
  isDirty: boolean;
  errors: Record<string, string | undefined>;
  touchedFields: Record<string, boolean>;
}

// Configurações de validação
export interface ValidationConfig {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
  debounceMs?: number;
}

// Props para componentes validados
export interface ValidatedFieldProps {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  validationState?: FieldValidationState;
  onValidationChange?: (state: FieldValidationState) => void;
}

// ==========================================
// TIPOS ESPECÍFICOS POR TIPO DE INPUT
// ==========================================

// Input de texto
export interface ValidatedInputProps extends ValidatedFieldProps {
  type?: HTMLInputTypeAttribute;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  autoComplete?: string;
}

// Select
export interface ValidatedSelectProps extends ValidatedFieldProps {
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  multiple?: boolean;
  searchable?: boolean;
}

// Textarea
export interface ValidatedTextAreaProps extends ValidatedFieldProps {
  rows?: number;
  maxLength?: number;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
}

// Checkbox
export interface ValidatedCheckboxProps extends Omit<ValidatedFieldProps, 'placeholder'> {
  checked?: boolean;
  value?: string;
}

// Radio Group
export interface ValidatedRadioGroupProps extends ValidatedFieldProps {
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  direction?: 'horizontal' | 'vertical';
}

// Date Picker
export interface ValidatedDatePickerProps extends ValidatedFieldProps {
  minDate?: Date;
  maxDate?: Date;
  format?: string;
  showTime?: boolean;
}

// File Upload
export interface ValidatedFileUploadProps extends ValidatedFieldProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // em bytes
  maxFiles?: number;
  previewImages?: boolean;
}

// ==========================================
// TIPOS PARA HOOKS E PROVIDERS
// ==========================================

// Props do hook useFormValidation
export interface UseFormValidationProps<T extends Record<string, any>> {
  schema: z.ZodSchema<T>;
  defaultValues?: Partial<T>;
  validationConfig?: ValidationConfig;
  onSubmit: (data: T) => void | Promise<void>;
  onError?: (errors: Record<string, string>) => void;
}

// Retorno do hook useFormValidation
export interface UseFormValidationReturn<T extends Record<string, any>> {
  // Valores do formulário
  values: Partial<T>;
  
  // Estado de validação
  formState: FormValidationState;
  
  // Métodos para manipular campos
  setValue: (name: keyof T, value: any) => void;
  setError: (name: keyof T, error: string) => void;
  clearError: (name: keyof T) => void;
  resetForm: () => void;
  
  // Métodos de validação
  validateField: (name: keyof T) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  
  // Método de submissão
  handleSubmit: (e?: React.FormEvent) => void;
  
  // Handlers para campos
  getFieldProps: (name: keyof T) => {
    name: string;
    value: any;
    onChange: (value: any) => void;
    onBlur: () => void;
    error?: string;
    required: boolean;
  };
  
  // Método para obter estado de validação de um campo
  getFieldValidationState: (name: keyof T) => FieldValidationState;
}

// Contexto do FormProvider
export interface FormProviderContextValue {
  formId: string;
  validationConfig: ValidationConfig;
  globalErrors: string[];
  addGlobalError: (error: string) => void;
  removeGlobalError: (error: string) => void;
  clearGlobalErrors: () => void;
}

// Props do FormProvider
export interface FormProviderProps {
  children: React.ReactNode;
  formId?: string;
  validationConfig?: ValidationConfig;
  onGlobalError?: (errors: string[]) => void;
}

// ==========================================
// TIPOS PARA DIFERENTES FORMULÁRIOS
// ==========================================

// Formulário de cadastro de usuário
export type UserRegistrationFormData = z.infer<typeof userRegistrationSchema>;

// Formulário de perfil de usuário  
export type UserProfileFormData = z.infer<typeof userProfileSchema>;

// Formulário de contato
export type ContactFormData = z.infer<typeof contactSchema>;

// Formulário de login
export type LoginFormData = z.infer<typeof loginSchema>;

// Formulário de endereço
export type AddressFormData = z.infer<typeof addressSchema>;

// ==========================================
// TIPOS PARA INTEGRAÇÃO COM API
// ==========================================

// Resposta da API para submissão de formulário
export interface FormSubmissionResponse<T = any> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
  message?: string;
}

// Estado de submissão async
export interface AsyncSubmissionState {
  isLoading: boolean;
  error?: string;
  success?: boolean;
  retryCount: number;
  lastSubmissionTime?: Date;
}

// Configuração para retry automático
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
}

// ==========================================
// UTILITÁRIOS DE TIPO
// ==========================================

// Extrai os nomes dos campos de um schema
export type FormFieldNames<T extends z.ZodSchema> = keyof z.infer<T>;

// Torna todos os campos opcionais (para partial updates)
export type PartialFormData<T> = Partial<T>;

// Torna todos os campos obrigatórios (para validação completa)
export type RequiredFormData<T> = Required<T>;

// Tipo para mensagens de erro customizadas por campo
export type FieldErrorMessages<T> = {
  [K in keyof T]?: string;
};