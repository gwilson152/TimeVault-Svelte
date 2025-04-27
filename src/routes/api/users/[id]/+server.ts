import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import bcrypt from 'bcryptjs';

// GET /api/users/[id] - Get user by ID
export async function GET({ params }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
      }
    });

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    return json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update user
export async function PUT({ params, request }) {
  try {
    const { email, name, password, role, clientId, active } = await request.json();
    
    // If email is being changed, verify it's not already in use
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: params.id }
        }
      });
      
      if (existingUser) {
        return json({ error: 'Email is already in use' }, { status: 400 });
      }
    }
    
    // For client roles, ensure a clientId is provided
    if ((role === 'CLIENT_ADMIN' || role === 'CLIENT_USER') && clientId === null) {
      return json({ error: 'Client ID is required for client roles' }, { status: 400 });
    }
    
    // Prepare update data
    const updateData = {
      email,
      name,
      role,
      clientId,
      active
    };
    
    // If password is provided, hash it
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );
    
    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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
    
    return json(updatedUser);
  } catch (error) {
    console.error('Failed to update user:', error);
    return json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE({ params }) {
  try {
    await prisma.user.delete({
      where: { id: params.id }
    });
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return json({ error: 'Failed to delete user' }, { status: 500 });
  }
}