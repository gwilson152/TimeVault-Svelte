# API Guidelines for TimeVault

## Related Documentation
- [Svelte 5 Guidelines](./svelte5-guidelines.md) - Development guidelines for Svelte 5

## API Endpoint Structure

SvelteKit file-based routing pattern with separate endpoint files for collections and individual resources:

### Collection Endpoints
Location: `/api/resource/+server.ts`
- GET: List all resources
- POST: Create a new resource

### Individual Resource Endpoints
Location: `/api/resource/[id]/+server.ts`
- GET: Get resource by ID
- PUT: Update resource by ID
- DELETE: Delete resource by ID

## Implementation Pattern

All API endpoints must follow this standard pattern:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: { /* relations */ }
    });
    
    if (!resource) {
      throw error(404, 'Resource not found');
    }
    
    return json(resource);
  } catch (err) {
    console.error('Failed to get resource:', err);
    throw error(500, err instanceof Error ? err.message : 'An unknown error occurred');
  }
};
```

## Error Handling

1. Always use try/catch blocks
2. Log errors to console with context
3. Use appropriate HTTP status codes
4. Return structured error responses

Example error handling:
```typescript
try {
  // API logic
} catch (err) {
  console.error('Operation failed:', err);
  
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma-specific errors
    if (err.code === 'P2002') {
      throw error(409, 'A resource with this identifier already exists');
    }
  }
  
  throw error(500, err instanceof Error ? err.message : 'An unknown error occurred');
}
```

## Client-Side Data Access

### Using Stores

Always use store methods for data access:

```typescript
// Correct - Use store methods
await clientStore.load();
const client = await clientStore.getById(id);

// Incorrect - Direct API calls
const response = await fetch('/api/clients');
const clients = await response.json();
```

### URL Conventions

1. Use relative URLs
   ```typescript
   // Correct
   const response = await fetch('/api/clients');
   
   // Incorrect
   const response = await fetch('https://timevault.example.com/api/clients');
   ```

2. Use consistent URL patterns
   - Collection: `/api/resource`
   - Individual: `/api/resource/[id]`
   - Related: `/api/resource/[id]/related`

## Response Formats

### Success Responses

1. Single Resource:
```typescript
return json({
  id: "123",
  name: "Example",
  createdAt: new Date()
});
```

2. Collection:
```typescript
return json([
  { id: "1", name: "First" },
  { id: "2", name: "Second" }
]);
```

### Error Responses

Use SvelteKit's error helper:
```typescript
throw error(404, 'Resource not found');
throw error(400, 'Invalid input data');
throw error(403, 'Not authorized');
```

## Type Safety

1. Use TypeScript types for request/response data
2. Define interfaces for all API payloads
3. Use Prisma-generated types when possible

Example:
```typescript
import type { Client } from '@prisma/client';

interface CreateClientPayload {
  name: string;
  email: string;
  type: 'business' | 'container' | 'individual';
  parentId?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  const payload = await request.json() as CreateClientPayload;
  // Validate and process...
};
```

## Security Considerations

1. Input Validation
```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  type: z.enum(['business', 'container', 'individual']),
  parentId: z.string().optional()
});

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  const validated = schema.parse(data);
  // Process validated data...
};
```

2. Authorization
```typescript
import { userStore } from '$lib/stores/userStore';

export const PUT: RequestHandler = async ({ params, request }) => {
  const user = await userStore.getCurrentUser();
  
  if (!user.canEditResource(params.id)) {
    throw error(403, 'Not authorized to edit this resource');
  }
  
  // Process authorized request...
};
```

## Testing

1. Write tests for all API endpoints
2. Test both success and error cases
3. Use mocked Prisma client for database operations
4. Test authorization rules

Example test:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server';
import { prisma } from '$lib/server/db';

vi.mock('$lib/server/db', () => ({
  prisma: {
    resource: {
      findUnique: vi.fn()
    }
  }
}));

describe('GET /api/resource/[id]', () => {
  it('returns 404 when resource not found', async () => {
    vi.mocked(prisma.resource.findUnique).mockResolvedValue(null);
    
    await expect(GET({ params: { id: '123' } })).rejects.toThrow('Resource not found');
  });
});
```