import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export const REGISTER_PROSPECT_KEY = ['register-prospect'] as const;

export interface ProspectOfferInput {
  id: string;
  egg_type?: string | null;
  format?: string | null;
  price?: number | null;
  photo_path?: string | null;
}

export interface RegisterProspectInput {
  id: string;              // id generado en el cliente (idempotencia offline)
  name: string;
  address?: string | null;
  phone?: string | null;
  lat: number;
  lng: number;
  has_competition: boolean;
  notes?: string | null;
  created_by: string;
  offers: ProspectOfferInput[];
}

// ── Base64 → Uint8Array (sin dependencias extra) ─────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      (B64.indexOf(clean[i + 2]) << 6) | B64.indexOf(clean[i + 3]);
    out[p++] = (n >> 16) & 0xff;
    if (clean[i + 2] !== undefined) out[p++] = (n >> 8) & 0xff;
    if (clean[i + 3] !== undefined) out[p++] = n & 0xff;
  }
  return out;
}

/** Sube una foto (uri local) al bucket "prospects" y devuelve la ruta. Requiere conexión. */
export async function uploadProspectPhoto(uri: string, prospectId: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const bytes = base64ToBytes(base64);
  const path = `${prospectId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('prospects').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

// URL pública de una foto (para mostrarla)
export function prospectPhotoUrl(path: string): string {
  return supabase.storage.from('prospects').getPublicUrl(path).data.publicUrl;
}

// Inserta el prospecto + su oferta. Idempotente por id (upsert ignoreDuplicates).
export async function registerProspect(input: RegisterProspectInput): Promise<void> {
  const { error: e1 } = await supabase.from('prospects').upsert(
    {
      id: input.id,
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      lat: input.lat,
      lng: input.lng,
      has_competition: input.has_competition,
      notes: input.notes ?? null,
      created_by: input.created_by,
      status: 'nuevo',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (e1) throw e1;

  const rows = input.offers
    .filter((o) => o.egg_type || o.format || o.price != null || o.photo_path)
    .map((o) => ({
      id: o.id,
      prospect_id: input.id,
      egg_type: o.egg_type ?? null,
      format: o.format ?? null,
      price: o.price ?? null,
      photo_path: o.photo_path ?? null,
    }));
  if (rows.length > 0) {
    const { error: e2 } = await supabase.from('prospect_offers').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (e2) throw e2;
  }
}
