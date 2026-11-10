# Component Naming Rules

## 🏷️ File Naming Conventions

### Components
- **UI Components**: PascalCase files in `src/components/ui/`
  - ✅ `Button.tsx`, `Alert.tsx`, `Dialog.tsx`
  - ❌ `button.tsx`, `alert-component.tsx`, `dialog_component.tsx`

- **Feature Components**: PascalCase with descriptive names
  - ✅ `UserProfile.tsx`, `ChartContainer.tsx`, `DataTable.tsx`
  - ❌ `profile.tsx`, `chart.tsx`, `table.tsx`

- **Layout Components**: PascalCase in appropriate directories
  - ✅ `Header.tsx`, `Sidebar.tsx`, `Footer.tsx`
  - ❌ `header.tsx`, `side-bar.tsx`, `page-footer.tsx`

### Pages
- **App Router Pages**: Always `page.tsx` in kebab-case directories
  - ✅ `app/[locale]/sign-in/page.tsx`
  - ✅ `app/[locale]/form-elements/page.tsx`
  - ❌ `app/[locale]/signIn/page.tsx`
  - ❌ `app/[locale]/FormElements/page.tsx`

- **Route Groups**: Use parentheses for organization
  - ✅ `app/[locale]/(home)/page.tsx`
  - ✅ `app/[locale]/(auth)/sign-in/page.tsx`

### Hooks
- **Custom Hooks**: camelCase with `use` prefix
  - ✅ `useLocalStorage.ts`, `useApiClient.ts`, `useFormValidation.ts`
  - ❌ `LocalStorage.ts`, `UseApiClient.ts`, `form-validation.ts`

### Utilities
- **Utility Functions**: camelCase descriptive names
  - ✅ `formatDate.ts`, `apiClient.ts`, `validationHelpers.ts`
  - ❌ `format-date.ts`, `ApiClient.ts`, `validation_helpers.ts`

### Types
- **Type Definitions**: PascalCase with descriptive names
  - ✅ `UserData.ts`, `ApiResponse.ts`, `ComponentProps.ts`
  - ❌ `user-data.ts`, `api_response.ts`, `componentProps.ts`

## 🎯 Component Naming Standards

### UI Component Pattern
All UI components must follow this exact pattern:

```typescript
// File: src/components/ui/ComponentName.tsx
export interface ComponentNameProps {
  // Props definition
}

function ComponentName(props: ComponentNameProps) {
  // Component implementation
}

export { ComponentName };
```

### Component Export Rules
- **Named exports**: Always use named exports for components
- **Interface exports**: Export component props interfaces
- **Variants exports**: Export CVA variants when applicable

```typescript
// ✅ Good - Named exports
export { Button, type ButtonProps, buttonVariants };

// ❌ Bad - Default exports for components
export default Button;
```

### Component Directory Structure
```
src/components/ui/
├── Button.tsx              # Simple component
├── alert/                  # Complex component with subcomponents
│   ├── Alert.tsx          # Main component
│   ├── AlertHeader.tsx    # Subcomponent
│   ├── AlertContent.tsx   # Subcomponent
│   ├── icons.tsx          # Related icons
│   └── index.tsx          # Barrel export
```

## 🔤 Naming Patterns by Context

### Props and Variables
- **Component Props**: camelCase, descriptive
  - ✅ `variant`, `isLoading`, `onSubmit`, `showHeader`
  - ❌ `type`, `loading`, `submit`, `header`

- **Event Handlers**: Start with `handle` or `on`
  - ✅ `handleClick`, `onSubmit`, `handleUserSelect`
  - ❌ `click`, `submit`, `userSelect`

- **State Variables**: Descriptive, often paired with setter
  - ✅ `[isOpen, setIsOpen]`, `[userData, setUserData]`
  - ❌ `[open, setOpen]`, `[data, setData]`

### CSS Classes and IDs
- **Tailwind Classes**: Use utility classes, no custom classes unless necessary
- **CSS Variables**: kebab-case with semantic names
  - ✅ `--primary-color`, `--background-subtle`
  - ❌ `--color1`, `--bg`

### Constants
- **Global Constants**: SCREAMING_SNAKE_CASE
  - ✅ `API_ENDPOINTS`, `DEFAULT_THEME`, `MAX_FILE_SIZE`
  - ❌ `apiEndpoints`, `defaultTheme`, `maxFileSize`

- **Component Constants**: SCREAMING_SNAKE_CASE within component scope
  - ✅ `const ANIMATION_DURATION = 300;`
  - ❌ `const animationDuration = 300;`

## 📁 Directory Organization Rules

### Component Grouping
```
src/components/
├── ui/                     # Base UI components (Button, Alert, etc.)
├── Layouts/               # Layout components (Header, Sidebar, Footer)
├── Charts/                # Chart-related components
├── Tables/                # Table components
├── FormElements/          # Form components
└── [FeatureName]/         # Feature-specific components
```

### Feature Components
- Group related components by feature
- Use PascalCase for feature directory names
- Include index.tsx for barrel exports

```
src/components/UserManagement/
├── UserList.tsx
├── UserCard.tsx
├── UserActions.tsx
└── index.tsx              # Export all components
```

## 🚫 Common Naming Mistakes to Avoid

### File Names
- ❌ `button.tsx` → ✅ `Button.tsx`
- ❌ `user-profile.tsx` → ✅ `UserProfile.tsx`
- ❌ `API_CLIENT.ts` → ✅ `apiClient.ts`
- ❌ `use_local_storage.ts` → ✅ `useLocalStorage.ts`

### Component Names
- ❌ `userCard` → ✅ `UserCard`
- ❌ `DATA_TABLE` → ✅ `DataTable`
- ❌ `button-component` → ✅ `Button`

### Props
- ❌ `disabled` (boolean without is/has prefix) → ✅ `isDisabled`
- ❌ `variant_type` → ✅ `variant`
- ❌ `onclick` → ✅ `onClick`

### Directories
- ❌ `src/components/form_elements/` → ✅ `src/components/FormElements/`
- ❌ `src/hooks/use-hooks/` → ✅ `src/hooks/`
- ❌ `src/utils/helper_functions/` → ✅ `src/utils/`

## 🎨 Variant and Size Naming

### Variant Names
Use semantic, descriptive names for component variants:

```typescript
// ✅ Good - Semantic variant names
variant: {
  default: "...",
  primary: "...",
  secondary: "...",
  destructive: "...",
  outline: "...",
  ghost: "...",
}

// ❌ Bad - Non-descriptive names
variant: {
  type1: "...",
  blue: "...",
  big: "...",
}
```

### Size Names
Use consistent size naming across all components:

```typescript
// ✅ Good - Consistent size names
size: {
  xs: "...",     // Extra small
  sm: "...",     // Small
  md: "...",     // Medium (default)
  lg: "...",     // Large
  xl: "...",     // Extra large
}
```

## 📋 Naming Checklist

Before creating or modifying components, ensure:

### ✅ File Structure
- [ ] Component files use PascalCase
- [ ] Page files are named `page.tsx` in kebab-case directories
- [ ] Hook files use camelCase with `use` prefix
- [ ] Utility files use camelCase

### ✅ Component Implementation
- [ ] Component name matches file name
- [ ] Props interface follows `ComponentNameProps` pattern
- [ ] Named exports are used (not default exports)
- [ ] Variants use semantic names

### ✅ Code Style
- [ ] Variables use camelCase
- [ ] Constants use SCREAMING_SNAKE_CASE
- [ ] Event handlers start with `handle` or `on`
- [ ] Boolean props use `is`, `has`, `should` prefixes

### ✅ Directory Organization
- [ ] Components are in appropriate directories
- [ ] Related components are grouped together
- [ ] Complex components have their own subdirectory
- [ ] Index files are used for barrel exports when needed

### ✅ Security Considerations
- [ ] No sensitive data in component names or props
- [ ] File names don't reveal internal implementation details
- [ ] No exposed API endpoints in naming patterns
- [ ] Component props are properly typed for security
- [ ] No hardcoded credentials or tokens in naming

## 🔍 Enforcement

These naming conventions are enforced through:
- **ESLint rules**: Automatic linting for naming patterns
- **TypeScript compiler**: Type checking for proper interfaces
- **Code reviews**: Manual verification of naming standards
- **Documentation**: This file serves as the reference guide

**Remember**: Consistent naming makes the codebase more maintainable, searchable, and easier for new developers to understand.