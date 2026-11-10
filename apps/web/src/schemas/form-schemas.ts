import { z } from "zod";
import { PATTERNS, LIMITS } from "@/config";

// ==========================================
// VALIDAÇÕES CUSTOMIZADAS BRASILEIRAS
// ==========================================

// Validação de CPF
export const cpfRegex = PATTERNS.CPF;
export const cpfValidation = z.string()
  .regex(cpfRegex, "CPF deve estar no formato 000.000.000-00")
  .refine((cpf) => {
    // Remove formatação
    const cleanCpf = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (cleanCpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
    
    // Validação dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf[i]) * (10 - i);
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(cleanCpf[9]) !== digit1) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf[i]) * (11 - i);
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(cleanCpf[10]) === digit2;
  }, "CPF inválido");

// Validação de CNPJ
export const cnpjRegex = PATTERNS.CNPJ;
export const cnpjValidation = z.string()
  .regex(cnpjRegex, "CNPJ deve estar no formato 00.000.000/0000-00")
  .refine((cnpj) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;
    
    // Validação do primeiro dígito
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanCnpj[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(cleanCnpj[12]) !== digit1) return false;
    
    // Validação do segundo dígito
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleanCnpj[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(cleanCnpj[13]) === digit2;
  }, "CNPJ inválido");

// Validação de CEP
export const cepRegex = PATTERNS.CEP;
export const cepValidation = z.string()
  .regex(cepRegex, "CEP deve estar no formato 00000-000");

// Validação de telefone brasileiro
export const phoneRegex = PATTERNS.PHONE;
export const phoneValidation = z.string()
  .regex(phoneRegex, "Telefone deve estar no formato (00) 00000-0000");

// ==========================================
// SCHEMAS BÁSICOS
// ==========================================

// Input de texto básico
export const textInputSchema = z.object({
  value: z.string()
    .min(1, "Este campo é obrigatório")
    .max(255, "Máximo de 255 caracteres")
});

// Input de texto com tamanho customizado
export const createTextSchema = (options: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
} = {}) => {
  const {
    required = true,
    minLength = 1,
    maxLength = 255,
  } = options;

  if (required) {
    return z.string()
      .min(minLength, `Mínimo de ${minLength} caracteres`)
      .max(maxLength, `Máximo de ${maxLength} caracteres`);
  } else {
    return z.string()
      .max(maxLength, `Máximo de ${maxLength} caracteres`)
      .optional();
  }
};

// Email
export const emailSchema = z.object({
  email: z.string()
    .min(1, "Email é obrigatório")
    .email("Email inválido")
    .max(255, "Email muito longo")
});

// Senha
export const passwordSchema = z.object({
  password: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .max(128, "Senha muito longa")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/\d/, "Senha deve conter pelo menos um número")
    .regex(/[^A-Za-z0-9]/, "Senha deve conter pelo menos um caractere especial")
});

// Confirmação de senha
export const passwordConfirmationSchema = z.object({
  password: passwordSchema.shape.password,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"]
});

// Data de nascimento
export const birthDateSchema = z.object({
  birthDate: z.date({
    required_error: "Data de nascimento é obrigatória",
    invalid_type_error: "Data inválida"
  })
  .max(new Date(), "Data de nascimento não pode ser futura")
  .refine(
    (date) => {
      const ageDiff = Date.now() - date.getTime();
      const ageDate = new Date(ageDiff);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return age >= 13;
    },
    "Idade mínima de 13 anos"
  )
});

// Checkbox de aceite de termos
export const termsSchema = z.object({
  acceptTerms: z.boolean().refine(val => val === true, {
    message: "Você deve aceitar os termos de uso"
  })
});

// Select básico
export const selectSchema = z.object({
  value: z.string().min(1, "Selecione uma opção")
});

// Multi-select
export const multiSelectSchema = z.object({
  values: z.array(z.string()).min(1, "Selecione pelo menos uma opção")
});

// Upload de arquivo
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: "Arquivo é obrigatório" })
    .refine((file) => file.size <= 5000000, "Arquivo deve ter no máximo 5MB")
    .refine(
      (file) => ["image/jpeg", "image/png", "image/gif"].includes(file.type),
      "Apenas imagens JPEG, PNG ou GIF são permitidas"
    )
});

// ==========================================
// SCHEMAS COMPOSTOS PARA FORMULÁRIOS
// ==========================================

// Formulário de cadastro de usuário
export const userRegistrationSchema = z.object({
  name: createTextSchema({ minLength: 2, maxLength: 100 }),
  email: emailSchema.shape.email,
  phone: phoneValidation,
  birthDate: birthDateSchema.shape.birthDate,
  acceptTerms: termsSchema.shape.acceptTerms,
  password: passwordSchema.shape.password,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"]
});

// Formulário de perfil de usuário
export const userProfileSchema = z.object({
  name: createTextSchema({ minLength: 2, maxLength: 100 }),
  email: emailSchema.shape.email,
  phone: phoneValidation.optional(),
  bio: createTextSchema({ required: false, maxLength: 500 }),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  location: createTextSchema({ required: false, maxLength: 100 })
});

// Formulário de contato
export const contactSchema = z.object({
  name: createTextSchema({ minLength: 2, maxLength: 100 }),
  email: emailSchema.shape.email,
  subject: createTextSchema({ minLength: 5, maxLength: 200 }),
  message: createTextSchema({ minLength: 10, maxLength: 1000 })
});

// Formulário de login
export const loginSchema = z.object({
  email: emailSchema.shape.email,
  password: z.string().min(1, "Senha é obrigatória"),
  rememberMe: z.boolean().optional()
});

// Formulário de endereço
export const addressSchema = z.object({
  cep: cepValidation,
  street: createTextSchema({ minLength: 5, maxLength: 200 }),
  number: createTextSchema({ minLength: 1, maxLength: 10 }),
  complement: createTextSchema({ required: false, maxLength: 100 }),
  neighborhood: createTextSchema({ minLength: 2, maxLength: 100 }),
  city: createTextSchema({ minLength: 2, maxLength: 100 }),
  state: z.string().length(2, "Estado deve ter 2 caracteres"),
  country: createTextSchema({ minLength: 2, maxLength: 50 })
});

// ==========================================
// TIPOS TYPESCRIPT DERIVADOS
// ==========================================

export type UserRegistrationFormData = z.infer<typeof userRegistrationSchema>;
export type UserProfileFormData = z.infer<typeof userProfileSchema>;
export type ContactFormData = z.infer<typeof contactSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type AddressFormData = z.infer<typeof addressSchema>;

// Tipos para componentes individuais
export type TextInputData = z.infer<typeof textInputSchema>;
export type EmailData = z.infer<typeof emailSchema>;
export type PasswordData = z.infer<typeof passwordSchema>;
export type BirthDateData = z.infer<typeof birthDateSchema>;
export type TermsData = z.infer<typeof termsSchema>;
export type SelectData = z.infer<typeof selectSchema>;
export type MultiSelectData = z.infer<typeof multiSelectSchema>;
export type FileUploadData = z.infer<typeof fileUploadSchema>;