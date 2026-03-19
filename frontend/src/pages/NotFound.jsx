export default function NotFound({ onBack }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-8xl mb-4">⚙️</p>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-slate-400 mb-6">Página no encontrada</p>
        <button onClick={onBack}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium">
          Volver al inicio
        </button>
      </div>
    </div>
  )
}