/**
 * Normaliza un número de teléfono uruguayo al formato +598 9XXXXXXX.
 * Acepta: 09XXXXXXX, 9XXXXXXX, +5989XXXXXXX, +598 9XXXXXXX, etc.
 */
export function normalizeUruguayPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  // Ya tiene código de país: 598XXXXXXXXX
  if (digits.startsWith('598')) {
    const local = digits.slice(3);
    return `+598 ${local}`;
  }

  // Empieza con 0 (formato local 09XXXXXXX → 9XXXXXXX)
  if (digits.startsWith('0')) {
    return `+598 ${digits.slice(1)}`;
  }

  // Solo dígitos locales (9XXXXXXX)
  return `+598 ${digits}`;
}
