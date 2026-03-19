import { useEffect } from 'react'

export default function Toast({ mensaje, tipo = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium
      ${tipo === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
      {tipo === 'success' ? '✅' : '❌'} {mensaje}
    </div>
  )
}