import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'

const FORM_INICIAL = { nombre: '', email: '', password: '', rol: 'operador', linea: '', whatsapp: '', costo_hora: '' }

const ROL_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  supervisor: 'bg-blue-100 text-blue-700',
  mantenimiento: 'bg-orange-100 text-orange-700',
  operador: 'bg-green-100 text-green-700',
}

const ROL_ICONS = {
  admin: '👑',
  supervisor: '🎯',
  mantenimiento: '🔧',
  operador: '👷',
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [lineas, setLineas] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [editando, setEditando] = useState(null)
  const [toast, setToast] = useState(null)
  const [filtroRol, setFiltroRol] = useState('')

  const cargar = async () => {
    const [u, m] = await Promise.all([api.get('/usuarios'), api.get('/maquinas')])
    setUsuarios(Array.isArray(u) ? u : [])
    // Extraer líneas únicas de las máquinas activas
    const lineasUnicas = [...new Set(
      (Array.isArray(m) ? m : [])
        .filter(maq => maq.activa && maq.linea)
        .map(maq => maq.linea)
    )].sort()
    setLineas(lineasUnicas)
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm(FORM_INICIAL); setEditando(null); setModalAbierto(true) }
  const abrirEditar = (u) => {
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol,
      linea: u.linea || '',
      whatsapp: u.whatsapp || '',
      costo_hora: u.costo_hora || ''
    })
    setEditando(u)
    setModalAbierto(true)
  }

  const guardar = async () => {
    if (!form.nombre || !form.email || (!editando && !form.password)) {
      setToast({ mensaje: 'Completa los campos requeridos', tipo: 'error' }); return
    }
    if (form.rol === 'mantenimiento' && form.whatsapp && !/^\+?[\d\s\-]{7,20}$/.test(form.whatsapp)) {
      setToast({ mensaje: 'Número WhatsApp inválido (ej: +573001234567)', tipo: 'error' }); return
    }
    // Limpiar maquina_id — ya no se asigna desde aquí
    const payload = { ...form, maquina_id: null }
    const res = editando
      ? await api.put(`/usuarios/${editando.id}`, payload)
      : await api.post('/usuarios', payload)
    if (res.error) { setToast({ mensaje: res.error, tipo: 'error' }) }
    else { setToast({ mensaje: 'Guardado correctamente', tipo: 'success' }); setModalAbierto(false); cargar() }
  }

  const usuariosFiltrados = filtroRol ? usuarios.filter(u => u.rol === filtroRol) : usuarios
  const conteoRol = (rol) => usuarios.filter(u => u.rol === rol && u.activo).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de accesos y roles del sistema</p>
        </div>
        <button onClick={abrirCrear}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Nuevo usuario
        </button>
      </div>

      {/* KPIs por rol */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { rol: 'admin', label: 'Administradores' },
          { rol: 'supervisor', label: 'Supervisores' },
          { rol: 'mantenimiento', label: 'Mantenimiento' },
          { rol: 'operador', label: 'Operadores' },
        ].map(({ rol, label }) => (
          <button key={rol} onClick={() => setFiltroRol(filtroRol === rol ? '' : rol)}
            className={`rounded-xl border p-4 text-left transition-all
              ${filtroRol === rol ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{ROL_ICONS[rol]}</span>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-700">{conteoRol(rol)}</p>
          </button>
        ))}
      </div>

      {/* Filtro activo */}
      {filtroRol && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Filtrando por:</span>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${ROL_COLORS[filtroRol]}`}>
            {ROL_ICONS[filtroRol]} {filtroRol}
          </span>
          <button onClick={() => setFiltroRol('')} className="text-xs text-slate-400 hover:text-slate-600">✕ Limpiar</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Nombre', 'Email', 'Rol', 'Línea / WhatsApp', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                  <div className="flex items-center gap-2">
                    <span>{ROL_ICONS[u.rol] || '👤'}</span>
                    {u.nombre}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${ROL_COLORS[u.rol] || 'bg-slate-100 text-slate-600'}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {u.rol === 'mantenimiento' ? (
                    u.whatsapp
                      ? <span className="text-green-600 font-medium">📱 {u.whatsapp}</span>
                      : <span className="text-orange-400 text-xs">⚠️ Sin WhatsApp</span>
                  ) : u.rol === 'operador' ? (
                    u.linea
                      ? <span className="text-blue-600 font-medium">🏭 {u.linea}</span>
                      : <span className="text-orange-400 text-xs">⚠️ Sin línea</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium
                    ${u.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => abrirEditar(u)}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-lg">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <Modal titulo={editando ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setModalAbierto(false)}>
          <div className="space-y-4">
            {[
              { label: 'Nombre', key: 'nombre', type: 'text', placeholder: 'Nombre completo' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'correo@empresa.com' },
              { label: editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
              <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value, linea: '', whatsapp: '', costo_hora: '' })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="operador">👷 Operador</option>
                <option value="supervisor">🎯 Supervisor</option>
                <option value="mantenimiento">🔧 Mantenimiento</option>
                <option value="admin">👑 Administrador</option>
              </select>
            </div>

            {/* Línea — para operadores y supervisores */}
            {(form.rol === 'operador' || form.rol === 'supervisor') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  🏭 Línea asignada {form.rol === 'operador' && <span className="text-red-500">*</span>}
                </label>
                <select value={form.linea} onChange={e => setForm({ ...form, linea: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Sin asignar</option>
                  {lineas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                {form.rol === 'operador' && (
                  <p className="text-xs text-slate-400 mt-1">El operador elegirá su máquina al iniciar sesión</p>
                )}
              </div>
            )}

            {/* WhatsApp — solo mantenimiento */}
            {form.rol === 'mantenimiento' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  📱 Número WhatsApp
                </label>
                <input type="tel" value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="+573001234567"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                <p className="text-xs text-slate-400 mt-1">Con código de país. Ej: +573001234567</p>
              </div>
            )}

            {/* Costo/hora — solo mantenimiento */}
            {form.rol === 'mantenimiento' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  💰 Costo por hora (COP)
                </label>
                <input type="number" value={form.costo_hora}
                  onChange={e => setForm({ ...form, costo_hora: e.target.value })}
                  placeholder="Ej: 50000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalAbierto(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={guardar}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">Guardar</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  )
}