/**
 * Aviso de "sesión expirada" para mostrar en el login cuando la sesión se
 * cerró sola por ser inválida (usuario borrado o inactivo). Se consume una
 * sola vez.
 */
let expired = false;

export function markSessionExpired() {
  expired = true;
}

/** Devuelve si había un aviso pendiente y lo limpia. */
export function consumeSessionExpired(): boolean {
  const v = expired;
  expired = false;
  return v;
}
