# Security Rules and Guidelines

## 🔐 Security-First Development

### Core Security Principles
- **Defense in Depth**: Multiple layers of security
- **Least Privilege**: Minimal necessary permissions
- **Fail Secure**: Default to secure state on failure
- **Never Trust Input**: Validate everything from users
- **Secure by Default**: Security should be the default, not optional

## 🛡️ Authentication & Authorization

### Authentication Rules
```typescript
// ✅ Good - Always check authentication
'use server';
export async function sensitiveAction(data: FormData) {
  const { userId } = auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  // Proceed with authenticated action
}

// ❌ Bad - No authentication check
export async function sensitiveAction(data: FormData) {
  // Direct action without auth check
}
```

### Authorization Patterns
```typescript
// ✅ Good - Role-based access control
export async function adminOnlyAction(data: FormData) {
  const { userId, user } = auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  if (user?.role !== 'admin') {
    throw new Error('Insufficient permissions');
  }
  
  // Admin-only logic
}

// ✅ Good - Resource-based authorization
export async function updateUserProfile(userId: string, data: FormData) {
  const { userId: currentUserId, user } = auth();
  
  if (!currentUserId) {
    throw new Error('Unauthorized');
  }
  
  // Users can only update their own profile, unless they're admin
  if (currentUserId !== userId && user?.role !== 'admin') {
    throw new Error('Cannot update other user profiles');
  }
  
  // Proceed with update
}
```

### Session Security
- **Secure cookies**: HttpOnly, Secure, SameSite
- **Session timeout**: Reasonable session expiration
- **Session invalidation**: Proper logout handling
- **CSRF protection**: Built into framework

## 🔍 Input Validation & Sanitization

### Server-Side Validation (MANDATORY)
```typescript
// ✅ Good - Comprehensive validation with Zod
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .toLowerCase(),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name contains invalid characters'),
  age: z.number()
    .int('Age must be an integer')
    .min(18, 'Must be at least 18')
    .max(120, 'Invalid age'),
  phone: z.string()
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone format')
    .optional()
});

export async function createUser(formData: FormData) {
  // Validate input
  const validationResult = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    age: Number(formData.get('age')),
    phone: formData.get('phone')
  });
  
  if (!validationResult.success) {
    throw new Error('Invalid input data');
  }
  
  const userData = validationResult.data;
  
  // Additional sanitization
  const sanitizedData = {
    ...userData,
    name: DOMPurify.sanitize(userData.name)
  };
  
  // Process with validated and sanitized data
}
```

### XSS Prevention
```typescript
// ✅ Good - Safe content rendering
import DOMPurify from 'isomorphic-dompurify';

interface SafeContentProps {
  content: string;
  allowedTags?: string[];
}

export function SafeContent({ content, allowedTags = [] }: SafeContentProps) {
  const cleanContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['href', 'title', 'alt'],
    FORBID_SCRIPT: true
  });
  
  return <div dangerouslySetInnerHTML={{ __html: cleanContent }} />;
}

// ❌ Bad - Direct HTML injection
export function UnsafeContent({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
}
```

### SQL Injection Prevention
- **Use ORMs**: Prisma, Drizzle with parameterized queries
- **Never concatenate SQL**: Use prepared statements
- **Validate inputs**: Before database operations

```typescript
// ✅ Good - Parameterized query (Prisma example)
export async function getUserByEmail(email: string) {
  // Validate email first
  const emailSchema = z.string().email();
  const validEmail = emailSchema.parse(email);
  
  return await prisma.user.findUnique({
    where: { email: validEmail }
  });
}

// ❌ Bad - SQL concatenation (avoid)
// SELECT * FROM users WHERE email = '${email}'
```

## 🔒 Data Protection

### Sensitive Data Handling
```typescript
// ✅ Good - Remove sensitive data before logging
export function logUserActivity(user: User, action: string) {
  const { password, ssn, creditCard, ...safeUserData } = user;
  
  console.log('User activity:', {
    user: safeUserData,
    action,
    timestamp: new Date().toISOString(),
    ip: getClientIP()
  });
}

// ❌ Bad - Logging sensitive data
console.log('User:', user); // Contains password, SSN, etc.
```

### Password Security
```typescript
// ✅ Good - Secure password handling
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  // Validate password strength
  const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain lowercase, uppercase, and number');
  
  passwordSchema.parse(password);
  
  // Hash with high cost factor
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

### Encryption for Sensitive Data
```typescript
// ✅ Good - Encrypt sensitive data at rest
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('additional-data'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  decipher.setAAD(Buffer.from('additional-data'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

## 🚨 Error Handling Security

### Secure Error Messages
```typescript
// ✅ Good - Generic user messages, detailed server logs
export async function loginUser(credentials: LoginCredentials) {
  try {
    const user = await authenticateUser(credentials);
    return { success: true, user };
  } catch (error) {
    // Detailed server-side logging
    console.error('Login attempt failed:', {
      email: credentials.email,
      error: error.message,
      timestamp: new Date().toISOString(),
      ip: getClientIP(),
      userAgent: getUserAgent()
    });
    
    // Generic user message
    return { 
      success: false, 
      error: 'Invalid email or password' 
    };
  }
}

// ❌ Bad - Exposing internal details
catch (error) {
  return { error: error.message }; // Might expose "User not found" vs "Wrong password"
}
```

### Rate Limiting
```typescript
// ✅ Good - Rate limiting implementation
import { rateLimit } from '@/lib/rate-limit';

export async function loginAPI(request: Request) {
  const ip = getClientIP(request);
  
  // Rate limit: 5 attempts per 15 minutes
  const isAllowed = await rateLimit(
    `login:${ip}`, 
    5, // max attempts
    15 * 60 * 1000 // 15 minutes in ms
  );
  
  if (!isAllowed) {
    return new Response('Too many login attempts', { 
      status: 429,
      headers: {
        'Retry-After': '900' // 15 minutes
      }
    });
  }
  
  // Proceed with login
}
```

## 📁 File Upload Security

### Secure File Handling
```typescript
// ✅ Good - Comprehensive file upload security
import path from 'path';
import { writeFile } from 'fs/promises';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'application/pdf'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = path.join(process.cwd(), 'secure-uploads');

export async function uploadFile(file: File): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { success: false, error: 'File type not allowed' };
    }
    
    // Validate file extension
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return { success: false, error: 'File extension not allowed' };
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File too large' };
    }
    
    // Generate secure filename
    const filename = generateSecureFilename(file.name);
    const filepath = path.join(UPLOAD_DIR, filename);
    
    // Validate file content (magic numbers)
    const buffer = await file.arrayBuffer();
    if (!validateFileContent(buffer, file.type)) {
      return { success: false, error: 'Invalid file content' };
    }
    
    // Scan for malware (implement based on your needs)
    const isSafe = await scanForMalware(buffer);
    if (!isSafe) {
      return { success: false, error: 'File failed security scan' };
    }
    
    // Save file
    await writeFile(filepath, Buffer.from(buffer));
    
    return { success: true, filename };
  } catch (error) {
    console.error('File upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
}

function generateSecureFilename(originalName: string): string {
  const extension = path.extname(originalName);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}${extension}`;
}
```

## 🌐 API Security

### Secure API Endpoints
```typescript
// ✅ Good - Secure API route
export async function POST(request: Request) {
  try {
    // Rate limiting
    const isRateLimited = await checkRateLimit(request);
    if (isRateLimited) {
      return new Response('Too Many Requests', { status: 429 });
    }
    
    // Authentication
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Input validation
    const body = await request.json();
    const validatedData = apiRequestSchema.parse(body);
    
    // Authorization (if needed)
    const hasPermission = await checkPermission(userId, 'resource:write');
    if (!hasPermission) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // Process request
    const result = await processSecurely(validatedData);
    
    // Return success response
    return Response.json({ success: true, data: result });
    
  } catch (error) {
    // Log error securely
    logSecurityEvent('API_ERROR', {
      error: error.message,
      endpoint: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });
    
    // Return generic error
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### CORS Security
```typescript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production' 
              ? 'https://yourdomain.com' 
              : 'http://localhost:3000'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          }
        ]
      }
    ];
  }
};
```

## 🛡️ Frontend Security

### Secure Client-Side Storage
```typescript
// ✅ Good - Secure storage utility
class SecureStorage {
  private static encrypt(value: string): string {
    // Use Web Crypto API for encryption
    return btoa(value); // Simplified - use proper encryption
  }
  
  private static decrypt(value: string): string {
    return atob(value); // Simplified - use proper decryption
  }
  
  static setItem(key: string, value: string): void {
    try {
      const encrypted = this.encrypt(value);
      sessionStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to store data securely:', error);
    }
  }
  
  static getItem(key: string): string | null {
    try {
      const encrypted = sessionStorage.getItem(key);
      return encrypted ? this.decrypt(encrypted) : null;
    } catch (error) {
      console.error('Failed to retrieve data securely:', error);
      return null;
    }
  }
  
  static removeItem(key: string): void {
    sessionStorage.removeItem(key);
  }
}

// ❌ Bad - Storing sensitive data in localStorage
localStorage.setItem('userToken', token); // Accessible to XSS
```

### Content Security Policy
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Set security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  
  return response;
}
```

## 🚨 Security Checklist

### ✅ Authentication & Authorization
- [ ] All protected routes use AuthGuard or equivalent
- [ ] Server actions verify authentication
- [ ] Role-based access control implemented
- [ ] Session management is secure
- [ ] Logout invalidates sessions properly

### ✅ Input Validation
- [ ] All user inputs validated server-side
- [ ] Zod schemas used for validation
- [ ] SQL injection prevention implemented
- [ ] XSS prevention measures in place
- [ ] File uploads are validated and secure

### ✅ Data Protection
- [ ] Sensitive data not logged
- [ ] Passwords properly hashed
- [ ] Sensitive data encrypted at rest
- [ ] Environment variables used for secrets
- [ ] No hardcoded credentials

### ✅ Error Handling
- [ ] Generic error messages to users
- [ ] Detailed errors logged server-side only
- [ ] No stack traces exposed to client
- [ ] Rate limiting implemented
- [ ] Proper HTTP status codes used

### ✅ API Security
- [ ] Request validation on all endpoints
- [ ] Authentication required for protected endpoints
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Proper error responses

### ✅ Frontend Security
- [ ] No sensitive data in client storage
- [ ] User content properly sanitized
- [ ] CSP headers configured
- [ ] Secure communication (HTTPS)
- [ ] No exposed development tools

### ✅ File Security
- [ ] File type validation implemented
- [ ] File size limits enforced
- [ ] Secure file storage location
- [ ] Malware scanning (if applicable)
- [ ] Secure filename generation

### ✅ General Security
- [ ] Security headers configured
- [ ] Regular security audits planned
- [ ] Dependencies kept up to date
- [ ] Security logging implemented
- [ ] Incident response plan in place

## 🚫 Security Anti-Patterns

### Never Do These
```typescript
// ❌ NEVER - Store secrets in code
const API_KEY = "sk-1234567890abcdef"; // Use environment variables

// ❌ NEVER - Log sensitive data
console.log("User password:", password);

// ❌ NEVER - Trust user input
const sql = `SELECT * FROM users WHERE id = ${userId}`; // SQL injection risk

// ❌ NEVER - Expose internal errors
catch (error) {
  res.json({ error: error.message }); // Might expose internal details
}

// ❌ NEVER - Skip authentication
export async function deleteUser(userId: string) {
  // Missing auth check - anyone can delete users!
  return await database.user.delete(userId);
}

// ❌ NEVER - Use eval() or similar
eval(userInput); // XSS and code injection risk

// ❌ NEVER - Store sensitive data in localStorage
localStorage.setItem('creditCard', cardNumber); // Persistent and accessible
```

## 🔐 Emergency Security Procedures

### Security Incident Response
1. **Identify**: Determine the nature and scope of the incident
2. **Contain**: Isolate affected systems immediately
3. **Assess**: Evaluate the damage and data exposure
4. **Notify**: Inform relevant stakeholders and authorities
5. **Recover**: Restore systems securely
6. **Learn**: Conduct post-incident review

### Security Monitoring
- **Log security events**: Authentication attempts, authorization failures
- **Monitor for anomalies**: Unusual access patterns, multiple failed logins
- **Regular security scans**: Dependency vulnerabilities, code analysis
- **Penetration testing**: Regular security assessments

Remember: Security is not optional - it's a fundamental requirement for protecting user data and maintaining trust.