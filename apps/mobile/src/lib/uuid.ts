/**
 * UUID v4 generado en el cliente. Se usa como id de las entregas para que
 * los reintentos offline sean idempotentes (mismo id => no se duplica).
 * No requiere dependencias nativas.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
