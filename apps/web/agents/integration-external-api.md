# 🌐 External API Integration Guide

## Context
You are integrating an external API into the AI Coders Starter Kit with:
- Next.js 15.3.3 server-side API routes
- Environment variables for API keys
- Proper error handling and retries
- TypeScript for type safety
- Response caching when appropriate

## Project Structure Reference
- API routes: `/src/app/api/`
- Environment config: `.env.local`
- Types: `/src/types/`
- Utilities: `/src/lib/`

## Implementation Steps

### 1. Environment Configuration
```bash
# .env.local
EXTERNAL_API_KEY=your_api_key_here
EXTERNAL_API_URL=https://api.example.com/v1
EXTERNAL_API_SECRET=your_secret_here
```

```typescript
// /src/config/external-api.ts
export const externalApiConfig = {
  apiKey: process.env.EXTERNAL_API_KEY!,
  baseUrl: process.env.EXTERNAL_API_URL!,
  secret: process.env.EXTERNAL_API_SECRET,
  timeout: 30000, // 30 seconds
  retries: 3,
};

// Validate config at startup
if (!externalApiConfig.apiKey || !externalApiConfig.baseUrl) {
  throw new Error('External API configuration is missing');
}
```

### 2. API Client Utility
```typescript
// /src/lib/external-api-client.ts
import { externalApiConfig } from '@/config/external-api';

interface ApiRequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

class ExternalApiClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor() {
    this.baseUrl = externalApiConfig.baseUrl;
    this.apiKey = externalApiConfig.apiKey;
    this.defaultTimeout = externalApiConfig.timeout;
    this.defaultRetries = externalApiConfig.retries;
  }

  private async fetchWithRetry(
    url: string,
    options: ApiRequestOptions = {},
    retryCount = 0
  ): Promise<Response> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, ...fetchOptions } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok && retryCount < retries) {
        // Retry on 5xx errors or rate limiting
        if (response.status >= 500 || response.status === 429) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, options, retryCount + 1);
        }
      }

      return response;
    } catch (error) {
      if (retryCount < retries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, data: any, options?: ApiRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async put<T>(endpoint: string, data: any, options?: ApiRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async delete(endpoint: string, options?: ApiRequestOptions): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await this.fetchWithRetry(url, {
      method: 'DELETE',
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }
  }
}

export const externalApi = new ExternalApiClient();
```

### 3. Type Definitions
```typescript
// /src/types/external-api.ts
export interface ExternalUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ExternalProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  available: boolean;
}

export interface ExternalOrder {
  id: string;
  user_id: string;
  products: ExternalProduct[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  created_at: string;
}

export interface ExternalApiError {
  error: string;
  message: string;
  code?: string;
  details?: any;
}
```

### 4. API Route Implementation
```typescript
// /src/app/api/external/users/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { externalApi } from '@/lib/external-api-client';
import { ExternalUser } from '@/types/external-api';
import { z } from 'zod';

// Input validation
const SearchSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    // Validate input
    const validation = SearchSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Build query string
    const queryString = new URLSearchParams(validation.data as any).toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;

    // Call external API
    const users = await externalApi.get<ExternalUser[]>(endpoint);

    // Transform data if needed
    const transformedUsers = users.map(user => ({
      ...user,
      // Add any transformations
      displayName: user.name || user.email,
    }));

    // Return response with cache headers
    return NextResponse.json(
      { users: transformedUsers },
      {
        headers: {
          'Cache-Control': 'private, max-age=60', // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    console.error('External API error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'External service timeout' },
          { status: 504 }
        );
      }
      
      if (error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Invalid API credentials' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch external data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();
    const CreateUserSchema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      metadata: z.record(z.any()).optional(),
    });

    const validation = CreateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Call external API
    const newUser = await externalApi.post<ExternalUser>(
      '/users',
      validation.data
    );

    // Log the action (optional)
    console.log(`User ${userId} created external user ${newUser.id}`);

    return NextResponse.json(
      { user: newUser },
      { status: 201 }
    );
  } catch (error) {
    console.error('External API error:', error);
    return NextResponse.json(
      { error: 'Failed to create external user' },
      { status: 500 }
    );
  }
}
```

### 5. Webhook Handler
```typescript
// /src/app/api/webhooks/external/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { externalApiConfig } from '@/config/external-api';

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');

    if (!signature || !externalApiConfig.secret) {
      return NextResponse.json(
        { error: 'Missing signature or secret' },
        { status: 401 }
      );
    }

    // Verify signature
    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      externalApiConfig.secret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook data
    const data = JSON.parse(rawBody);
    
    // Handle different webhook events
    switch (data.event) {
      case 'user.created':
        await handleUserCreated(data.payload);
        break;
      
      case 'user.updated':
        await handleUserUpdated(data.payload);
        break;
      
      case 'order.completed':
        await handleOrderCompleted(data.payload);
        break;
      
      default:
        console.log('Unknown webhook event:', data.event);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent retries on processing errors
    return NextResponse.json({ received: true });
  }
}

async function handleUserCreated(payload: any) {
  // Process user creation
  console.log('User created:', payload);
  // Add your logic here
}

async function handleUserUpdated(payload: any) {
  // Process user update
  console.log('User updated:', payload);
  // Add your logic here
}

async function handleOrderCompleted(payload: any) {
  // Process completed order
  console.log('Order completed:', payload);
  // Add your logic here
}
```

### 6. Frontend Hook
```typescript
// /src/hooks/useExternalApi.ts
"use client";

import { useState } from 'react';
import { toast } from 'sonner';

export function useExternalApi() {
  const [loading, setLoading] = useState(false);

  const fetchExternalUsers = async (params?: {
    email?: string;
    name?: string;
  }) => {
    try {
      setLoading(true);
      const queryString = new URLSearchParams(params as any).toString();
      const response = await fetch(`/api/external/users${queryString ? `?${queryString}` : ''}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      return data.users;
    } catch (error) {
      toast.error('Failed to load external users');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createExternalUser = async (userData: {
    email: string;
    name: string;
    metadata?: Record<string, any>;
  }) => {
    try {
      setLoading(true);
      const response = await fetch('/api/external/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      const data = await response.json();
      toast.success('User created successfully');
      return data.user;
    } catch (error) {
      toast.error('Failed to create external user');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchExternalUsers,
    createExternalUser,
    loading,
  };
}
```

### 7. Error Handling & Monitoring
```typescript
// /src/lib/external-api-monitor.ts
interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastError?: {
    timestamp: Date;
    message: string;
    endpoint: string;
  };
}

class ApiMonitor {
  private metrics: ApiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
  };

  recordRequest(endpoint: string, duration: number, success: boolean, error?: Error) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastError = {
        timestamp: new Date(),
        message: error?.message || 'Unknown error',
        endpoint,
      };
    }

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration) / 
      this.metrics.totalRequests;

    // Log to monitoring service (optional)
    if (!success) {
      console.error(`API Error - ${endpoint}:`, error);
      // Send to error tracking service like Sentry
    }
  }

  getMetrics(): ApiMetrics {
    return { ...this.metrics };
  }

  getHealthStatus() {
    const successRate = this.metrics.totalRequests > 0
      ? this.metrics.successfulRequests / this.metrics.totalRequests
      : 1;

    return {
      healthy: successRate > 0.95, // 95% success rate
      successRate,
      averageResponseTime: this.metrics.averageResponseTime,
      lastError: this.metrics.lastError,
    };
  }
}

export const apiMonitor = new ApiMonitor();
```

## Best Practices

### 1. Security
- Never expose API keys in client code
- Validate all inputs
- Use HTTPS for all external calls
- Implement rate limiting
- Verify webhook signatures

### 2. Performance
- Cache responses when appropriate
- Implement request debouncing
- Use pagination for large datasets
- Set reasonable timeouts
- Batch requests when possible

### 3. Error Handling
- Implement retry logic with exponential backoff
- Log all errors for debugging
- Provide user-friendly error messages
- Handle network failures gracefully
- Monitor API health

### 4. Testing
```typescript
// Mock external API for tests
export const mockExternalApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

// In tests
jest.mock('@/lib/external-api-client', () => ({
  externalApi: mockExternalApi,
}));
```

## Environment Setup
```bash
# Development
EXTERNAL_API_URL=https://sandbox.api.example.com/v1
EXTERNAL_API_KEY=dev_key_xxxxx

# Production
EXTERNAL_API_URL=https://api.example.com/v1
EXTERNAL_API_KEY=prod_key_xxxxx

# Optional
EXTERNAL_API_TIMEOUT=30000
EXTERNAL_API_RETRY_COUNT=3
EXTERNAL_API_RATE_LIMIT=100
```

## Documentation References
- API routes: `/docs/03-development/apis-endpoints.md`
- Environment config: `/docs/02-configuration/configuracoes.md`
- Error handling: `/docs/03-development/guia-desenvolvimento.md`

## Testing Checklist
- [ ] API client handles all HTTP methods
- [ ] Retry logic works for transient failures
- [ ] Timeouts are enforced
- [ ] Authentication headers are included
- [ ] Error responses are properly formatted
- [ ] Webhook signatures are verified
- [ ] Rate limiting is respected
- [ ] Caching works as expected
- [ ] Monitoring captures metrics
- [ ] All edge cases handled