import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export async function GET({ url }) {
  try {
    const category = url.searchParams.get('category');
    const key = url.searchParams.get('key');
    
    const where = {
      ...(category && { category }),
      ...(key && { key })
    };

    const settings = await prisma.settings.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });
    return json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.key || !data.value || !data.category) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for existing setting
    const existing = await prisma.settings.findFirst({
      where: {
        key: data.key,
        category: data.category
      }
    });

    if (existing) {
      return json({ error: 'Setting already exists' }, { status: 409 });
    }

    const setting = await prisma.settings.create({ 
      data: {
        key: data.key,
        value: data.value,
        category: data.category,
        description: data.description
      }
    });
    
    return json(setting);
  } catch (error) {
    console.error('Failed to create setting:', error);
    return json({ error: 'Failed to create setting' }, { status: 500 });
  }
}

export async function PUT({ request }) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.key || !data.value || !data.category) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const setting = await prisma.settings.update({
      where: { id: data.id },
      data: {
        value: data.value,
        description: data.description
      }
    });
    
    return json(setting);
  } catch (error) {
    console.error('Failed to update setting:', error);
    return json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    
    if (!id) {
      return json({ error: 'Missing setting ID' }, { status: 400 });
    }

    await prisma.settings.delete({
      where: { id }
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete setting:', error);
    return json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}