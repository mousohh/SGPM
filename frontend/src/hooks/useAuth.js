import { useState, useEffect } from 'react'
import { api } from '../services/api'

export const useAuth = () => {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioGuardado = localStorage.getItem('usuario')
    if (token && usuarioGuardado) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const expiracion = payload.exp * 1000
        const ahora = Date.now()
        const unaHora = 60 * 60 * 1000
        if (expiracion - ahora < unaHora) {
          localStorage.removeItem('token')
          localStorage.removeItem('usuario')
        } else {
          setUsuario(JSON.parse(usuarioGuardado))
        }
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('usuario')
      }
    }
    setCargando(false)
  }, [])

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    if (data.token) {
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      setUsuario(data.usuario)
      return { ok: true }
    }
    return { ok: false, error: data.error }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }

  return { usuario, cargando, login, logout, isAuthenticated: !!usuario }
}