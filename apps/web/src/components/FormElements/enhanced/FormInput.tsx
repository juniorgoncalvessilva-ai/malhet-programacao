"use client";

import { forwardRef } from "react";
import ValidatedInput, { ValidatedInputComponentProps } from "./ValidatedInput";
import { UseFormValidationReturn } from "@/types/form-types";

interface FormInputProps extends Omit<ValidatedInputComponentProps, 'value' | 'onChange' | 'onBlur' | 'error' | 'validationState'> {
  name: string;
  formContext: UseFormValidationReturn<any>;
}

/**
 * Componente wrapper que conecta automaticamente o ValidatedInput 
 * com o contexto do useFormValidation hook
 */
const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({
  name,
  formContext,
  ...props
}, ref) => {
  const fieldProps = formContext.getFieldProps(name);
  const validationState = formContext.getFieldValidationState(name);

  return (
    <ValidatedInput
      ref={ref}
      name={name}
      value={fieldProps.value || ''}
      onChange={fieldProps.onChange}
      onBlur={fieldProps.onBlur}
      error={fieldProps.error}
      validationState={validationState}
      required={fieldProps.required}
      {...props}
    />
  );
});

FormInput.displayName = "FormInput";

export default FormInput;