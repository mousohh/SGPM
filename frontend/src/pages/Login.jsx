import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function Login({ onLogin }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Completa todos los campos");
      return;
    }
    setCargando(true);
    setError("");
    const result = await login(email, password);
    setCargando(false);
    if (result.ok) {
      onLogin();
    } else {
      setError(result.error || "Error al iniciar sesión");
    }
  };

  return (
    <div className="pagina-login min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">SGPM</h1>
          <p className="text-slate-400 mt-1">Sistema de Gestión de Paros de Máquinas</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-3 transition-colors"
            >
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Control de producción · Acceso restringido
        </p>

        <div className="text-center mt-4 space-y-0.5">
          <p className="text-slate-500 text-xs">© {new Date().getFullYear()} Departamento de TIC</p>
          <p className="text-slate-500 text-xs">
            Desarrollado por <span className="text-slate-400 font-medium">Moisés Mejía</span>
          </p>
          <p className="text-slate-500 text-xs">
            Idea y colaboración <span className="text-slate-400 font-medium">Asdrúbal Patiño</span>
          </p>
        </div>
      </div>
    </div>
  );
}