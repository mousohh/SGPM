import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MiMaquina from './pages/operador/MiMaquina'
import SeleccionMaquina from './pages/operador/SeleccionMaquina'
import PanelSupervisor from './pages/supervisor/PanelSupervisor'
import PanelMantenimiento from './pages/mantenimiento/PanelMantenimiento'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioGuardado = localStorage.getItem('usuario')
    const maquinaGuardada = sessionStorage.getItem('maquina_turno')

    if (token && usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
    }
    if (maquinaGuardada) {
      try { setMaquinaSeleccionada(JSON.parse(maquinaGuardada)) } catch {}
    }
    setCargando(false)
  }, [])

  const handleLogin = () => {
    const usuarioGuardado = localStorage.getItem('usuario')
    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
      setMaquinaSeleccionada(null)
      sessionStorage.removeItem('maquina_turno')
    }
  }

  const handleLogout = () => {
    setUsuario(null)
    setMaquinaSeleccionada(null)
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    sessionStorage.removeItem('maquina_turno')
  }

  const handleSeleccionMaquina = (maquina) => {
    setMaquinaSeleccionada(maquina)
    sessionStorage.setItem('maquina_turno', JSON.stringify(maquina))
  }

  if (cargando) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg">Cargando...</div>
    </div>
  )

  if (!usuario) return <Login onLogin={handleLogin} />
  if (usuario.rol === 'admin') return <Dashboard onLogout={handleLogout} />
  if (usuario.rol === 'supervisor') return <PanelSupervisor onLogout={handleLogout} />
  if (usuario.rol === 'mantenimiento') return <PanelMantenimiento onLogout={handleLogout} />

  if (usuario.rol === 'operador') {
    if (!maquinaSeleccionada) {
      return (
        <SeleccionMaquina
          usuario={usuario}
          onSeleccionar={handleSeleccionMaquina}
          onLogout={handleLogout}
        />
      )
    }
    return (
      <MiMaquina
        onLogout={handleLogout}
        maquinaOverride={maquinaSeleccionada}
        onCambiarMaquina={() => {
          setMaquinaSeleccionada(null)
          sessionStorage.removeItem('maquina_turno')
        }}
      />
    )
  }

  return <MiMaquina onLogout={handleLogout} />
}