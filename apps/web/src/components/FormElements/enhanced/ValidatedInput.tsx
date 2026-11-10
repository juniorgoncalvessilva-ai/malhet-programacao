"use client";

import { cn } from "@/lib/utils";
import { type HTMLInputTypeAttribute, useId, forwardRef } from "react";
import { ValidatedInputProps, FieldValidationState } from "@/types/form-types";

// Ícones para feedback visual
const CheckIcon = () => (
  <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ExclamationIcon = () => (
  <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.768 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="h-5 w-5 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4m8-8h-4M6 12H2m15.364-6.364l-2.828 2.828M9.464 15.536l-2.828 2.828m0-12.728l2.828 2.828m8.486 8.486l-2.828-2.828" />
  </svg>
);

export interface ValidatedInputComponentProps extends Omit<ValidatedInputProps, 'onValidationChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  isValidating?: boolean;
  validationState?: FieldValidationState;
  fileStyleVariant?: "style1" | "style2";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  height?: "sm" | "default";
  showValidationIcon?: boolean;
  showValidationStates?: boolean;
  helpText?: string;
  onValidationChange?: (state: FieldValidationState) => void;
}

const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputComponentProps>(({
  className,
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  value,
  defaultValue,
  onChange,
  onBlur,
  error,
  isValidating = false,
  validationState,
  fileStyleVariant = "style1",
  icon,
  iconPosition = "right",
  height = "default",
  showValidationIcon = true,
  showValidationStates = true,
  helpText,
  maxLength,
  minLength,
  pattern,
  autoComplete,
  onValidationChange,
  ...props
}, ref) => {
  const id = useId();
  
  // Determinar estado visual baseado na validação
  const hasError = !!error;
  const isValid = validationState?.isValid && validationState?.isTouched && !hasError;
  const isDirty = validationState?.isDirty;
  const isTouched = validationState?.isTouched;

  // Handler para mudanças
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    
    // Notificar mudança de estado de validação
    if (onValidationChange && validationState) {
      onValidationChange({
        ...validationState,
        isDirty: true
      });
    }
  };

  // Handler para blur
  const handleBlur = () => {
    onBlur?.();
    
    // Notificar que o campo foi tocado
    if (onValidationChange && validationState) {
      onValidationChange({
        ...validationState,
        isTouched: true
      });
    }
  };

  // Determinar qual ícone de validação mostrar
  const getValidationIcon = () => {
    if (!showValidationIcon) return null;
    
    if (isValidating) return <LoadingIcon />;
    if (hasError && isTouched) return <ExclamationIcon />;
    if (isValid) return <CheckIcon />;
    
    return null;
  };

  // Classes CSS baseadas no estado de validação
  const getInputClasses = () => {
    const baseClasses = cn(
      "w-full rounded-lg border-[1.5px] border-stroke bg-transparent outline-none transition focus:border-primary disabled:cursor-default disabled:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary dark:disabled:bg-dark",
      type === "file"
        ? getFileStyles(fileStyleVariant)
        : "px-5.5 py-3 text-dark placeholder:text-dark-6 dark:text-white",
      iconPosition === "left" && "pl-12.5",
      (iconPosition === "right" && (icon || showValidationIcon)) && "pr-12.5",
      height === "sm" && "py-2.5"
    );

    // Estados de validação
    if (showValidationStates && isTouched) {
      if (hasError) {
        return cn(baseClasses, "border-red-500 focus:border-red-500 ring-red-500/20 focus:ring-2");
      }
      if (isValid) {
        return cn(baseClasses, "border-green-500 focus:border-green-500 ring-green-500/20 focus:ring-2");
      }
    }

    return baseClasses;
  };

  const getLabelClasses = () => {
    const baseClasses = "text-body-sm font-medium text-dark dark:text-white";
    
    if (showValidationStates && isTouched) {
      if (hasError) return cn(baseClasses, "text-red-600 dark:text-red-400");
      if (isValid) return cn(baseClasses, "text-green-600 dark:text-green-400");
    }
    
    return baseClasses;
  };

  const validationIcon = getValidationIcon();

  return (
    <div className={className}>
      {/* Label */}
      <label
        htmlFor={id}
        className={getLabelClasses()}
      >
        {label}
        {required && <span className="ml-1 select-none text-red">*</span>}
        {showValidationStates && isDirty && !isTouched && (
          <span className="ml-1 text-xs text-gray-500">(modificado)</span>
        )}
      </label>

      {/* Input Container */}
      <div
        className={cn(
          "relative mt-3",
          "[&_svg]:absolute [&_svg]:top-1/2 [&_svg]:-translate-y-1/2",
          iconPosition === "left" ? "[&_svg]:left-4.5" : "[&_svg]:right-4.5"
        )}
      >
        <input
          ref={ref}
          id={id}
          type={type}
          name={name}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          value={value}
          defaultValue={defaultValue}
          className={getInputClasses()}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          autoComplete={autoComplete}
          aria-invalid={hasError}
          aria-describedby={cn(
            error && `${id}-error`,
            helpText && `${id}-help`
          )}
          data-testid={`validated-input-${name}`}
          {...props}
        />

        {/* Ícone customizado ou de validação */}
        {iconPosition === "left" && icon}
        {iconPosition === "right" && (validationIcon || icon)}
      </div>

      {/* Texto de ajuda */}
      {helpText && !error && (
        <p 
          id={`${id}-help`}
          className="mt-2 text-xs text-gray-600 dark:text-gray-400"
        >
          {helpText}
        </p>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="mt-2 flex items-center gap-2">
          <ExclamationIcon />
          <p 
            id={`${id}-error`}
            className="text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        </div>
      )}

      {/* Estados de validação em tempo real (apenas para debug/desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && showValidationStates && validationState && (
        <div className="mt-1 text-xs text-gray-500">
          <span>Estado: </span>
          {isValid && <span className="text-green-600">✓ Válido</span>}
          {hasError && <span className="text-red-600">✗ Erro</span>}
          {isValidating && <span className="text-blue-600">⏳ Validando</span>}
          {isDirty && <span className="ml-2">📝 Modificado</span>}
          {isTouched && <span className="ml-2">👆 Tocado</span>}
        </div>
      )}
    </div>
  );
});

ValidatedInput.displayName = "ValidatedInput";

export default ValidatedInput;

// Função auxiliar para estilos de file input (reutilizada do componente original)
function getFileStyles(variant: "style1" | "style2") {
  switch (variant) {
    case "style1":
      return `file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-[#E2E8F0] file:px-6.5 file:py-[13px] file:text-body-sm file:font-medium file:text-dark-5 file:hover:bg-primary file:hover:bg-opacity-10 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white`;
    default:
      return `file:mr-4 file:rounded file:border-[0.5px] file:border-stroke file:bg-stroke file:px-2.5 file:py-1 file:text-body-xs file:font-medium file:text-dark-5 file:focus:border-primary dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white px-3 py-[9px]`;
  }
}