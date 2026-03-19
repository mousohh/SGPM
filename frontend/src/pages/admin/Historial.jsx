import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

const formatDuracion = (segundos) => {
  if (!segundos) return '—'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

const formatFecha = (fecha) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const formatCOP = (valor) => {
  if (!valor) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(valor)
}

const toDatetimeLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const fromDatetimeLocal = (val) => {
  if (!val) return ''
  const d = new Date(val)
  const offset = d.getTimezoneOffset()
  const utc = new Date(d.getTime() + offset * 60000)
  return utc.toISOString().slice(0, 19).replace('T', ' ')
}

const POR_PAGINA = 15

export default function Historial() {
  const { usuario } = useAuth()
  const [paros, setParos] = useState([])
  const [maquinas, setMaquinas] = useState([])
  const [motivos, setMotivos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [filtro, setFiltro] = useState({
    fecha_inicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    fecha_fin: new Date().toISOString().slice(0, 10),
    linea: '',
    maquina_id: '',
    motivo_id: '',
    turno: '',
    paro_id: ''
  })
  const [modalEliminar, setModalEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const [usuarios, setUsuarios] = useState([])
  const [modalEditar, setModalEditar] = useState(null)
  const [editForm, setEditForm] = useState({ inicio: '', fin: '', razon: '', maquina_id: '', usuario_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [errorEditar, setErrorEditar] = useState('')
  const [preview, setPreview] = useState(null)

  const cargar = async () => {
    setCargando(true)
    setPagina(0)
    const params = new URLSearchParams()
    if (filtro.fecha_inicio) params.append('fecha_inicio', filtro.fecha_inicio)
    if (filtro.fecha_fin) params.append('fecha_fin', filtro.fecha_fin)
    if (filtro.maquina_id) params.append('maquina_id', filtro.maquina_id)
    if (filtro.motivo_id) params.append('motivo_id', filtro.motivo_id)
    const [parosData, maqData, motivosData, usuariosData] = await Promise.all([
      api.get(`/paros/historial?${params}`),
      api.get('/maquinas'),
      api.get('/motivos'),
      api.get('/usuarios')
    ])
    setParos(parosData)
    setMaquinas(maqData)
    setMotivos(motivosData)
    setUsuarios(usuariosData.filter(u => u.rol === 'operador'))
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // Líneas únicas extraídas de las máquinas
  const lineas = [...new Set(maquinas.filter(m => m.linea).map(m => m.linea))].sort()

  // Máquinas filtradas por línea seleccionada
  const maquinasFiltradas = filtro.linea
    ? maquinas.filter(m => m.linea === filtro.linea)
    : maquinas

  const handleFiltroLinea = (linea) => {
    setFiltro(prev => ({ ...prev, linea, maquina_id: '' }))
  }

  // Filtrado local por línea (ya que el backend filtra por maquina_id)
  // Turnos: Mañana 05:30-13:29, Tarde 13:30-21:29, Noche 21:30-05:29
  const turnoDeHora = (fecha) => {
    if (!fecha) return null
    const h = new Date(fecha).getHours()
    const m = new Date(fecha).getMinutes()
    const mins = h * 60 + m
    if (mins >= 330 && mins < 810) return 'Mañana'
    if (mins >= 810 && mins < 1290) return 'Tarde'
    return 'Noche'
  }

  const parosFiltrados = paros.filter(p => {
    if (filtro.linea && p.linea !== filtro.linea) return false
    if (filtro.turno && turnoDeHora(p.inicio) !== filtro.turno) return false
    if (filtro.paro_id && !String(p.id).includes(filtro.paro_id.trim())) return false
    return true
  })

  const eliminarParo = async () => {
    if (!modalEliminar) return
    setEliminando(true)
    try {
      await api.delete(`/paros/${modalEliminar.id}`)
      setModalEliminar(null)
      await cargar()
    } catch { }
    setEliminando(false)
  }

  const abrirEditar = (paro) => {
    setModalEditar(paro)
    setEditForm({
      inicio: toDatetimeLocal(paro.inicio),
      fin: toDatetimeLocal(paro.fin),
      razon: '',
      maquina_id: paro.maquina_id || '',
      usuario_id: paro.usuario_id || ''
    })
    setErrorEditar('')
    setPreview(null)
  }

  const calcularPreview = (inicio, fin, maquinaId) => {
    if (!inicio || !fin) { setPreview(null); return }
    const ini = new Date(inicio)
    const fi = new Date(fin)
    if (fi <= ini) { setPreview(null); return }
    const segundos = Math.round((fi - ini) / 1000)
    const h = Math.floor(segundos / 3600)
    const m = Math.floor((segundos % 3600) / 60)
    const s = segundos % 60
    const duracion = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
    // usar la maquina del form si cambió, sino la original
    const maq = maquinas.find(m => m.id == (maquinaId || editForm.maquina_id)) || modalEditar
    const costo = Math.round((segundos / 3600) * (maq?.costo_hora || 0))
    const esLinea3 = maq?.linea === '3 - Sellado'
    const unidades = (esLinea3 && maq?.unidades_por_minuto > 0)
      ? Math.round((segundos / 60) * maq.unidades_por_minuto) : null
    setPreview({ duracion, costo, unidades, segundos })
  }

  const handleEditChange = (campo, valor) => {
    const nuevo = { ...editForm, [campo]: valor }
    setEditForm(nuevo)
    if (campo === 'inicio' || campo === 'fin' || campo === 'maquina_id') {
      calcularPreview(nuevo.inicio, nuevo.fin, nuevo.maquina_id)
    }
    setErrorEditar('')
  }

  const guardarEdicion = async () => {
    if (!editForm.inicio || !editForm.fin) { setErrorEditar('Completa inicio y fin'); return }
    if (new Date(editForm.fin) <= new Date(editForm.inicio)) { setErrorEditar('El fin debe ser posterior al inicio'); return }
    if (!editForm.razon.trim()) { setErrorEditar('Debes indicar la razón del cambio'); return }
    setGuardando(true)
    try {
      await api.put(`/paros/${modalEditar.id}/editar-tiempos`, {
        inicio: fromDatetimeLocal(editForm.inicio),
        fin: fromDatetimeLocal(editForm.fin),
        razon: editForm.razon.trim(),
        maquina_id: editForm.maquina_id || undefined,
        usuario_id: editForm.usuario_id || undefined
      })
      setModalEditar(null)
      await cargar()
    } catch (e) {
      setErrorEditar(e?.message || 'Error al guardar')
    }
    setGuardando(false)
  }

  const limpiarFiltros = () => {
    setFiltro({
      fecha_inicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      fecha_fin: new Date().toISOString().slice(0, 10),
      linea: '', maquina_id: '', motivo_id: '', turno: '', paro_id: ''
    })
    setTimeout(cargar, 100)
  }

  const filtrarUltimas24h = () => {
    const ahora = new Date()
    const hace24 = new Date(ahora.getTime() - 24 * 60 * 60 * 1000)
    setFiltro(prev => ({
      ...prev,
      fecha_inicio: hace24.toISOString().slice(0, 10),
      fecha_fin: ahora.toISOString().slice(0, 10),
      turno: ''
    }))
    setTimeout(cargar, 100)
  }

  // Paginación sobre datos filtrados localmente
  const totalPaginas = Math.ceil(parosFiltrados.length / POR_PAGINA)
  const parosPagina = parosFiltrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)

  // KPIs sobre todos los datos filtrados (no solo la página)
  const totalSegundos = parosFiltrados.reduce((acc, p) => acc + (p.duracion_segundos || 0), 0)
  const totalHoras = (totalSegundos / 3600).toFixed(1)
  const totalCosto = parosFiltrados.reduce((acc, p) => acc + (Number(p.costo_perdido) || 0), 0)
  const totalUnidades = parosFiltrados.reduce((acc, p) => acc + (Number(p.unidades_no_producidas) || 0), 0)

  const exportarExcel = () => {
    const datos = parosFiltrados.map(p => ({
      'Máquina': p.maquina_nombre,
      'Código': p.codigo,
      'Línea': p.linea || '—',
      'Motivo': p.motivo_nombre,
      'Categoría': p.categoria,
      'Operador': p.operador_nombre,
      'Orden CDP/MO': p.codigo_orden || '—',
      'Inicio': formatFecha(p.inicio),
      'Fin': formatFecha(p.fin),
      'Duración': formatDuracion(p.duracion_segundos),
      'Segundos': p.duracion_segundos || 0,
      'Costo perdido (COP)': p.costo_perdido || 0,
      'Unidades no producidas': p.unidades_no_producidas || '—',
      'Observaciones': p.observaciones || ''
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Historial de Paros')
    XLSX.writeFile(wb, `paros_${filtro.fecha_inicio}_al_${filtro.fecha_fin}.xlsx`)
  }

  const puedeEditar = usuario?.rol === 'admin' || usuario?.rol === 'supervisor'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Paros</h1>
          <p className="text-slate-500 text-sm mt-1">Registro detallado de todos los paros</p>
        </div>
        <button onClick={exportarExcel} disabled={parosFiltrados.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          📥 Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          {/* Buscar por ID */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ID del paro</label>
            <input type="text" value={filtro.paro_id} placeholder="Ej: 142"
              onChange={e => setFiltro(prev => ({ ...prev, paro_id: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-28" />
          </div>
          {/* Fechas */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha inicio</label>
            <input type="date" value={filtro.fecha_inicio}
              onChange={e => setFiltro(prev => ({ ...prev, fecha_inicio: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha fin</label>
            <input type="date" value={filtro.fecha_fin}
              onChange={e => setFiltro(prev => ({ ...prev, fecha_fin: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>

          {/* Turno */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Turno</label>
            <select value={filtro.turno}
              onChange={e => setFiltro(prev => ({ ...prev, turno: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Todos los turnos</option>
              <option value="Mañana">🌅 Mañana (5:30 - 13:29)</option>
              <option value="Tarde">🌤 Tarde (13:30 - 21:29)</option>
              <option value="Noche">🌙 Noche (21:30 - 5:29)</option>
            </select>
          </div>

          {/* Línea */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Línea</label>
            <select value={filtro.linea} onChange={e => handleFiltroLinea(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Todas las líneas</option>
              {lineas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Máquina — filtrada por línea */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Máquina</label>
            <select value={filtro.maquina_id}
              onChange={e => setFiltro(prev => ({ ...prev, maquina_id: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Todas las máquinas</option>
              {maquinasFiltradas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Motivo</label>
            <select value={filtro.motivo_id}
              onChange={e => setFiltro(prev => ({ ...prev, motivo_id: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Todos los motivos</option>
              {motivos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <button onClick={cargar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Buscar
          </button>
          <button onClick={() => {
            setFiltro({
              fecha_inicio: new Date().toISOString().slice(0, 10),
              fecha_fin: new Date().toISOString().slice(0, 10),
              linea: '', maquina_id: '', motivo_id: '', turno: ''
            })
            setTimeout(cargar, 100)
          }} className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
            Hoy
          </button>
          <button onClick={filtrarUltimas24h}
            className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
            ⏱ 24h
          </button>
          <button onClick={limpiarFiltros}
            className="border border-slate-300 text-slate-500 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
            🗑 Limpiar
          </button>
        </div>

        {/* Tags de filtros activos */}
        {(filtro.linea || filtro.maquina_id || filtro.motivo_id || filtro.turno) && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-slate-400">Filtros activos:</span>
            {filtro.turno && (
              <span className="flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2 py-1 rounded-full">
                🕐 {filtro.turno}
                <button onClick={() => setFiltro(prev => ({ ...prev, turno: '' }))} className="hover:text-purple-900 ml-1">×</button>
              </span>
            )}
            {filtro.linea && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-full">
                📍 {filtro.linea}
                <button onClick={() => handleFiltroLinea('')} className="hover:text-blue-900 ml-1">×</button>
              </span>
            )}
            {filtro.maquina_id && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-full">
                🔧 {maquinas.find(m => m.id == filtro.maquina_id)?.nombre}
                <button onClick={() => setFiltro(prev => ({ ...prev, maquina_id: '' }))} className="hover:text-blue-900 ml-1">×</button>
              </span>
            )}
            {filtro.motivo_id && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-full">
                ⚠️ {motivos.find(m => m.id == filtro.motivo_id)?.nombre}
                <button onClick={() => setFiltro(prev => ({ ...prev, motivo_id: '' }))} className="hover:text-blue-900 ml-1">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Paros', valor: parosFiltrados.length, color: 'text-red-500' },
          { label: 'Horas Perdidas', valor: `${totalHoras}h`, color: 'text-orange-500' },
          { label: 'Costo Total Perdido', valor: formatCOP(totalCosto), color: 'text-red-700' },
          { label: 'Unidades No Producidas', valor: totalUnidades > 0 ? totalUnidades.toLocaleString('es-CO') : '—', color: 'text-purple-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-slate-500 text-sm">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">
            {parosFiltrados.length} registro{parosFiltrados.length !== 1 ? 's' : ''} encontrado{parosFiltrados.length !== 1 ? 's' : ''}
            {totalPaginas > 1 && <span className="text-slate-400 font-normal text-sm ml-2">— página {pagina + 1} de {totalPaginas}</span>}
          </h2>
          {puedeEditar && (
            <p className="text-xs text-slate-400">✏️ Haz clic en editar para corregir tiempos</p>
          )}
        </div>

        {cargando ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : parosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg mb-1">Sin registros</p>
            <p className="text-sm">No hay paros con los filtros seleccionados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['ID', 'Máquina', 'Motivo', 'Operador', 'CDP', 'Inicio', 'Fin', 'Duración', 'Costo', 'Unid.', 'Obs.', ...(puedeEditar ? [''] : [])].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parosPagina.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs">#{p.id}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800 whitespace-nowrap">{p.maquina_nombre}</p>
                        <p className="text-slate-400 text-xs">{p.linea || ''}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color_hex }} />
                          <span className="text-slate-700 whitespace-nowrap">{p.motivo_nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.operador_nombre}</td>
                      <td className="px-3 py-2">
                        {p.codigo_orden
                          ? <span className="bg-blue-50 text-blue-700 border border-blue-200 font-mono px-1.5 py-0.5 rounded">{p.codigo_orden}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatFecha(p.inicio)}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatFecha(p.fin)}</td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800 whitespace-nowrap">{formatDuracion(p.duracion_segundos)}</td>
                      <td className="px-3 py-2 font-bold text-red-600 whitespace-nowrap">{formatCOP(p.costo_perdido)}</td>
                      <td className="px-3 py-2 font-medium text-purple-600 whitespace-nowrap">
                        {p.unidades_no_producidas ? Number(p.unidades_no_producidas).toLocaleString('es-CO') + ' u' : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate">{p.observaciones || '—'}</td>
                      {puedeEditar && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEditar(p)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                              ✏️
                            </button>
                            {usuario?.rol === 'admin' && (
                              <button onClick={() => setModalEliminar(p)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded-lg transition-colors">
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                <button onClick={() => setPagina(p => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                  className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-30 hover:bg-slate-50">
                  ← Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPaginas }, (_, i) => i).map(i => {
                    if (i === 0 || i === totalPaginas - 1 || Math.abs(i - pagina) <= 1) {
                      return (
                        <button key={i} onClick={() => setPagina(i)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                            ${pagina === i ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                          {i + 1}
                        </button>
                      )
                    }
                    if (Math.abs(i - pagina) === 2) {
                      return <span key={i} className="text-slate-400 text-sm px-1">…</span>
                    }
                    return null
                  })}
                </div>
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                  disabled={pagina === totalPaginas - 1}
                  className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-30 hover:bg-slate-50">
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal edición de tiempos */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col" style={{maxHeight: '85vh'}}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">✏️ Editar Paro</h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{modalEditar.maquina_nombre} · {modalEditar.motivo_nombre}</p>
              </div>
              <button onClick={() => setModalEditar(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none ml-2">×</button>
            </div>

            <div className="px-5 py-3 space-y-3 overflow-y-auto flex-1">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2">VALORES ACTUALES</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Duración</p>
                    <p className="font-bold text-slate-700">{formatDuracion(modalEditar.duracion_segundos)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Costo</p>
                    <p className="font-bold text-red-600">{formatCOP(modalEditar.costo_perdido)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Unidades</p>
                    <p className="font-bold text-purple-600">
                      {modalEditar.unidades_no_producidas
                        ? Number(modalEditar.unidades_no_producidas).toLocaleString('es-CO') + ' u' : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Máquina</label>
                <select value={editForm.maquina_id}
                  onChange={e => handleEditChange('maquina_id', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  {maquinas.filter(m => m.activa).map(m => (
                    <option key={m.id} value={m.id}>{m.nombre} · {m.linea}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Operador</label>
                <select value={editForm.usuario_id}
                  onChange={e => handleEditChange('usuario_id', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— Sin cambiar —</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Inicio del paro</label>
                <input type="datetime-local" value={editForm.inicio}
                  onChange={e => handleEditChange('inicio', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fin del paro</label>
                <input type="datetime-local" value={editForm.fin}
                  onChange={e => handleEditChange('fin', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Razón del cambio <span className="text-red-500">*</span>
                </label>
                <textarea value={editForm.razon}
                  onChange={e => handleEditChange('razon', e.target.value)}
                  placeholder="Ej: El operador registró mal el tiempo de fin, el paro realmente terminó a las 10:30..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                <p className="text-xs text-slate-400 mt-1">{editForm.razon.length}/200 caracteres</p>
              </div>

              {preview && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 mb-2">NUEVOS VALORES CALCULADOS</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-blue-400">Duración</p>
                      <p className="font-bold text-blue-800">{preview.duracion}</p>
                    </div>
                    <div>
                      <p className="text-blue-400">Costo</p>
                      <p className="font-bold text-red-600">{formatCOP(preview.costo)}</p>
                    </div>
                    <div>
                      <p className="text-blue-400">Unidades</p>
                      <p className="font-bold text-purple-600">
                        {preview.unidades != null ? Number(preview.unidades).toLocaleString('es-CO') + ' u' : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {errorEditar && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {errorEditar}
                </p>
              )}

              <p className="text-xs text-slate-400">
                ⚠️ Este cambio y su razón quedarán registrados en las observaciones del paro.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={() => setModalEditar(null)}
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={guardando || !preview || !editForm.razon.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold">
                {guardando ? '⏳ Guardando...' : '✅ Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {modalEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-6 py-5 text-center">
              <p className="text-4xl mb-3">🗑️</p>
              <h2 className="font-bold text-slate-800 text-lg">Eliminar paro #{modalEliminar.id}</h2>
              <p className="text-slate-500 text-sm mt-1">{modalEliminar.maquina_nombre} · {modalEliminar.motivo_nombre}</p>
              <p className="text-slate-400 text-xs mt-0.5">{formatFecha(modalEliminar.inicio)}</p>
              <p className="text-red-600 text-sm mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠️ Esta acción es irreversible. El registro se eliminará permanentemente.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModalEliminar(null)}
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm">
                Cancelar
              </button>
              <button onClick={eliminarParo} disabled={eliminando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold">
                {eliminando ? '⏳ Eliminando...' : '🗑️ Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}