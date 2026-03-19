import { useState } from 'react'

const COLORES = {
  red: 'bg-red-50 border-red-300 text-red-800',
  orange: 'bg-orange-50 border-orange-300 text-orange-800',
  yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800'
}

export default function PanelAlertas({
  alertas, config, mostrarConfig, setMostrarConfig,
  guardarConfig, dismissAlerta, dismissTodas
}) {
  const [configLocal, setConfigLocal] = useState(config)

  const handleGuardar = () => {
    guardarConfig(configLocal)
    setMostrarConfig(false)
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">

        <div className="flex flex-col gap-2 max-w-sm">
          {alertas.slice(0, 5).map(a => (
            <div key={a.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm
                ${COLORES[a.color] || COLORES.orange}`}>
              <div className="flex-1">
                <p className="font-bold text-xs">{a.titulo}</p>
                <p className="text-xs mt-0.5 opacity-80">{a.mensaje}</p>
              </div>
              <button onClick={() => dismissAlerta(a.id)}
                className="text-current opacity-60 hover:opacity-100 text-lg leading-none">×</button>
            </div>
          ))}
          {alertas.length > 5 && (
            <p className="text-xs text-slate-500 text-right">+{alertas.length - 5} más</p>
          )}
        </div>


        <div className="flex items-center gap-2">
          {alertas.length > 0 && (
            <button onClick={dismissTodas}
              className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs px-3 py-2 rounded-xl">
              Limpiar todo
            </button>
          )}
          <button onClick={() => setMostrarConfig(true)}
            className={`relative w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center text-xl transition-all
              ${alertas.length > 0 ? 'bg-red-500 hover:bg-red-600 animate-bounce' : 'bg-slate-700 hover:bg-slate-800'} text-white`}>
            🔔
            {alertas.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-slate-900 text-xs font-bold rounded-full flex items-center justify-center">
                {alertas.length > 9 ? '9+' : alertas.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {mostrarConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">⚙️ Configurar Alertas</h2>
              <button onClick={() => setMostrarConfig(false)} className="text-slate-400 text-2xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Alertas activas</label>
                <button onClick={() => setConfigLocal(c => ({ ...c, activo: !c.activo }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${configLocal.activo ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all
                    ${configLocal.activo ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>


              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Sonido de alerta</label>
                <button onClick={() => setConfigLocal(c => ({ ...c, sonido: !c.sonido }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${configLocal.sonido ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all
                    ${configLocal.sonido ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>


              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-slate-700">Anuncio por voz</label>
                  <p className="text-xs text-slate-400">Anuncia máquina y motivo al iniciar paro</p>
                </div>
                <button onClick={() => setConfigLocal(c => ({ ...c, voz: !c.voz }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${configLocal.voz ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all
                    ${configLocal.voz ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>


              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Alarma continua si paro supera{' '}
                  <span className="text-blue-600 font-bold">{configLocal.minutos_paro_critico} min</span>
                </label>
                <input type="range" min={5} max={60} step={5}
                  value={configLocal.minutos_paro_critico}
                  onChange={e => setConfigLocal(c => ({ ...c, minutos_paro_critico: Number(e.target.value) }))}
                  className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5 min</span><span>60 min</span>
                </div>
              </div>


              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Alertar si máquina supera{' '}
                  <span className="text-blue-600 font-bold">{configLocal.max_paros_turno} paros</span> en el turno
                </label>
                <input type="range" min={2} max={20} step={1}
                  value={configLocal.max_paros_turno}
                  onChange={e => setConfigLocal(c => ({ ...c, max_paros_turno: Number(e.target.value) }))}
                  className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>2 paros</span><span>20 paros</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setMostrarConfig(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm">
                Cancelar
              </button>
              <button onClick={handleGuardar}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}