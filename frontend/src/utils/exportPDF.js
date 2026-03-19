import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const EMPRESA = 'Codiplax S.A.S'
const COLOR_PRIMARY = [37, 99, 235] // blue-600
const COLOR_DARK = [30, 41, 59]     // slate-800
const COLOR_GRAY = [100, 116, 139]  // slate-500
const COLOR_LIGHT = [241, 245, 249] // slate-100
const COLOR_RED = [220, 38, 38]
const COLOR_GREEN = [22, 163, 74]

const formatCOP = (valor) => {
  if (!valor) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(valor)
}

const formatTiempo = (segundos) => {
  if (!segundos) return '0 min'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const hexToRgb = (hex) => {
  if (!hex) return [100, 116, 139]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

const addHeader = (doc, titulo, subtitulo) => {
  const pageW = doc.internal.pageSize.getWidth()

  // Fondo header
  doc.setFillColor(...COLOR_PRIMARY)
  doc.rect(0, 0, pageW, 28, 'F')

  // Círculo logo
  doc.setFillColor(255, 255, 255)
  doc.circle(18, 14, 8, 'F')
  doc.setTextColor(...COLOR_PRIMARY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('C', 15.5, 17.5)

  // Empresa y título
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(EMPRESA, 30, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(titulo, 30, 19)

  // Fecha arriba derecha
  doc.setFontSize(8)
  const fecha = new Date().toLocaleString('es-CO', {
    dateStyle: 'medium', timeStyle: 'short'
  })
  doc.text(fecha, pageW - 10, 12, { align: 'right' })
  if (subtitulo) doc.text(subtitulo, pageW - 10, 19, { align: 'right' })

  return 35
}

const addSectionTitle = (doc, titulo, y) => {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...COLOR_LIGHT)
  doc.rect(10, y - 4, pageW - 20, 8, 'F')
  doc.setTextColor(...COLOR_DARK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, 14, y + 1)
  return y + 10
}

const checkNewPage = (doc, y, needed = 20) => {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - 15) {
    doc.addPage()
    return 15
  }
  return y
}

const addKPIs = (doc, kpis, y) => {
  const pageW = doc.internal.pageSize.getWidth()
  const cardW = (pageW - 30) / 4
  const cards = [
    { label: 'Total Paros', valor: String(kpis.total_paros || 0), color: COLOR_RED },
    { label: 'Horas Perdidas', valor: `${kpis.horas_perdidas || kpis.minutos_perdidos || 0}${kpis.horas_perdidas !== undefined ? 'h' : ' min'}`, color: [234, 88, 12] },
    { label: 'Costo Perdido', valor: formatCOP(kpis.costo_total_perdido || kpis.costo_perdido), color: COLOR_RED },
    { label: kpis.maquina_critica !== undefined ? 'Máq. Crítica' : 'Unidades N.P.', valor: kpis.maquina_critica || String(Number(kpis.unidades_no_producidas || 0).toLocaleString('es-CO')), color: [124, 58, 237] },
  ]

  cards.forEach((c, i) => {
    const x = 10 + i * (cardW + 2.5)
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'S')
    doc.setTextColor(...COLOR_GRAY)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(c.label, x + 4, y + 7)
    doc.setTextColor(...c.color)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(c.valor.length > 14 ? c.valor.slice(0, 14) : c.valor, x + 4, y + 15)
  })
  return y + 26
}

const addTabla = (doc, headers, rows, y, colWidths) => {
  const pageW = doc.internal.pageSize.getWidth()
  const tableW = pageW - 20

  // Header tabla
  doc.setFillColor(...COLOR_PRIMARY)
  doc.rect(10, y, tableW, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  let x = 12
  headers.forEach((h, i) => {
    doc.text(h, x, y + 5)
    x += colWidths[i]
  })
  y += 7

  rows.forEach((row, idx) => {
    y = checkNewPage(doc, y, 8)
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(10, y, tableW, 7, 'F')
    }
    doc.setTextColor(...COLOR_DARK)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    x = 12
    row.forEach((cell, i) => {
      const text = String(cell || '—')
      doc.text(text.length > 22 ? text.slice(0, 22) + '…' : text, x, y + 5)
      x += colWidths[i]
    })
    doc.setDrawColor(226, 232, 240)
    doc.line(10, y + 7, pageW - 10, y + 7)
    y += 7
  })
  return y + 5
}

const addGraficoBarras = (doc, datos, dataKey, labelKey, colorKey, titulo, y) => {
  if (!datos?.length) return y
  const pageW = doc.internal.pageSize.getWidth()
  const maxVal = Math.max(...datos.map(d => parseFloat(d[dataKey]) || 0))
  const chartW = pageW - 80
  const barH = 6
  const gap = 3

  doc.setTextColor(...COLOR_GRAY)
  doc.setFontSize(7)

  datos.slice(0, 8).forEach((d, i) => {
    y = checkNewPage(doc, y, barH + gap + 2)
    const val = parseFloat(d[dataKey]) || 0
    const barW = maxVal > 0 ? (val / maxVal) * chartW : 0
    const color = colorKey ? hexToRgb(d[colorKey]) : COLOR_PRIMARY
    const label = String(d[labelKey] || '').slice(0, 18)

    doc.setTextColor(...COLOR_DARK)
    doc.setFont('helvetica', 'normal')
    doc.text(label, 12, y + barH - 1)
    doc.setFillColor(...color)
    doc.roundedRect(62, y, Math.max(barW, 2), barH, 1, 1, 'F')
    doc.setTextColor(...COLOR_GRAY)
    doc.text(String(val), 62 + barW + 3, y + barH - 1)
    y += barH + gap
  })
  return y + 5
}

// ─── EXPORT PRINCIPAL ──────────────────────────────────────────────────────────
export const exportarReportePDF = async ({
  resumen, disponibilidad, paretoAgrupado, historial, filtro
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const subtitulo = filtro ? `${filtro.fecha_inicio} al ${filtro.fecha_fin}` : ''
  let y = addHeader(doc, 'Reporte de Paros y Disponibilidad', subtitulo)

  // KPIs
  y = addSectionTitle(doc, 'Indicadores Generales', y)
  y = addKPIs(doc, resumen, y)

  // Disponibilidad
  if (disponibilidad?.length) {
    y = checkNewPage(doc, y, 40)
    y = addSectionTitle(doc, 'Disponibilidad por Máquina (%)', y)
    y = addGraficoBarras(doc, disponibilidad, 'disponibilidad_pct', 'nombre', null, 'Disponibilidad', y)

    y = checkNewPage(doc, y, 20)
    y = addSectionTitle(doc, 'Detalle por Máquina', y)
    y = addTabla(doc,
      ['Máquina', 'Línea', 'Paros', 'T. Perdido', 'Costo/h', 'Costo Perdido', 'Disp.%'],
      disponibilidad.map(m => [
        m.nombre, m.linea || '—', m.total_paros,
        formatTiempo(m.segundos_perdidos),
        formatCOP(m.costo_hora),
        formatCOP(m.costo_perdido),
        `${m.disponibilidad_pct}%`
      ]),
      y, [38, 28, 14, 20, 22, 28, 14]
    )
  }

  // Motivos
  if (paretoAgrupado?.length) {
    y = checkNewPage(doc, y, 40)
    y = addSectionTitle(doc, 'Motivos de Paro (minutos perdidos)', y)
    y = addGraficoBarras(doc, paretoAgrupado, 'minutos_perdidos', 'nombre', 'color_hex', 'Motivos', y)

    y = checkNewPage(doc, y, 20)
    y = addTabla(doc,
      ['Motivo', 'Categoría', 'Paros', 'Min Perdidos', 'Costo Perdido'],
      paretoAgrupado.map(m => [
        m.nombre, m.categoria, m.total_paros,
        `${m.minutos_perdidos} min`,
        formatCOP(m.costo_perdido)
      ]),
      y, [55, 35, 18, 30, 36]
    )
  }

  // Historial
  if (historial?.length) {
    y = checkNewPage(doc, y, 20)
    y = addSectionTitle(doc, `Historial de Paros (${historial.length} registros)`, y)
    y = addTabla(doc,
      ['Fecha', 'Máquina', 'Motivo', 'Duración', 'Costo'],
      historial.slice(0, 100).map(p => [
        new Date(p.inicio).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
        p.maquina_nombre, p.motivo_nombre,
        formatTiempo(p.duracion_segundos),
        formatCOP(p.costo_perdido)
      ]),
      y, [35, 38, 40, 22, 30]
    )
  }

  // Footer en cada página
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...COLOR_LIGHT)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setTextColor(...COLOR_GRAY)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`${EMPRESA} — Sistema de Gestión de Paros de Máquinas`, 10, pageH - 4)
    doc.text(`Página ${i} de ${totalPages}`, pageW - 10, pageH - 4, { align: 'right' })
  }

  const fecha = new Date().toISOString().slice(0, 10)
  doc.save(`reporte-paros-${fecha}.pdf`)
}

// ─── EXPORT SUPERVISOR ─────────────────────────────────────────────────────────
export const exportarReporteSupervisorPDF = async ({
  kpis, maquinas, motivos, historial, turno, linea
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = addHeader(doc, `Reporte de Turno — ${linea}`, turno?.nombre || '')

  // KPIs
  y = addSectionTitle(doc, 'Indicadores del Turno', y)
  y = addKPIs(doc, {
    total_paros: kpis?.total_paros,
    minutos_perdidos: kpis?.minutos_perdidos,
    costo_perdido: kpis?.costo_perdido,
    unidades_no_producidas: kpis?.unidades_no_producidas
  }, y)

  // Máquinas
  if (maquinas?.length) {
    y = checkNewPage(doc, y, 30)
    y = addSectionTitle(doc, 'Estado por Máquina', y)
    y = addTabla(doc,
      ['Máquina', 'Código', 'Paros', 'Min Perdidos', 'Costo Perdido', 'Disp.%'],
      maquinas.map(m => [
        m.nombre, m.codigo, m.total_paros,
        `${m.minutos_perdidos} min`,
        formatCOP(m.costo_perdido),
        `${m.disponibilidad_pct}%`
      ]),
      y, [45, 25, 15, 28, 35, 20]
    )
  }

  // Motivos
  if (motivos?.length) {
    y = checkNewPage(doc, y, 40)
    y = addSectionTitle(doc, 'Motivos del Turno', y)
    y = addGraficoBarras(doc, motivos, 'minutos_perdidos', 'nombre', 'color_hex', 'Motivos', y)
  }

  // Historial
  if (historial?.length) {
    y = checkNewPage(doc, y, 20)
    y = addSectionTitle(doc, `Historial de Paros (${historial.length} registros)`, y)
    y = addTabla(doc,
      ['Hora', 'Máquina', 'Motivo', 'Duración', 'Costo', 'Operador'],
      historial.map(p => [
        new Date(p.inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        p.maquina_nombre, p.motivo_nombre,
        formatTiempo(p.duracion_segundos),
        formatCOP(p.costo_perdido),
        p.operador_nombre
      ]),
      y, [18, 35, 38, 18, 26, 30]
    )
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...COLOR_LIGHT)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setTextColor(...COLOR_GRAY)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`${EMPRESA} — Sistema de Gestión de Paros de Máquinas`, 10, pageH - 4)
    doc.text(`Página ${i} de ${totalPages}`, pageW - 10, pageH - 4, { align: 'right' })
  }

  const fecha = new Date().toISOString().slice(0, 10)
  doc.save(`reporte-turno-${linea.replace(/ /g, '-')}-${fecha}.pdf`)
}