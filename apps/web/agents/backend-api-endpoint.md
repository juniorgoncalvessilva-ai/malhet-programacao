# 🔌 Backend API Endpoint Implementation Guide

## Context
You are working on the AI Coders Starter Kit project, a Next.js 15.3.3 application with:
- App Router architecture
- Clerk authentication
- Supabase integration
- TypeScript
- Zod validation

## Project Structure Reference
- API routes location: `/src/app/api/`
- Protected routes: `/src/app/api/protected/`
- Middleware: `/src/middleware.ts`
- Supabase client: `/src/lib/supabase/`
- Types: `/src/types/`

## Implementation Requirements

### 1. File Location
- Public endpoints: `/src/app/api/[endpoint-name]/route.ts`
- Protected endpoints: `/src/app/api/protected/[endpoint-name]/route.ts`

### 2. Authentication Pattern
```typescript
// For protected endpoints
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // ... rest of implementation
}
```

### 3. Supabase Integration
```typescript
import { createServerClient } from '@/lib/supabase/server';

const supabase = await createServerClient();
// Use supabase client with automatic Clerk JWT token
```

### 4. Request Validation
```typescript
import { z } from 'zod';

const RequestSchema = z.object({
  field: z.string().min(1),
  // ... other fields
});

const validationResult = RequestSchema.safeParse(body);
if (!validationResult.success) {
  return NextResponse.json(
    { error: 'Invalid data', details: validationResult.error.errors },
    { status: 400 }
  );
}
```

### 5. Error Handling
- Always use try-catch blocks
- Return consistent error responses
- Log errors for debugging
- Use appropriate HTTP status codes

### 6. Response Format
```typescript
// Success
return NextResponse.json({
  success: true,
  data: result,
  message: 'Operation successful'
});

// Error
return NextResponse.json({
  error: 'Error message',
  details: additionalInfo // optional
}, { status: errorCode });
```

### 7. HTTP Methods
Implement only needed methods:
- GET: Retrieve data
- POST: Create new resource
- PUT/PATCH: Update resource
- DELETE: Remove resource

### 8. CORS and Headers
Handled automatically by middleware, but can add custom headers:
```typescript
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'no-store',
  }
});
```

## Documentation References
- API creation: `/docs/03-development/apis-endpoints.md`
- API examples: `/docs/03-development/api-examples.md`
- Authentication: `/docs/05-features/autenticacao.md`
- Supabase: `/docs/05-features/supabase-integration.md`

## Testing Checklist
- [ ] Test with and without authentication
- [ ] Validate all input scenarios
- [ ] Check error responses
- [ ] Verify Supabase queries work
- [ ] Test with curl or API client
- [ ] Check TypeScript types

## Example Implementation Pattern
Follow examples in:
- `/src/app/api/protected/user-profile/route.ts`
- `/src/app/api/protected/supabase-posts/route.ts`
- `/src/app/api/public/contact/route.ts`