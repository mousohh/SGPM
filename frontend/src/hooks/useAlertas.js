import { useState, useEffect, useRef, useCallback } from 'react'
import { sonarAlerta, hablarParo, iniciarAlarma, detenerAlarma } from '../utils/alertaSonido'
import { api } from '../services/api'

const CONFIG_KEY = 'sgpm_alertas_config'

const defaultConfig = {
  activo: true,
  sonido: true,
  voz: true,
  minutos_paro_critico: 15,
  max_paros_turno: 5
}

export const useAlertas = ({ rol, linea }) => {
  const [alertas, setAlertas] = useState([])
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig
    } catch { return defaultConfig }
  })
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const alertasIdRef = useRef(new Set())
  const alarmasActivasRef = useRef(new Set())
  const checkIntervalRef = useRef(null)

  const guardarConfig = (nueva) => {
    const actualizada = { ...config, ...nueva }
    setConfig(actualizada)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(actualizada))
  }

  const agregarAlerta = useCallback((alerta) => {
    if (!config.activo) return
    const clave = `${alerta.tipo}-${alerta.maquinaId}`
    if (alertasIdRef.current.has(clave)) return
    alertasIdRef.current.add(clave)
    if (config.sonido) sonarAlerta(alerta.nivel || 'paro')
    const id = `${clave}-${Date.now()}`
    setAlertas(prev => [{ ...alerta, id, timestamp: new Date() }, ...prev.slice(0, 9)])
    setTimeout(() => alertasIdRef.current.delete(clave), 120000)
  }, [config])

  const dismissAlerta = (id) => setAlertas(prev => prev.filter(a => a.id !== id))

  const dismissTodas = () => {
    setAlertas([])
    detenerAlarma()
    alarmasActivasRef.current.clear()
  }

  const chequearParosCriticos = useCallback(async () => {
    if (!config.activo) return
    try {
      const paros = await api.get('/paros/activos')
      const ahora = Date.now()
      let hayParoCritico = false

      paros.forEach(p => {
        if (linea && p.linea !== linea) return
        const minutos = (ahora - new Date(p.inicio).getTime()) / 60000
        if (minutos >= config.minutos_paro_critico) {
          hayParoCritico = true
          agregarAlerta({
            tipo: 'paro_critico',
            nivel: 'critico',
            maquinaId: p.maquina_id,
            titulo: '⏰ Paro prolongado',
            mensaje: `${p.maquina_nombre} lleva ${Math.floor(minutos)} min parada (${p.motivo_nombre})`,
            color: 'red'
          })

          if (!alarmasActivasRef.current.has(p.maquina_id)) {
            alarmasActivasRef.current.add(p.maquina_id)
            if (config.sonido) iniciarAlarma(p.maquina_nombre, p.motivo_nombre)
          }
        }
      })


      if (!hayParoCritico && alarmasActivasRef.current.size > 0) {
        detenerAlarma()
        alarmasActivasRef.current.clear()
      }
    } catch (e) { /* silencioso */ }
  }, [config, linea, agregarAlerta])

  useEffect(() => {
    checkIntervalRef.current = setInterval(chequearParosCriticos, 60000)
    return () => {
      clearInterval(checkIntervalRef.current)
      detenerAlarma()
    }
  }, [chequearParosCriticos])

  const alertarParoIniciado = useCallback((data) => {
    if (!config.activo) return
    if (linea && data.linea !== linea) return
    if (config.sonido) sonarAlerta('paro')
    if (config.voz) hablarParo(data.maquinaNombre || 'Máquina', data.motivoNombre)
    const clave = `paro_iniciado-${data.maquinaId}`
    if (!alertasIdRef.current.has(clave)) {
      alertasIdRef.current.add(clave)
      const id = `${clave}-${Date.now()}`
      setAlertas(prev => [{
        tipo: 'paro_iniciado',
        nivel: 'paro',
        maquinaId: data.maquinaId,
        titulo: '🛑 Paro registrado',
        mensaje: `${data.maquinaNombre || 'Máquina'} — ${data.motivoNombre}`,
        color: 'orange',
        id,
        timestamp: new Date()
      }, ...prev.slice(0, 9)])
      setTimeout(() => alertasIdRef.current.delete(clave), 120000)
    }
  }, [config, linea])

  const alertarExcesoParos = useCallback((maquinaNombre, maquinaId, totalParos) => {
    if (!config.activo) return
    if (totalParos >= config.max_paros_turno) {
      agregarAlerta({
        tipo: 'exceso_paros',
        nivel: 'critico',
        maquinaId,
        titulo: '⚠️ Exceso de paros',
        mensaje: `${maquinaNombre} acumula ${totalParos} paros en el turno`,
        color: 'red'
      })
    }
  }, [config, agregarAlerta])

  return {
    alertas, config, mostrarConfig, setMostrarConfig,
    guardarConfig, dismissAlerta, dismissTodas,
    alertarParoIniciado, alertarExcesoParos, chequearParosCriticos
  }
}