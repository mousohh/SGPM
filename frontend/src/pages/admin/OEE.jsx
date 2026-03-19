import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import jsPDF from 'jspdf'
import {
  RadialBarChart, RadialBar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer
} from 'recharts'

const formatCOP = (v) => v
  ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
  : '$0'

const formatMin = (m) => {
  if (!m) return '0s'
  const total = Math.round(m * 60)
  const h = Math.floor(total / 3600)
  const min = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}h ${min}m` : min > 0 ? `${min}m ${s}s` : `${s}s`
}

const colorOEE = (pct) => {
  if (pct >= 85) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: '#16a34a', badge: 'bg-green-100 text-green-700' }
  if (pct >= 65) return { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', bar: '#f59e0b', badge: 'bg-yellow-100 text-yellow-700' }
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', bar: '#ef4444', badge: 'bg-red-100 text-red-700' }
}

const nivelOEE = (pct) => {
  if (pct >= 85) return 'Clase Mundial'
  if (pct >= 75) return 'Bueno'
  if (pct >= 65) return 'Regular'
  return 'Critico'
}

export default function OEE() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cargandoIA, setCargandoIA] = useState(false)
  const [analisisIA, setAnalisisIA] = useState(null)
  const [errorIA, setErrorIA] = useState('')
  const [lineas, setLineas] = useState([])
  const [exportando, setExportando] = useState(false)
  const [filtro, setFiltro] = useState({
    fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    fecha_fin: new Date().toISOString().slice(0, 10),
    linea: ''
  })

  const cargar = async (f = filtro) => {
    setCargando(true)
    setAnalisisIA(null)
    try {
      const params = new URLSearchParams()
      if (f.fecha_inicio) params.append('fecha_inicio', f.fecha_inicio)
      if (f.fecha_fin) params.append('fecha_fin', f.fecha_fin)
      if (f.linea) params.append('linea', f.linea)
      const data = await api.get(`/reportes/oee?${params}`)
      setDatos(data)
      if (lineas.length === 0 && data.maquinas) {
        const ls = [...new Set(data.maquinas.filter(m => m.linea).map(m => m.linea))].sort()
        setLineas(ls)
      }
      setCargando(false)
      analizarConIA(data)
    } catch (e) {
      console.error(e)
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const analizarConIA = async (data) => {
    if (!data || !data.paros_por_maquina_motivo?.length) return
    setCargandoIA(true)
    setErrorIA('')
    try {
      const resultado = await api.post('/ia/analizar-oee', { datos: data })
      if (resultado.error) setErrorIA(resultado.error)
      else setAnalisisIA(resultado)
    } catch (e) {
      setErrorIA('No se pudo generar el analisis de IA. Intenta de nuevo.')
    }
    setCargandoIA(false)
  }

  const exportarPDF = async () => {
    if (!datos) return
    setExportando(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      const margin = 14
      let y = 0

      const colorHex = (hex) => {
        const r = parseInt(hex.slice(1,3),16)
        const g = parseInt(hex.slice(3,5),16)
        const b = parseInt(hex.slice(5,7),16)
        return [r, g, b]
      }

      const oeeColor = datos.oee_global >= 85 ? [22,163,74] : datos.oee_global >= 65 ? [245,158,11] : [239,68,68]

      // ── PORTADA ──────────────────────────────────────────────────
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, W, 60, 'F')

      doc.setFillColor(...oeeColor)
      doc.rect(0, 56, W, 4, 'F')

      doc.setTextColor(255,255,255)
      doc.setFontSize(22)
      doc.setFont('helvetica','bold')
      doc.text('REPORTE OEE & ANALISIS IA', margin, 22)

      doc.setFontSize(11)
      doc.setFont('helvetica','normal')
      doc.setTextColor(148,163,184)
      doc.text(`Periodo: ${datos.periodo.fecha_inicio} al ${datos.periodo.fecha_fin}`, margin, 32)
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, margin, 40)
      doc.text(`Dias analizados: ${datos.periodo.dias}`, margin, 48)

      // OEE badge
      doc.setFillColor(...oeeColor)
      doc.roundedRect(W - 55, 10, 40, 40, 4, 4, 'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(20)
      doc.setFont('helvetica','bold')
      doc.text(`${datos.oee_global}%`, W - 35, 28, { align: 'center' })
      doc.setFontSize(8)
      doc.setFont('helvetica','normal')
      doc.text(nivelOEE(datos.oee_global), W - 35, 36, { align: 'center' })
      doc.text('OEE GLOBAL', W - 35, 43, { align: 'center' })

      y = 68

      // ── KPIs ──────────────────────────────────────────────────────
      const totalParos = datos.maquinas.reduce((a,m) => a + Number(m.total_paros||0), 0)
      const totalMin = datos.maquinas.reduce((a,m) => a + Number(m.minutos_perdidos||0), 0)
      const totalCosto = datos.maquinas.reduce((a,m) => a + Number(m.costo_perdido||0), 0)

      const kpis = [
        { label: 'Maquinas', valor: datos.maquinas.length, color: [59,130,246] },
        { label: 'Total Paros', valor: totalParos, color: [239,68,68] },
        { label: 'Tiempo Perdido', valor: formatMin(totalMin), color: [249,115,22] },
        { label: 'Costo Perdido', valor: formatCOP(totalCosto), color: [220,38,38] },
      ]

      const kW = (W - margin*2 - 9) / 4
      kpis.forEach((k, i) => {
        const x = margin + i * (kW + 3)
        doc.setFillColor(248,250,252)
        doc.setDrawColor(226,232,240)
        doc.roundedRect(x, y, kW, 18, 2, 2, 'FD')
        doc.setTextColor(...k.color)
        doc.setFontSize(11)
        doc.setFont('helvetica','bold')
        doc.text(String(k.valor), x + kW/2, y + 9, { align: 'center' })
        doc.setTextColor(100,116,139)
        doc.setFontSize(7)
        doc.setFont('helvetica','normal')
        doc.text(k.label, x + kW/2, y + 15, { align: 'center' })
      })
      y += 26

      // ── DISPONIBILIDAD POR MAQUINA ────────────────────────────────
      doc.setFillColor(248,250,252)
      doc.setDrawColor(226,232,240)
      doc.roundedRect(margin, y, W - margin*2, 8, 2, 2, 'FD')
      doc.setTextColor(51,65,85)
      doc.setFontSize(10)
      doc.setFont('helvetica','bold')
      doc.text('DISPONIBILIDAD POR MAQUINA', margin + 4, y + 5.5)
      y += 12

      datos.maquinas.slice(0, 12).forEach((m) => {
        const pct = Math.min(100, Math.max(0, m.disponibilidad_pct || 0))
        const c = pct >= 85 ? [22,163,74] : pct >= 65 ? [245,158,11] : [239,68,68]
        const barW = W - margin*2 - 60

        doc.setTextColor(51,65,85)
        doc.setFontSize(8)
        doc.setFont('helvetica','normal')
        doc.text(m.nombre.substring(0,22), margin, y + 3.5)

        doc.setFillColor(226,232,240)
        doc.roundedRect(margin + 52, y, barW, 5, 1, 1, 'F')
        doc.setFillColor(...c)
        doc.roundedRect(margin + 52, y, (barW * pct / 100), 5, 1, 1, 'F')

        doc.setTextColor(...c)
        doc.setFont('helvetica','bold')
        doc.setFontSize(8)
        doc.text(`${pct}%`, W - margin - 2, y + 4, { align: 'right' })

        doc.setTextColor(148,163,184)
        doc.setFont('helvetica','normal')
        doc.setFontSize(7)
        doc.text(`${m.total_paros} paros`, margin + 35, y + 3.5)

        y += 9
        if (y > 260) {
          doc.addPage()
          y = 20
        }
      })
      y += 4

      // ── TOP MOTIVOS ───────────────────────────────────────────────
      if (datos.top_motivos?.length > 0) {
        if (y > 220) { doc.addPage(); y = 20 }

        doc.setFillColor(248,250,252)
        doc.setDrawColor(226,232,240)
        doc.roundedRect(margin, y, W - margin*2, 8, 2, 2, 'FD')
        doc.setTextColor(51,65,85)
        doc.setFontSize(10)
        doc.setFont('helvetica','bold')
        doc.text('TOP MOTIVOS DE PARO', margin + 4, y + 5.5)
        y += 12

        const maxMin = Math.max(...datos.top_motivos.map(m => m.minutos_perdidos || 0))
        const barMaxW = W - margin*2 - 70

        datos.top_motivos.slice(0,8).forEach((mo) => {
          const pct = maxMin > 0 ? (mo.minutos_perdidos / maxMin) : 0
          const hex = mo.color_hex || '#3b82f6'
          const [r,g,b] = colorHex(hex.length === 7 ? hex : '#3b82f6')

          doc.setFillColor(r,g,b)
          doc.circle(margin + 2, y + 2.5, 2, 'F')

          doc.setTextColor(51,65,85)
          doc.setFontSize(8)
          doc.setFont('helvetica','normal')
          doc.text(mo.nombre.substring(0,24), margin + 6, y + 3.5)

          doc.setFillColor(226,232,240)
          doc.roundedRect(margin + 56, y, barMaxW, 5, 1, 1, 'F')
          doc.setFillColor(r,g,b)
          doc.roundedRect(margin + 56, y, barMaxW * pct, 5, 1, 1, 'F')

          doc.setTextColor(100,116,139)
          doc.setFontSize(7)
          doc.text(formatMin(mo.minutos_perdidos), W - margin - 2, y + 4, { align: 'right' })

          y += 9
          if (y > 260) { doc.addPage(); y = 20 }
        })
        y += 4
      }

      // ── ANALISIS IA ───────────────────────────────────────────────
      if (analisisIA) {
        doc.addPage()
        y = 20

        // Header IA
        doc.setFillColor(109,40,217)
        doc.roundedRect(margin, y, W - margin*2, 14, 3, 3, 'F')
        doc.setTextColor(255,255,255)
        doc.setFontSize(12)
        doc.setFont('helvetica','bold')
        doc.text('ANALISIS INTELIGENTE CON IA', margin + 5, y + 9)
        doc.setFontSize(8)
        doc.setFont('helvetica','normal')
        doc.setTextColor(221,214,254)
        doc.text('Diagnostico automatico · Recomendaciones accionables', W - margin - 2, y + 9, { align: 'right' })
        y += 20

        const addSection = (titulo, color, contenido) => {
          if (y > 250) { doc.addPage(); y = 20 }
          doc.setFillColor(...color)
          doc.roundedRect(margin, y, W - margin*2, 7, 2, 2, 'F')
          doc.setTextColor(255,255,255)
          doc.setFontSize(9)
          doc.setFont('helvetica','bold')
          doc.text(titulo, margin + 3, y + 4.8)
          y += 10
          contenido()
          y += 4
        }

        const addTextBox = (text, bgColor, textColor) => {
          if (y > 255) { doc.addPage(); y = 20 }
          const lines = doc.splitTextToSize(text, W - margin*2 - 8)
          const boxH = lines.length * 5 + 6
          doc.setFillColor(...bgColor)
          doc.setDrawColor(226,232,240)
          doc.roundedRect(margin, y, W - margin*2, boxH, 2, 2, 'FD')
          doc.setTextColor(...textColor)
          doc.setFontSize(8.5)
          doc.setFont('helvetica','normal')
          lines.forEach((line, i) => {
            doc.text(line, margin + 4, y + 6 + i * 5)
          })
          y += boxH + 3
        }

        // Resumen ejecutivo
        addSection('RESUMEN EJECUTIVO', [51,65,85], () => {
          addTextBox(analisisIA.resumen_ejecutivo || '', [248,250,252], [51,65,85])
          if (analisisIA.nivel_oee) {
            doc.setFillColor(...oeeColor)
            doc.roundedRect(margin, y, 60, 7, 2, 2, 'F')
            doc.setTextColor(255,255,255)
            doc.setFontSize(8)
            doc.setFont('helvetica','bold')
            doc.text(analisisIA.nivel_oee, margin + 30, y + 4.8, { align: 'center' })
            y += 10
          }
        })

        // Alertas criticas
        if (analisisIA.alertas_criticas?.length > 0) {
          addSection('ALERTAS CRITICAS', [220,38,38], () => {
            analisisIA.alertas_criticas.forEach(a => {
              if (y > 255) { doc.addPage(); y = 20 }
              addTextBox('• ' + a, [254,242,242], [185,28,28])
            })
          })
        }

        // Causas raiz
        if (analisisIA.causas_raiz?.length > 0) {
          addSection('CAUSAS RAIZ POR MAQUINA', [234,88,12], () => {
            analisisIA.causas_raiz.forEach((c) => {
              if (y > 240) { doc.addPage(); y = 20 }
              doc.setFillColor(255,247,237)
              doc.setDrawColor(253,186,116)
              doc.roundedRect(margin, y, W - margin*2, 26, 2, 2, 'FD')

              doc.setTextColor(154,52,18)
              doc.setFontSize(9)
              doc.setFont('helvetica','bold')
              doc.text(`${c.maquina}${c.linea ? ' · ' + c.linea : ''}`, margin + 3, y + 6)

              if (c.impacto_cop > 0) {
                doc.setTextColor(220,38,38)
                doc.setFontSize(8)
                doc.text(formatCOP(c.impacto_cop), W - margin - 3, y + 6, { align: 'right' })
              }

              doc.setTextColor(51,65,85)
              doc.setFontSize(8)
              doc.setFont('helvetica','normal')
              const causeLines = doc.splitTextToSize(c.causa_probable || '', W - margin*2 - 8)
              causeLines.forEach((l,i) => doc.text(l, margin + 3, y + 12 + i*4.5))

              doc.setTextColor(100,116,139)
              doc.setFontSize(7.5)
              doc.setFont('helvetica','italic')
              const evLines = doc.splitTextToSize(c.evidencia || '', W - margin*2 - 8)
              evLines.forEach((l,i) => doc.text(l, margin + 3, y + 20 + i*4))

              y += 30
            })
          })
        }

        // Plan de accion
        if (analisisIA.plan_accion?.length > 0) {
          addSection('PLAN DE ACCION PRIORIZADO', [109,40,217], () => {
            analisisIA.plan_accion.forEach((p) => {
              if (y > 240) { doc.addPage(); y = 20 }
              doc.setFillColor(250,245,255)
              doc.setDrawColor(196,181,253)
              doc.roundedRect(margin, y, W - margin*2, 28, 2, 2, 'FD')

              doc.setFillColor(109,40,217)
              doc.circle(margin + 6, y + 8, 5, 'F')
              doc.setTextColor(255,255,255)
              doc.setFontSize(9)
              doc.setFont('helvetica','bold')
              doc.text(String(p.prioridad), margin + 6, y + 10.5, { align: 'center' })

              doc.setTextColor(51,65,85)
              doc.setFontSize(9)
              doc.setFont('helvetica','bold')
              const acLines = doc.splitTextToSize(p.accion || '', W - margin*2 - 22)
              acLines.forEach((l,i) => doc.text(l, margin + 14, y + 6 + i*4.5))

              doc.setTextColor(100,116,139)
              doc.setFontSize(7.5)
              doc.setFont('helvetica','normal')
              doc.text(`Donde: ${p.maquina_o_area || ''}`, margin + 14, y + 15)

              const plazoColor = p.plazo === 'inmediato' ? [220,38,38] : p.plazo === 'corto_plazo' ? [217,119,6] : [37,99,235]
              doc.setTextColor(...plazoColor)
              doc.setFontSize(7.5)
              doc.setFont('helvetica','bold')
              doc.text((p.plazo || '').replace(/_/g,' ').toUpperCase(), margin + 14, y + 20)

              if (p.ahorro_estimado_cop > 0) {
                doc.setTextColor(21,128,61)
                doc.text(`Ahorro est: ${formatCOP(p.ahorro_estimado_cop)}`, W - margin - 3, y + 20, { align: 'right' })
              }

              const impLines = doc.splitTextToSize(p.impacto_esperado || '', W - margin*2 - 22)
              doc.setTextColor(71,85,105)
              doc.setFontSize(7.5)
              doc.setFont('helvetica','normal')
              impLines.forEach((l,i) => doc.text(l, margin + 14, y + 25 + i*4))

              y += 32
            })
          })
        }

        // Recomendaciones mantenimiento
        if (analisisIA.recomendaciones_mantenimiento?.length > 0) {
          addSection('RECOMENDACIONES DE MANTENIMIENTO PREVENTIVO', [21,128,61], () => {
            analisisIA.recomendaciones_mantenimiento.forEach((r) => {
              if (y > 240) { doc.addPage(); y = 20 }
              doc.setFillColor(240,253,244)
              doc.setDrawColor(134,239,172)
              doc.roundedRect(margin, y, W - margin*2, 24, 2, 2, 'FD')

              doc.setTextColor(21,128,61)
              doc.setFontSize(9)
              doc.setFont('helvetica','bold')
              doc.text(r.equipo || '', margin + 3, y + 6)

              const frecColors = { diaria: [220,38,38], semanal: [217,119,6], mensual: [37,99,235] }
              const fc = frecColors[r.frecuencia] || [100,116,139]
              doc.setTextColor(...fc)
              doc.setFontSize(7.5)
              doc.setFont('helvetica','bold')
              doc.text((r.frecuencia || '').toUpperCase(), W - margin - 3, y + 6, { align: 'right' })

              doc.setTextColor(51,65,85)
              doc.setFontSize(8.5)
              doc.setFont('helvetica','normal')
              const recLines = doc.splitTextToSize(r.recomendacion || '', W - margin*2 - 8)
              recLines.forEach((l,i) => doc.text(l, margin + 3, y + 12 + i*4.5))

              doc.setTextColor(100,116,139)
              doc.setFontSize(7.5)
              doc.setFont('helvetica','italic')
              const jusLines = doc.splitTextToSize(r.justificacion || '', W - margin*2 - 8)
              jusLines.forEach((l,i) => doc.text(l, margin + 3, y + 18 + i*4))

              y += 28
            })
          })
        }
      }

      // ── FOOTER EN CADA PAGINA ─────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFillColor(15,23,42)
        doc.rect(0, 287, W, 10, 'F')
        doc.setTextColor(148,163,184)
        doc.setFontSize(7)
        doc.setFont('helvetica','normal')
        doc.text('SGPM - Sistema de Gestion de Paros de Maquinas', margin, 293)
        doc.text(`Pagina ${i} de ${totalPages}`, W - margin, 293, { align: 'right' })
      }

      doc.save(`OEE_Reporte_${datos.periodo.fecha_inicio}_${datos.periodo.fecha_fin}.pdf`)
    } catch (e) {
      console.error('Error exportando PDF:', e)
    }
    setExportando(false)
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">Calculando OEE...</p>
    </div>
  )

  if (!datos) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">Sin datos disponibles</p>
    </div>
  )

  const { oee_global, maquinas, lineas: lineasData, top_motivos, periodo } = datos
  const colores = colorOEE(oee_global)
  const radialData = [{ value: Math.max(0, Math.min(100, oee_global)), fill: colores.bar }]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">OEE & Analisis con IA</h1>
          <p className="text-slate-500 text-sm mt-1">
            Disponibilidad de equipos · Periodo: {periodo.fecha_inicio} al {periodo.fecha_fin}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportarPDF} disabled={exportando || !datos}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {exportando ? '⏳ Generando...' : '📄 Exportar PDF'}
          </button>
          <button onClick={() => cargar(filtro)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Fecha inicio</label>
          <input type="date" value={filtro.fecha_inicio}
            onChange={e => setFiltro(p => ({ ...p, fecha_inicio: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Fecha fin</label>
          <input type="date" value={filtro.fecha_fin}
            onChange={e => setFiltro(p => ({ ...p, fecha_fin: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Linea</label>
          <select value={filtro.linea}
            onChange={e => setFiltro(p => ({ ...p, linea: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
            <option value="">Todas las lineas</option>
            {lineas.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button onClick={() => cargar(filtro)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Buscar
        </button>
      </div>

      {/* OEE Global */}
      <div className={`rounded-2xl border-2 p-6 mb-6 ${colores.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">OEE Global de Disponibilidad</p>
            <div className="flex items-end gap-3">
              <span className={`text-6xl font-black ${colores.text}`}>{oee_global}%</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full mb-2 ${colores.badge}`}>
                {nivelOEE(oee_global)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Referencia: &gt;85% Clase Mundial · 65-85% Aceptable · &lt;65% Critico
            </p>
          </div>
          <div style={{ width: 128, height: 128, flexShrink: 0 }}>
            <RadialBarChart width={128} height={128} innerRadius="60%" outerRadius="95%"
              data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#e2e8f0' }} />
            </RadialBarChart>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Maquinas analizadas', valor: maquinas.length, color: 'text-blue-600', icono: '⚙️' },
          { label: 'Total paros', valor: maquinas.reduce((a,m) => a + Number(m.total_paros||0), 0), color: 'text-red-600', icono: '🛑' },
          { label: 'Tiempo perdido', valor: formatMin(maquinas.reduce((a,m) => a + Number(m.minutos_perdidos||0), 0)), color: 'text-orange-600', icono: '⏱️' },
          { label: 'Costo total perdido', valor: formatCOP(maquinas.reduce((a,m) => a + Number(m.costo_perdido||0), 0)), color: 'text-red-700', icono: '💸' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span>{k.icono}</span>
              <p className="text-xs text-slate-500">{k.label}</p>
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Disponibilidad por maquina */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Disponibilidad por Maquina</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {maquinas.map((m, i) => {
              const c = colorOEE(m.disponibilidad_pct)
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{m.nombre}</p>
                    <p className="text-xs text-slate-400">{m.codigo}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">{m.total_paros} paros</span>
                      <span className={`text-xs font-bold ${c.text}`}>{m.disponibilidad_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100,Math.max(0,m.disponibilidad_pct))}%`, backgroundColor: c.bar }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top motivos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Top Motivos de Paro</h2>
          {top_motivos.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Sin datos en el periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top_motivos} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="nombre" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [formatMin(v), 'Tiempo perdido']} />
                <Bar dataKey="minutos_perdidos" radius={[4, 4, 0, 0]}>
                  {top_motivos.map((m, i) => <Cell key={i} fill={m.color_hex || '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* OEE por linea */}
      {lineasData?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">Disponibilidad por Linea de Produccion</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lineasData.map((l, i) => {
              const c = colorOEE(l.disponibilidad_pct)
              return (
                <div key={i} className={`rounded-xl border-2 p-4 ${c.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-700 text-sm">{l.linea}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                      {nivelOEE(l.disponibilidad_pct)}
                    </span>
                  </div>
                  <p className={`text-3xl font-black ${c.text} mb-2`}>{l.disponibilidad_pct}%</p>
                  <div className="w-full bg-white/60 rounded-full h-2 mb-3">
                    <div className="h-2 rounded-full"
                      style={{ width: `${Math.min(100,Math.max(0,l.disponibilidad_pct))}%`, backgroundColor: c.bar }} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                    <span>⚙️ {l.total_maquinas} maquinas</span>
                    <span>🛑 {l.total_paros} paros</span>
                    <span>⏱️ {formatMin(l.minutos_perdidos)}</span>
                    <span>💸 {formatCOP(l.costo_perdido)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Analisis IA */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white text-lg">🤖</div>
            <div>
              <h2 className="font-bold text-slate-800">Analisis Inteligente con IA</h2>
              <p className="text-xs text-slate-400">Diagnostico automatico · Recomendaciones accionables</p>
            </div>
          </div>
          {analisisIA && (
            <button onClick={() => analizarConIA(datos)}
              className="text-xs bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg font-medium">
              🔄 Regenerar
            </button>
          )}
        </div>

        <div className="p-5">
          {cargandoIA ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Analizando patrones de fallo con IA...</p>
              <p className="text-slate-300 text-xs">Esto puede tomar unos segundos</p>
            </div>
          ) : errorIA ? (
            <div className="text-center py-8">
              <p className="text-red-500 text-sm mb-3">{errorIA}</p>
              <button onClick={() => analizarConIA(datos)}
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm">
                Reintentar analisis
              </button>
            </div>
          ) : analisisIA ? (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">📋 Resumen Ejecutivo</p>
                <p className="text-slate-700 text-sm leading-relaxed">{analisisIA.resumen_ejecutivo}</p>
                <div className="mt-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${colores.badge}`}>
                    {analisisIA.nivel_oee}
                  </span>
                </div>
              </div>

              {analisisIA.alertas_criticas?.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <p className="text-xs font-bold text-red-600 uppercase mb-2">🚨 Alertas Criticas</p>
                  <ul className="space-y-1">
                    {analisisIA.alertas_criticas.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="mt-0.5 flex-shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analisisIA.causas_raiz?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">🔍 Causas Raiz por Maquina</p>
                  <div className="space-y-3">
                    {analisisIA.causas_raiz.map((c, i) => (
                      <div key={i} className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{c.maquina}</span>
                            {c.linea && <span className="text-xs text-slate-400 ml-2">· {c.linea}</span>}
                          </div>
                          {c.impacto_cop > 0 && (
                            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              {formatCOP(c.impacto_cop)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-orange-800 mb-1">{c.causa_probable}</p>
                        <p className="text-xs text-slate-500 italic">{c.evidencia}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analisisIA.plan_accion?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">📋 Plan de Accion Priorizado</p>
                  <div className="space-y-3">
                    {analisisIA.plan_accion.map((p, i) => {
                      const plazoColor = p.plazo === 'inmediato'
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : p.plazo === 'corto_plazo'
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        : 'bg-blue-100 text-blue-700 border-blue-200'
                      const tipoIcon = { mantenimiento_preventivo: '⚙️', correctivo: '🔧', proceso: '⚠️', capacitacion: '📚' }[p.tipo] || '📋'
                      return (
                        <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                              {p.prioridad}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-slate-800 text-sm mb-1">{tipoIcon} {p.accion}</p>
                              <p className="text-xs text-slate-500 mb-2">📍 {p.maquina_o_area}</p>
                              <p className="text-xs text-slate-600 mb-2">{p.impacto_esperado}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${plazoColor}`}>
                                  {p.plazo?.replace(/_/g,' ')}
                                </span>
                                {p.ahorro_estimado_cop > 0 && (
                                  <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                    💰 Ahorro est. {formatCOP(p.ahorro_estimado_cop)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {analisisIA.recomendaciones_mantenimiento?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">🔧 Recomendaciones de Mantenimiento Preventivo</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {analisisIA.recomendaciones_mantenimiento.map((r, i) => {
                      const frecColor = {
                        diaria: 'bg-red-50 text-red-600 border-red-200',
                        semanal: 'bg-yellow-50 text-yellow-600 border-yellow-200',
                        mensual: 'bg-blue-50 text-blue-600 border-blue-200'
                      }[r.frecuencia] || 'bg-slate-50 text-slate-600 border-slate-200'
                      return (
                        <div key={i} className="bg-green-50 rounded-xl p-3 border border-green-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-slate-700 text-sm">{r.equipo}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${frecColor}`}>
                              {r.frecuencia}
                            </span>
                          </div>
                          <p className="text-sm text-green-800 font-medium mb-1">{r.recomendacion}</p>
                          <p className="text-xs text-slate-500 italic">{r.justificacion}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p>Sin datos suficientes para el analisis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}