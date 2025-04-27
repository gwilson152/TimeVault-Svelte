import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import bcrypt from 'bcryptjs';

// GET /api/users - Retrieves a list of users
export async function GET({ url }) {
  try {
    const clientId = url.searchParams.get('clientId');
    const role = url.searchParams.get('role');
    
    // Build filter conditions
    const where = {};
    if (clientId) {
      where.clientId = clientId;
    }
    if (role) {
      where.role = role;
    }
    
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clientId: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        client: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users - Creates a new user
export async function POST({ request }) {
  try {
    const { email, name, password, role, clientId, active } = await request.json();
    
    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return json({ error: 'Email is already in use' }, { status: 400 });
    }
    
    // For client roles, ensure a clientId is provided
    if ((role === 'CLIENT_ADMIN' || role === 'CLIENT_USER') && !clientId) {
      return json({ error: 'Client ID is required for client roles' }, { status: 400 });
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        clientId,
        active: active ?? true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clientId: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    return json(user);
  } catch (error) {
    console.error('Failed to create user:', error);
    return json({ error: 'Failed to create user' }, { status: 500 });
  }
}