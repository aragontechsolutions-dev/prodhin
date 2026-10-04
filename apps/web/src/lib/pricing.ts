// Conversión de cajones y cálculo de precios.
//
// Empaque:
//  * Suelto:    1 cajón = 2 cajas plásticas.  Precio por CAJÓN.
//  * Envasado:  1 cajón = 3 cajas plásticas.  Precio por ENVASE.
//    (envases por caja plástica = packages_per_box)

export function cpPerCajon(isPackaged: boolean): number {
  return isPackaged ? 3 : 2;
}

/** Cajones equivalentes a N cajas plásticas, según clasificación. */
export function cajonesFor(cajasPlasticas: number, isPackaged: boolean): number {
  return cajasPlasticas / cpPerCajon(isPackaged);
}

export function formatCajonesFor(cajasPlasticas: number, isPackaged: boolean): string {
  const c = cajonesFor(cajasPlasticas, isPackaged);
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}

/**
 * Total de una línea.
 *  - Suelto:   cajones (cp/2) × precio_por_cajón.
 *  - Envasado: envases (cp × paquetes_por_caja) × precio_por_envase.
 */
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
  const cj = cajonesFor(cajasPlasticas, false);
  return Math.round(cj * unitPrice * 100) / 100;
}

/** Cantidad "facturable" por línea (cajones para suelto, envases para envasado). */
export function billableUnits(
  cajasPlasticas: number,
  isPackaged: boolean,
  packagesPerBox: number | null,
): number {
  return isPackaged ? cajasPlasticas * (packagesPerBox ?? 0) : cajonesFor(cajasPlasticas, false);
}

export function priceUnitLabel(isPackaged: boolean): string {
  return isPackaged ? 'envase' : 'cajón';
}

export function formatMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-UY');
}
