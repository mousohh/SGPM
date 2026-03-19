import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, BarChart, Bar, LineChart
} from 'recharts'
import { exportarReportePDF } from '../../utils/exportPDF'

const COLORES = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b']

const formatHoras = (segundos) => {
  if (!segundos) return '0s'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const formatMinutos = (minutosDecimal) => {
  if (!minutosDecimal) return '0s'
  const totalSegundos = Math.round(minutosDecimal * 60)
  const h = Math.floor(totalSegundos / 3600)
  const m = Math.floor((totalSegundos % 3600) / 60)
  const s = totalSegundos % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const formatCOP = (valor) => {
  if (!valor) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(valor)
}

const formatEjeX = (periodo, granularidad) => {
  if (!periodo) return ''
  if (granularidad === 'hora') return periodo.slice(11, 16)
  if (granularidad === 'mes') return periodo.slice(0, 7)
  return periodo.slice(5)
}

const TooltipSeries = ({ active, payload, label, granularidad }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-2">📅 {formatEjeX(label, granularidad)}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold text-slate-800">
            {p.name === 'Costo (COP)'
              ? formatCOP(p.value)
              : p.name === 'Unidades'
              ? Number(p.value).toLocaleString('es-CO')
              : formatMinutos(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Reportes() {
  const [filtro, setFiltro] = useState({
    fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    fecha_fin: new Date().toISOString().slice(0, 10),
    linea: ''
  })
  const [filtroPareto, setFiltroPareto] = useState({ granularidad: 'dia', linea: '' })
  const [filtroSeries, setFiltroSeries] = useState({ granularidad: 'dia', linea: '' })
  const [resumen, setResumen] = useState(null)
  const [disponibilidad, setDisponibilidad] = useState([])
  const [pareto, setPareto] = useState([])
  const [tendencia, setTendencia] = useState([])
  const [seriesTemporal, setSeriesTemporal] = useState([])
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoPareto, setCargandoPareto] = useState(false)
  const [cargandoSeries, setCargandoSeries] = useState(false)
  const [exportando, setExportando] = useState(false)

  const cargarLineas = async () => {
    const data = await api.get('/reportes/lineas')
    setLineas(Array.isArray(data) ? data : [])
  }

  const cargarPareto = async (f = filtro, fp = filtroPareto) => {
    setCargandoPareto(true)
    const params = new URLSearchParams()
    params.append('fecha_inicio', f.fecha_inicio)
    params.append('fecha_fin', f.fecha_fin)
    params.append('granularidad', fp.granularidad)
    if (fp.linea) params.append('linea', fp.linea)
    const data = await api.get(`/reportes/pareto?${params}`)
    setPareto(Array.isArray(data) ? data : [])
    setCargandoPareto(false)
  }

  const cargarSeriesTemporal = async (f = filtro, fs = filtroSeries) => {
    setCargandoSeries(true)
    const params = new URLSearchParams()
    params.append('fecha_inicio', f.fecha_inicio)
    params.append('fecha_fin', f.fecha_fin)
    params.append('granularidad', fs.granularidad)
    if (fs.linea) params.append('linea', fs.linea)
    const data = await api.get(`/reportes/series-temporal?${params}`)
    setSeriesTemporal(Array.isArray(data) ? data : [])
    setCargandoSeries(false)
  }

  const cargar = async () => {
    setCargando(true)
    const lineaParam = filtro.linea ? `&linea=${encodeURIComponent(filtro.linea)}` : ''
    const params = `?fecha_inicio=${filtro.fecha_inicio}&fecha_fin=${filtro.fecha_fin}${lineaParam}`
    const [res, dis, ten] = await Promise.all([
      api.get(`/reportes/resumen${params}`),
      api.get(`/reportes/disponibilidad${params}`),
      api.get(`/reportes/tendencia${params}`)
    ])
    setResumen(res)
    setDisponibilidad(Array.isArray(dis) ? dis : [])
    setTendencia(Array.isArray(ten) ? ten : [])
    const fp = { ...filtroPareto, linea: filtro.linea }
    const fs = { ...filtroSeries, linea: filtro.linea }
    setFiltroPareto(fp)
    setFiltroSeries(fs)
    await cargarPareto(filtro, fp)
    await cargarSeriesTemporal(filtro, fs)
    setCargando(false)
  }

  // Carga con fechas explícitas — evita depender del estado de React
  const cargarConFechas = async (fi, ff, linea = '') => {
    setCargando(true)
    const lineaParam = linea ? `&linea=${encodeURIComponent(linea)}` : ''
    const params = `?fecha_inicio=${fi}&fecha_fin=${ff}${lineaParam}`
    const fp = { ...filtroPareto, linea }
    const fs = { ...filtroSeries, linea }
    setFiltroPareto(fp)
    setFiltroSeries(fs)
    const [res, dis, ten] = await Promise.all([
      api.get(`/reportes/resumen${params}`),
      api.get(`/reportes/disponibilidad${params}`),
      api.get(`/reportes/tendencia${params}`)
    ])
    setResumen(res)
    setDisponibilidad(Array.isArray(dis) ? dis : [])
    setTendencia(Array.isArray(ten) ? ten : [])
    await cargarPareto({ fecha_inicio: fi, fecha_fin: ff, linea }, fp)
    await cargarSeriesTemporal({ fecha_inicio: fi, fecha_fin: ff, linea }, fs)
    setCargando(false)
  }

  useEffect(() => {
    cargarLineas()
    cargar()
  }, [])

  const paretoAgrupado = pareto.reduce((acc, item) => {
    const existe = acc.find(a => a.nombre === item.nombre)
    if (existe) {
      existe.minutos_perdidos = parseFloat((existe.minutos_perdidos + parseFloat(item.minutos_perdidos || 0)).toFixed(1))
      existe.costo_perdido = (existe.costo_perdido || 0) + (parseInt(item.costo_perdido) || 0)
      existe.total_paros = (existe.total_paros || 0) + (parseInt(item.total_paros) || 0)
    } else {
      acc.push({
        nombre: item.nombre,
        color_hex: item.color_hex,
        categoria: item.categoria,
        minutos_perdidos: parseFloat(item.minutos_perdidos || 0),
        costo_perdido: parseInt(item.costo_perdido) || 0,
        total_paros: parseInt(item.total_paros) || 0
      })
    }
    return acc
  }, []).sort((a, b) => b.minutos_perdidos - a.minutos_perdidos)

  const handleExportPDF = async () => {
    setExportando(true)
    try {
      const params = `?fecha_inicio=${filtro.fecha_inicio}&fecha_fin=${filtro.fecha_fin}`
      const hist = await api.get(`/paros/historial${params}`)
      await exportarReportePDF({
        resumen,
        disponibilidad,
        paretoAgrupado,
        historial: Array.isArray(hist) ? hist : [],
        filtro
      })
    } catch (e) {
      console.error('Error exportando PDF:', e)
    }
    setExportando(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reportes y Analítica</h1>
          <p className="text-slate-500 text-sm mt-1">Análisis de paros, disponibilidad y costos</p>
        </div>
        <button onClick={handleExportPDF} disabled={exportando || cargando}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {exportando ? '⏳ Generando...' : '📄 Exportar PDF'}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Fecha inicio</label>
          <input type="date" value={filtro.fecha_inicio}
            onChange={e => setFiltro({ ...filtro, fecha_inicio: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Fecha fin</label>
          <input type="date" value={filtro.fecha_fin}
            onChange={e => setFiltro({ ...filtro, fecha_fin: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Línea</label>
          <select value={filtro.linea}
            onChange={e => setFiltro({ ...filtro, linea: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
            <option value="">Todas las líneas</option>
            {lineas.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button onClick={cargar}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Aplicar filtro
        </button>

        {/* Botón Hoy — pasa fechas directamente sin depender del estado */}
        <button onClick={() => {
          const hoy = new Date().toISOString().slice(0, 10)
          setFiltro({ fecha_inicio: hoy, fecha_fin: hoy, linea: '' })
          cargarConFechas(hoy, hoy, '')
        }} className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
          Hoy
        </button>

        {filtro.linea && (
          <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-2 rounded-lg">
            📍 {filtro.linea}
            <button onClick={() => {
              setFiltro(prev => ({ ...prev, linea: '' }))
              setTimeout(cargar, 100)
            }} className="hover:text-blue-900 ml-1 font-bold">×</button>
          </span>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400">Cargando reportes...</div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Paros', valor: resumen?.total_paros || 0, color: 'text-red-500', bg: 'bg-red-50 border-red-200', icono: '🛑' },
              { label: 'Horas Perdidas', valor: `${resumen?.horas_perdidas || 0}h`, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200', icono: '⏱️' },
              { label: 'Costo Total Perdido', valor: formatCOP(resumen?.costo_total_perdido), color: 'text-red-700', bg: 'bg-red-50 border-red-300', icono: '💸' },
              { label: 'Máquina Crítica', valor: resumen?.maquina_critica || '—', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icono: '⚠️' },
            ].map((k, i) => (
              <div key={i} className={`rounded-xl p-4 border ${k.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{k.icono}</span>
                  <p className="text-slate-500 text-xs">{k.label}</p>
                </div>
                <p className={`text-xl font-bold ${k.color}`}>{k.valor}</p>
                {i === 3 && resumen?.costo_maquina_critica > 0 && (
                  <p className="text-xs text-purple-400 mt-1">{formatCOP(resumen.costo_maquina_critica)} perdidos</p>
                )}
              </div>
            ))}
          </div>

          {/* Gráficas disponibilidad y costo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-700 mb-4">Disponibilidad por Máquina (%)</h2>
              {disponibilidad.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin datos en el período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={disponibilidad} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Disponibilidad']} />
                    <Bar dataKey="disponibilidad_pct" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-700 mb-4">Costo Perdido por Máquina (COP)</h2>
              {disponibilidad.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin datos en el período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={disponibilidad} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [formatCOP(v), 'Costo perdido']} />
                    <Bar dataKey="costo_perdido" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Serie Temporal */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-semibold text-slate-700">Serie Temporal de Paros</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Línea</label>
                  <select value={filtroSeries.linea}
                    onChange={e => setFiltroSeries({ ...filtroSeries, linea: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Toda la planta</option>
                    {lineas.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Granularidad</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {[{ valor: 'hora', label: 'Hora' }, { valor: 'dia', label: 'Día' }, { valor: 'mes', label: 'Mes' }].map(g => (
                      <button key={g.valor}
                        onClick={() => setFiltroSeries({ ...filtroSeries, granularidad: g.valor })}
                        className={`px-3 py-1.5 text-sm transition-colors
                          ${filtroSeries.granularidad === g.valor ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => cargarSeriesTemporal(filtro, filtroSeries)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium mt-4">
                  Filtrar
                </button>
              </div>
            </div>
            {cargandoSeries ? (
              <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
            ) : seriesTemporal.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin datos en el período</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={seriesTemporal} margin={{ top: 10, right: 70, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={-35} textAnchor="end"
                    interval="preserveStartEnd" tickFormatter={v => formatEjeX(v, filtroSeries.granularidad)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }}
                    label={{ value: 'Minutos', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: 11, fill: '#64748b' } }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}
                    tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
                    label={{ value: 'COP', angle: 90, position: 'insideRight', offset: -5, style: { fontSize: 11, fill: '#64748b' } }} />
                  <Tooltip content={<TooltipSeries granularidad={filtroSeries.granularidad} />} />
                  <Legend verticalAlign="top" height={36}
                    formatter={v => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>} />
                  <Line yAxisId="left" type="monotone" dataKey="minutos_perdidos"
                    name="Minutos perdidos" stroke="#2ecc71" strokeWidth={2}
                    dot={{ r: 4, fill: '#2ecc71' }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="costo_perdido"
                    name="Costo (COP)" stroke="#4FC3F7" strokeWidth={2}
                    dot={{ r: 3, fill: '#4FC3F7' }} activeDot={{ r: 5 }} />
                  <Line yAxisId="left" type="monotone" dataKey="unidades_no_producidas"
                    name="Unidades" stroke="#9575CD" strokeWidth={2}
                    dot={{ r: 3, fill: '#9575CD' }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pareto */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-semibold text-slate-700">Motivos de Paro (tiempo perdido)</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Línea</label>
                  <select value={filtroPareto.linea}
                    onChange={e => setFiltroPareto({ ...filtroPareto, linea: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Todas las líneas</option>
                    {lineas.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Granularidad</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {[{ valor: 'hora', label: 'Hora' }, { valor: 'dia', label: 'Día' }, { valor: 'mes', label: 'Mes' }].map(g => (
                      <button key={g.valor}
                        onClick={() => setFiltroPareto({ ...filtroPareto, granularidad: g.valor })}
                        className={`px-3 py-1.5 text-sm transition-colors
                          ${filtroPareto.granularidad === g.valor ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => cargarPareto(filtro, filtroPareto)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium mt-4">
                  Filtrar
                </button>
              </div>
            </div>
            {cargandoPareto ? (
              <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
            ) : paretoAgrupado.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin datos en el período</p>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={paretoAgrupado} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [formatMinutos(v), 'Tiempo perdido']}
                      labelFormatter={l => `Motivo: ${l}`} />
                    <Bar dataKey="minutos_perdidos" radius={[4, 4, 0, 0]}>
                      {paretoAgrupado.map((entry, index) => (
                        <Cell key={index} fill={entry.color_hex || COLORES[index % COLORES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Motivo', 'Categoría', 'Total Paros', 'Tiempo Perdido', 'Costo Perdido'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paretoAgrupado.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color_hex }} />
                              <span className="text-sm text-slate-800">{m.nombre}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-500 capitalize">{m.categoria}</td>
                          <td className="px-3 py-2 text-sm text-slate-800">{m.total_paros}</td>
                          <td className="px-3 py-2 text-sm font-medium text-orange-600">{formatMinutos(m.minutos_perdidos)}</td>
                          <td className="px-3 py-2 text-sm font-bold text-red-600">{formatCOP(m.costo_perdido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Tendencia */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h2 className="font-semibold text-slate-700 mb-4">Tendencia de Paros por Día</h2>
            {tendencia.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin datos en el período</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tendencia} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={v => `Fecha: ${v}`}
                    formatter={(v, n) => [
                      n === 'minutos_perdidos' ? formatMinutos(v) : v,
                      n === 'minutos_perdidos' ? 'Tiempo perdido' : 'Paros'
                    ]} />
                  <Line type="monotone" dataKey="minutos_perdidos" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="minutos_perdidos" />
                  <Line type="monotone" dataKey="total_paros" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="total_paros" />
                  <Legend formatter={v => v === 'minutos_perdidos' ? 'Tiempo perdido' : 'Total paros'} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Detalle por máquina */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-700">Detalle por Máquina</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Máquina', 'Línea', 'Área', 'Total Paros', 'Tiempo Perdido', 'Costo/hora', 'Costo Perdido', 'Disponibilidad'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disponibilidad.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">Sin datos en el período</td></tr>
                )}
                {disponibilidad.map((m, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{m.nombre}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{m.linea || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{m.area || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{m.total_paros}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{formatHoras(m.segundos_perdidos)}</td>
                    <td className="px-4 py-3 text-sm text-green-700 font-medium">{formatCOP(m.costo_hora)}/h</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600">{formatCOP(m.costo_perdido)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(Math.max(m.disponibilidad_pct, 0), 100)}%`,
                              backgroundColor: m.disponibilidad_pct >= 80 ? '#16a34a' : m.disponibilidad_pct >= 60 ? '#f59e0b' : '#ef4444'
                            }} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-12">{m.disponibilidad_pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}