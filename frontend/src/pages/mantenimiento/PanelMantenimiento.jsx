import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'

const formatTiempo = (segundos) => {
  if (!segundos) return '0s'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

const formatCOP = (v) => v
  ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
  : '$0'

const nivelUrgencia = (segundos) => {
  const min = segundos / 60
  if (min >= 60) return { label: 'CRÍTICO', color: 'bg-red-600', text: 'text-red-600', border: 'border-red-400', bg: 'bg-red-50' }
  if (min >= 30) return { label: 'URGENTE', color: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-400', bg: 'bg-orange-50' }
  if (min >= 15) return { label: 'ATENCIÓN', color: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-400', bg: 'bg-yellow-50' }
  return { label: 'RECIENTE', color: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-300', bg: 'bg-blue-50' }
}

const ACCIONES = [
  'En camino a máquina',
  'Diagnóstico en proceso',
  'Reparación en curso',
  'Esperando repuesto',
  'Reparación completada',
  'Requiere parada mayor',
  'Ajuste realizado',
  'Limpieza ejecutada',
]

export default function PanelMantenimiento({ onLogout }) {
  const [paros, setParos] = useState([])
  const [stats, setStats] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [modalParo, setModalParo] = useState(null)
  const [historial, setHistorial] = useState([])
  const [accion, setAccion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [notificando, setNotificando] = useState(null)
  const [toast, setToast] = useState(null)
  const [segundos, setSegundos] = useState({})
  const [costoPreview, setCostoPreview] = useState(null)
  const [parosHoy, setParosHoy] = useState([])
  const intervaloRef = useRef(null)
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 4000)
  }

  const cargar = async () => {
    try {
      const [p, s, ph] = await Promise.all([
        api.get('/mantenimiento/paros-activos'),
        api.get('/mantenimiento/resumen-turno'),
        api.get('/mantenimiento/paros-hoy')
      ])
      setParos(Array.isArray(p) ? p : [])
      setStats(s)
      setParosHoy(Array.isArray(ph) ? ph : [])
      const map = {}
      if (Array.isArray(p)) {
        p.forEach(paro => { map[paro.id] = paro.segundos_transcurridos || 0 })
      }
      setSegundos(map)
    } catch (e) { console.error(e) }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    intervaloRef.current = setInterval(() => {
      setSegundos(prev => {
        const next = {}
        Object.keys(prev).forEach(k => { next[k] = (prev[k] || 0) + 1 })
        return next
      })
    }, 1000)
    return () => clearInterval(intervaloRef.current)
  }, [])

  useEffect(() => {
    if (!modalParo || !usuario.costo_hora) { setCostoPreview(null); return }
    const segs = segundos[modalParo.id] || 0
    setCostoPreview(Math.round((segs / 3600) * parseFloat(usuario.costo_hora || 0)))
  }, [segundos, modalParo])

  useSocket((data) => {
    if (data?.maquinaId) cargar()
  }, null)

  const abrirModal = async (paro) => {
    setModalParo(paro)
    setAccion('')
    setDescripcion('')
    try {
      const h = await api.get(`/mantenimiento/historial/${paro.id}`)
      setHistorial(Array.isArray(h) ? h : [])
    } catch { setHistorial([]) }
  }

  const registrarIntervencion = async () => {
    if (!accion.trim()) return mostrarToast('Selecciona una acción', 'error')
    setGuardando(true)
    try {
      const res = await api.post('/mantenimiento/intervenir', { paro_id: modalParo.id, accion, descripcion })
      const costo = res.costo_intervencion || 0
      mostrarToast(`✅ Intervención registrada · Costo: ${formatCOP(costo)}`)
      const h = await api.get(`/mantenimiento/historial/${modalParo.id}`)
      setHistorial(Array.isArray(h) ? h : [])
      setAccion('')
      setDescripcion('')
      cargar()
    } catch { mostrarToast('Error al registrar', 'error') }
    setGuardando(false)
  }

  const notificarTecnicos = async (paro_id) => {
    setNotificando(paro_id)
    try {
      const r = await api.post('/mantenimiento/notificar', { paro_id })
      mostrarToast(r.message || 'Notificación enviada ✅')
    } catch { mostrarToast('Error al notificar', 'error') }
    setNotificando(null)
  }

  const costoTotalHistorial = historial.reduce((acc, h) => acc + parseFloat(h.costo_intervencion || 0), 0)

  const costoHoyVivo = parosHoy.reduce((acc, p) => {
    if (p.activo == 1) {
      const segs = segundos[p.id] || p.duracion_segundos || 0
      return acc + Math.round((segs / 3600) * parseFloat(p.costo_hora_maquina || 0))
    }
    return acc + (Number(p.costo_perdido) || 0)
  }, 0)

  const formatDuracion = (segs) => {
    if (!segs) return '0s'
    const h = Math.floor(segs / 3600)
    const m = Math.floor((segs % 3600) / 60)
    const s = segs % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  if (cargando) return (
    <div className="pagina-mantenimiento min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-white">Cargando panel...</p>
    </div>
  )

  return (
    <div className="pagina-mantenimiento min-h-screen bg-slate-900 text-white">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-xl">🔧</div>
            <div>
              <h1 className="text-lg font-bold">Panel de Mantenimiento</h1>
              <p className="text-xs text-slate-400">Solo paros de mantenimiento · {usuario.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={cargar} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm">🔄 Actualizar</button>
            <button onClick={onLogout} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm">🚪 Salir</button>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Paros mantenimiento', valor: paros.length, color: 'text-red-400', icono: '🛑' },
            { label: 'Críticos (+60min)', valor: paros.filter(p => (segundos[p.id] || 0) >= 3600).length, color: 'text-red-500', icono: '🚨' },
            { label: 'T. respuesta prom.', valor: stats?.tiempo_respuesta_promedio ? `${stats.tiempo_respuesta_promedio}m` : 'N/A', color: 'text-blue-400', icono: '⚡' },
            { label: 'Costo paros mant. hoy', valor: formatCOP(costoHoyVivo), color: 'text-orange-400', icono: '💰' },
          ].map((k, i) => (
            <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span>{k.icono}</span>
                <p className="text-xs text-slate-400">{k.label}</p>
              </div>
              <p className={`text-2xl font-bold ${k.color}`}>{k.valor}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            {paros.length === 0 ? (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col items-center justify-center py-20">
                <span className="text-6xl mb-4">✅</span>
                <h2 className="text-xl font-bold text-green-400 mb-2">Sin paros de mantenimiento activos</h2>
                <p className="text-slate-400 text-sm">Los paros de otras categorías no se muestran aquí</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {paros.map(paro => {
                  const segs = segundos[paro.id] || paro.segundos_transcurridos || 0
                  const urgencia = nivelUrgencia(segs)
                  const costoMaquina = Math.round((segs / 3600) * parseFloat(paro.costo_hora_maquina || 0))
                  return (
                    <div key={paro.id} className={`rounded-2xl border-2 ${urgencia.border} ${urgencia.bg} overflow-hidden`}>
                      <div className={`${urgencia.color} px-4 py-1.5 flex items-center justify-between`}>
                        <span className="text-xs font-black tracking-widest text-white">{urgencia.label}</span>
                        <span className="text-xs font-mono font-bold text-white">{formatTiempo(segs)}</span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-slate-800 text-lg leading-tight">{paro.maquina_nombre}</h3>
                            <p className="text-xs text-slate-500">{paro.linea}</p>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse mt-1" />
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: paro.color_hex || '#94a3b8' }} />
                          <span className="text-sm text-slate-700 font-medium">{paro.motivo_nombre}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3 bg-white/70 rounded-xl p-3">
                          <div>
                            <p className="text-xs text-slate-400 mb-0.5">Costo parada máquina</p>
                            <p className="text-sm font-bold text-red-600">{formatCOP(costoMaquina)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-0.5">Costo última intervención</p>
                            <p className="text-sm font-bold text-orange-600">
                              {paro.ultimo_costo_intervencion ? formatCOP(paro.ultimo_costo_intervencion) : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-slate-600">
                          <span>👷 {paro.operador_nombre}</span>
                          <span>🕐 {new Date(paro.inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {paro.ultima_accion && (
                          <div className="bg-white/60 rounded-lg px-3 py-2 mb-3 text-xs text-slate-600">
                            <span className="font-medium">Última acción:</span> {paro.ultima_accion}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => abrirModal(paro)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-2 rounded-lg transition-colors">
                            📋 Registrar intervención
                          </button>
                          {usuario.rol !== 'mantenimiento' && (
                            <button onClick={() => notificarTecnicos(paro.id)} disabled={notificando === paro.id}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                              {notificando === paro.id ? '...' : '📱'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="w-80 flex-shrink-0">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">📋 Paros de hoy</p>
                  <p className="text-xs text-slate-400">{parosHoy.length} registro{parosHoy.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Costo total</p>
                  <p className="text-sm font-bold text-orange-400">{formatCOP(costoHoyVivo)}</p>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
                {parosHoy.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">Sin paros hoy</div>
                ) : parosHoy.map((p, i) => {
                  const estaActivo = p.activo == 1
                  const segs = estaActivo ? (segundos[p.id] || p.duracion_segundos || 0) : p.duracion_segundos
                  const costo = estaActivo
                    ? Math.round((segs / 3600) * parseFloat(p.costo_hora_maquina || 0))
                    : Number(p.costo_perdido) || 0
                  return (
                    <div key={i} className={`px-4 py-3 border-b border-slate-700/50 ${estaActivo ? 'bg-red-900/20' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {estaActivo && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                            <p className="text-xs font-semibold text-white truncate">{p.maquina_nombre}</p>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{p.motivo_nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{p.operador_nombre}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-mono text-blue-300">{formatDuracion(segs)}</p>
                          <p className="text-xs font-bold text-red-400">{formatCOP(costo)}</p>
                          {estaActivo && <p className="text-xs text-red-500 mt-0.5">En curso</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalParo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-slate-800 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white">{modalParo.maquina_nombre}</h2>
                <p className="text-xs text-slate-400">{modalParo.linea} · {modalParo.motivo_nombre}</p>
              </div>
              <button onClick={() => setModalParo(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-400 mb-1">Tiempo parado</p>
                  <p className="text-lg font-black text-red-600">{formatTiempo(segundos[modalParo.id] || 0)}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-orange-400 mb-1">Costo máquina</p>
                  <p className="text-sm font-black text-orange-600">
                    {formatCOP(Math.round(((segundos[modalParo.id] || 0) / 3600) * parseFloat(modalParo.costo_hora_maquina || 0)))}
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-purple-400 mb-1">Costo técnico</p>
                  <p className="text-sm font-black text-purple-600">
                    {costoPreview !== null ? formatCOP(costoPreview) : <span className="text-xs text-slate-400">Sin tarifa</span>}
                  </p>
                </div>
              </div>

              {!usuario.costo_hora && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-xs text-yellow-700 flex items-center gap-2">
                  ⚠️ Tu perfil no tiene costo/hora configurado. El admin puede asignarlo en la gestión de usuarios.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Acción realizada</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {ACCIONES.map(a => (
                    <button key={a} onClick={() => setAccion(a)}
                      className={`text-xs px-3 py-2 rounded-lg border text-left transition-colors
                        ${accion === a
                          ? 'bg-orange-500 border-orange-500 text-white font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-orange-50'}`}>
                      {a}
                    </button>
                  ))}
                </div>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Descripción adicional (opcional)..." rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-orange-400 resize-none" />
                {accion && (
                  <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-700 mb-1">Resumen de esta intervención:</p>
                    <div className="flex justify-between">
                      <span>Duración del paro</span>
                      <span className="font-bold">{formatTiempo(segundos[modalParo.id] || 0)}</span>
                    </div>
                    {costoPreview !== null && (
                      <div className="flex justify-between mt-1">
                        <span>Costo técnico ({formatCOP(usuario.costo_hora)}/h)</span>
                        <span className="font-bold text-purple-600">{formatCOP(costoPreview)}</span>
                      </div>
                    )}
                    <div className="flex justify-between mt-1 border-t border-slate-200 pt-1">
                      <span>Costo total parada</span>
                      <span className="font-bold text-red-600">
                        {formatCOP(Math.round(((segundos[modalParo.id] || 0) / 3600) * parseFloat(modalParo.costo_hora_maquina || 0)) + (costoPreview || 0))}
                      </span>
                    </div>
                  </div>
                )}
                <button onClick={registrarIntervencion} disabled={guardando || !accion}
                  className="w-full mt-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                  {guardando ? 'Guardando...' : '✅ Registrar intervención'}
                </button>
              </div>

              {historial.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Historial de este paro</p>
                    {costoTotalHistorial > 0 && (
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                        Total intervenciones: {formatCOP(costoTotalHistorial)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {historial.map((h, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-700">{h.accion}</span>
                          <div className="flex items-center gap-2">
                            {h.costo_intervencion > 0 && (
                              <span className="text-orange-600 font-bold">{formatCOP(h.costo_intervencion)}</span>
                            )}
                            <span className="text-slate-400">{h.tiempo_respuesta_min}m</span>
                          </div>
                        </div>
                        {h.descripcion && <p className="text-slate-500 italic">{h.descripcion}</p>}
                        <p className="text-slate-400 mt-1">
                          👷 {h.tecnico_nombre}
                          {h.costo_hora_tecnico > 0 && <span className="ml-1 text-slate-300">({formatCOP(h.costo_hora_tecnico)}/h)</span>}
                          · {new Date(h.creado_en).toLocaleString('es-CO')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
