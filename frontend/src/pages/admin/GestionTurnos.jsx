import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_SEMANA_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TURNOS_PRESET = [
  { nombre: 'Turno Mañana', hora_inicio: '05:30', hora_fin: '13:30' },
  { nombre: 'Turno Tarde',  hora_inicio: '13:30', hora_fin: '21:30' },
  { nombre: 'Turno Noche',  hora_inicio: '21:30', hora_fin: '05:30' },
]

const hoy = new Date()

export default function GestionTurnos() {
  const [lineas, setLineas] = useState([])
  const [lineaActiva, setLineaActiva] = useState(null)
  const [turnos, setTurnos] = useState([])
  const [diasTrabajo, setDiasTrabajo] = useState([])
  const [operadoresPorTurno, setOperadoresPorTurno] = useState({})
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [tab, setTab] = useState('turnos')

  const [turnoExpandido, setTurnoExpandido] = useState(null)
  const [operadoresDetalle, setOperadoresDetalle] = useState({})

  const esTurnoActivo = (horaInicio, horaFin) => {
    const ahora = new Date()
    const [hI, mI] = horaInicio.split(':').map(Number)
    const [hF, mF] = horaFin.split(':').map(Number)
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
    const minInicio = hI * 60 + mI
    const minFin = hF * 60 + mF
    if (minInicio < minFin) return minAhora >= minInicio && minAhora < minFin
    // turno nocturno cruza medianoche
    return minAhora >= minInicio || minAhora < minFin
  }

  const toggleTurnoDetalle = async (turnoId) => {
    if (turnoExpandido === turnoId) { setTurnoExpandido(null); return }
    setTurnoExpandido(turnoId)
    if (!operadoresDetalle[turnoId]) {
      try {
        const [usuarios, parosActivos] = await Promise.all([
          api.get('/usuarios'),
          api.get('/paros/activos')
        ])
        const ops = usuarios.filter(u => u.rol === 'operador' && u.linea === lineaActiva?.nombre && u.activo)
        // Mapear qué máquina está operando cada usuario
        const maquinaPorUsuario = {}
        parosActivos.forEach(p => { maquinaPorUsuario[p.usuario_id] = p.maquina_nombre })
        const opsConMaquina = ops.map(u => ({ ...u, maquina_activa: maquinaPorUsuario[u.id] || null }))
        setOperadoresDetalle(prev => ({ ...prev, [turnoId]: opsConMaquina }))
      } catch { setOperadoresDetalle(prev => ({ ...prev, [turnoId]: [] })) }
    }
  }
  const [modalTurno, setModalTurno] = useState(false)
  const [modalMasivo, setModalMasivo] = useState(false)
  const [editTurno, setEditTurno] = useState(null)
  const [diasSemana, setDiasSemana] = useState([1,2,3,4,5])
  const [formTurno, setFormTurno] = useState({ nombre: '', hora_inicio: '06:00', hora_fin: '14:00' })

  // Sistema de alertas propio
  const [alertas, setAlertas] = useState([])
  const [toasts, setToasts] = useState([])

  const addToast = (msg, tipo = 'success', detalle = '') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, tipo, detalle }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  const evaluarAlertas = (turnosList, operadoresMap, lineaNombre) => {
    const nuevasAlertas = []
    turnosList.forEach(t => {
      if (!t.activo) return
      const ops = operadoresMap[t.id] || 0
      if (ops === 0) {
        nuevasAlertas.push({
          id: `sin-op-${t.id}`,
          tipo: 'warning',
          titulo: 'Turno sin operadores',
          detalle: `"${t.nombre}" en ${lineaNombre} no tiene operadores asignados`,
          icono: '👷'
        })
      }
    })
    setAlertas(nuevasAlertas)
  }

  const cargarLineas = async () => {
    const data = await api.get('/turnos/lineas')
    setLineas(data)
    if (!lineaActiva && data.length > 0) setLineaActiva(data[0])
  }

  const cargarTurnos = async (lid, lineaNombre) => {
    const data = await api.get(`/turnos/turnos?linea_id=${lid}`)
    setTurnos(data)
    try {
      const usuarios = await api.get('/usuarios')
      const opsLinea = usuarios.filter(u => u.rol === 'operador' && u.linea === lineaNombre)
      const opsMap = {}
      data.forEach(t => { opsMap[t.id] = opsLinea.length })
      setOperadoresPorTurno(opsMap)
      evaluarAlertas(data, opsMap, lineaNombre)
    } catch {
      setOperadoresPorTurno({})
    }
  }

  const cargarDias = async (lid, m, a) => {
    const data = await api.get(`/turnos/dias?linea_id=${lid}&mes=${m}&anio=${a}`)
    setDiasTrabajo(data)
  }

  useEffect(() => { cargarLineas() }, [])

  useEffect(() => {
    if (lineaActiva) {
      cargarTurnos(lineaActiva.id, lineaActiva.nombre)
      cargarDias(lineaActiva.id, mes, anio)
    }
  }, [lineaActiva, mes, anio])

  // ── TURNOS ──────────────────────────────────────────────────────
  const guardarTurno = async () => {
    if (!formTurno.nombre || !lineaActiva) return
    if (editTurno) {
      await api.put(`/turnos/turnos/${editTurno.id}`, { ...formTurno, activo: editTurno.activo })
      addToast('Turno actualizado', 'success', `${formTurno.nombre} · ${formTurno.hora_inicio} → ${formTurno.hora_fin}`)
    } else {
      await api.post('/turnos/turnos', { ...formTurno, linea_id: lineaActiva.id })
      addToast('✅ Turno creado', 'success', `${formTurno.nombre} · ${formTurno.hora_inicio} → ${formTurno.hora_fin} en ${lineaActiva.nombre}`)
    }
    setModalTurno(false)
    setEditTurno(null)
    setFormTurno({ nombre: '', hora_inicio: '06:00', hora_fin: '14:00' })
    await cargarTurnos(lineaActiva.id, lineaActiva.nombre)
  }

  const abrirEditTurno = (t) => {
    setEditTurno(t)
    setFormTurno({ nombre: t.nombre, hora_inicio: t.hora_inicio.slice(0,5), hora_fin: t.hora_fin.slice(0,5) })
    setModalTurno(true)
  }

  const eliminarTurno = async (t) => {
    if (!confirm(`¿Eliminar el turno "${t.nombre}"?`)) return
    await api.delete(`/turnos/turnos/${t.id}`)
    addToast('🗑️ Turno eliminado', 'error', `"${t.nombre}" eliminado de ${lineaActiva.nombre}`)
    await cargarTurnos(lineaActiva.id, lineaActiva.nombre)
  }

  const toggleActivoTurno = async (t) => {
    await api.put(`/turnos/turnos/${t.id}`, { ...t, activo: !t.activo })
    addToast(
      t.activo ? 'Turno desactivado' : 'Turno activado',
      t.activo ? 'warning' : 'success',
      `"${t.nombre}" en ${lineaActiva.nombre}`
    )
    await cargarTurnos(lineaActiva.id, lineaActiva.nombre)
  }

  const aplicarPreset = (preset) => {
    setFormTurno({ nombre: preset.nombre, hora_inicio: preset.hora_inicio, hora_fin: preset.hora_fin })
  }

  // ── DIAS ────────────────────────────────────────────────────────
  const toggleDia = async (fecha, trabajaActual) => {
    await api.post('/turnos/dias/toggle', { linea_id: lineaActiva.id, fecha, trabaja: !trabajaActual })
    await cargarDias(lineaActiva.id, mes, anio)
  }

  const aplicarMasivo = async () => {
    await api.post('/turnos/dias/masivo', { linea_id: lineaActiva.id, mes, anio, dias_semana: diasSemana })
    addToast('Calendario configurado', 'success', `${MESES[mes-1]} ${anio} · ${lineaActiva.nombre}`)
    setModalMasivo(false)
    await cargarDias(lineaActiva.id, mes, anio)
  }

  const generarCalendario = () => {
    const primerDia = new Date(anio, mes - 1, 1)
    const ultimoDia = new Date(anio, mes, 0)
    const diasMap = {}
    diasTrabajo.forEach(d => { diasMap[d.fecha.slice(0,10)] = d })
    const celdas = []
    for (let i = 0; i < primerDia.getDay(); i++) celdas.push(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const fecha = `${anio}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const diaData = diasMap[fecha]
      const diaSemana = new Date(anio, mes-1, d).getDay()
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6
      celdas.push({ d, fecha, diaData, esFinDeSemana, diaSemana })
    }
    return celdas
  }

  const celdas = lineaActiva ? generarCalendario() : []
  const diasTrabajados = diasTrabajo.filter(d => d.trabaja).length
  const diasNoTrabajados = diasTrabajo.filter(d => !d.trabaja).length

  const toastColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500 text-yellow-900',
    info: 'bg-blue-500'
  }

  const alertaColors = {
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800'
  }

  return (
    <div>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm
              ${toastColors[t.tipo] || 'bg-slate-700'}`}>
            <div className="flex-1">
              <p className="font-bold">{t.msg}</p>
              {t.detalle && <p className="text-xs opacity-80 mt-0.5">{t.detalle}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="opacity-70 hover:opacity-100 text-base leading-none mt-0.5">×</button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Turnos</h1>
          <p className="text-slate-500 text-sm mt-1">Líneas de producción · Turnos · Calendario de trabajo</p>
        </div>
      </div>

      {/* Alertas persistentes */}
      {alertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertas.map(a => (
            <div key={a.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${alertaColors[a.tipo]}`}>
              <span className="text-lg flex-shrink-0">{a.icono}</span>
              <div className="flex-1">
                <p className="font-bold">{a.titulo}</p>
                <p className="text-xs opacity-80 mt-0.5">{a.detalle}</p>
              </div>
              <button onClick={() => setAlertas(prev => prev.filter(x => x.id !== a.id))}
                className="opacity-60 hover:opacity-100 text-base leading-none mt-0.5">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        {/* Panel izquierdo - Líneas */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Líneas de Producción</p>
            </div>
            {lineas.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-400 text-sm mb-1">Sin líneas creadas</p>
                <p className="text-xs text-slate-300">Créalas desde Máquinas → Líneas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {lineas.map(l => (
                  <div key={l.id} onClick={() => setLineaActiva(l)}
                    className={`px-4 py-3 cursor-pointer transition-colors
                      ${lineaActiva?.id === l.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${lineaActiva?.id === l.id ? 'text-blue-700' : 'text-slate-700'}`}>
                          {l.nombre}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {l.total_turnos} turno{l.total_turnos !== 1 ? 's' : ''} · {l.total_maquinas} máq.
                        </p>
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${l.activa ? 'bg-green-400' : 'bg-slate-300'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        {!lineaActiva ? (
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200 min-h-64">
            <div className="text-center text-slate-400">
              <p className="text-4xl mb-3">🏭</p>
              <p className="font-medium">Selecciona una línea</p>
              <p className="text-sm mt-1">Las líneas se gestionan desde Máquinas → Líneas</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            {/* Header linea activa */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">{lineaActiva.nombre}</h2>
                    {lineaActiva.codigo && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-mono px-2 py-0.5 rounded">
                        {lineaActiva.codigo}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lineaActiva.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {lineaActiva.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  {lineaActiva.descripcion && (
                    <p className="text-sm text-slate-500 mt-0.5">{lineaActiva.descripcion}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 w-fit">
              {[
                { key: 'turnos', label: '🕐 Turnos' },
                { key: 'calendario', label: '📅 Calendario' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Turnos */}
            {tab === 'turnos' && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <p className="font-semibold text-slate-700">Turnos de {lineaActiva.nombre}</p>
                  <button onClick={() => { setEditTurno(null); setFormTurno({ nombre: '', hora_inicio: '06:00', hora_fin: '14:00' }); setModalTurno(true) }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    + Agregar turno
                  </button>
                </div>

                {turnos.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">
                    <p className="text-3xl mb-2">🕐</p>
                    <p className="font-medium">Sin turnos configurados</p>
                    <p className="text-sm mt-1">Agrega los turnos de esta línea</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {turnos.map(t => {
                      const ops = operadoresPorTurno[t.id] || 0
                      const sinOps = t.activo && ops === 0
                      const expandido = turnoExpandido === t.id
                      const turnoEnCurso = esTurnoActivo(t.hora_inicio, t.hora_fin)
                      const opsDetalle = operadoresDetalle[t.id] || []
                      return (
                        <div key={t.id} className={`border-b border-slate-100 last:border-0 ${sinOps ? 'bg-yellow-50' : ''}`}>
                          <div className={`px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors`}
                            onClick={() => toggleTurnoDetalle(t.id)}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                              ${t.activo ? 'bg-blue-100' : 'bg-slate-100'}`}>
                              {t.nombre.includes('Mañana') ? '🌅' : t.nombre.includes('Tarde') ? '☀️' : t.nombre.includes('Noche') ? '🌙' : '🕐'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-semibold text-sm ${t.activo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                  {t.nombre}
                                </p>
                                {turnoEnCurso && t.activo && (
                                  <span className="flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded-full animate-pulse">
                                    🟢 En curso
                                  </span>
                                )}
                                {sinOps && (
                                  <span className="flex items-center gap-1 text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300 px-2 py-0.5 rounded-full">
                                    ⚠️ Sin operadores
                                  </span>
                                )}
                                {!sinOps && t.activo && (
                                  <span className="text-xs text-slate-400">{ops} operador{ops !== 1 ? 'es' : ''}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                {t.hora_inicio.slice(0,5)} → {t.hora_fin.slice(0,5)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button onClick={() => toggleActivoTurno(t)}
                                className={`text-xs px-2 py-1 rounded-lg font-medium border transition-colors
                                  ${t.activo
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                {t.activo ? 'Activo' : 'Inactivo'}
                              </button>
                              <button onClick={() => abrirEditTurno(t)}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg">
                                ✏️
                              </button>
                              <button onClick={() => eliminarTurno(t)}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-500 px-2 py-1 rounded-lg">
                                🗑️
                              </button>
                              <span className="text-slate-300 text-sm">{expandido ? '▲' : '▼'}</span>
                            </div>
                          </div>

                          {/* Panel desplegable operadores */}
                          {expandido && (
                            <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 uppercase mt-3 mb-2">
                                👷 Operadores de {lineaActiva?.nombre}
                              </p>
                              {opsDetalle.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No hay operadores asignados a esta línea</p>
                              ) : (
                                <div className="space-y-3">
                                  {turnoEnCurso && (
                                    <div>
                                      <p className="text-xs text-green-700 font-semibold mb-1.5">🟢 En turno ahora</p>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {opsDetalle.map(u => (
                                          <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-green-50 border-green-200 text-xs">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-green-200 text-green-800">
                                              {u.nombre.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                              <p className="font-medium text-slate-800">{u.nombre}</p>
                                              {u.maquina_activa
                                                ? <p className="text-red-500 font-medium">🔴 {u.maquina_activa}</p>
                                                : <p className="text-green-600 font-medium">✅ Operando</p>
                                              }
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {!turnoEnCurso && (
                                    <div>
                                      <p className="text-xs text-slate-400 font-semibold mb-1.5">⏸ Fuera de turno</p>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {opsDetalle.map(u => (
                                          <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white border-slate-200 text-xs opacity-60">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-slate-200 text-slate-500">
                                              {u.nombre.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                              <p className="font-medium text-slate-600">{u.nombre}</p>
                                              <p className="text-slate-400">Sin turno activo</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab Calendario */}
            {tab === 'calendario' && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => {
                      if (mes === 1) { setMes(12); setAnio(a => a - 1) }
                      else setMes(m => m - 1)
                    }} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">‹</button>
                    <p className="font-bold text-slate-800 w-36 text-center">{MESES[mes - 1]} {anio}</p>
                    <button onClick={() => {
                      if (mes === 12) { setMes(1); setAnio(a => a + 1) }
                      else setMes(m => m + 1)
                    }} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">›</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> {diasTrabajados} trabaja
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-slate-200 inline-block" /> {diasNoTrabajados} libre
                      </span>
                    </div>
                    <button onClick={() => setModalMasivo(true)}
                      className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                      ⚡ Configurar masivo
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-7 mb-2">
                    {DIAS_SEMANA.map(d => (
                      <div key={d} className="text-center text-xs font-bold text-slate-400 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {celdas.map((celda, i) => {
                      if (!celda) return <div key={i} />
                      const { d, fecha, diaData, esFinDeSemana } = celda
                      const trabaja = diaData ? diaData.trabaja : null
                      const esHoy = fecha === hoy.toISOString().slice(0,10)
                      let bg = 'bg-slate-50 border-slate-200 text-slate-400'
                      if (trabaja === 1) bg = 'bg-blue-500 border-blue-600 text-white'
                      else if (trabaja === 0) bg = 'bg-slate-200 border-slate-300 text-slate-500'
                      else if (esFinDeSemana) bg = 'bg-orange-50 border-orange-200 text-orange-400'
                      return (
                        <button key={fecha} onClick={() => toggleDia(fecha, trabaja === 1)}
                          className={`aspect-square rounded-lg border text-sm font-semibold transition-all hover:opacity-80 active:scale-95 relative ${bg}`}>
                          {d}
                          {esHoy && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 flex-wrap">
                    <span className="text-xs text-slate-400 font-medium">Leyenda:</span>
                    {[
                      { color: 'bg-blue-500', label: 'Trabaja' },
                      { color: 'bg-slate-200', label: 'No trabaja' },
                      { color: 'bg-slate-50 border border-slate-200', label: 'Sin definir' },
                      { color: 'bg-orange-50 border border-orange-200', label: 'Fin de semana' },
                    ].map((l, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className={`w-4 h-4 rounded ${l.color}`} />
                        {l.label}
                      </span>
                    ))}
                    <span className="text-xs text-slate-400 ml-auto">Clic en un día para alternar</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Nuevo/Editar Turno */}
      {modalTurno && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">{editTurno ? 'Editar Turno' : 'Nuevo Turno'}</h2>
                <p className="text-xs text-slate-400">{lineaActiva?.nombre}</p>
              </div>
              <button onClick={() => setModalTurno(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {!editTurno && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Plantillas rápidas</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TURNOS_PRESET.map(p => (
                      <button key={p.nombre} onClick={() => aplicarPreset(p)}
                        className="border border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-2 text-center transition-colors">
                        <p className="text-xs font-semibold text-slate-700">{p.nombre.replace('Turno ', '')}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.hora_inicio}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del turno *</label>
                <input value={formTurno.nombre} onChange={e => setFormTurno(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Turno Mañana"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Hora inicio</label>
                  <input type="time" value={formTurno.hora_inicio}
                    onChange={e => setFormTurno(p => ({ ...p, hora_inicio: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Hora fin</label>
                  <input type="time" value={formTurno.hora_fin}
                    onChange={e => setFormTurno(p => ({ ...p, hora_fin: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModalTurno(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={guardarTurno} disabled={!formTurno.nombre.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold">
                {editTurno ? 'Guardar cambios' : 'Crear turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración Masiva */}
      {modalMasivo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">⚡ Configurar mes completo</h2>
                <p className="text-xs text-slate-400">{MESES[mes-1]} {anio} · {lineaActiva?.nombre}</p>
              </div>
              <button onClick={() => setModalMasivo(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600 mb-4">Selecciona los días de la semana que esta línea trabaja:</p>
              <div className="grid grid-cols-7 gap-1 mb-6">
                {DIAS_SEMANA.map((d, i) => (
                  <button key={i}
                    onClick={() => setDiasSemana(prev =>
                      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                    )}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all
                      ${diasSemana.includes(i)
                        ? 'bg-blue-500 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-4">
                Se marcarán como <strong>trabaja</strong> los días: {diasSemana.map(d => DIAS_SEMANA_FULL[d]).join(', ') || 'ninguno'}
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModalMasivo(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={aplicarMasivo}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-sm font-bold">
                Aplicar al mes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}