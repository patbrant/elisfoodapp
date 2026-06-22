import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { type ComponentRow, mapComponent } from '../db/queries';
import type { Component } from '../domain/types';

export async function listFavorites(): Promise<Component[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ComponentRow>(
    'SELECT * FROM components WHERE is_favorite = 1 ORDER BY name ASC',
  );
  return rows.map(mapComponent);
}

export async function listRecent(limit = 10): Promise<Component[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ComponentRow>(
    'SELECT * FROM components WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(mapComponent);
}

export async function search(query: string, limit = 50): Promise<Component[]> {
  const db = await getDb();
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const rows = await db.getAllAsync<ComponentRow>(
    'SELECT * FROM components WHERE name LIKE ? ORDER BY name ASC LIMIT ?',
    [`%${trimmed}%`, limit],
  );
  return rows.map(mapComponent);
}

export async function createComponent(
  name: string,
  category: string | null = null,
): Promise<Component> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO components (id, name, category, is_favorite, last_used_at) VALUES (?, ?, ?, 0, NULL)',
    [id, name, category],
  );
  return {
    id,
    name,
    category,
    isFavorite: false,
    lastUsedAt: null,
  };
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE components SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id],
  );
}

export async function touchLastUsed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE components SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}
