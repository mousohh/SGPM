import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useAlertas } from '../../hooks/useAlertas'
import PanelAlertas from '../../components/PanelAlertas'
import { exportarReporteSupervisorPDF } from '../../utils/exportPDF'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import IconoMaquina from '../../components/IconoMaquina'

const formatCOP = (valor) => {
  if (!valor) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(valor)
}

const formatTiempo = (segundos) => {
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

const getTurnoActual = () => {
  const ahora = new Date()
  const totalMin = ahora.getHours() * 60 + ahora.getMinutes()
  if (totalMin >= 330 && totalMin <= 809) {
    const inicio = new Date(ahora); inicio.setHours(5, 30, 0, 0)
    const fin = new Date(ahora); fin.setHours(13, 29, 59, 999)
    return { nombre: 'Turno Mañana', inicio, fin }
  }
  if (totalMin >= 810 && totalMin <= 1289) {
    const inicio = new Date(ahora); inicio.setHours(13, 30, 0, 0)
    const fin = new Date(ahora); fin.setHours(21, 29, 59, 999)
    return { nombre: 'Turno Tarde', inicio, fin }
  }
  const inicio = new Date(ahora)
  if (totalMin >= 1290) { inicio.setHours(21, 30, 0, 0) }
  else { inicio.setDate(inicio.getDate() - 1); inicio.setHours(21, 30, 0, 0) }
  const fin = new Date(ahora)
  if (totalMin < 330) { fin.setHours(5, 29, 59, 999) }
  else { fin.setDate(fin.getDate() + 1); fin.setHours(5, 29, 59, 999) }
  return { nombre: 'Turno Noche', inicio, fin }
}

const toLocalISO = (date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 19).replace('T', ' ')
}

const formatHora = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export default function PanelSupervisor({ onLogout }) {
  const { usuario, logout } = useAuth()
  const [datos, setDatos] = useState(null)
  const [turno, setTurno] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [paginaHistorial, setPaginaHistorial] = useState(0)
  const [maquinasActivas, setMaquinasActivas] = useState([])
  const [parosActivos, setParosActivos] = useState({})
  const [exportando, setExportando] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [editForm, setEditForm] = useState({ inicio: '', fin: '' })
  const [guardando, setGuardando] = useState(false)
  const [errorEditar, setErrorEditar] = useState('')
  const [preview, setPreview] = useState(null)
  const [notificando, setNotificando] = useState(null)
  const [toast, setToast] = useState(null)
  const intervalRef = useRef(null)
  const POR_PAGINA = 8

  const {
    alertas, config, mostrarConfig, setMostrarConfig,
    guardarConfig, dismissAlerta, dismissTodas,
    alertarParoIniciado, alertarExcesoParos
  } = useAlertas({ rol: 'supervisor', linea: usuario?.linea })

  const mostrarToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const cargar = async () => {
    const t = getTurnoActual()
    setTurno(t)
    const params = new URLSearchParams({
      linea: usuario.linea,
      turno_inicio: toLocalISO(t.inicio),
      turno_fin: toLocalISO(t.fin)
    })
    const data = await api.get(`/reportes/resumen-supervisor?${params}`)
    setDatos(data)
    setCargando(false)
  }

  const cargarMaquinasActivas = async () => {
    const [maqData, parosData] = await Promise.all([
      api.get('/maquinas'),
      api.get('/paros/activos')
    ])
    const miLinea = maqData.filter(m => m.linea === usuario.linea && m.activa)
    setMaquinasActivas(miLinea)
    const parosMap = {}
    parosData.forEach(p => { parosMap[p.maquina_id] = p })
    setParosActivos(parosMap)
  }

  useEffect(() => {
    if (usuario?.linea) {
      cargar()
      cargarMaquinasActivas()
      intervalRef.current = setInterval(cargar, 15000)
    }
    return () => clearInterval(intervalRef.current)
  }, [usuario])

  useSocket(
    (data) => {
      setParosActivos(prev => ({
        ...prev,
        [data.maquinaId]: {
          maquina_id: data.maquinaId,
          motivo_nombre: data.motivoNombre,
          color_hex: data.colorHex,
          inicio: data.inicio
        }
      }))
      if (!usuario?.linea || data.linea === usuario?.linea) {
        alertarParoIniciado(data)
        if (data.totalParosTurno) {
          alertarExcesoParos(data.maquinaNombre, data.maquinaId, data.totalParosTurno)
        }
      }
      setTimeout(() => cargar(), 500)
    },
    (data) => {
      setParosActivos(prev => {
        const nuevo = { ...prev }
        delete nuevo[data.maquinaId]
        return nuevo
      })
      setTimeout(() => cargar(), 500)
    }
  )

  const notificarTecnicos = async (paroId) => {
    setNotificando(paroId)
    try {
      const r = await api.post('/mantenimiento/notificar', { paro_id: paroId })
      mostrarToast(r.message || 'Notificación enviada ✅')
    } catch (e) {
      mostrarToast('Error al notificar', 'error')
    }
    setNotificando(null)
  }

  const abrirEditar = (paro) => {
    setModalEditar(paro)
    setEditForm({ inicio: toDatetimeLocal(paro.inicio), fin: toDatetimeLocal(paro.fin) })
    setErrorEditar('')
    setPreview(null)
  }

  const calcularPreview = (inicio, fin, paro) => {
    if (!inicio || !fin) { setPreview(null); return }
    const ini = new Date(inicio)
    const fi = new Date(fin)
    if (fi <= ini) { setPreview(null); return }
    const segundos = Math.round((fi - ini) / 1000)
    const h = Math.floor(segundos / 3600)
    const m = Math.floor((segundos % 3600) / 60)
    const s = segundos % 60
    const duracion = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
    const costo = Math.round((segundos / 3600) * (paro?.costo_hora || 0))
    const unidades = (paro?.linea === '3 - Sellado' && paro?.unidades_por_minuto > 0)
      ? Math.round((segundos / 60) * paro.unidades_por_minuto) : null
    setPreview({ duracion, costo, unidades })
  }

  const handleEditChange = (campo, valor) => {
    const nuevo = { ...editForm, [campo]: valor }
    setEditForm(nuevo)
    calcularPreview(nuevo.inicio, nuevo.fin, modalEditar)
    setErrorEditar('')
  }

  const guardarEdicion = async () => {
    if (!editForm.inicio || !editForm.fin) { setErrorEditar('Completa inicio y fin'); return }
    if (new Date(editForm.fin) <= new Date(editForm.inicio)) { setErrorEditar('El fin debe ser posterior al inicio'); return }
    setGuardando(true)
    try {
      await api.put(`/paros/${modalEditar.id}/editar-tiempos`, {
        inicio: fromDatetimeLocal(editForm.inicio),
        fin: fromDatetimeLocal(editForm.fin)
      })
      setModalEditar(null)
      await cargar()
    } catch (e) { setErrorEditar('Error al guardar') }
    setGuardando(false)
  }

  const handleExportPDF = async () => {
    setExportando(true)
    try {
      await exportarReporteSupervisorPDF({
        kpis: datos?.kpis,
        maquinas: datos?.maquinas,
        motivos: datos?.motivos,
        historial: datos?.historial,
        turno,
        linea: usuario?.linea
      })
    } catch (e) { console.error('Error exportando PDF:', e) }
    setExportando(false)
  }

  const handleLogout = () => { logout(); onLogout() }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-400">Cargando panel...</p>
      </div>
    )
  }

  const { kpis, maquinas, motivos, historial } = datos || {}
  const totalPaginasHistorial = Math.ceil((historial?.length || 0) / POR_PAGINA)
  const historialPagina = historial?.slice(paginaHistorial * POR_PAGINA, (paginaHistorial + 1) * POR_PAGINA) || []

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-sm font-bold">S</div>
          <div>
            <h1 className="font-bold text-slate-800">Panel Supervisor</h1>
            <p className="text-slate-400 text-xs">{usuario?.linea} · {turno?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm">{usuario?.nombre}</span>
          <button onClick={handleExportPDF} disabled={exportando}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg">
            {exportando ? '⏳...' : '📄 PDF'}
          </button>
          <button onClick={handleLogout}
            className="border border-slate-300 text-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50">
            Salir
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Paros', valor: kpis?.total_paros || 0, color: 'text-red-600', bg: 'bg-red-50 border-red-200', icono: '🛑' },
            { label: 'Tiempo Perdido', valor: formatMinutos(kpis?.minutos_perdidos), color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icono: '⏱️' },
            { label: 'Costo Perdido', valor: formatCOP(kpis?.costo_perdido), color: 'text-red-700', bg: 'bg-red-50 border-red-300', icono: '💸' },
            { label: 'Unidades No Prod.', valor: Number(kpis?.unidades_no_producidas || 0).toLocaleString('es-CO'), color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icono: '📦' },
          ].map((k, i) => (
            <div key={i} className={`rounded-xl p-4 border ${k.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{k.icono}</span>
                <p className="text-slate-500 text-xs">{k.label}</p>
              </div>
              <p className={`text-xl font-bold ${k.color}`}>{k.valor}</p>
            </div>
          ))}
        </div>

        {/* Máquinas tiempo real */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">Estado en Tiempo Real — {usuario?.linea}</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400">En vivo</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {maquinasActivas.length === 0 ? (
              <p className="text-slate-400 text-sm col-span-4">Sin máquinas en esta línea</p>
            ) : maquinasActivas.map(m => {
              const paro = parosActivos[m.id]
              const enParo = !!paro
              return (
                <div key={m.id}
                  className={`rounded-2xl border-2 overflow-hidden transition-all duration-300
                    ${enParo ? 'border-red-400 shadow-md shadow-red-100' : 'border-green-300'}`}>
                  {/* Ilustración */}
                  <div className={`p-3 pb-1 ${enParo ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className="w-full h-14">
                      <IconoMaquina nombre={m.nombre} enParo={enParo} />
                    </div>
                  </div>
                  <div className={`px-3 py-2 ${enParo ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500">{m.codigo}</span>
                      <div className={`w-2 h-2 rounded-full ${enParo ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-1 truncate">{m.nombre}</p>
                    {enParo ? (
                      <>
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: paro.color_hex }} />
                          <p className="text-xs text-red-600 font-medium truncate">{paro.motivo_nombre}</p>
                        </div>
                        <p className="text-xs text-red-400 mb-2">
                          Desde {new Date(paro.inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <button
                          onClick={() => notificarTecnicos(paro.id)}
                          disabled={notificando === paro.id}
                          className="w-full flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
                          {notificando === paro.id ? '⏳' : '📱'}
                          {notificando === paro.id ? 'Notificando...' : 'Llamar técnico'}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-green-600 font-medium">✔ Operando</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Resumen por máquina */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-700 mb-4">Resumen por Máquina — Turno</h2>
            {!maquinas?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin datos en este turno</p>
            ) : (
              <div className="space-y-3">
                {maquinas.map((m, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{m.nombre}</p>
                        <p className="text-slate-400 text-xs">{m.codigo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{formatCOP(m.costo_perdido)}</p>
                        <p className="text-xs text-slate-400">{m.total_paros} paros · {formatMinutos(m.minutos_perdidos)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(Math.max(m.disponibilidad_pct, 0), 100)}%`,
                            backgroundColor: m.disponibilidad_pct >= 80 ? '#16a34a' : m.disponibilidad_pct >= 60 ? '#f59e0b' : '#ef4444'
                          }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600 w-12">{m.disponibilidad_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gráfico motivos */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-700 mb-4">Motivos del Turno</h2>
            {!motivos?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">Sin paros en este turno</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={motivos} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [formatMinutos(v), 'Tiempo perdido']}
                      labelFormatter={l => `Motivo: ${l}`} />
                    <Bar dataKey="minutos_perdidos" radius={[4, 4, 0, 0]}>
                      {motivos.map((m, i) => (
                        <Cell key={i} fill={m.color_hex || '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {motivos.slice(0, 4).map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color_hex }} />
                        <span className="text-slate-600">{m.nombre}</span>
                      </div>
                      <span className="font-medium text-slate-700">{m.total_paros} paros · {formatMinutos(m.minutos_perdidos)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Historial del turno */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Historial de Paros del Turno</h2>
            <span className="text-xs text-slate-400">{historial?.length || 0} paros registrados</span>
          </div>
          {!historial?.length ? (
            <p className="text-slate-400 text-sm text-center py-8">Sin paros registrados en este turno</p>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Hora', 'Máquina', 'Motivo', 'Duración', 'Costo', 'Operador', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historialPagina.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-500">{formatHora(p.inicio)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.maquina_nombre}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color_hex }} />
                          <span className="text-sm text-slate-700">{p.motivo_nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-orange-600 font-medium">{formatTiempo(p.duracion_segundos)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600">{formatCOP(p.costo_perdido)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.operador_nombre}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => abrirEditar(p)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap">
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPaginasHistorial > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <button onClick={() => setPaginaHistorial(p => Math.max(0, p - 1))}
                    disabled={paginaHistorial === 0}
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-30 hover:bg-slate-50">
                    ← Anterior
                  </button>
                  <span className="text-sm text-slate-400">Página {paginaHistorial + 1} de {totalPaginasHistorial}</span>
                  <button onClick={() => setPaginaHistorial(p => Math.min(totalPaginasHistorial - 1, p + 1))}
                    disabled={paginaHistorial === totalPaginasHistorial - 1}
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-30 hover:bg-slate-50">
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-center mt-6">
          <button onClick={cargar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
            🔄 Actualizar datos
          </button>
        </div>
      </div>

      {/* Modal edición tiempos */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">✏️ Editar Tiempos del Paro</h2>
                <p className="text-xs text-slate-400 mt-0.5">{modalEditar.maquina_nombre} · {modalEditar.motivo_nombre}</p>
              </div>
              <button onClick={() => setModalEditar(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2">VALORES ACTUALES</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Duración</p>
                    <p className="font-bold text-slate-700">{formatTiempo(modalEditar.duracion_segundos)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Costo</p>
                    <p className="font-bold text-red-600">{formatCOP(modalEditar.costo_perdido)}</p>
                  </div>
                </div>
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
              {preview && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 mb-2">NUEVOS VALORES CALCULADOS</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-blue-400">Duración</p>
                      <p className="font-bold text-blue-800">{preview.duracion}</p>
                    </div>
                    <div>
                      <p className="text-blue-400">Costo</p>
                      <p className="font-bold text-red-600">{formatCOP(preview.costo)}</p>
                    </div>
                    {preview.unidades != null && (
                      <div className="col-span-2">
                        <p className="text-blue-400">Unidades no producidas</p>
                        <p className="font-bold text-purple-600">{Number(preview.unidades).toLocaleString('es-CO')} u</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {errorEditar && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {errorEditar}
                </p>
              )}
              <p className="text-xs text-slate-400">
                ⚠️ Este cambio quedará registrado en las observaciones con tu nombre y fecha.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModalEditar(null)}
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={guardando || !preview}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold">
                {guardando ? '⏳ Guardando...' : '✔ Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PanelAlertas
        alertas={alertas}
        config={config}
        mostrarConfig={mostrarConfig}
        setMostrarConfig={setMostrarConfig}
        guardarConfig={guardarConfig}
        dismissAlerta={dismissAlerta}
        dismissTodas={dismissTodas}
      />
    </div>
  )
}