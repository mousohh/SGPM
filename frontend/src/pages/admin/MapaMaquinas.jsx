import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import IconoMaquina from '../../components/IconoMaquina'

const formatTiempo = (segundos) => {
  if (!segundos) return '00:00:00'
  const h = Math.floor(segundos / 3600).toString().padStart(2, '0')
  const m = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0')
  const s = (segundos % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

const formatCOP = (valor) => {
  if (!valor) return '$0'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

const hablar = (texto) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'es-CO'; u.rate = 0.9; u.pitch = 1; u.volume = 1
    window.speechSynthesis.speak(u)
  }
}

export default function MapaMaquinas() {
  const [maquinas, setMaquinas] = useState([])
  const [parosActivos, setParosActivos] = useState({})
  const [resumenDia, setResumenDia] = useState({ total_paros: 0, segundos_perdidos: 0, costo_perdido: 0 })
  const [alertas, setAlertas] = useState([])
  const [silenciadas, setSilenciadas] = useState(new Set())
  const [silenciadoGlobal, setSilenciadoGlobal] = useState(false)
  const [notificando, setNotificando] = useState(null)
  const [toast, setToast] = useState(null)
  const [vistaGrid, setVistaGrid] = useState(true)
  const intervalRef = useRef(null)

  const toggleSilenciarMaquina = (maquinaId) => {
    setSilenciadas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(maquinaId)) nuevo.delete(maquinaId)
      else nuevo.add(maquinaId)
      return nuevo
    })
  }

  const estaSilenciada = (maquinaId) => silenciadoGlobal || silenciadas.has(maquinaId)

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const cargarResumenDia = async () => {
    const hoy = new Date().toISOString().slice(0, 10)
    try {
      const data = await api.get(`/paros/historial?fecha_inicio=${hoy}&fecha_fin=${hoy}`)
      if (Array.isArray(data)) {
        const total_paros = data.length
        const segundos_perdidos = data.reduce((acc, p) => acc + Number(p.duracion_segundos || 0), 0)
        const costo_perdido = data.reduce((acc, p) => acc + Number(p.costo_perdido || 0), 0)
        setResumenDia({ total_paros, segundos_perdidos, costo_perdido })
      }
    } catch { }
  }

  const cargarDatos = async () => {
    const [maqData, parosData] = await Promise.all([api.get('/maquinas'), api.get('/paros/activos')])
    // Incluir TODAS las máquinas (activas e inactivas) para mostrar en el mapa
    setMaquinas(Array.isArray(maqData) ? maqData : [])
    const parosMap = {}
    parosData.forEach(p => { parosMap[p.maquina_id] = { ...p, segundos: p.segundos_transcurridos || 0 } })
    setParosActivos(parosMap)
    await cargarResumenDia()
  }

  useEffect(() => {
    cargarDatos()
    intervalRef.current = setInterval(() => {
      setParosActivos(prev => {
        const nuevo = { ...prev }
        Object.keys(nuevo).forEach(id => { nuevo[id] = { ...nuevo[id], segundos: nuevo[id].segundos + 1 } })
        return nuevo
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  useSocket(
    (data) => {
      if (!estaSilenciada(data.maquinaId)) hablar(`Atención. La máquina ${data.maquinaNombre} se ha detenido. Motivo: ${data.motivoNombre}`)
      setParosActivos(prev => ({
        ...prev,
        [data.maquinaId]: {
          maquina_id: data.maquinaId, maquina_nombre: data.maquinaNombre,
          motivo_nombre: data.motivoNombre, color_hex: data.colorHex,
          operador_nombre: data.operador, costo_hora: data.costoHora || 0,
          unidades_por_minuto: data.unidadesPorMinuto || null,
          linea: data.linea || '', inicio: data.inicio, segundos: 0
        }
      }))
      const alerta = { id: Date.now(), ...data }
      setAlertas(prev => [alerta, ...prev.slice(0, 4)])
      setTimeout(() => setAlertas(prev => prev.filter(a => a.id !== alerta.id)), 15000)
    },
    (data) => {
      if (!estaSilenciada(data.maquinaId)) hablar(`La máquina ${data.maquinaNombre} ha sido activada`)
      setResumenDia(prev => ({
        total_paros: prev.total_paros + 1,
        segundos_perdidos: prev.segundos_perdidos + (data.duracion_segundos || 0),
        costo_perdido: prev.costo_perdido + (data.costo_perdido || 0)
      }))
      setParosActivos(prev => { const n = { ...prev }; delete n[data.maquinaId]; return n })
    }
  )

  const notificarTecnicos = async (paroId) => {
    setNotificando(paroId)
    try {
      const r = await api.post('/mantenimiento/notificar', { paro_id: paroId })
      mostrarToast(r.message || 'Notificación enviada ✅')
    } catch { mostrarToast('Error al notificar', 'error') }
    setNotificando(null)
  }

  // Solo máquinas ACTIVAS para los KPIs y disponibilidad
  const maquinasActivas = maquinas.filter(m => m.activa)
  const maquinasInactivas = maquinas.filter(m => !m.activa)
  const maquinasParadas = Object.keys(parosActivos).length
  const maquinasOperando = maquinasActivas.length - maquinasParadas
  const disponibilidad = maquinasActivas.length > 0
    ? Math.round((maquinasOperando / maquinasActivas.length) * 100)
    : 0

  const costoActivo = Object.values(parosActivos).reduce((acc, p) => acc + ((p.costo_hora || 0) / 3600) * p.segundos, 0)
  const segundosActivos = Object.values(parosActivos).reduce((acc, p) => acc + p.segundos, 0)

  const parosDia = Number(resumenDia.total_paros) + maquinasParadas
  const minutosPerdidosDia = Math.round((Number(resumenDia.segundos_perdidos) + segundosActivos) / 60)
  const costoDia = parseFloat(resumenDia.costo_perdido || 0) + costoActivo

  const unidadesTotal = Object.values(parosActivos).reduce((acc, p) => {
    if (p.linea === '3 - Sellado' && p.unidades_por_minuto > 0) return acc + (p.unidades_por_minuto / 60) * p.segundos
    return acc
  }, 0)

  // Agrupar por línea — todas las máquinas
  const porLinea = maquinas.reduce((acc, m) => {
    const linea = m.linea || 'Sin línea'
    if (!acc[linea]) acc[linea] = []
    acc[linea].push(m)
    return acc
  }, {})

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Alertas flotantes */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
        {alertas.map(a => (
          <div key={a.id} className="bg-red-600 text-white rounded-xl p-4 shadow-xl flex items-start justify-between">
            <div>
              <p className="font-bold text-sm">🚨 Máquina Parada</p>
              <p className="text-sm mt-0.5">{a.maquinaNombre}</p>
              <p className="text-xs text-red-200 mt-0.5">{a.motivoNombre}</p>
            </div>
            <button onClick={() => setAlertas(prev => prev.filter(al => al.id !== a.id))}
              className="text-red-200 hover:text-white ml-2 text-lg">×</button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mapa de Máquinas</h1>
          <p className="text-slate-500 text-sm mt-1">Estado en tiempo real de toda la planta</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-200 rounded-lg p-1">
            <button onClick={() => setVistaGrid(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${vistaGrid ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              🏭 Visual
            </button>
            <button onClick={() => setVistaGrid(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${!vistaGrid ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              📋 Lista
            </button>
          </div>
          <button onClick={() => setSilenciadoGlobal(!silenciadoGlobal)}
            className={`text-sm px-3 py-2 rounded-lg border transition-colors
              ${silenciadoGlobal ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
            {silenciadoGlobal ? '🔇' : '🔊'}
          </button>
          <button onClick={cargarDatos} className="text-sm px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700">
            🔄
          </button>
        </div>
      </div>

      {/* KPIs — solo máquinas activas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="rounded-xl p-4 border bg-green-50 border-green-200">
          <p className="text-slate-500 text-sm">Operando ahora</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{maquinasOperando}</p>
          <p className="text-xs text-slate-400 mt-0.5">de {maquinasActivas.length} activas</p>
        </div>
        <div className="rounded-xl p-4 border bg-red-50 border-red-200">
          <p className="text-slate-500 text-sm">Paradas hoy</p>
          <p className="text-2xl font-bold mt-1 text-red-500">{parosDia}</p>
          <p className="text-xs text-slate-400 mt-0.5">{maquinasParadas} activas ahora</p>
        </div>
        <div className="rounded-xl p-4 border bg-blue-50 border-blue-200">
          <p className="text-slate-500 text-sm">Disponibilidad</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{disponibilidad}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{minutosPerdidosDia} min perdidos hoy</p>
        </div>
        <div className="rounded-xl p-4 border bg-red-50 border-red-300">
          <p className="text-slate-500 text-sm">Pérdida total hoy</p>
          <p className="text-2xl font-bold mt-1 text-red-700">{formatCOP(costoDia)}</p>
          <p className="text-xs text-slate-400 mt-0.5">acumulado del día</p>
        </div>
      </div>

      {/* Badge máquinas inactivas */}
      {maquinasInactivas.length > 0 && (
        <div className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 mb-6 flex items-center gap-2">
          <span className="text-slate-400 text-sm">⚙️</span>
          <p className="text-slate-500 text-xs">
            <span className="font-semibold text-slate-600">{maquinasInactivas.length} máquina{maquinasInactivas.length > 1 ? 's' : ''} desactivada{maquinasInactivas.length > 1 ? 's' : ''}</span>
            {' '}— no influyen en disponibilidad ni OEE.
            {' '}{maquinasInactivas.map(m => m.nombre).join(', ')}
          </p>
        </div>
      )}

      {unidadesTotal > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <p className="text-purple-700 font-bold text-lg">{Math.round(unidadesTotal).toLocaleString('es-CO')} unidades no producidas</p>
            <p className="text-purple-500 text-sm">Acumulado en paros activos de sellado</p>
          </div>
        </div>
      )}

      {maquinas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">No hay máquinas registradas</p>
        </div>
      ) : vistaGrid ? (
        <div className="space-y-6">
          {Object.entries(porLinea).map(([linea, maquinasLinea]) => (
            <div key={linea}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-bold text-slate-700">{linea}</h3>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">
                  {maquinasLinea.filter(m => m.activa && !parosActivos[m.id]).length}/{maquinasLinea.filter(m => m.activa).length} operando
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {maquinasLinea.map(m => {
                  const paro = parosActivos[m.id]
                  const enParo = !!paro
                  const inactiva = !m.activa
                  const costoActualMaq = enParo ? ((m.costo_hora || 0) / 3600) * paro.segundos : 0

                  // Máquina INACTIVA — tarjeta gris
                  if (inactiva) return (
                    <div key={m.id} className="rounded-2xl border-2 border-slate-200 overflow-hidden opacity-60">
                      <div className="bg-slate-100 p-3 pb-1">
                        <div className="w-full h-16 grayscale opacity-40">
                          <IconoMaquina nombre={m.nombre} enParo={false} />
                        </div>
                      </div>
                      <div className="px-3 py-2 bg-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-slate-400 text-xs truncate">{m.nombre}</p>
                          <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0 ml-1" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">🔧 Desactivada</p>
                        {m.motivo_desactivacion && (
                         <p className="text-xs text-red-600 font-medium mt-0.5 truncate" title={m.motivo_desactivacion}>
                            {m.motivo_desactivacion}
                          </p>
                        )}
                      </div>
                    </div>
                  )

                  // Máquina ACTIVA — tarjeta normal
                  return (
                    <div key={m.id} className={`rounded-2xl border-2 overflow-hidden transition-all duration-300
                      ${enParo ? 'border-red-400 shadow-lg shadow-red-100' : 'border-green-300'}`}>
                      <div className={`p-3 pb-1 ${enParo ? 'bg-red-50' : 'bg-green-50'}`}>
                        <div className="w-full h-16">
                          <IconoMaquina nombre={m.nombre} enParo={enParo} />
                        </div>
                      </div>
                      <div className={`px-3 py-2 ${enParo ? 'bg-red-50' : 'bg-green-50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-slate-800 text-xs truncate">{m.nombre}</p>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${enParo ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                        </div>

                        {enParo ? (
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: paro.color_hex }} />
                              <p className="text-xs text-red-700 font-medium truncate">{paro.motivo_nombre}</p>
                            </div>
                            <p className="text-lg font-mono font-black text-red-600 leading-none mb-1">
                              {formatTiempo(paro.segundos)}
                            </p>
                            <p className="text-xs font-bold text-red-500 mb-1">💸 {formatCOP(costoActualMaq)}</p>
                            <p className="text-xs text-slate-500 mb-2">👷 {paro.operador_nombre}</p>
                            <div className="flex gap-1 mb-1">
                              <button onClick={() => notificarTecnicos(paro.id)} disabled={notificando === paro.id}
                                className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg">
                                {notificando === paro.id ? '⏳' : '📱'}
                                {notificando === paro.id ? '...' : 'Notificar'}
                              </button>
                              <button onClick={() => toggleSilenciarMaquina(m.id)}
                                className={`px-2 py-1.5 rounded-lg text-xs border transition-colors
                                  ${estaSilenciada(m.id) ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                {estaSilenciada(m.id) ? '🔇' : '🔔'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-green-600 text-xs font-bold">✔ Operando</p>
                              <button onClick={() => toggleSilenciarMaquina(m.id)}
                                className={`text-xs px-1.5 py-0.5 rounded border transition-colors
                                  ${estaSilenciada(m.id) ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                {estaSilenciada(m.id) ? '🔇' : '🔔'}
                              </button>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">{formatCOP(m.costo_hora)}/h</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {maquinas.map(m => {
            const paro = parosActivos[m.id]
            const enParo = !!paro
            const inactiva = !m.activa
            const costoActualMaq = enParo ? ((m.costo_hora || 0) / 3600) * paro.segundos : 0
            const unidadesActual = enParo && m.linea === '3 - Sellado' && m.unidades_por_minuto > 0
              ? Math.round((m.unidades_por_minuto / 60) * paro.segundos) : 0

            if (inactiva) return (
              <div key={m.id} className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 opacity-60">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-400 text-sm">{m.nombre}</p>
                    <p className="text-xs text-slate-400">{m.linea || 'Sin línea'}</p>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                </div>
                <p className="text-slate-400 text-sm font-medium">🔧 Desactivada</p>
                {m.motivo_desactivacion && (
                  <p className="text-xs text-red-600 font-medium mt-1">{m.motivo_desactivacion}</p>
                )}
                <p className="text-xs text-slate-300 mt-1">No influye en OEE ni disponibilidad</p>
              </div>
            )

            return (
              <div key={m.id} className={`rounded-xl border-2 p-4 transition-all
                ${enParo ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{m.nombre}</p>
                    <p className="text-xs text-slate-500">{m.linea || 'Sin línea'}</p>
                  </div>
                  <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${enParo ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                </div>
                {enParo ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: paro.color_hex }} />
                      <p className="text-xs font-medium text-red-700">{paro.motivo_nombre}</p>
                    </div>
                    <p className="text-2xl font-mono font-bold text-red-600">{formatTiempo(paro.segundos)}</p>
                    <p className="text-xs font-bold text-red-500 mt-1">💸 {formatCOP(costoActualMaq)}</p>
                    {unidadesActual > 0 && <p className="text-xs font-bold text-purple-600 mt-1">📦 {unidadesActual.toLocaleString('es-CO')} u</p>}
                    <p className="text-xs text-slate-500 mt-1">Op: {paro.operador_nombre}</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => notificarTecnicos(paro.id)} disabled={notificando === paro.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg">
                        {notificando === paro.id ? '⏳ Notificando...' : '📱 Notificar'}
                      </button>
                      <button onClick={() => toggleSilenciarMaquina(m.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors
                          ${estaSilenciada(m.id) ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                        {estaSilenciada(m.id) ? '🔇' : '🔔'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-green-600 text-sm font-medium">✔ Operando</span>
                      <button onClick={() => toggleSilenciarMaquina(m.id)}
                        className={`text-sm px-2 py-1 rounded-lg border transition-colors
                          ${estaSilenciada(m.id) ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        {estaSilenciada(m.id) ? '🔇' : '🔔'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{formatCOP(m.costo_hora)}/h</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
