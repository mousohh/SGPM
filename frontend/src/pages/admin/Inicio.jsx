import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'

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

const formatHora = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export default function Inicio({ usuario, onNavegar }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(new Date())
  const intervalRef = useRef(null)
  const relojRef = useRef(null)

  const cargar = async () => {
    try {
      const data = await api.get('/reportes/resumen-inicio')
      setDatos(data)
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    intervalRef.current = setInterval(cargar, 30000)
    relojRef.current = setInterval(() => setAhora(new Date()), 1000)
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(relojRef.current)
    }
  }, [])

  useSocket(
    () => setTimeout(cargar, 800),
    () => setTimeout(cargar, 800)
  )

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  const {
    turnoNombre, maquinas_operando, maquinas_paradas, total_maquinas,
    disponibilidad_pct, total_paros_turno, minutos_perdidos_turno,
    costo_perdido_turno, paros_activos, top_motivos, ultimos_paros
  } = datos || {}

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bienvenido, {usuario?.nombre} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">
            {turnoNombre && `Turno ${turnoNombre} en curso`} · Última actualización: {formatHora(new Date().toISOString())}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-800 tabular-nums">
            {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-xs text-slate-400">
            {ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavegar('mapa')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-700 text-xs font-medium">Operando</p>
            <span className="text-lg">✅</span>
          </div>
          <p className="text-3xl font-bold text-green-700">{maquinas_operando ?? '—'}</p>
          <p className="text-xs text-green-600 mt-1">de {total_maquinas} máquinas → Ver mapa</p>
        </div>

        <div className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow
            ${maquinas_paradas > 0 ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}
          onClick={() => onNavegar('mapa')}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-medium ${maquinas_paradas > 0 ? 'text-red-700' : 'text-slate-500'}`}>Paradas</p>
            <span className="text-lg">{maquinas_paradas > 0 ? '🛑' : '✔️'}</span>
          </div>
          <p className={`text-3xl font-bold ${maquinas_paradas > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {maquinas_paradas ?? '—'}
          </p>
          <p className={`text-xs mt-1 ${maquinas_paradas > 0 ? 'text-red-500' : 'text-slate-400'}`}>
            {maquinas_paradas > 0 ? 'Con paro activo → Ver mapa' : 'Sin paros activos'}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavegar('reportes')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-700 text-xs font-medium">Disponibilidad</p>
            <span className="text-lg">📊</span>
          </div>
          <p className={`text-3xl font-bold
            ${disponibilidad_pct >= 80 ? 'text-green-600' : disponibilidad_pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {disponibilidad_pct ?? '—'}%
          </p>
          <div className="mt-2 bg-blue-200 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.min(disponibilidad_pct || 0, 100)}%`,
                backgroundColor: disponibilidad_pct >= 80 ? '#16a34a' : disponibilidad_pct >= 60 ? '#f59e0b' : '#ef4444'
              }} />
          </div>
          <p className="text-xs text-blue-600 mt-1">Turno actual → Ver reportes</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavegar('reportes')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-orange-700 text-xs font-medium">Costo perdido</p>
            <span className="text-lg">💸</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">{formatCOP(costo_perdido_turno)}</p>
          <p className="text-xs text-orange-600 mt-1">
            {total_paros_turno} paros · {formatMinutos(minutos_perdidos_turno)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-700">Paros Activos</h2>
              {paros_activos?.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {paros_activos.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400">En vivo</span>
            </div>
          </div>

          {!paros_activos?.length ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-slate-500 font-medium">Todas las máquinas operando</p>
              <p className="text-slate-400 text-sm mt-1">Sin paros activos en este momento</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paros_activos.map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 text-sm">{p.maquina_nombre}</p>
                      <span className="text-xs text-slate-400">{p.linea}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color_hex }} />
                      <p className="text-xs text-slate-500 truncate">{p.motivo_nombre}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold tabular-nums
                      ${p.minutos_transcurridos >= 15 ? 'text-red-600' : 'text-orange-600'}`}>
                      {formatTiempo(p.minutos_transcurridos * 60)}
                    </p>
                    <p className="text-xs text-slate-400">{formatCOP(p.costo_acumulado)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-100">
            <button onClick={() => onNavegar('mapa')}
              className="text-blue-600 text-xs font-medium hover:underline">
              Ver mapa completo →
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-700 mb-3">Top Motivos — Turno</h2>
            {!top_motivos?.length ? (
              <p className="text-slate-400 text-sm text-center py-4">Sin paros en el turno</p>
            ) : (
              <div className="space-y-2">
                {top_motivos.map((m, i) => {
                  const maxMin = top_motivos[0]?.minutos_perdidos || 1
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color_hex }} />
                          <span className="text-xs text-slate-700 font-medium">{m.nombre}</span>
                        </div>
                        <span className="text-xs text-slate-500">{formatMinutos(m.minutos_perdidos)}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full"
                          style={{
                            width: `${(m.minutos_perdidos / maxMin) * 100}%`,
                            backgroundColor: m.color_hex
                          }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={() => onNavegar('reportes')}
              className="text-blue-600 text-xs font-medium hover:underline mt-3 block">
              Ver análisis completo →
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-700 mb-3">Últimos Paros Cerrados</h2>
            {!ultimos_paros?.length ? (
              <p className="text-slate-400 text-sm text-center py-4">Sin paros cerrados hoy</p>
            ) : (
              <div className="space-y-2">
                {ultimos_paros.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: p.color_hex }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{p.maquina_nombre}</p>
                      <p className="text-xs text-slate-400 truncate">{p.motivo_nombre}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-slate-600">{formatTiempo(p.duracion_segundos)}</p>
                      <p className="text-xs text-slate-400">{formatHora(p.fin)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => onNavegar('historial')}
              className="text-blue-600 text-xs font-medium hover:underline mt-3 block">
              Ver historial completo →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}