# 📝 Frontend Form Implementation Guide

## Context
You are creating a form for the AI Coders Starter Kit project using:
- React Hook Form for form management
- Zod for validation
- TypeScript for type safety
- Existing form components
- Internationalization support

## Project Structure Reference
- Form components: `/src/components/Forms/`
- Form controls: `/src/components/FormElements/`
- Validation schemas: Create alongside component
- API endpoints: `/src/app/api/`

## Implementation Requirements

### 1. Basic Form Template
```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

// Define schema
const FormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  // Add more fields
});

type FormData = z.infer<typeof FormSchema>;

export function ContactForm() {
  const t = useTranslations("ContactForm");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema)
  });
  
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error();
      
      toast.success(t("success"));
      reset();
    } catch (error) {
      toast.error(t("error"));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Form fields */}
    </form>
  );
}
```

### 2. Form Input Components
```typescript
// Text Input
<div>
  <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
    {t("name")}
    <span className="text-red">*</span>
  </label>
  <input
    {...register("name")}
    type="text"
    placeholder={t("namePlaceholder")}
    className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition placeholder:text-dark-6 focus:border-primary active:border-primary disabled:cursor-default dark:border-dark-3 dark:bg-dark-2 dark:text-white"
  />
  {errors.name && (
    <span className="mt-1 text-sm text-red">{errors.name.message}</span>
  )}
</div>

// Select Input
<div>
  <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
    {t("category")}
  </label>
  <select
    {...register("category")}
    className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
  >
    <option value="">{t("selectCategory")}</option>
    <option value="general">{t("general")}</option>
    <option value="support">{t("support")}</option>
  </select>
</div>

// Textarea
<div>
  <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
    {t("message")}
  </label>
  <textarea
    {...register("message")}
    rows={6}
    placeholder={t("messagePlaceholder")}
    className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition placeholder:text-dark-6 focus:border-primary active:border-primary disabled:cursor-default dark:border-dark-3 dark:bg-dark-2 dark:text-white"
  />
</div>
```

### 3. Advanced Form Controls
```typescript
// Checkbox
<div className="flex items-center">
  <input
    {...register("terms")}
    type="checkbox"
    id="terms"
    className="h-5 w-5 text-primary"
  />
  <label htmlFor="terms" className="ml-2 text-body-sm">
    {t("acceptTerms")}
  </label>
</div>

// Radio Buttons
<div className="space-y-2">
  {["option1", "option2", "option3"].map((option) => (
    <label key={option} className="flex items-center">
      <input
        {...register("radioOption")}
        type="radio"
        value={option}
        className="mr-2"
      />
      {t(option)}
    </label>
  ))}
</div>

// File Upload
<div>
  <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
    {t("fileUpload")}
  </label>
  <input
    {...register("file")}
    type="file"
    className="w-full cursor-pointer rounded-[7px] border-[1.5px] border-stroke bg-transparent outline-none transition file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-[#E2E8F0] file:px-6.5 file:py-[13px] file:text-body-sm file:font-medium file:text-dark-5 file:hover:bg-primary file:hover:bg-opacity-10 focus:border-primary active:border-primary disabled:cursor-default disabled:bg-dark dark:border-dark-3 dark:bg-dark-2 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white"
  />
</div>
```

### 4. Submit Button
```typescript
<button
  type="submit"
  disabled={isSubmitting}
  className="flex w-full justify-center rounded-[7px] bg-primary p-[13px] font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
>
  {isSubmitting ? (
    <div className="flex items-center">
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {t("submitting")}
    </div>
  ) : (
    t("submit")
  )}
</button>
```

### 5. Complex Validation
```typescript
const ComplexSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Conditional validation
const ConditionalSchema = z.object({
  hasPhone: z.boolean(),
  phone: z.string().optional(),
}).refine((data) => {
  if (data.hasPhone && !data.phone) {
    return false;
  }
  return true;
}, {
  message: "Phone is required when hasPhone is true",
  path: ["phone"],
});
```

### 6. Dynamic Forms
```typescript
import { useFieldArray } from "react-hook-form";

// For dynamic field arrays
const { fields, append, remove } = useFieldArray({
  control,
  name: "items"
});

// In JSX
{fields.map((field, index) => (
  <div key={field.id}>
    <input {...register(`items.${index}.name`)} />
    <button type="button" onClick={() => remove(index)}>
      Remove
    </button>
  </div>
))}
<button type="button" onClick={() => append({ name: "" })}>
  Add Item
</button>
```

### 7. Form State Management
```typescript
// Watch specific fields
const watchedField = watch("fieldName");

// Get form state
const { isDirty, isValid, isSubmitting } = formState;

// Set values programmatically
setValue("fieldName", "value");

// Trigger validation
trigger("fieldName");
```

## Available Form Components
- `/src/components/FormElements/InputGroup/`
- `/src/components/FormElements/SelectGroup/`
- `/src/components/FormElements/Checkbox/`
- `/src/components/Forms/DatePicker/`
- `/src/components/Forms/MultiSelect/`

## Documentation References
- Form validation: `/docs/05-features/validacao-formularios.md`
- API endpoints: `/docs/03-development/apis-endpoints.md`
- Components: `/docs/04-components/componentes.md`

## Testing Checklist
- [ ] All fields have proper validation
- [ ] Error messages display correctly
- [ ] Form submits successfully
- [ ] Loading state during submission
- [ ] Success/error feedback to user
- [ ] Form resets after submission
- [ ] Accessibility (labels, ARIA)
- [ ] Works on mobile devices
- [ ] Translations working

## Example Forms to Reference
- `/src/components/Forms/ContactForm.tsx`
- `/src/app/[locale]/forms/form-elements/page.tsx`
- `/src/app/[locale]/forms/form-layout/page.tsx`