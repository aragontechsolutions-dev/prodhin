import { useRef, useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { useBulkCreateCustomers } from '../../../hooks/useCustomers';
import type { CreateCustomerDto } from '@prodhin/shared';

interface ParsedRow {
  index: number;
  data: CreateCustomerDto & { created_by: string };
  errors: string[];
}

function parseCSV(text: string, userId: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const col = (row: string[], name: string) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (row[i] ?? '').trim() : '';
  };

  return lines.slice(1).map((line, idx) => {
    const row = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const errors: string[] = [];

    const tipo = col(row, 'tipo') as 'persona_fisica' | 'empresa';
    if (tipo !== 'persona_fisica' && tipo !== 'empresa') {
      errors.push('tipo debe ser persona_fisica o empresa');
    }

    const nombre = col(row, 'nombre');
    if (!nombre) errors.push('nombre es obligatorio');

    const telefono = col(row, 'telefono');
    if (!telefono) errors.push('telefono es obligatorio');

    const direccion = col(row, 'direccion');
    if (!direccion) errors.push('direccion es obligatoria');

    const latRaw = col(row, 'lat');
    const lngRaw = col(row, 'lng');
    const lat = latRaw ? parseFloat(latRaw) : 0;
    const lng = lngRaw ? parseFloat(lngRaw) : 0;
    if (latRaw && isNaN(lat)) errors.push('lat debe ser un número');
    if (lngRaw && isNaN(lng)) errors.push('lng debe ser un número');

    const numeroRaw = col(row, 'numero') || col(row, 'numero_cliente');
    let customer_number: number | null = null;
    if (numeroRaw) {
      if (!/^\d+$/.test(numeroRaw)) errors.push('numero debe ser numérico');
      else customer_number = parseInt(numeroRaw, 10);
    }

    const data: CreateCustomerDto & { created_by: string } = {
      customer_type: tipo === 'empresa' ? 'empresa' : 'persona_fisica',
      customer_number,
      first_name: tipo !== 'empresa' ? nombre || null : null,
      last_name: tipo !== 'empresa' ? col(row, 'apellido') || null : null,
      business_name: tipo === 'empresa' ? nombre || null : null,
      tax_id: col(row, 'rut') || null,
      business_type: col(row, 'tipo_empresa') || null,
      contact_name: col(row, 'contacto') || null,
      phone: telefono,
      email: col(row, 'email') || null,
      address: direccion,
      lat,
      lng,
      notes: col(row, 'notas') || null,
      created_by: userId,
    };

    return { index: idx + 2, data, errors };
  });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function CustomerImportModal({ isOpen, onClose, userId }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkCreate = useBulkCreateCustomers();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text, userId));
    };
    reader.readAsText(file, 'utf-8');
  }

  function reset() {
    setRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  async function handleImport() {
    if (!validRows.length) return;
    try {
      await bulkCreate.mutateAsync(validRows.map((r) => r.data));
      toast.success(`${validRows.length} cliente${validRows.length !== 1 ? 's' : ''} importado${validRows.length !== 1 ? 's' : ''} correctamente`);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar clientes desde CSV" size="xl">
      <div className="space-y-4">
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Archivo CSV
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Seleccionar archivo
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
            {fileName && <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{fileName}</span>}
          </div>
        </div>

        {/* Format hint */}
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 space-y-1">
          <p className="font-medium text-gray-600 dark:text-gray-300">Columnas del CSV (la primera fila debe ser el encabezado):</p>
          <p><span className="font-mono">tipo</span> (persona_fisica / empresa), <span className="font-mono">nombre</span>, <span className="font-mono">apellido</span>, <span className="font-mono">telefono</span>, <span className="font-mono">email</span>, <span className="font-mono">direccion</span>, <span className="font-mono">lat</span>, <span className="font-mono">lng</span>, <span className="font-mono">notas</span>, <span className="font-mono">rut</span>, <span className="font-mono">tipo_empresa</span>, <span className="font-mono">contacto</span></p>
          <p>Los campos obligatorios son: <span className="font-mono font-semibold">tipo</span>, <span className="font-mono font-semibold">nombre</span>, <span className="font-mono font-semibold">telefono</span>, <span className="font-mono font-semibold">direccion</span>.</p>
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {rows.length} fila{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''}
              </p>
              {validRows.length > 0 && <Badge variant="green">{validRows.length} válidas</Badge>}
              {errorRows.length > 0 && <Badge variant="red">{errorRows.length} con errores</Badge>}
            </div>

            <div className="overflow-auto max-h-64 rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">#</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Tipo</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Nombre</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Teléfono</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Dirección</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r) => {
                    const name = r.data.customer_type === 'empresa'
                      ? r.data.business_name
                      : `${r.data.first_name ?? ''} ${r.data.last_name ?? ''}`.trim();
                    return (
                      <tr key={r.index} className={r.errors.length ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="px-3 py-1.5 text-gray-400">{r.index}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant={r.data.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                            {r.data.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200 max-w-[140px] truncate">{name || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{r.data.phone || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 max-w-[160px] truncate">{r.data.address || '—'}</td>
                        <td className="px-3 py-1.5">
                          {r.errors.length === 0
                            ? <Badge variant="green">OK</Badge>
                            : (
                              <span className="text-red-600 dark:text-red-400" title={r.errors.join(', ')}>
                                ⚠ {r.errors[0]}{r.errors.length > 1 ? ` +${r.errors.length - 1}` : ''}
                              </span>
                            )
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {errorRows.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                Las filas con errores serán omitidas. Solo se importarán las {validRows.length} filas válidas.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            isLoading={bulkCreate.isPending}
            disabled={validRows.length === 0}
            className="flex-1"
          >
            Importar {validRows.length > 0 ? `${validRows.length} cliente${validRows.length !== 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
