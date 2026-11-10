# 🔍 Code Review Guide - Compliance Verification

## Context
This guide is for conducting code reviews on local changes that haven't been pushed to the remote repository (origin) yet. The goal is to ensure that all new or modified code complies with the established documentation and standards of the project.

## 📋 Review Checklist

### 1. Check Local Changes

```bash
# See all uncommitted changes
git status

# See diff of staged changes
git diff --cached

# See diff of all changes (staged + unstaged)
git diff HEAD

# See only modified files that aren't in remote
git diff origin/main --name-only

# See complete diff against remote
git diff origin/main
```

### 2. Structure and Organization

#### ✅ Check folder structure (`/docs/01-getting-started/estrutura-geral.md`)
- [ ] New files are in correct folders according to documentation
- [ ] Components in `/src/components/`
- [ ] Hooks in `/src/hooks/`
- [ ] Stores in `/src/store/`
- [ ] Pages in `/src/app/[locale]/`
- [ ] Utils in `/src/lib/` or `/src/utils/`

#### ✅ File naming
- [ ] Components: PascalCase (e.g., `UserProfile.tsx`)
- [ ] Hooks: camelCase starting with 'use' (e.g., `useUserData.ts`)
- [ ] Stores: kebab-case with '-store' suffix (e.g., `user-store.ts`)
- [ ] Pages: kebab-case (e.g., `user-profile/page.tsx`)

### 3. React Components

#### ✅ Component patterns (`/docs/02-components/`)
- [ ] Uses TypeScript with explicit types for props
- [ ] Exports prop types when reusable
- [ ] Components are functional (not classes)
- [ ] Props destructured in function parameter
- [ ] Uses `"use client"` only when necessary
- [ ] Imports organized (React first, then external, then internal)

```typescript
// ✅ Correct example
interface UserCardProps {
  userId: string;
  showEmail?: boolean;
  onEdit?: () => void;
}

export function UserCard({ userId, showEmail = true, onEdit }: UserCardProps) {
  // ...
}
```

### 4. State Management

#### ✅ Zustand usage (`/docs/04-architecture/state-management.md`)
- [ ] Global state used only when necessary (see documentation)
- [ ] Uses individual hooks instead of object selectors
- [ ] Avoids creating new objects in selectors
- [ ] Actions used instead of direct setState
- [ ] Stores organized by domain (ui, app, auth, locale)

```typescript
// ✅ Correct
const theme = useTheme();
const setTheme = useSetTheme();

// ❌ Avoid
const { theme, setTheme } = useUIStore(state => ({
  theme: state.theme,
  setTheme: state.setTheme
}));
```

### 5. Forms and Validation

#### ✅ Validation system (`/docs/05-features/form-validation.md`)
- [ ] Uses Zod for validation schemas
- [ ] Integrated with React Hook Form
- [ ] `useFormValidation` hook for complex forms
- [ ] Brazilian validations using correct utils (CPF, CNPJ, CEP)
- [ ] Consistent visual error feedback

```typescript
// ✅ Zod schema example
const schema = z.object({
  email: z.string().email('Invalid email'),
  cpf: z.string().refine(isValidCPF, 'Invalid CPF'),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'Invalid CEP')
});
```

### 6. Internationalization

#### ✅ i18n with next-intl
- [ ] All user-visible text uses `t()` or `useTranslations`
- [ ] Translation files updated in `/messages/`
- [ ] Namespaces organized by feature/page
- [ ] No hardcoded strings in Portuguese or English

```typescript
// ✅ Correct
const t = useTranslations('UserProfile');
return <h1>{t('title')}</h1>;

// ❌ Avoid
return <h1>User Profile</h1>;
```

### 7. APIs and Endpoints

#### ✅ API patterns (`/docs/03-development/apis-endpoints.md`)
- [ ] Endpoints in `/src/app/api/`
- [ ] Uses Next.js 15.3.3 Route Handlers
- [ ] Authentication with Clerk middleware when needed
- [ ] Standardized error handling
- [ ] Consistent JSON response format

```typescript
// ✅ Response pattern
return NextResponse.json({
  success: true,
  data: result,
  message: 'Operation completed successfully'
});

// ✅ Error pattern
return NextResponse.json({
  success: false,
  error: 'Error message',
  code: 'ERROR_CODE'
}, { status: 400 });
```

### 8. Supabase Integration

#### ✅ Supabase usage (`/docs/03-development/supabase-local.md`)
- [ ] Supabase client created with `useSupabase()` hook
- [ ] Row Level Security (RLS) considered
- [ ] Generated TypeScript types used
- [ ] Supabase error handling

### 9. Styling

#### ✅ Tailwind CSS and components
- [ ] Tailwind classes organized (layout > spacing > visual)
- [ ] Uses `cn()` for conditional classes
- [ ] UI components from `/components/ui/` when available
- [ ] Dark mode supported with `dark:` classes
- [ ] Responsive with mobile-first classes

```typescript
// ✅ Correct cn() usage
<div className={cn(
  "rounded-lg p-4",
  "bg-white dark:bg-gray-800",
  isActive && "border-2 border-primary"
)} />
```

### 10. Performance and Optimization

#### ✅ Best practices
- [ ] Images using `next/image` with defined sizes
- [ ] Lazy loading for heavy components
- [ ] Memoization when appropriate (`useMemo`, `useCallback`)
- [ ] Avoids unnecessary re-renders
- [ ] Bundle size considered (specific imports)

### 11. Testing and Quality

#### ✅ Code quality
- [ ] No `console.log` in production
- [ ] No TODO comments without associated issue
- [ ] No dead or commented code
- [ ] TypeScript without `any` usage (use `unknown` if needed)
- [ ] Edge case handling (null, undefined, empty arrays)

### 12. Security

#### ✅ Security practices
- [ ] No secrets or API keys in code
- [ ] User input validation
- [ ] Data sanitization before rendering
- [ ] CORS properly configured for APIs
- [ ] Authentication verified on protected routes

#### ✅ Input Validation
- [ ] All inputs are validated server-side
- [ ] Client-side validation is for UX only
- [ ] User inputs are sanitized
- [ ] File uploads are validated and secure

#### ✅ Data Protection
- [ ] No sensitive data in logs
- [ ] Passwords are properly hashed
- [ ] Sensitive data is encrypted
- [ ] Environment variables are used for secrets

#### ✅ Error Handling
- [ ] Generic error messages to users
- [ ] Detailed errors logged server-side only
- [ ] No stack traces exposed to client
- [ ] Rate limiting implemented

#### ✅ API Security
- [ ] Request validation implemented
- [ ] Authentication required for protected endpoints

#### ✅ Frontend Security
- [ ] No sensitive data in localStorage
- [ ] User content is sanitized

## 🔍 Review Process

### 1. List modified files
```bash
# See list of changed files
git diff origin/main --name-only

# Save list to file for reference
git diff origin/main --name-only > changed-files.txt
```

### 2. Review each file
For each modified file, check:

1. **Imports and dependencies**
   - Necessary and organized imports
   - No unused imports
   - Correct relative paths

2. **Standards compliance**
   - Follows documentation patterns
   - Consistent with existing similar code
   - Clear and descriptive naming

3. **Functionality**
   - Code does what it should do
   - Edge cases handled
   - Errors handled appropriately

4. **Performance**
   - No unnecessary loops
   - Optimized queries
   - Minimized re-renders

### 3. Run automatic checks

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build to check for errors
npm run build

# Tests (if any)
npm test
```

### 4. Test functionality

1. **Manual testing**
   - Main functionality works
   - Edge cases tested
   - UI responsive and accessible

2. **Test in different states**
   - Authenticated/unauthenticated user
   - Different languages (pt-BR, en)
   - Light/dark mode
   - Different screen sizes

## 📝 Review Template

```markdown
## Code Review - [Branch Name]

### Changed Files
- [ ] `/src/components/NewComponent.tsx`
- [ ] `/src/hooks/useNewHook.ts`
- [ ] `/messages/pt-BR.json`
- [ ] `/messages/en.json`

### General Checklist
- [ ] Code follows structure documentation
- [ ] Global state used appropriately
- [ ] Internationalization implemented
- [ ] No hardcoded strings
- [ ] TypeScript without `any`
- [ ] Adequate error handling

### Tests Performed
- [ ] Functionality tested manually
- [ ] Tested in Portuguese and English
- [ ] Tested in light and dark mode
- [ ] Tested responsiveness
- [ ] Build executed without errors

### Observations
[Add any observations or points of attention]

### Status
- [ ] Approved
- [ ] Needs adjustments
```

## 🚨 Red Flags - Special Attention

1. **Usage of `any` in TypeScript**
2. **Global states for form data**
3. **Hardcoded strings in Portuguese/English**
4. **Console.log left in code**
5. **Imports of non-existent files**
6. **Components without loading/error handling**
7. **APIs without authentication when needed**
8. **Direct `useState` usage when should use Zustand**
9. **Loops without unique key in React lists**
10. **Promises without await or .catch**

## 🔗 References

- Structure: `/docs/01-getting-started/estrutura-geral.md`
- Components: `/docs/02-components/`
- APIs: `/docs/03-development/apis-endpoints.md`
- Global State: `/docs/04-architecture/state-management.md`
- Validation: `/docs/05-features/form-validation.md`
- Configuration: `/docs/03-development/configuracao-central.md`
