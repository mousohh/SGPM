import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

const formatTiempo = (segundos) => {
  if (!segundos) return '0s'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const formatCOP = (valor) => {
  if (!valor) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(valor)
}

const getTurnoActual = () => {
  const ahora = new Date()
  const totalMin = ahora.getHours() * 60 + ahora.getMinutes()
  if (totalMin >= 330 && totalMin <= 809) {
    const inicio = new Date(ahora); inicio.setHours(5, 30, 0, 0)
    const fin = new Date(ahora); fin.setHours(13, 29, 59, 999)
    return { nombre: 'Turno Mañana', icono: '🌅', inicio, fin }
  }
  if (totalMin >= 810 && totalMin <= 1289) {
    const inicio = new Date(ahora); inicio.setHours(13, 30, 0, 0)
    const fin = new Date(ahora); fin.setHours(21, 29, 59, 999)
    return { nombre: 'Turno Tarde', icono: '☀️', inicio, fin }
  }
  const inicio = new Date(ahora)
  if (totalMin >= 1290) { inicio.setHours(21, 30, 0, 0) }
  else { inicio.setDate(inicio.getDate() - 1); inicio.setHours(21, 30, 0, 0) }
  const fin = new Date(ahora)
  if (totalMin < 330) { fin.setHours(5, 29, 59, 999) }
  else { fin.setDate(fin.getDate() + 1); fin.setHours(5, 29, 59, 999) }
  return { nombre: 'Turno Noche', icono: '🌙', inicio, fin }
}

const toLocalISO = (date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 19).replace('T', ' ')
}

const CATEGORIAS = [
  { key: 'Todos', label: 'Todos', icono: '🔍' },
  { key: 'falla', label: 'Falla', icono: '🔧' },
  { key: 'mantenimiento', label: 'Mantenimiento', icono: '⚙️' },
  { key: 'setup', label: 'Setup', icono: '🔄' },
  { key: 'material', label: 'Material', icono: '📦' },
  { key: 'calidad', label: 'Calidad', icono: '✅' },
  { key: 'otro', label: 'Otro', icono: '📋' },
]

const DURACION_TURNO_MIN = 480 // 8 horas

export default function MiMaquina({ onLogout, maquinaOverride, onCambiarMaquina }) {
  const { usuario, logout, cargando: cargandoAuth } = useAuth()
  const maquinaId = maquinaOverride?.id || usuario?.maquina_id
  const [maquina, setMaquina] = useState(null)
  const [paroActivo, setParoActivo] = useState(null)
  const [motivos, setMotivos] = useState([])
  const [segundos, setSegundos] = useState(0)
  const [modalParo, setModalParo] = useState(false)
  const [motivoSeleccionado, setMotivoSeleccionado] = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [cargando, setCargando] = useState(false)
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [resumenTurno, setResumenTurno] = useState(null)
  const [alertaParo, setAlertaParo] = useState(null)
  const [turno, setTurno] = useState(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [parosTurno, setParosTurno] = useState([])
  const [silenciado, setSilenciado] = useState(false)

  // Código de orden CDP/MO/
  const [modalCodigo, setModalCodigo] = useState(false)
  const [codigoNumero, setCodigoNumero] = useState('')
  const [datosPendientesParo, setDatosPendientesParo] = useState(null)

  // Estado turno de la línea
  const [estadoTurno, setEstadoTurno] = useState({ dia_laborable: true, en_turno: true, turno_nombre: null })
  const [advertencia, setAdvertencia] = useState(null)
  const [parosPendiente, setParoPendiente] = useState(null)

  const intervalRef = useRef(null)
  const segundosRef = useRef(0)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const cargarEstadoTurno = async (maquina_id) => {
    try {
      const data = await api.get(`/paros/estado-turno?maquina_id=${maquina_id}`)
      setEstadoTurno(data)
    } catch { }
  }

  const cargarResumenTurno = async (maquina_id) => {
    const t = getTurnoActual()
    setTurno(t)
    const params = new URLSearchParams({
      maquina_id,
      turno_inicio: toLocalISO(t.inicio),
      turno_fin: toLocalISO(t.fin)
    })
    const data = await api.get(`/paros/resumen-turno?${params}`)
    setResumenTurno(data)
    const paramsH = new URLSearchParams({
      maquina_id,
      fecha_inicio: t.inicio.toISOString().slice(0, 10),
      fecha_fin: t.fin.toISOString().slice(0, 10)
    })
    const historial = await api.get(`/paros/historial?${paramsH}`)
    if (Array.isArray(historial)) {
      const inicio = t.inicio.getTime()
      const fin = t.fin.getTime()
      setParosTurno(historial.filter(p => {
        const time = new Date(p.inicio).getTime()
        return time >= inicio && time <= fin
      }))
    }
  }

  const cargarDatos = async (maquina_id) => {
    const [maqData, parosData, motivosData] = await Promise.all([
      api.get('/maquinas'),
      api.get('/paros/activos'),
      api.get('/motivos')
    ])
    const miMaquina = maqData.find(m => m.id === Number(maquina_id))
    setMaquina(miMaquina)
    setMotivos(Array.isArray(motivosData) ? motivosData.filter(m => m.activo) : [])
    const miParo = parosData.find(p => p.maquina_id === Number(maquina_id))
    if (miParo) {
      setParoActivo(miParo)
      setSegundos(miParo.segundos_transcurridos || 0)
      segundosRef.current = miParo.segundos_transcurridos || 0
    }
    await Promise.all([
      cargarResumenTurno(maquina_id),
      cargarEstadoTurno(maquina_id)
    ])
  }

  useEffect(() => {
    if (!cargandoAuth && maquinaId) cargarDatos(maquinaId)
  }, [cargandoAuth, usuario])

  useEffect(() => {
    if (!maquinaId) return
    const interval = setInterval(() => cargarEstadoTurno(maquinaId), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [usuario])

  useEffect(() => {
    if (paroActivo) {
      intervalRef.current = setInterval(() => {
        setSegundos(s => { segundosRef.current = s + 1; return s + 1 })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
      setSegundos(0)
      segundosRef.current = 0
    }
    return () => clearInterval(intervalRef.current)
  }, [paroActivo])

  // ── Flujo registrar paro: primero pedir código, luego enviar ──
  const abrirModalCodigo = (datos) => {
    setDatosPendientesParo(datos)
    setCodigoNumero('')
    setModalParo(false)
    setModalCodigo(true)
  }

  const confirmarConCodigo = async () => {
    if (!codigoNumero.trim()) return
    const codigo_orden = `CDP/MO/${codigoNumero.trim()}`
    setModalCodigo(false)
    await enviarParo({ ...datosPendientesParo, codigo_orden })
    setDatosPendientesParo(null)
  }

  const enviarParo = async ({ motivo_id, observaciones: obs, forzar, codigo_orden }) => {
    setCargando(true)
    const res = await api.post('/paros/iniciar', {
      maquina_id: maquinaId,
      motivo_id,
      observaciones: obs,
      forzar,
      codigo_orden
    })
    setCargando(false)

    if (res.error === 'dia_no_laborable') {
      setMotivoSeleccionado(null); setObservaciones(''); setCategoriaFiltro('Todos')
      setAdvertencia({ tipo: 'dia_no_laborable', mensaje: res.mensaje, bloqueado: true })
      return
    }

    if (res.advertencia) {
      setAdvertencia(res)
      setParoPendiente({ motivo_id, observaciones: obs })
      return
    }

    if (res.paro) {
      setParoActivo(res.paro)
      setSegundos(0); segundosRef.current = 0
      setAdvertencia(null); setParoPendiente(null)
      setMotivoSeleccionado(null); setObservaciones(''); setCategoriaFiltro('Todos')
      await cargarResumenTurno(maquinaId)
    }
  }

  const iniciarParo = () => {
    if (!motivoSeleccionado) return
    abrirModalCodigo({ motivo_id: motivoSeleccionado, observaciones })
  }

  const forzarParo = () => {
    if (!parosPendiente) return
    abrirModalCodigo({ ...parosPendiente, forzar: true })
    setAdvertencia(null)
  }

  const cerrarParo = async () => {
    if (!paroActivo) return
    setCargando(true)
    const segundosCierre = segundosRef.current
    const paroParaAlerta = {
      motivo: paroActivo.motivo_nombre,
      duracion: segundosCierre,
      costo: Math.round((maquina?.costo_hora || 0) / 3600 * segundosCierre),
      unidades: maquina?.linea === '3 - Sellado' && maquina?.unidades_por_minuto > 0
        ? Math.round((maquina.unidades_por_minuto / 60) * segundosCierre) : null
    }
    await api.put(`/paros/${paroActivo.id}/cerrar`, {})
    setParoActivo(null)
    setConfirmCerrar(false)
    setCargando(false)
    setTimeout(async () => { await cargarResumenTurno(maquinaId) }, 500)
    setAlertaParo(paroParaAlerta)
    setTimeout(() => setAlertaParo(null), 8000)
  }

  const handleLogout = () => { logout(); onLogout() }

  const costoParoActivo = paroActivo ? Math.round((maquina?.costo_hora || 0) / 3600 * segundos) : 0
  const minutosParoActivo = paroActivo ? segundos / 60 : 0
  const unidadesParoActivo = paroActivo && maquina?.linea === '3 - Sellado' && maquina?.unidades_por_minuto > 0
    ? Math.round((maquina.unidades_por_minuto / 60) * segundos) : 0

  const totalParos = (parseInt(resumenTurno?.total_paros) || 0) + (paroActivo ? 1 : 0)
  const totalMinutos = parseFloat((parseFloat(resumenTurno?.minutos_perdidos || 0) + minutosParoActivo).toFixed(1))
  const totalCosto = (parseInt(resumenTurno?.costo_perdido) || 0) + costoParoActivo
  const totalUnidades = (parseInt(resumenTurno?.unidades_no_producidas) || 0) + unidadesParoActivo

  const motivosFiltrados = categoriaFiltro === 'Todos'
    ? motivos : motivos.filter(m => m.categoria === categoriaFiltro)

  const urgencia = segundos > 3600 ? 'CRITICO' : segundos > 1800 ? 'URGENTE' : segundos > 600 ? 'ATENCION' : 'RECIENTE'
  const urgenciaColor = segundos > 3600 ? 'text-red-300' : segundos > 1800 ? 'text-orange-300' : segundos > 600 ? 'text-yellow-300' : 'text-blue-300'

  const estadoLabel = !estadoTurno.dia_laborable
    ? { texto: 'Día no laborable', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icono: '📅' }
    : !estadoTurno.en_turno
    ? { texto: 'Fuera de horario', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icono: '🕐' }
    : estadoTurno.turno_nombre
    ? { texto: estadoTurno.turno_nombre, color: 'bg-green-500/20 text-green-300 border-green-500/30', icono: '✅' }
    : null

  // ── Rendimiento del turno (carita) ──
  const minutosParados = totalMinutos + (paroActivo ? segundos / 60 : 0)
  const rendimiento = Math.max(0, Math.round(((DURACION_TURNO_MIN - minutosParados) / DURACION_TURNO_MIN) * 100))
  const caraRendimiento = rendimiento >= 95 ? '😊' : '😢'
  const colorRendimiento = rendimiento >= 95 ? 'text-green-300' : 'text-red-300'

  const botonPresionar = (e, color) => {
    const shadows = {
      red: '0 2px 0 #7f1d1d, 0 4px 15px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2)',
      green: '0 2px 0 #14532d, 0 4px 15px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2)'
    }
    e.currentTarget.style.boxShadow = shadows[color]
    e.currentTarget.style.transform = 'translateY(6px)'
  }

  const botonSoltar = (e, color) => {
    const shadows = {
      red: '0 8px 0 #7f1d1d, 0 12px 30px rgba(0,0,0,0.6), 0 0 60px rgba(239,68,68,0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
      green: '0 8px 0 #14532d, 0 12px 30px rgba(0,0,0,0.6), 0 0 60px rgba(74,222,128,0.3), inset 0 2px 4px rgba(255,255,255,0.3)'
    }
    e.currentTarget.style.boxShadow = shadows[color]
    e.currentTarget.style.transform = 'translateY(0)'
  }

  if (cargandoAuth) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  if (!maquinaId) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-white text-xl font-bold mb-2">Sin maquina asignada</p>
        <p className="text-slate-400 mb-6">Contacta al administrador</p>
        <button onClick={handleLogout} className="bg-slate-700 text-white px-4 py-2 rounded-lg">Cerrar sesion</button>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700
      ${paroActivo ? 'bg-gradient-to-b from-red-950 to-red-900' : 'bg-gradient-to-b from-slate-900 to-green-950'}`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-base">⚙️</div>
          <div>
            <span className="font-bold text-white text-sm">SGPM</span>
            <p className="text-white/40 text-xs">{turno?.icono} {turno?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          <span className="text-white/50 text-xs hidden sm:block">{usuario?.nombre}</span>
          {/* Botón silenciar */}
          <button onClick={() => setSilenciado(s => !s)}
            title={silenciado ? 'Activar alertas de sonido' : 'Silenciar alertas de sonido'}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${silenciado ? 'bg-yellow-500/30 text-yellow-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
            {silenciado ? '🔕' : '🔔'}
          </button>
          <button onClick={handleLogout}
            className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg">
            Salir
          </button>
          {onCambiarMaquina && (
            <button onClick={onCambiarMaquina}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg">
              🔄 Cambiar
            </button>
          )}
        </div>
      </div>

      {!online && (
        <div className="bg-yellow-500 text-yellow-900 text-center py-2 text-xs font-bold">
          ⚠️ SIN CONEXION — Los cambios no se guardaran
        </div>
      )}

      {alertaParo && (
        <div className="mx-4 mt-3 bg-green-500 text-white rounded-2xl p-4 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-base mb-1">✅ Paro registrado exitosamente</p>
              <p className="text-sm opacity-90">Motivo: <strong>{alertaParo.motivo}</strong></p>
              <p className="text-sm opacity-90">Duracion: <strong>{formatTiempo(alertaParo.duracion)}</strong></p>
              <p className="text-sm opacity-90">Costo: <strong>{formatCOP(alertaParo.costo)}</strong></p>
              {alertaParo.unidades && (
                <p className="text-sm opacity-90">Unidades no prod: <strong>{alertaParo.unidades.toLocaleString('es-CO')}</strong></p>
              )}
            </div>
            <button onClick={() => setAlertaParo(null)} className="text-white/70 hover:text-white text-xl ml-3">×</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-start justify-center p-4 gap-4">

        {/* Panel resumen turno - izquierda */}
        <div className="w-full lg:w-72 bg-white rounded-2xl p-5 shadow-lg flex-shrink-0">
          <div className="mb-4 pb-3 border-b border-slate-100">
            <p className="text-slate-400 text-xs uppercase tracking-widest">Resumen de turno</p>
            <p className="text-slate-800 font-bold text-base mt-1">{turno?.icono} {turno?.nombre || '—'}</p>
          </div>
          <div className="space-y-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-slate-400 text-xs mb-1">Total paros</p>
              <p className="text-slate-800 text-2xl font-bold">{totalParos}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-slate-400 text-xs mb-1">Tiempo perdido</p>
              <p className="text-orange-600 text-2xl font-bold">{totalMinutos} min</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-slate-400 text-xs mb-1">Costo perdido</p>
              <p className="text-red-600 text-2xl font-bold">{formatCOP(totalCosto)}</p>
            </div>
            {maquina?.linea === '3 - Sellado' && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400 text-xs mb-1">Unidades no producidas</p>
                <p className="text-purple-600 text-2xl font-bold">{totalUnidades.toLocaleString('es-CO')}</p>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Paros del turno</p>
            {parosTurno.length === 0 && !paroActivo ? (
              <p className="text-slate-400 text-xs">Sin paros registrados aún</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(paroActivo ? [{ ...paroActivo, activo: true, duracion_segundos: segundos }] : [])
                  .concat(parosTurno).slice(0, 8).map((p, i) => (
                    <div key={i} className={`rounded-lg p-2 border ${p.activo ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.activo ? 'animate-pulse' : ''}`}
                          style={{ backgroundColor: p.color_hex }} />
                        <p className="text-slate-700 text-xs font-medium truncate">{p.motivo_nombre}</p>
                        {p.activo && <span className="ml-auto text-red-500 text-xs flex-shrink-0">en curso</span>}
                      </div>
                      <p className="text-slate-400 text-xs mt-1 pl-4">
                        {p.activo ? 'Activo ahora' : `${Math.round((p.duracion_segundos || 0) / 60)} min`}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Contenido central */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto relative">

          {/* Carita rendimiento — esquina derecha */}
          <div className="absolute top-0 right-0 flex flex-col items-center gap-1 select-none">
            <span className={`text-5xl leading-none ${colorRendimiento}`}>{caraRendimiento}</span>
            <span className={`text-xs font-bold ${colorRendimiento}`}>{rendimiento}%</span>
          </div>

          <div className="text-center mb-4">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Mi Maquina</p>
            <h1 className="text-3xl font-black text-white">{maquina?.nombre || '...'}</h1>
            <p className="text-white/40 text-sm mt-0.5">{maquina?.linea}</p>
          </div>

          {/* Indicador de turno de la línea */}
          {estadoLabel && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold mb-4 ${estadoLabel.color}`}>
              <span>{estadoLabel.icono}</span>
              <span>{estadoLabel.texto}</span>
            </div>
          )}

          {/* Estado */}
          {paroActivo ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-5 mb-4 border border-red-400/30 w-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-red-300 font-bold uppercase tracking-wide text-sm">Maquina Parada</span>
                </div>
                <span className={`text-xs font-black uppercase tracking-widest ${urgenciaColor}`}>{urgencia}</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: paroActivo.color_hex || '#94a3b8' }} />
                <p className="text-white font-semibold text-base">{paroActivo.motivo_nombre}</p>
              </div>
              {paroActivo.codigo_orden && (
                <p className="text-white/40 text-xs mb-3 font-mono">📋 {paroActivo.codigo_orden}</p>
              )}
              <div className="text-center py-2">
                <p className="text-7xl font-mono font-black text-white leading-none tracking-tight">
                  {formatTiempo(segundos)}
                </p>
                <p className="text-white/40 text-xs mt-2">Tiempo de paro</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-black/20 rounded-2xl p-3 text-center">
                  <p className="text-white/50 text-xs mb-1">Costo perdido</p>
                  <p className="text-red-300 font-bold text-lg">{formatCOP(costoParoActivo)}</p>
                </div>
                <div className="bg-black/20 rounded-2xl p-3 text-center">
                  <p className="text-white/50 text-xs mb-1">Paros hoy</p>
                  <p className="text-orange-300 font-bold text-lg">{totalParos}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-5 mb-4 border border-green-400/30 w-full">
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="w-4 h-4 bg-green-400 rounded-full" />
                <span className="text-green-300 font-bold text-xl uppercase tracking-wide">Operando</span>
              </div>
              <p className="text-white/40 text-sm text-center">La maquina esta en funcionamiento</p>
            </div>
          )}

          {/* BOTON EMERGENCIA 3D */}
          <div className="flex justify-center py-4">
            {paroActivo ? (
              <button onClick={() => setConfirmCerrar(true)} disabled={!online}
                onMouseDown={e => botonPresionar(e, 'green')} onMouseUp={e => botonSoltar(e, 'green')}
                onMouseLeave={e => botonSoltar(e, 'green')} onTouchStart={e => botonPresionar(e, 'green')}
                onTouchEnd={e => botonSoltar(e, 'green')}
                style={{
                  width: 220, height: 220, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #4ade80, #16a34a 60%, #14532d)',
                  boxShadow: online ? '0 8px 0 #14532d, 0 12px 30px rgba(0,0,0,0.6), 0 0 60px rgba(74,222,128,0.3), inset 0 2px 4px rgba(255,255,255,0.3)' : '0 2px 0 #14532d, 0 4px 10px rgba(0,0,0,0.4)',
                  transition: 'all 0.1s ease', border: '6px solid #15803d',
                  outline: '8px solid rgba(22,163,74,0.2)',
                  cursor: online ? 'pointer' : 'not-allowed', opacity: online ? 1 : 0.5,
                }}>
                <div className="flex flex-col items-center justify-center h-full select-none">
                  <span className="text-4xl mb-2">✅</span>
                  <span className="text-white font-black text-base leading-tight text-center px-4 drop-shadow-md">MAQUINA<br/>INICIADA</span>
                </div>
              </button>
            ) : (
              <button onClick={() => estadoTurno.dia_laborable ? setModalParo(true) : setAdvertencia({ tipo: 'dia_no_laborable', mensaje: 'Hoy no es día laborable para esta línea. No se pueden registrar paros.', bloqueado: true })} disabled={!online}
                onMouseDown={e => botonPresionar(e, 'red')} onMouseUp={e => botonSoltar(e, 'red')}
                onMouseLeave={e => botonSoltar(e, 'red')} onTouchStart={e => botonPresionar(e, 'red')}
                onTouchEnd={e => botonSoltar(e, 'red')}
                style={{
                  width: 220, height: 220, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #f87171, #dc2626 60%, #7f1d1d)',
                  boxShadow: online ? '0 8px 0 #7f1d1d, 0 12px 30px rgba(0,0,0,0.6), 0 0 60px rgba(239,68,68,0.4), inset 0 2px 4px rgba(255,255,255,0.3)' : '0 2px 0 #7f1d1d, 0 4px 10px rgba(0,0,0,0.4)',
                  transition: 'all 0.1s ease', border: '6px solid #991b1b',
                  outline: '8px solid rgba(220,38,38,0.2)',
                  cursor: online ? 'pointer' : 'not-allowed', opacity: online ? 1 : 0.5,
                }}>
                <div className="flex flex-col items-center justify-center h-full select-none">
                  <span className="text-4xl mb-2">🛑</span>
                  <span className="text-white font-black text-base leading-tight text-center px-4 drop-shadow-md">REGISTRAR<br/>PARO</span>
                </div>
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-white/40 text-xs">{online ? 'Conectado' : 'Sin conexion'}</span>
          </div>
        </div>
      </div>

      {/* Modal registrar paro */}
      {modalParo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-800">¿Por que paro la maquina?</h2>
                <p className="text-xs text-slate-400">{maquina?.nombre}</p>
              </div>
              <button onClick={() => { setModalParo(false); setMotivoSeleccionado(null); setCategoriaFiltro('Todos') }}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-lg flex-shrink-0">×</button>
            </div>

            {(!estadoTurno.dia_laborable || !estadoTurno.en_turno) && (
              <div className="mx-5 mt-3 flex-shrink-0 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="text-orange-500 text-lg flex-shrink-0">⚠️</span>
                <p className="text-orange-700 text-xs">
                  {!estadoTurno.dia_laborable
                    ? 'Hoy no es día laborable para esta línea.'
                    : 'Estás fuera del horario de turno configurado.'
                  } El paro se registrará de todas formas.
                </p>
              </div>
            )}

            <div className="px-5 pt-3 pb-2 flex-shrink-0">
              <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Filtrar por categoria</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIAS.map(cat => (
                  <button key={cat.key} onClick={() => setCategoriaFiltro(cat.key)}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl border-2 transition-all
                      ${categoriaFiltro === cat.key
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <span className="text-lg leading-none">{cat.icono}</span>
                    <span className="text-xs font-semibold leading-none">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2 min-h-0">
              {motivosFiltrados.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin motivos en esta categoria</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 py-2">
                  {motivosFiltrados.map(m => (
                    <button key={m.id} onClick={() => setMotivoSeleccionado(m.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left
                        ${motivoSeleccionado === m.id
                          ? 'border-slate-800 bg-slate-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: m.color_hex }} />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm">{m.nombre}</p>
                        <p className="text-xs text-slate-400 capitalize">{m.categoria}</p>
                      </div>
                      {motivoSeleccionado === m.id && (
                        <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-slate-100 flex-shrink-0 space-y-3">
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                placeholder="Observaciones adicionales (opcional)" rows={2}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-slate-400 resize-none text-slate-700" />
              <div className="flex gap-3">
                <button onClick={() => { setModalParo(false); setMotivoSeleccionado(null); setCategoriaFiltro('Todos') }}
                  className="flex-1 border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-semibold text-sm">
                  Cancelar
                </button>
                <button onClick={iniciarParo} disabled={!motivoSeleccionado || cargando}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base transition-colors">
                  {cargando ? 'Registrando...' : '🛑 Continuar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal código de orden CDP/MO/ */}
      {modalCodigo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">📋</div>
              <h2 className="text-xl font-black text-slate-800">Código de orden</h2>
              <p className="text-slate-500 text-sm mt-1">Ingresa el número de la orden de producción</p>
            </div>

            <div className="mb-5">
              <div className="flex items-center border-2 border-slate-300 focus-within:border-blue-500 rounded-2xl overflow-hidden transition-colors">
                <span className="bg-slate-100 px-4 py-4 text-slate-600 font-mono font-bold text-sm border-r border-slate-300 flex-shrink-0">
                  CDP/MO/
                </span>
                <input
                  type="number"
                  value={codigoNumero}
                  onChange={e => setCodigoNumero(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345"
                  autoFocus
                  className="flex-1 px-4 py-4 text-slate-800 font-mono font-bold text-lg focus:outline-none"
                  onKeyDown={e => e.key === 'Enter' && codigoNumero.trim() && confirmarConCodigo()}
                />
              </div>
              {codigoNumero && (
                <p className="text-xs text-slate-400 mt-2 text-center font-mono">
                  Código completo: <strong>CDP/MO/{codigoNumero}</strong>
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModalCodigo(false); setDatosPendientesParo(null); setModalParo(true) }}
                className="flex-1 border-2 border-slate-200 text-slate-600 py-3 rounded-2xl font-semibold text-sm">
                Atrás
              </button>
              <button onClick={confirmarConCodigo} disabled={!codigoNumero.trim() || cargando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-2xl font-black text-sm">
                {cargando ? 'Registrando...' : '🛑 Confirmar paro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal advertencia / bloqueo */}
      {advertencia && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl">
            {advertencia.bloqueado ? (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🚫</div>
                <h2 className="text-xl font-black text-red-700 mb-2">Día no laborable</h2>
                <p className="text-slate-500 text-sm mb-2">{advertencia.mensaje}</p>
                <p className="text-xs text-slate-400 mb-6">
                  Si esto es un error, contacta al administrador para actualizar el calendario de la línea.
                </p>
                <button onClick={() => setAdvertencia(null)}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-2xl font-black text-sm">
                  Entendido
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🕐</div>
                <h2 className="text-lg font-black text-slate-800 mb-2">Fuera de horario</h2>
                <p className="text-slate-500 text-sm mb-6">{advertencia.mensaje}</p>
                <div className="flex gap-3">
                  <button onClick={() => { setAdvertencia(null); setParoPendiente(null) }}
                    className="flex-1 border-2 border-slate-200 text-slate-600 py-3 rounded-2xl font-semibold text-sm">
                    Cancelar
                  </button>
                  <button onClick={forzarParo} disabled={cargando}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-2xl font-black text-sm">
                    {cargando ? 'Registrando...' : 'Registrar igual'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmar cierre */}
      {confirmCerrar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
            <h2 className="text-xl font-black text-slate-800 mb-1">¿La maquina ya inicio?</h2>
            <p className="text-slate-500 text-sm mb-1">
              Motivo: <strong className="text-slate-700">{paroActivo?.motivo_nombre}</strong>
            </p>
            <p className="text-slate-500 text-sm mb-5">
              Duracion: <strong className="text-slate-700">{formatTiempo(segundos)}</strong>
              {costoParoActivo > 0 && <span className="text-red-500 ml-2 font-bold">{formatCOP(costoParoActivo)}</span>}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCerrar(false)}
                className="flex-1 border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-semibold">
                No, espera
              </button>
              <button onClick={cerrarParo} disabled={cargando}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black transition-colors">
                {cargando ? 'Cerrando...' : 'Si, inicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}