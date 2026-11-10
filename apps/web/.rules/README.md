# 🤖 AI Agent Rules and Guidelines

This directory contains comprehensive rules and guidelines for AI agents working on the AI Coders Starter Kit project. These rules ensure consistency, quality, and adherence to project standards.

## 📁 Rules Overview

### [component-naming.md](./component-naming.md)
**Component Naming Conventions**
- File naming patterns for components, pages, hooks, and utilities
- Directory organization standards
- Props and variable naming conventions
- Export patterns and code organization
- Common naming mistakes to avoid

### [code-style.md](./code-style.md)
**Code Style and Standards**
- TypeScript strict typing requirements
- React component architecture patterns
- CVA (Class Variance Authority) implementation
- Styling guidelines with Tailwind CSS
- Error handling and security practices
- Performance optimization patterns

### [project-structure.md](./project-structure.md)
**Project Structure Rules**
- Directory organization principles
- App Router structure with Next.js 15
- Component categorization and grouping
- File organization patterns
- Import/export strategies
- Scalability considerations

### [internationalization.md](./internationalization.md)
**Internationalization Guidelines**
- next-intl implementation patterns
- Translation key organization
- Server vs client component i18n usage
- Locale switching and navigation
- Content quality guidelines
- Translation workflow and testing

### [security.md](./security.md)
**Security Rules and Guidelines**
- Authentication and authorization patterns
- Input validation and sanitization
- Data protection and encryption
- Secure error handling
- File upload security
- API security best practices
- Frontend security measures

## 🎯 Quick Reference

### Component Creation Checklist
- [ ] Use PascalCase for component files (`Button.tsx`)
- [ ] Implement CVA for styling variants
- [ ] Include proper TypeScript interfaces
- [ ] Support dark/light themes
- [ ] Add internationalization support
- [ ] Follow project structure rules
- [ ] Implement proper input validation
- [ ] Check authentication/authorization where needed

### Code Quality Standards
- [ ] No `any` types - use proper TypeScript
- [ ] Use named exports for components
- [ ] Implement proper error handling
- [ ] Follow Tailwind CSS patterns
- [ ] Include responsive design
- [ ] Ensure accessibility compliance
- [ ] Validate all user inputs server-side
- [ ] Use generic error messages for users

### Project Integration
- [ ] Place files in correct directories
- [ ] Use absolute imports (`@/`)
- [ ] Follow established naming conventions
- [ ] Add translations for both languages
- [ ] Update documentation if needed
- [ ] Test in both themes and locales
- [ ] No sensitive data exposed in code or logs
- [ ] Proper authentication checks implemented

## 🚀 Getting Started

1. **Read the main instructions**: Start with `/AGENT.md` for comprehensive overview
2. **Review specific rules**: Read relevant rule files for your task
3. **Follow the patterns**: Use existing components as examples
4. **Check your work**: Use the checklists in each rule file
5. **Test thoroughly**: Ensure everything works in all configurations

## 🔧 Development Workflow

### Before Starting
1. Review the relevant rule files
2. Understand the existing codebase patterns
3. Plan your implementation approach
4. Check for similar existing components

### During Development
1. Follow TypeScript strict typing
2. Use established component patterns
3. Implement proper styling with Tailwind
4. Add internationalization support
5. Test in different themes and locales
6. Implement security measures (validation, auth)
7. Use secure coding practices

### Before Submitting
1. Run through all relevant checklists
2. Verify TypeScript compilation
3. Test responsive design
4. Check accessibility
5. Ensure no hardcoded text remains
6. Review security checklist
7. Verify no sensitive data is exposed

## 🎨 Key Principles

### Consistency
All code should follow established patterns and conventions to maintain a cohesive codebase.

### Type Safety
Use TypeScript to its full potential with strict typing and proper interfaces.

### Internationalization
All user-facing text must be translatable and support both pt-BR and en locales.

### Accessibility
Components must be accessible and work with screen readers and keyboard navigation.

### Performance
Consider performance implications and follow Next.js best practices.

### Maintainability
Write code that is easy to understand, modify, and extend.

### Security
Implement security measures at every level - authentication, authorization, input validation, data protection, and secure error handling.

## 🚨 Critical Requirements

### Absolute Must-Dos
- ✅ **PascalCase components**: All component files must use PascalCase
- ✅ **Translation support**: No hardcoded user-facing text
- ✅ **TypeScript strict**: No `any` types, proper interfaces
- ✅ **Dark mode support**: All components work in both themes
- ✅ **CVA patterns**: Use Class Variance Authority for variants
- ✅ **Responsive design**: Mobile-first approach
- ✅ **Security first**: All inputs validated, authentication checked
- ✅ **Data protection**: No sensitive data in logs or client storage

### Absolute Don'ts
- ❌ **No hardcoded text**: All text must be translatable
- ❌ **No `any` types**: Use proper TypeScript typing
- ❌ **No custom CSS**: Use Tailwind CSS utilities
- ❌ **No default exports**: Use named exports for components
- ❌ **No broken patterns**: Follow established conventions
- ❌ **No accessibility issues**: Ensure proper ARIA and keyboard support
- ❌ **No security vulnerabilities**: Never skip validation or auth checks
- ❌ **No exposed secrets**: No credentials or tokens in code

## 📚 Learning Resources

### Project Documentation
- **[/docs/](../docs/)**: Complete project documentation
- **[/AGENT.md](../AGENT.md)**: Comprehensive AI agent instructions
- **Existing Components**: Study components in `/src/components/ui/`

### External Resources
- **[Next.js 15 Docs](https://nextjs.org/docs)**: App Router and React Server Components
- **[Tailwind CSS](https://tailwindcss.com/docs)**: Utility-first CSS framework
- **[next-intl](https://next-intl-docs.vercel.app/)**: Internationalization for Next.js
- **[CVA Docs](https://cva.style/docs)**: Class Variance Authority

## 🔍 Quality Assurance

### Automated Checks
- TypeScript compilation must pass
- ESLint rules must pass
- All translations must be present
- Components must export properly

### Manual Verification
- Test in both light and dark themes
- Verify responsive design works
- Check keyboard navigation
- Test with screen readers
- Validate in both locales (pt-BR, en)
- Verify security measures are working
- Test with invalid/malicious inputs

## 🆘 Getting Help

### When You're Stuck
1. **Review existing components**: Look for similar patterns
2. **Check the documentation**: Refer to `/docs/` directory
3. **Follow the examples**: Use the patterns shown in rule files
4. **Start simple**: Build basic version first, then add complexity

### Common Issues
- **Import errors**: Use absolute imports with `@/` prefix
- **Styling issues**: Follow Tailwind CSS patterns, avoid custom CSS
- **Translation errors**: Ensure keys exist in both language files
- **Type errors**: Use proper interfaces, avoid `any` types
- **Security errors**: Always validate inputs server-side, check authentication
- **Data exposure**: Never log sensitive data, use generic error messages

## 📈 Success Metrics

Your work is successful when:
- ✅ All TypeScript compilation passes without errors
- ✅ Components work seamlessly in both themes
- ✅ All text is properly internationalized
- ✅ Responsive design works on all screen sizes
- ✅ Code follows established patterns consistently
- ✅ No accessibility issues exist
- ✅ Performance is optimized
- ✅ Security measures are properly implemented
- ✅ No sensitive data is exposed or logged

---

**Remember**: These rules exist to ensure high-quality, maintainable code that provides an excellent user experience. Following them carefully will result in professional-grade contributions to the project.