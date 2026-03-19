import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socketInstance = null

export const useSocket = (onParoIniciado, onParoCerrado) => {
  const handlersRef = useRef({ onParoIniciado, onParoCerrado })

  useEffect(() => {
    handlersRef.current = { onParoIniciado, onParoCerrado }
  })

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(window.location.origin, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      })

      socketInstance.on('connect', () => {
        console.log('[Socket] Conectado:', socketInstance.id)
      })

      socketInstance.on('disconnect', (reason) => {
        console.warn('[Socket] Desconectado:', reason)
      })

      socketInstance.on('reconnect', (attempt) => {
        console.log('[Socket] Reconectado tras', attempt, 'intento(s)')
      })

      socketInstance.on('reconnect_attempt', (attempt) => {
        console.log('[Socket] Intentando reconectar... intento', attempt)
      })

      socketInstance.on('reconnect_error', (err) => {
        console.error('[Socket] Error de reconexión:', err.message)
      })
    }

    const handleIniciado = (data) => handlersRef.current.onParoIniciado?.(data)
    const handleCerrado  = (data) => handlersRef.current.onParoCerrado?.(data)

    socketInstance.on('paro:iniciado', handleIniciado)
    socketInstance.on('paro:cerrado',  handleCerrado)

    return () => {
      socketInstance.off('paro:iniciado', handleIniciado)
      socketInstance.off('paro:cerrado',  handleCerrado)
    }
  }, [])

  return socketInstance
}