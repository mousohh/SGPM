import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { useAlertas } from '../hooks/useAlertas'
import PanelAlertas from '../components/PanelAlertas'
import Inicio from './admin/Inicio'
import Maquinas from './admin/Maquinas'
import Motivos from './admin/Motivos'
import Usuarios from './admin/Usuarios'
import MapaMaquinas from './admin/MapaMaquinas'
import Reportes from './admin/Reportes'
import Historial from './admin/Historial'
import OEE from './admin/OEE'
import GestionTurnos from './admin/GestionTurnos'
import PanelMantenimiento from './mantenimiento/PanelMantenimiento'

const NAV_ITEMS = [
  { key: 'inicio', label: 'Inicio', icono: '🏠' },
  { key: 'mapa', label: 'Mapa en Tiempo Real', icono: '🗺️' },
  { key: 'reportes', label: 'Reportes', icono: '📊' },
  { key: 'historial', label: 'Historial', icono: '📜' },
  { key: 'oee', label: 'OEE & Análisis IA', icono: '🤖' },
  { key: 'turnos', label: 'Turnos', icono: '🕐' },
  { key: 'maquinas', label: 'Máquinas', icono: '⚙️' },
  { key: 'motivos', label: 'Motivos de Paro', icono: '📋' },
  { key: 'usuarios', label: 'Usuarios', icono: '👥' },
  { key: 'mantenimiento', label: 'Mantenimiento', icono: '🛠️' },
]

export default function Dashboard({ onLogout }) {
  const { usuario, logout } = useAuth()
  const [seccion, setSeccion] = useState('inicio')

  const {
    alertas, config, mostrarConfig, setMostrarConfig,
    guardarConfig, dismissAlerta, dismissTodas,
    alertarParoIniciado, alertarExcesoParos
  } = useAlertas({ rol: 'admin', linea: null })

  useSocket(
    (data) => {
      alertarParoIniciado(data)
      if (data.totalParosTurno) {
        alertarExcesoParos(data.maquinaNombre, data.maquinaId, data.totalParosTurno)
      }
    },
    null
  )

  const handleLogout = () => { logout(); onLogout() }

  const renderContenido = () => {
    if (seccion === 'inicio') return <Inicio usuario={usuario} onNavegar={setSeccion} />
    if (seccion === 'mapa') return <MapaMaquinas />
    if (seccion === 'reportes') return <Reportes />
    if (seccion === 'historial') return <Historial />
    if (seccion === 'turnos') return <GestionTurnos />
    if (seccion === 'oee') return <OEE />
    if (seccion === 'maquinas') return <Maquinas />
    if (seccion === 'motivos') return <Motivos />
    if (seccion === 'usuarios') return <Usuarios />
    if (seccion === 'mantenimiento') return <PanelMantenimiento />
  }

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden">
      <aside className="w-56 bg-slate-900 text-white flex flex-col flex-shrink-0 h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">⚙️</div>
            <span className="font-bold text-lg">SGPM</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => setSeccion(item.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-colors
                ${seccion === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              <span>{item.icono}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-700">
          <div className="px-3 py-2 text-xs text-slate-400 mb-2">
            {usuario?.nombre}<br />
            <span className="capitalize text-blue-400">{usuario?.rol}</span>
          </div>
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto h-screen">
        {renderContenido()}
      </main>

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