// Conversión de cajones y cálculo de precios (igual que en la web).
//  * Suelto:    1 cajón = 2 cajas plásticas.  Precio por CAJÓN.
//  * Envasado:  1 cajón = 3 cajas plásticas.  Precio por ENVASE.

export function cpPerCajon(isPackaged: boolean): number {
  return isPackaged ? 3 : 2;
}

export function cajonesFor(cajasPlasticas: number, isPackaged: boolean): number {
  return cajasPlasticas / cpPerCajon(isPackaged);
}

export function formatCajonesFor(cajasPlasticas: number, isPackaged: boolean): string {
  const c = cajonesFor(cajasPlasticas, isPackaged);
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}

/** Total de una línea: suelto = cajones × precio_cajón; envasado = envases × precio_envase. */
export function lineTotal(
  cajasPlasticas: number,
  unitPrice: number,
  isPackaged: boolean,
  packagesPerBox: number | null,
): number {
  if (!unitPrice || unitPrice <= 0) return 0;
  if (isPackaged) {
    const envases = cajasPlasticas * (packagesPerBox ?? 0);
    return Math.round(envases * unitPrice * 100) / 100;
  }
  return Math.round(cajonesFor(cajasPlasticas, false) * unitPrice * 100) / 100;
}

export function priceUnitLabel(isPackaged: boolean): string {
  return isPackaged ? 'envase' : 'cajón';
}

export function formatMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-UY');
}
