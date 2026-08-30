import { supabase } from '../lib/supabaseClient';
import type { InventoryItem } from '../types';

export async function listInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching inventory items:', error);
    throw error;
  }

  return data.map((item: any) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    totalQuantity: item.total_quantity,
    coverImage: item.cover_image,
    notes: item.notes,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert([
      {
        name: item.name,
        category: item.category,
        total_quantity: item.totalQuantity,
        cover_image: item.coverImage,
        notes: item.notes,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating inventory item:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    totalQuantity: data.total_quantity,
    coverImage: data.cover_image,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<InventoryItem> {
  const updates: any = { updated_at: new Date().toISOString() };
  if (item.name !== undefined) updates.name = item.name;
  if (item.category !== undefined) updates.category = item.category;
  if (item.totalQuantity !== undefined) updates.total_quantity = item.totalQuantity;
  if (item.coverImage !== undefined) updates.cover_image = item.coverImage;
  if (item.notes !== undefined) updates.notes = item.notes;

  const { data, error } = await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    totalQuantity: data.total_quantity,
    coverImage: data.cover_image,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
}
