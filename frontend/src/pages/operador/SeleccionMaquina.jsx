import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const IconoMaquina = ({ nombre }) => {
  const n = nombre?.toLowerCase() || ''

  if (n.includes('extrus')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="5" y="25" width="60" height="30" rx="4" fill="#3b82f6" />
      <rect x="60" y="33" width="30" height="14" rx="2" fill="#1d4ed8" />
      <rect x="88" y="36" width="22" height="8" rx="1" fill="#60a5fa" />
      <circle cx="20" cy="20" r="8" fill="#2563eb" />
      <circle cx="20" cy="20" r="4" fill="#93c5fd" />
      <rect x="10" y="55" width="12" height="15" rx="2" fill="#1e40af" />
      <rect x="38" y="55" width="12" height="15" rx="2" fill="#1e40af" />
      <circle cx="100" cy="40" r="2" fill="#fbbf24" />
      <line x1="108" y1="40" x2="115" y2="35" stroke="#fbbf24" strokeWidth="1.5" />
      <line x1="108" y1="40" x2="115" y2="40" stroke="#fbbf24" strokeWidth="1.5" />
      <line x1="108" y1="40" x2="115" y2="45" stroke="#fbbf24" strokeWidth="1.5" />
    </svg>
  )

  if (n.includes('sella')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="10" y="15" width="100" height="20" rx="3" fill="#8b5cf6" />
      <rect x="10" y="45" width="100" height="20" rx="3" fill="#7c3aed" />
      <rect x="40" y="35" width="40" height="10" rx="1" fill="#a78bfa" />
      <rect x="20" y="10" width="8" height="10" rx="1" fill="#6d28d9" />
      <rect x="92" y="10" width="8" height="10" rx="1" fill="#6d28d9" />
      <rect x="20" y="65" width="8" height="10" rx="1" fill="#6d28d9" />
      <rect x="92" y="65" width="8" height="10" rx="1" fill="#6d28d9" />
      <rect x="40" y="37" width="40" height="6" rx="1" fill="#fbbf24" opacity="0.7" />
    </svg>
  )

  if (n.includes('impres')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="15" y="30" width="90" height="35" rx="4" fill="#10b981" />
      <rect x="25" y="15" width="70" height="20" rx="3" fill="#059669" />
      <rect x="35" y="52" width="50" height="8" rx="1" fill="#6ee7b7" />
      <rect x="45" y="60" width="30" height="12" rx="1" fill="white" opacity="0.8" />
      <circle cx="95" cy="38" r="4" fill="#fbbf24" />
    </svg>
  )

  if (n.includes('cort')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="10" y="20" width="100" height="40" rx="4" fill="#ef4444" />
      <rect x="20" y="35" width="80" height="10" rx="1" fill="#fca5a5" />
      <polygon points="55,25 65,25 60,55" fill="#dc2626" />
      <rect x="15" y="60" width="15" height="10" rx="2" fill="#b91c1c" />
      <rect x="90" y="60" width="15" height="10" rx="2" fill="#b91c1c" />
    </svg>
  )

  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="15" y="20" width="90" height="45" rx="6" fill="#0ea5e9" />
      <circle cx="35" cy="42" r="12" fill="#0284c7" />
      <circle cx="35" cy="42" r="6" fill="#7dd3fc" />
      <rect x="55" y="30" width="40" height="8" rx="2" fill="#0284c7" />
      <rect x="55" y="44" width="30" height="8" rx="2" fill="#0284c7" />
      <rect x="25" y="65" width="15" height="8" rx="2" fill="#0369a1" />
      <rect x="80" y="65" width="15" height="8" rx="2" fill="#0369a1" />
      <circle cx="95" cy="28" r="4" fill="#fbbf24" />
    </svg>
  )
}

export default function SeleccionMaquina({ usuario, onSeleccionar, onLogout }) {
  const [maquinas, setMaquinas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [lineaResuelta, setLineaResuelta] = useState(usuario.linea || null)

  useEffect(() => {
    const cargar = async () => {
      try {
        let linea = usuario.linea

        if (!linea && usuario.maquina_id) {
          const todasMaquinas = await api.get('/maquinas')
          const miMaquina = todasMaquinas.find(m => m.id === Number(usuario.maquina_id))
          linea = miMaquina?.linea || null
        }

        if (!linea) {
          setCargando(false)
          return
        }

        const data = await api.get(`/maquinas/por-linea/${encodeURIComponent(linea)}`)
        setMaquinas(Array.isArray(data) ? data : [])
        setLineaResuelta(linea)
      } catch (e) { console.error(e) }
      setCargando(false)
    }
    cargar()
  }, [usuario.linea, usuario.maquina_id])

  const confirmar = () => {
    if (!seleccionada || confirmando) return
    setConfirmando(true)
    setTimeout(() => onSeleccionar(seleccionada), 300)
  }

  if (cargando) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-sm">Cargando máquinas...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">⚙️</div>
            <div>
              <p className="text-white font-bold">SGPM</p>
              <p className="text-white/40 text-xs">Bienvenido, {usuario.nombre}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-red-500/20 border border-white/10 hover:border-red-400/40 text-white/60 hover:text-red-400 text-xs font-medium px-3 py-2 rounded-xl transition-all">
            🚪 Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl">

          {/* Título */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-4">
              <span className="text-white/50 text-xs">Línea asignada</span>
              <span className="text-white font-bold text-sm">{lineaResuelta || 'Cargando...'}</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">¿En qué máquina vas a trabajar?</h1>
            <p className="text-white/40 text-sm">Selecciona tu máquina para este turno</p>
          </div>

          {/* Sin máquinas */}
          {maquinas.length === 0 ? (
            <div className="text-center bg-white/5 rounded-3xl p-12 border border-white/10">
              <p className="text-5xl mb-4">🏭</p>
              <p className="text-white font-bold text-lg mb-1">Sin máquinas disponibles</p>
              <p className="text-white/40 text-sm">No hay máquinas activas en tu línea. Contacta al administrador.</p>
            </div>
          ) : (
            <>
              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {maquinas.map(m => {
                  const esSel = seleccionada?.id === m.id
                  return (
                    <button key={m.id} onClick={() => setSeleccionada(m)}
                      className={`relative rounded-2xl p-4 border-2 transition-all duration-200 text-left group
                        ${esSel
                          ? 'border-blue-400 bg-blue-500/20 scale-[1.03] shadow-xl shadow-blue-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'}`}>

                      {esSel && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white text-xs font-black">✓</span>
                        </div>
                      )}

                      <div className="w-full h-20 mb-3 opacity-90 group-hover:opacity-100 transition-opacity">
                        <IconoMaquina nombre={m.nombre} />
                      </div>

                      <p className={`font-bold text-sm leading-tight mb-0.5 ${esSel ? 'text-white' : 'text-white/80'}`}>
                        {m.nombre}
                      </p>
                      <p className="text-white/40 text-xs font-mono">{m.codigo}</p>
                      {m.area && <p className="text-white/25 text-xs mt-0.5 truncate">{m.area}</p>}
                    </button>
                  )
                })}
              </div>

              {/* Confirmar */}
              {seleccionada && (
                <div className="flex flex-col items-center gap-3 animate-fade-in">
                  <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-center">
                    <p className="text-white/50 text-xs mb-0.5">Máquina seleccionada</p>
                    <p className="text-white font-bold text-lg">{seleccionada.nombre}</p>
                    <p className="text-white/40 text-xs font-mono">{seleccionada.codigo}</p>
                  </div>
                  <button onClick={confirmar} disabled={confirmando}
                    className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-70 text-white font-black text-lg py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/30">
                    {confirmando ? '⏳ Iniciando...' : '✅ Confirmar y entrar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}