# 🔄 Full Stack CRUD Feature Implementation Guide

## Context
You are implementing a complete CRUD (Create, Read, Update, Delete) feature for the AI Coders Starter Kit with:
- Next.js 15.3.3 App Router (frontend)
- Supabase + PostgreSQL (database)
- Clerk authentication
- TypeScript end-to-end
- Real-time updates (optional)

## Implementation Steps Overview
1. Database schema and migration
2. TypeScript types
3. API endpoints
4. Frontend hooks
5. UI components
6. Page integration
7. Navigation and translations

## Step 1: Database Migration
```sql
-- /migrations/00X_create_items_table.sql
CREATE TABLE IF NOT EXISTS public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'active',
  price DECIMAL(10,2),
  quantity INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own items" ON public.items
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can create items" ON public.items
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own items" ON public.items
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can delete own items" ON public.items
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- Indexes
CREATE INDEX idx_items_user_id ON public.items(user_id);
CREATE INDEX idx_items_status ON public.items(status);
CREATE INDEX idx_items_created_at ON public.items(created_at DESC);

-- Update trigger
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
```

## Step 2: TypeScript Types
```typescript
// /src/types/item.ts
export interface Item {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: 'active' | 'inactive' | 'archived';
  price: number | null;
  quantity: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateItemDto {
  name: string;
  description?: string;
  category?: string;
  status?: 'active' | 'inactive';
  price?: number;
  quantity?: number;
  metadata?: Record<string, any>;
}

export interface UpdateItemDto extends Partial<CreateItemDto> {}

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Step 3: API Endpoints
```typescript
// /src/app/api/protected/items/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const CreateItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  price: z.number().positive().optional(),
  quantity: z.number().int().min(0).default(0),
  metadata: z.record(z.any()).default({})
});

// GET - List items
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * limit, page * limit - 1);

    const { data: items, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      items: items || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// POST - Create item
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = CreateItemSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: item, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        ...validationResult.data
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}
```

```typescript
// /src/app/api/protected/items/[id]/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  price: z.number().positive().optional(),
  quantity: z.number().int().min(0).optional(),
  metadata: z.record(z.any()).optional()
});

// GET - Get single item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    const { data: item, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

// PATCH - Update item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = UpdateItemSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: item, error } = await supabase
      .from('items')
      .update(validationResult.data)
      .eq('id', params.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}
```

## Step 4: Frontend Hooks with TanStack Query

> **⚠️ IMPORTANTE**: Use TanStack Query para gerenciamento de estado do servidor, não custom hooks!
```typescript
// /src/hooks/queries/useItems.ts
"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type Item = Database['public']['Tables']['items']['Row'];

// Query para listar items com filtros e paginação
export function useItems(filters?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useQuery({
    queryKey: ['items', filters],
    queryFn: async (): Promise<{ items: Item[]; pagination: any }> => {
      let query = supabase
        .from('items')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id || '');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      
      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return {
        items: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    },
    enabled: !!user?.id,
  });
}

// Query para buscar um item específico
export function useItem(itemId: string) {
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useQuery({
    queryKey: ['items', itemId],
    queryFn: async (): Promise<Item> => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', user?.id || '')
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!itemId && !!user?.id,
  });
}
```

```typescript
// /src/hooks/mutations/useItems.ts
"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useShowToast } from '@/store';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];
type Item = Database['public']['Tables']['items']['Row'];

// Mutation para criar item
export function useCreateItem() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (newItem: Omit<ItemInsert, 'user_id'>): Promise<Item> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('items')
        .insert({
          ...newItem,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showToast({
        type: 'success',
        message: 'Item criado com sucesso!'
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.message || 'Falha ao criar item'
      });
    },
  });
}

// Mutation para atualizar item
export function useUpdateItem() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: ItemUpdate }): Promise<Item> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(['items', updatedItem.id], updatedItem);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showToast({
        type: 'success',
        message: 'Item atualizado com sucesso!'
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.message || 'Falha ao atualizar item'
      });
    },
  });
}

// Mutation para deletar item
export function useDeleteItem() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showToast({
        type: 'success',
        message: 'Item deletado com sucesso!'
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.message || 'Falha ao deletar item'
      });
    },
  });
}
```

## Step 5: UI Components
```typescript
// /src/components/Items/ItemsList.tsx
"use client";

import { useState } from 'react';
import { useItems } from '@/hooks/queries/useItems';
import { useDeleteItem } from '@/hooks/mutations/useItems';
import { useTranslations } from 'next-intl';
import { Trash2, Edit, Plus } from 'lucide-react';
import Link from 'next/link';

export function ItemsList() {
  const t = useTranslations('Items');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useItems({ page, search, limit: 10 });
  const deleteItemMutation = useDeleteItem();

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDelete'))) {
      await deleteItemMutation.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search and Actions */}
      <div className="mb-6 flex justify-between items-center">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-md border border-stroke px-4 py-2 dark:border-dark-3 dark:bg-dark-2"
        />
        <Link
          href="/items/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-white hover:bg-opacity-90"
        >
          <Plus size={20} />
          {t('addNew')}
        </Link>
      </div>

      {/* Items Table */}
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-stroke dark:border-dark-3">
                <th className="px-4 py-4 text-left">{t('name')}</th>
                <th className="px-4 py-4 text-left">{t('category')}</th>
                <th className="px-4 py-4 text-left">{t('status')}</th>
                <th className="px-4 py-4 text-right">{t('price')}</th>
                <th className="px-4 py-4 text-center">{t('quantity')}</th>
                <th className="px-4 py-4 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-4 py-4">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </td>
                  <td className="px-4 py-4">{item.category || '-'}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs ${
                      item.status === 'active' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t(`status.${item.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {item.price ? `$${item.price.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-4 text-center">{item.quantity}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center gap-2">
                      <Link
                        href={`/items/${item.id}/edit`}
                        className="text-primary hover:text-opacity-80"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting}
                        className="text-red-500 hover:text-opacity-80 disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex justify-between items-center p-4">
            <p className="text-sm text-gray-600">
              {t('showing', {
                from: (page - 1) * 10 + 1,
                to: Math.min(page * 10, data.pagination.total),
                total: data.pagination.total
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-stroke disabled:opacity-50"
              >
                {t('previous')}
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page === data.pagination.totalPages}
                className="px-3 py-1 rounded border border-stroke disabled:opacity-50"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

```typescript
// /src/components/Items/ItemForm.tsx
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCreateItem, useUpdateItem } from '@/hooks/mutations/useItems';
import type { Database } from '@/lib/supabase/types';

type Item = Database['public']['Tables']['items']['Row'];

const ItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  price: z.number().positive().optional(),
  quantity: z.number().int().min(0)
});

type ItemFormData = z.infer<typeof ItemSchema>;

interface ItemFormProps {
  item?: Item;
}

export function ItemForm({ item }: ItemFormProps) {
  const t = useTranslations('ItemForm');
  const router = useRouter();
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ItemFormData>({
    resolver: zodResolver(ItemSchema),
    defaultValues: item || {
      status: 'active',
      quantity: 0
    }
  });

  const onSubmit = async (data: ItemFormData) => {
    try {
      if (item) {
        await updateItemMutation.mutateAsync({ itemId: item.id, updates: data });
      } else {
        await createItemMutation.mutateAsync(data);
      }
      router.push('/items');
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const isSubmitting = createItemMutation.isPending || updateItemMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
          {t('name')} <span className="text-red">*</span>
        </label>
        <input
          {...register('name')}
          type="text"
          className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        />
        {errors.name && (
          <span className="mt-1 text-sm text-red">{errors.name.message}</span>
        )}
      </div>

      <div>
        <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
          {t('description')}
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
            {t('category')}
          </label>
          <input
            {...register('category')}
            type="text"
            className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
            {t('status')}
          </label>
          <select
            {...register('status')}
            className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          >
            <option value="active">{t('status.active')}</option>
            <option value="inactive">{t('status.inactive')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
            {t('price')}
          </label>
          <input
            {...register('price', { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
            {t('quantity')}
          </label>
          <input
            {...register('quantity', { valueAsNumber: true })}
            type="number"
            className="w-full rounded-[7px] border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex justify-center rounded-[7px] bg-primary px-6 py-[13px] font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/items')}
          className="flex justify-center rounded-[7px] border border-stroke px-6 py-[13px] font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-3"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
```

## Step 6: Page Integration
```typescript
// /src/app/[locale]/items/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import DefaultLayout from '@/components/Layouts/DefaultLaout';
import { ItemsList } from '@/components/Items/ItemsList';

export async function generateMetadata({
  params: { locale }
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Items' });
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default async function ItemsPage() {
  const t = await getTranslations('Items');

  return (
    <DefaultLayout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold dark:text-white">{t('title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t('description')}
          </p>
        </div>
        
        <ItemsList />
      </div>
    </DefaultLayout>
  );
}
```

```typescript
// /src/app/[locale]/items/new/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import DefaultLayout from '@/components/Layouts/DefaultLaout';
import { ItemForm } from '@/components/Items/ItemForm';

export async function generateMetadata({
  params: { locale }
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'ItemForm' });
  
  return {
    title: t('meta.titleNew'),
    description: t('meta.description'),
  };
}

export default async function NewItemPage() {
  const t = await getTranslations('ItemForm');

  return (
    <DefaultLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold dark:text-white">
          {t('titleNew')}
        </h1>
        
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
          <ItemForm />
        </div>
      </div>
    </DefaultLayout>
  );
}
```

## Step 7: Translations
```json
// /src/i18n/locales/pt/Items.json
{
  "meta": {
    "title": "Itens",
    "description": "Gerencie seus itens"
  },
  "title": "Itens",
  "description": "Gerencie todos os seus itens em um só lugar",
  "searchPlaceholder": "Buscar itens...",
  "addNew": "Adicionar Novo",
  "name": "Nome",
  "category": "Categoria",
  "status": {
    "active": "Ativo",
    "inactive": "Inativo",
    "archived": "Arquivado"
  },
  "price": "Preço",
  "quantity": "Quantidade",
  "actions": "Ações",
  "confirmDelete": "Tem certeza que deseja excluir este item?",
  "showing": "Mostrando {{from}} a {{to}} de {{total}} itens",
  "previous": "Anterior",
  "next": "Próximo"
}

// /src/i18n/locales/pt/ItemForm.json
{
  "meta": {
    "titleNew": "Novo Item",
    "titleEdit": "Editar Item",
    "description": "Formulário de item"
  },
  "titleNew": "Novo Item",
  "titleEdit": "Editar Item",
  "name": "Nome",
  "description": "Descrição",
  "category": "Categoria",
  "status": {
    "active": "Ativo",
    "inactive": "Inativo"
  },
  "price": "Preço",
  "quantity": "Quantidade",
  "save": "Salvar",
  "saving": "Salvando...",
  "cancel": "Cancelar"
}
```

## Navigation Update
```typescript
// Add to /src/hooks/useNavigation.tsx
{
  label: t("items"),
  route: "/items",
  icon: <Package className="h-5 w-5" />,
}

// Add to translation files
// /src/i18n/locales/pt/Sidebar.json
"items": "Itens"

// /src/i18n/locales/en/Sidebar.json
"items": "Items"
```

## Testing Checklist
- [ ] Database migration runs successfully
- [ ] All CRUD operations work (Create, Read, Update, Delete)
- [ ] Authentication enforced on all endpoints
- [ ] Form validation works properly
- [ ] Error states handled gracefully
- [ ] Loading states shown during operations
- [ ] Pagination works correctly
- [ ] Search/filter functionality works
- [ ] Real-time updates work (if enabled)
- [ ] Responsive design on all devices
- [ ] Dark mode works properly
- [ ] Translations in all languages
- [ ] Navigation link added and working

## Documentation References
- Full stack overview: `/docs/01-getting-started/estrutura-geral.md`
- API development: `/docs/03-development/apis-endpoints.md`
- Database setup: `/docs/05-features/supabase-integration.md`
- Form handling: `/docs/05-features/validacao-formularios.md`
- State management: `/docs/05-features/zustand-state-management.md`
- Components: `/docs/04-components/componentes.md`

## Common Patterns
- Always validate user ownership in queries
- Use transactions for complex operations
- Implement proper error boundaries
- Add loading skeletons for better UX
- Use optimistic updates for real-time feel
- Cache data when appropriate
- Implement proper SEO with metadata