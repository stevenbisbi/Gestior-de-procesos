export const PROCESS_LABELS = {
  corte: 'Corte', chaflan: 'Chaflanado', moleteo: 'Moleteado', curvado: 'Curvado',
};

export const PROCESS_ICONS = {
  corte: '✂️', chaflan: '🔩', moleteo: '⚙️', curvado: '🔄',
};

export const STATUS_BADGES = {
  in_basket:  { cls: 'badge-blue badge-dot',  label: 'En canasta' },
  in_process: { cls: 'badge-amber badge-dot', label: 'En proceso' },
  paused:     { cls: 'badge-blue badge-dot',  label: 'Pausado' },
  finished:   { cls: 'badge-green badge-dot', label: 'Terminado' },
  dispatched: { cls: 'badge-gray badge-dot',  label: 'Despachado' },
  pending:    { cls: 'badge-gray',  label: 'Pendiente' },
};

export function formatDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-CO');
}

export function formatDateTime(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
