import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'

const CATEGORIAS = ['falla', 'mantenimiento', 'setup', 'material', 'calidad', 'otro']
const FORM_INICIAL = { nombre: '', categoria: 'falla', color_hex: '#ef4444' }

export default function Motivos() {
  const [motivos, setMotivos] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [editando, setEditando] = useState(null)
  const [toast, setToast] = useState(null)

  const cargar = async () => {
    const data = await api.get('/motivos')
    setMotivos(data)
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm(FORM_INICIAL); setEditando(null); setModalAbierto(true) }
  const abrirEditar = (m) => {
    setForm({ nombre: m.nombre, categoria: m.categoria, color_hex: m.color_hex })
    setEditando(m); setModalAbierto(true)
  }

  const guardar = async () => {
    if (!form.nombre) { setToast({ mensaje: 'El nombre es requerido', tipo: 'error' }); return }
    const res = editando
      ? await api.put(`/motivos/${editando.id}`, form)
      : await api.post('/motivos', form)
    if (res.error) { setToast({ mensaje: res.error, tipo: 'error' }) }
    else { setToast({ mensaje: 'Guardado correctamente', tipo: 'success' }); setModalAbierto(false); cargar() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Motivos de Paro</h1>
          <p className="text-slate-500 text-sm mt-1">Catálogo de causas de paro de máquinas</p>
        </div>
        <button onClick={abrirCrear}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Nuevo motivo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Color', 'Nombre', 'Categoría', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {motivos.map(m => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: m.color_hex }} />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{m.nombre}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">{m.categoria}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium
                    ${m.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => abrirEditar(m)}
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
        <Modal titulo={editando ? 'Editar motivo' : 'Nuevo motivo'} onClose={() => setModalAbierto(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Falla mecánica"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.color_hex} onChange={e => setForm({ ...form, color_hex: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer border border-slate-300" />
                <span className="text-sm text-slate-500">{form.color_hex}</span>
              </div>
            </div>
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