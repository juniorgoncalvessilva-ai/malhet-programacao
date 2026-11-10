// Re-export all schemas and types
export * from './form-schemas';

// Convenience exports for commonly used schemas
export {
  userRegistrationSchema,
  userProfileSchema,
  contactSchema,
  loginSchema,
  addressSchema,
  emailSchema,
  passwordSchema,
  createTextSchema,
  cpfValidation,
  cnpjValidation,
  cepValidation,
  phoneValidation
} from './form-schemas';

// Type exports
export type {
  UserRegistrationFormData,
  UserProfileFormData,
  ContactFormData,
  LoginFormData,
  AddressFormData,
  TextInputData,
  EmailData,
  PasswordData
} from './form-schemas';