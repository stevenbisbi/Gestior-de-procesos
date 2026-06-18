"""
Genera un diagrama Entidad-Relación del modelo de datos del sistema.
Salida: docs/ER_modelo.png

Uso:
    python docs/er_diagram.py
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.path import Path
import os

# ─── Definición de entidades ──────────────────────────────────────────────
# Cada entidad: (x, y, ancho, alto, título, color, lista de [campo, tipo, PK/FK])

ENTITIES = {
    # ── CATÁLOGO (fila superior) ──
    "TubeSpec": {
        "pos": (0.5, 9.0), "size": (3.5, 2.2), "color": "#dbeafe", "border": "#3b82f6",
        "fields": [
            ("id", "PK", "key"),
            ("shape", "round|square", ""),
            ("outer_diameter", "char(20)", ""),
            ("thickness", "float", ""),
            ("material", "cr|hr|cr_est|...", ""),
            ("original_length", "float (mm)", ""),
        ],
    },
    "ProductType": {
        "pos": (5.0, 8.2), "size": (4.0, 3.0), "color": "#dbeafe", "border": "#3b82f6",
        "fields": [
            ("id", "PK", "key"),
            ("name", "char(100)", ""),
            ("item_code", "char(50)", ""),
            ("tube_spec_id", "FK → TubeSpec", "fk"),
            ("cut_length", "float (mm)", ""),
            ("client", "char(200)", ""),
            ("default_priority", "alta|media|baja", ""),
            ("requires_chaflan", "bool", ""),
            ("requires_moleteo", "bool", ""),
            ("requires_curvado", "bool", ""),
            ("saw_type", "hss|tct|none", ""),
            ("rpm", "int", ""),
        ],
    },
    "Machine": {
        "pos": (10.0, 9.0), "size": (3.5, 2.2), "color": "#dbeafe", "border": "#3b82f6",
        "fields": [
            ("id", "PK", "key"),
            ("name", "char(100)", ""),
            ("process_type", "corte|chaflan|...", ""),
            ("is_active", "bool", ""),
            ("operators", "M2M → User", "fk"),
        ],
    },
    "User": {
        "pos": (14.5, 9.0), "size": (3.0, 2.0), "color": "#fef3c7", "border": "#d97706",
        "fields": [
            ("id", "PK", "key"),
            ("username", "char", ""),
            ("first/last_name", "char", ""),
            ("is_staff", "bool", ""),
            ("groups", "M2M", "fk"),
        ],
    },

    # ── PROGRAMA DE CORTE (fila media-izquierda) ──
    "CuttingProgram": {
        "pos": (0.5, 5.0), "size": (3.5, 2.2), "color": "#e9d5ff", "border": "#9333ea",
        "fields": [
            ("id", "PK", "key"),
            ("month", "date", ""),
            ("version", "int", ""),
            ("status", "draft|active|closed", ""),
            ("notes", "text", ""),
            ("created_by_id", "FK → User", "fk"),
        ],
    },
    "CuttingProgramLine": {
        "pos": (4.8, 4.0), "size": (4.4, 3.4), "color": "#e9d5ff", "border": "#9333ea",
        "fields": [
            ("id", "PK", "key"),
            ("program_id", "FK → CuttingProgram", "fk"),
            ("product_type_id", "FK → ProductType", "fk"),
            ("batch_id", "1:1 → ProductionBatch", "fk"),
            ("start_date / end_date", "date", ""),
            ("pedido_quantity", "int (cliente)", ""),
            ("total_quantity", "int (a cortar)", ""),
            ("tube_count", "int (tubos largos)", ""),
            ("sections_per_tube", "int", ""),
            ("tube_length_mm", "float", ""),
            ("item_code, client, packaging", "char", ""),
            ("saw_type, saw_teeth, rpm", "char/int", ""),
            ("advance_high, advance_low", "float", ""),
        ],
    },

    # ── PRODUCCIÓN (fila media-derecha) ──
    "ProductionBatch": {
        "pos": (10.0, 5.0), "size": (4.0, 2.6), "color": "#dcfce7", "border": "#16a34a",
        "fields": [
            ("id", "PK", "key"),
            ("batch_code", "char (LOTE-XXXX)", ""),
            ("product_type_id", "FK → ProductType", "fk"),
            ("total_quantity", "int", ""),
            ("priority", "alta|media|baja", ""),
            ("scheduled_date", "date", ""),
            ("status", "in_basket|...|dispatched", ""),
            ("created_by_id", "FK → User", "fk"),
        ],
    },
    "ProcessRecord": {
        "pos": (15.0, 4.5), "size": (4.0, 3.0), "color": "#dcfce7", "border": "#16a34a",
        "fields": [
            ("id", "PK", "key"),
            ("batch_id", "FK → Batch", "fk"),
            ("process_type", "corte|chaflan|...", ""),
            ("sequence", "int", ""),
            ("machine_id", "FK → Machine", "fk"),
            ("operator_id", "FK → User (último)", "fk"),
            ("status", "pending|in_process|paused|finished", ""),
            ("qty_assigned", "int", ""),
            ("qty_done", "int (acumulado)", ""),
            ("shift, signature", "char/text", ""),
        ],
    },
    "ProcessShiftEntry": {
        "pos": (15.0, 0.5), "size": (4.0, 2.4), "color": "#fee2e2", "border": "#dc2626",
        "fields": [
            ("id", "PK", "key"),
            ("process_record_id", "FK → ProcessRecord", "fk"),
            ("operator_id", "FK → User", "fk"),
            ("machine_id", "FK → Machine", "fk"),
            ("shift", "A|B|C", ""),
            ("qty_done", "int (este turno)", ""),
            ("started_at / finished_at", "datetime", ""),
            ("signature, notes", "text", ""),
        ],
    },

    # ── CALIDAD (fila inferior) ──
    "QualityCheck": {
        "pos": (5.0, 0.5), "size": (4.4, 2.8), "color": "#fce7f3", "border": "#db2777",
        "fields": [
            ("id", "PK", "key"),
            ("process_record_id", "1:1 → ProcessRecord", "fk"),
            ("date, shift", "date/char", ""),
            ("client, item_tramo, moto", "char", ""),
            ("dimensions_ok", "si|no|otras", ""),
            ("sheet_type", "char", ""),
            ("appearance_ok", "si|no", ""),
            ("cut_appearance", "conforme|no_conforme", ""),
            ("knurling_distance", "char", ""),
            ("double_knurling_free", "char", ""),
            ("sample_1/2/3", "char", ""),
            ("observations", "text", ""),
        ],
    },
    "DimensionalLog": {
        "pos": (10.0, 0.5), "size": (4.0, 2.4), "color": "#fce7f3", "border": "#db2777",
        "fields": [
            ("id", "PK", "key"),
            ("process_record_id", "FK → ProcessRecord", "fk"),
            ("piece_number", "int", ""),
            ("measure_1/2/3", "char (label + valor)", ""),
            ("result", "conforme|no_conforme", ""),
            ("operator_id", "FK → User", "fk"),
            ("logged_at", "datetime", ""),
            ("notes", "text", ""),
        ],
    },
}

# ─── Relaciones: (from, to, cardinalidad, label opcional) ────────────────
RELATIONS = [
    ("TubeSpec",       "ProductType",        "1:N",  ""),
    ("ProductType",    "ProductionBatch",    "1:N",  "genera"),
    ("ProductType",    "CuttingProgramLine", "1:N",  ""),
    ("CuttingProgram", "CuttingProgramLine", "1:N",  ""),
    ("CuttingProgramLine", "ProductionBatch", "1:1", "crea"),
    ("ProductionBatch","ProcessRecord",      "1:N",  "1 por proceso"),
    ("ProcessRecord",  "ProcessShiftEntry",  "1:N",  "1 por turno"),
    ("ProcessRecord",  "QualityCheck",       "1:1",  ""),
    ("ProcessRecord",  "DimensionalLog",     "1:N",  ""),
    ("Machine",        "ProcessRecord",      "1:N",  ""),
    ("Machine",        "ProcessShiftEntry",  "1:N",  ""),
    ("User",           "ProcessShiftEntry",  "1:N",  "operario"),
    ("User",           "ProductionBatch",    "1:N",  "creado_por"),
]


# ─── Render ────────────────────────────────────────────────────────────────
def get_entity_anchor(entity, side='right'):
    """Devuelve el punto de anclaje para una flecha en el lado especificado."""
    x, y = entity["pos"]
    w, h = entity["size"]
    if side == 'left':   return (x, y + h/2)
    if side == 'right':  return (x + w, y + h/2)
    if side == 'top':    return (x + w/2, y + h)
    if side == 'bottom': return (x + w/2, y)


def best_anchors(from_ent, to_ent):
    """Decide los mejores lados de anclaje según posiciones relativas."""
    fx, fy = from_ent["pos"]
    fw, fh = from_ent["size"]
    tx, ty = to_ent["pos"]
    tw, th = to_ent["size"]
    fcx, fcy = fx + fw/2, fy + fh/2
    tcx, tcy = tx + tw/2, ty + th/2
    dx, dy   = tcx - fcx, tcy - fcy
    if abs(dx) >= abs(dy):
        return ('right' if dx > 0 else 'left',
                'left'  if dx > 0 else 'right')
    else:
        return ('top' if dy > 0 else 'bottom',
                'bottom' if dy > 0 else 'top')


def draw():
    fig, ax = plt.subplots(figsize=(24, 14))
    ax.set_xlim(0, 20)
    ax.set_ylim(-1, 12.5)
    ax.set_aspect('equal')
    ax.axis('off')

    # Título y leyenda
    fig.suptitle("Modelo Entidad-Relación · Sistema de Producción Tubería",
                 fontsize=20, fontweight='bold', y=0.97)
    ax.text(10, 11.8, "Generado desde production/models.py + quality/models.py",
            ha='center', fontsize=10, color='#64748b', style='italic')

    # Leyenda de colores
    legend_y = -0.7
    legends = [
        ("Catálogo",    "#dbeafe", "#3b82f6"),
        ("Auth",        "#fef3c7", "#d97706"),
        ("Programa",    "#e9d5ff", "#9333ea"),
        ("Producción",  "#dcfce7", "#16a34a"),
        ("Turnos",      "#fee2e2", "#dc2626"),
        ("Calidad",     "#fce7f3", "#db2777"),
    ]
    for i, (label, bg, brd) in enumerate(legends):
        x = 2 + i * 3
        ax.add_patch(patches.Rectangle((x, legend_y), 0.5, 0.3,
                                       facecolor=bg, edgecolor=brd, linewidth=1.5))
        ax.text(x + 0.7, legend_y + 0.15, label, fontsize=11, va='center')

    # Dibujar cajas de entidades
    for name, ent in ENTITIES.items():
        x, y = ent["pos"]
        w, h = ent["size"]
        color = ent["color"]
        border = ent["border"]

        # Caja con borde redondeado
        box = FancyBboxPatch((x, y), w, h,
                             boxstyle="round,pad=0.02,rounding_size=0.1",
                             facecolor=color, edgecolor=border, linewidth=1.8)
        ax.add_patch(box)

        # Header (banda superior con título) — usar rectángulo simple para que no corte
        header_h = 0.38
        header = patches.Rectangle((x + 0.02, y + h - header_h), w - 0.04, header_h - 0.02,
                                   facecolor=border, edgecolor='none')
        ax.add_patch(header)
        ax.text(x + w/2, y + h - header_h/2, name,
                ha='center', va='center', fontsize=11, fontweight='bold', color='white')

        # Campos
        fields = ent["fields"]
        n = len(fields)
        avail_h = h - header_h - 0.1
        line_h = avail_h / max(n, 1)

        for i, (field_name, field_type, marker) in enumerate(fields):
            fy_top = y + h - header_h - 0.05
            fy_mid = fy_top - line_h * i - line_h / 2
            # Marker (PK/FK)
            prefix = ""
            color_fld = "#0f172a"
            if marker == "key":
                prefix = "[PK] "
                color_fld = "#b45309"
            elif marker == "fk":
                prefix = "[FK] "
                color_fld = "#1d4ed8"

            ax.text(x + 0.15, fy_mid, f"{prefix}{field_name}",
                    ha='left', va='center', fontsize=8, color=color_fld,
                    fontweight='bold' if marker in ('key', 'fk') else 'normal')
            ax.text(x + w - 0.15, fy_mid, field_type,
                    ha='right', va='center', fontsize=7.5, color='#64748b',
                    style='italic')

    # Dibujar relaciones
    for from_name, to_name, card, label in RELATIONS:
        from_ent = ENTITIES[from_name]
        to_ent   = ENTITIES[to_name]
        f_side, t_side = best_anchors(from_ent, to_ent)
        x1, y1 = get_entity_anchor(from_ent, f_side)
        x2, y2 = get_entity_anchor(to_ent, t_side)

        arrow = FancyArrowPatch(
            (x1, y1), (x2, y2),
            arrowstyle='-|>', mutation_scale=15,
            connectionstyle="arc3,rad=0.08",
            color='#475569', linewidth=1.3,
        )
        ax.add_patch(arrow)

        # Etiqueta cardinalidad en el medio
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        # Pequeño offset para que no se superponga a la flecha
        ax.text(mx, my + 0.12,
                f"{card}" + (f"\n{label}" if label else ""),
                ha='center', va='bottom', fontsize=7.5,
                color='#0f172a', fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.25',
                          facecolor='white', edgecolor='#94a3b8', linewidth=0.6))

    # Anotaciones extra
    ax.text(10, 11.5, "[PK] = clave primaria      [FK] = clave foránea",
            ha='center', fontsize=10, color='#475569', fontweight='bold')

    # Guardar
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "ER_modelo.png")
    plt.savefig(out_path, dpi=160, bbox_inches='tight', facecolor='white')
    print(f"OK Generado: {out_path}")


if __name__ == "__main__":
    draw()
