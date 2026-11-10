# 🗄️ Backend Database Integration Guide

## Context
You are implementing database operations for the AI Coders Starter Kit using:
- Supabase as the database (PostgreSQL)
- Clerk JWT tokens for authentication
- Row Level Security (RLS) policies
- TypeScript for type safety
- Both local and production environments

## Project Structure Reference
- Supabase client: `/src/lib/supabase/`
- Database types: `/src/lib/supabase/types.ts`
- Migrations: `/migrations/`
- API routes: `/src/app/api/`

## Implementation Requirements

### 1. Database Client Setup
```typescript
// Server-side (API routes, server components)
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerClient();
  // Client is automatically configured with Clerk JWT
}

// Client-side (components with "use client")
import { useSupabase } from '@/hooks/useSupabase';

function Component() {
  const supabase = useSupabase();
  // Client is automatically configured with Clerk JWT
}
```

### 2. Creating Tables (Migration)
```sql
-- /migrations/00X_create_tablename.sql
CREATE TABLE IF NOT EXISTS public.tablename (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Clerk user ID
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tablename ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own data" ON public.tablename
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own data" ON public.tablename
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own data" ON public.tablename
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can delete own data" ON public.tablename
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- Create indexes
CREATE INDEX idx_tablename_user_id ON public.tablename(user_id);
CREATE INDEX idx_tablename_created_at ON public.tablename(created_at DESC);

-- Add update trigger
CREATE TRIGGER update_tablename_updated_at BEFORE UPDATE ON public.tablename
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. TypeScript Types
```typescript
// Add to /src/lib/supabase/types.ts
export interface Database {
  public: {
    Tables: {
      tablename: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string | null
          status: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content?: string | null
          status?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          status?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
```

### 4. CRUD Operations
```typescript
// CREATE
const { data, error } = await supabase
  .from('tablename')
  .insert({
    user_id: userId, // From Clerk auth
    title: 'Example',
    content: 'Content here'
  })
  .select()
  .single();

// READ - Single record
const { data, error } = await supabase
  .from('tablename')
  .select('*')
  .eq('id', recordId)
  .single();

// READ - Multiple with filters
const { data, error, count } = await supabase
  .from('tablename')
  .select('*', { count: 'exact' })
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .range(0, 9); // Pagination

// UPDATE
const { data, error } = await supabase
  .from('tablename')
  .update({ title: 'Updated Title' })
  .eq('id', recordId)
  .eq('user_id', userId) // Extra security
  .select()
  .single();

// DELETE
const { error } = await supabase
  .from('tablename')
  .delete()
  .eq('id', recordId)
  .eq('user_id', userId); // Extra security
```

### 5. Advanced Queries
```typescript
// JSON operations
const { data } = await supabase
  .from('tablename')
  .select('*')
  .contains('metadata', { key: 'value' });

// Full text search
const { data } = await supabase
  .from('tablename')
  .select('*')
  .textSearch('title', 'search term');

// Joins (if foreign keys exist)
const { data } = await supabase
  .from('posts')
  .select(`
    *,
    profiles!posts_user_id_fkey (
      full_name,
      avatar_url
    )
  `);

// Aggregations
const { data } = await supabase
  .from('tablename')
  .select('status')
  .eq('user_id', userId)
  .then(result => {
    // Process aggregations in JS
    const counts = result.data?.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  });
```

### 6. Real-time Subscriptions
```typescript
// In a client component
useEffect(() => {
  const channel = supabase
    .channel('tablename_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tablename',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('Change received:', payload);
        // Update local state
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [supabase, userId]);
```

### 7. Error Handling
```typescript
try {
  const { data, error } = await supabase
    .from('tablename')
    .select('*');
    
  if (error) {
    console.error('Supabase error:', error);
    
    // Handle specific errors
    if (error.code === '42501') {
      return { error: 'Permission denied' };
    }
    
    return { error: 'Database operation failed' };
  }
  
  return { data };
} catch (error) {
  console.error('Unexpected error:', error);
  return { error: 'An unexpected error occurred' };
}
```

### 8. Transactions
```typescript
// For complex operations that need atomicity
const { data, error } = await supabase.rpc('your_function_name', {
  param1: value1,
  param2: value2
});

// Or use multiple operations with error handling
const results = await Promise.all([
  supabase.from('table1').insert({ ... }),
  supabase.from('table2').update({ ... })
]);

const hasError = results.some(r => r.error);
if (hasError) {
  // Rollback logic
}
```

### 9. Security Best Practices
- Always use RLS policies
- Validate user ownership in queries
- Use parameterized queries (Supabase does this automatically)
- Never expose service role key to client
- Validate data before inserting

### 10. Performance Tips
- Use indexes for frequently queried columns
- Limit select fields: `.select('id, title, created_at')`
- Use pagination for large datasets
- Consider caching strategies
- Enable Supabase query optimization

## Migration Commands
```bash
# Run migrations locally
./scripts/run-migrations.sh

# Create new migration
touch migrations/00X_your_migration.sql
```

## Documentation References
- Supabase integration: `/docs/05-features/supabase-integration.md`
- Local setup: `/docs/03-development/supabase-local.md`
- API examples: `/docs/03-development/api-examples.md`

## Testing Checklist
- [ ] Migration runs without errors
- [ ] RLS policies work correctly
- [ ] CRUD operations succeed
- [ ] Error cases handled properly
- [ ] Types are correctly defined
- [ ] Real-time updates work (if used)
- [ ] Performance is acceptable
- [ ] Security policies enforced

## Example Implementations
- `/src/app/api/protected/supabase-posts/route.ts`
- `/src/hooks/useSupabase.ts`
- `/migrations/002_create_profiles_table.sql`
- `/migrations/003_create_posts_table.sql`