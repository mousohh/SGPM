import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'

const FORM_MAQ_INICIAL = { nombre: '', linea: '', costo_hora: '', unidades_por_minuto: '', descripcion: '' }
const FORM_LINEA_INICIAL = { nombre: '', tipo_medicion: 'unidades' }

const formatCosto = (valor) => {
  if (!valor) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

export default function Maquinas() {
  const [maquinas, setMaquinas] = useState([])
  const [lineas, setLineas] = useState([])
  const [seccion, setSeccion] = useState('maquinas')

  const [modalMaq, setModalMaq] = useState(false)
  const [formMaq, setFormMaq] = useState(FORM_MAQ_INICIAL)
  const [editandoMaq, setEditandoMaq] = useState(null)

  const [modalLinea, setModalLinea] = useState(false)
  const [formLinea, setFormLinea] = useState(FORM_LINEA_INICIAL)
  const [editandoLinea, setEditandoLinea] = useState(null)

  // Modal desactivar
  const [modalDesactivar, setModalDesactivar] = useState(false)
  const [maquinaADesactivar, setMaquinaADesactivar] = useState(null)
  const [motivoDesactivacion, setMotivoDesactivacion] = useState('')

  const [toast, setToast] = useState(null)
  const [cargando, setCargando] = useState(false)

  const mostrarToast = (mensaje, tipo = 'success') => setToast({ mensaje, tipo })

  const cargar = async () => {
    const [m, l] = await Promise.all([api.get('/maquinas'), api.get('/lineas')])
    setMaquinas(Array.isArray(m) ? m : [])
    setLineas(Array.isArray(l) ? l : [])
  }

  useEffect(() => { cargar() }, [])

  // ─── MÁQUINAS ───────────────────────────────────────────
  const abrirCrearMaq = () => { setFormMaq(FORM_MAQ_INICIAL); setEditandoMaq(null); setModalMaq(true) }
  const abrirEditarMaq = (m) => {
    setFormMaq({
      nombre: m.nombre, linea: m.linea || '',
      costo_hora: m.costo_hora || '', unidades_por_minuto: m.unidades_por_minuto || '',
      descripcion: m.descripcion || ''
    })
    setEditandoMaq(m); setModalMaq(true)
  }

  const guardarMaq = async () => {
    if (!formMaq.nombre || !formMaq.costo_hora) {
      mostrarToast('Nombre y costo por hora son requeridos', 'error'); return
    }
    setCargando(true)
    const res = editandoMaq
      ? await api.put(`/maquinas/${editandoMaq.id}`, { ...formMaq, activa: editandoMaq.activa })
      : await api.post('/maquinas', formMaq)
    setCargando(false)
    if (res.error) { mostrarToast(res.error, 'error') }
    else { mostrarToast(editandoMaq ? 'Máquina actualizada' : 'Máquina creada'); setModalMaq(false); cargar() }
  }

  // Toggle con confirmación de motivo al desactivar
  const toggleMaq = async (m) => {
    if (m.activa) {
      // Desactivar → pedir motivo
      setMaquinaADesactivar(m)
      setMotivoDesactivacion('')
      setModalDesactivar(true)
    } else {
      // Activar → directo
      await api.put(`/maquinas/${m.id}`, { ...m, activa: true, motivo_desactivacion: null })
      mostrarToast(`${m.nombre} activada`)
      cargar()
    }
  }

  const confirmarDesactivar = async () => {
    if (!motivoDesactivacion.trim()) {
      mostrarToast('Debes indicar el motivo de desactivación', 'error'); return
    }
    setCargando(true)
    await api.put(`/maquinas/${maquinaADesactivar.id}`, {
      ...maquinaADesactivar,
      activa: false,
      motivo_desactivacion: motivoDesactivacion.trim()
    })
    setCargando(false)
    mostrarToast(`${maquinaADesactivar.nombre} desactivada`)
    setModalDesactivar(false)
    setMaquinaADesactivar(null)
    setMotivoDesactivacion('')
    cargar()
  }

  // ─── LÍNEAS ─────────────────────────────────────────────
  const abrirCrearLinea = () => { setFormLinea(FORM_LINEA_INICIAL); setEditandoLinea(null); setModalLinea(true) }
  const abrirEditarLinea = (l) => {
    setFormLinea({ nombre: l.nombre, tipo_medicion: l.tipo_medicion || 'unidades' })
    setEditandoLinea(l); setModalLinea(true)
  }

  const guardarLinea = async () => {
    if (!formLinea.nombre.trim()) { mostrarToast('El nombre es requerido', 'error'); return }
    setCargando(true)
    const res = editandoLinea
      ? await api.put(`/lineas/${editandoLinea.id}`, formLinea)
      : await api.post('/lineas', formLinea)
    setCargando(false)
    if (res.error) { mostrarToast(res.error, 'error') }
    else { mostrarToast(editandoLinea ? 'Línea actualizada' : 'Línea creada'); setModalLinea(false); cargar() }
  }

  const toggleLinea = async (l) => {
    const res = await api.patch(`/lineas/${l.id}/toggle`)
    if (res.error) mostrarToast(res.error, 'error')
    else { mostrarToast(res.message); cargar() }
  }

  const lineaSeleccionada = lineas.find(l => l.nombre === formMaq.linea)
  const esKilos = lineaSeleccionada?.tipo_medicion === 'kilos'
  const esUnidades = lineaSeleccionada?.tipo_medicion === 'unidades'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Máquinas y Líneas</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión del catálogo de máquinas y líneas de producción</p>
        </div>
        <button onClick={seccion === 'maquinas' ? abrirCrearMaq : abrirCrearLinea}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + {seccion === 'maquinas' ? 'Nueva máquina' : 'Nueva línea'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        {[
          { key: 'maquinas', label: '⚙️ Máquinas', count: maquinas.length },
          { key: 'lineas', label: '🏭 Líneas de Producción', count: lineas.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setSeccion(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
              ${seccion === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
              ${seccion === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── SECCIÓN MÁQUINAS ── */}
      {seccion === 'maquinas' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nombre', 'Línea', 'Costo/hora', 'Producción', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maquinas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No hay máquinas registradas</td></tr>
              )}
              {maquinas.map(m => (
                <tr key={m.id} className={`border-b border-slate-100 hover:bg-slate-50 ${!m.activa ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{m.nombre}</p>
                    {!m.activa && m.motivo_desactivacion && (
                      <p className="text-xs text-slate-400 mt-0.5 italic">⚠️ {m.motivo_desactivacion}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.linea || '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-700">{formatCosto(m.costo_hora)}/h</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {m.kilos_por_hora ? `${m.kilos_por_hora} kg/h` : m.unidades_por_minuto ? `${m.unidades_por_minuto} u/min` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                      ${m.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {m.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditarMaq(m)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-lg">
                        Editar
                      </button>
                      <button onClick={() => toggleMaq(m)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors
                          ${m.activa ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}>
                        {m.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SECCIÓN LÍNEAS ── */}
      {seccion === 'lineas' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nombre', 'Medición', 'Máquinas', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No hay líneas registradas</td></tr>
              )}
              {lineas.map(l => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${l.activa ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className="text-sm font-medium text-slate-800">{l.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {l.tipo_medicion === 'kilos'
                      ? <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2 py-0.5 rounded-full font-medium">⚖️ Kilos/hora</span>
                      : <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-full font-medium">📦 Unidades/hora</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{l.maquinas_activas || 0}</span>
                      <span className="text-xs text-slate-400">/ {l.total_maquinas || 0} activas</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                      ${l.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {l.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditarLinea(l)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-lg">
                        Editar
                      </button>
                      <button onClick={() => toggleLinea(l)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors
                          ${l.activa ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}>
                        {l.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL DESACTIVAR MÁQUINA ── */}
      {modalDesactivar && maquinaADesactivar && (
        <Modal titulo="Desactivar máquina" onClose={() => setModalDesactivar(false)}>
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <div>
                <p className="font-bold text-slate-800">{maquinaADesactivar.nombre}</p>
                <p className="text-xs text-slate-500">{maquinaADesactivar.linea || 'Sin línea'}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              ⚠️ Al desactivar esta máquina dejará de aparecer en el mapa de operadores y no influirá en el cálculo de disponibilidad ni OEE hasta que sea reactivada.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo de desactivación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoDesactivacion}
                onChange={e => setMotivoDesactivacion(e.target.value)}
                placeholder="Ej: Mantenimiento mayor programado, falla estructural, reemplazo de componentes..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">Este motivo será visible en el mapa para todos los roles.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalDesactivar(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={confirmarDesactivar} disabled={cargando || !motivoDesactivacion.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {cargando ? 'Desactivando...' : 'Confirmar desactivación'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL MÁQUINA ── */}
      {modalMaq && (
        <Modal titulo={editandoMaq ? 'Editar máquina' : 'Nueva máquina'} onClose={() => setModalMaq(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input value={formMaq.nombre} onChange={e => setFormMaq({ ...formMaq, nombre: e.target.value })}
                placeholder="Ej: Extrusora 1"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Línea</label>
              <select value={formMaq.linea}
                onChange={e => setFormMaq({ ...formMaq, linea: e.target.value, unidades_por_minuto: '', kilos_por_hora: '', precio_kilo: '' })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Sin línea</option>
                {lineas.filter(l => l.activa).map(l => (
                  <option key={l.id} value={l.nombre}>{l.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Costo por hora (COP) <span className="text-red-500">*</span></label>
              <input type="number" value={formMaq.costo_hora}
                onChange={e => setFormMaq({ ...formMaq, costo_hora: e.target.value })}
                placeholder="Ej: 120000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              {formMaq.costo_hora > 0 && (
                <p className="text-xs text-slate-400 mt-1">= {formatCosto(formMaq.costo_hora)}/hora</p>
              )}
            </div>

            {esKilos && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">⚖️ Producción — Medición por Kilos</p>
                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-1">Kilos por hora <span className="text-red-500">*</span></label>
                  <input type="number" value={formMaq.kilos_por_hora || ''}
                    onChange={e => setFormMaq({ ...formMaq, kilos_por_hora: e.target.value })}
                    placeholder="Ej: 80"
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white" />
                  {formMaq.kilos_por_hora > 0 && (
                    <p className="text-xs text-orange-500 mt-1">= {(formMaq.kilos_por_hora * 8).toLocaleString('es-CO')} kg por turno</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-1">Valor total producción (COP/hora) <span className="text-red-500">*</span></label>
                  <input type="number" value={formMaq.precio_kilo || ''}
                    onChange={e => setFormMaq({ ...formMaq, precio_kilo: e.target.value })}
                    placeholder="Ej: 400000"
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white" />
                  {formMaq.precio_kilo > 0 && (
                    <p className="text-xs text-orange-600 font-medium mt-0.5">= {formatCosto(formMaq.precio_kilo)} perdidos por cada hora parada</p>
                  )}
                </div>
              </div>
            )}

            {esUnidades && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">📦 Producción — Medición por Unidades</p>
                <label className="block text-sm font-medium text-blue-700 mb-1">Unidades por minuto <span className="text-red-500">*</span></label>
                <input type="number" value={formMaq.unidades_por_minuto}
                  onChange={e => setFormMaq({ ...formMaq, unidades_por_minuto: e.target.value })}
                  placeholder="Ej: 150"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white" />
                {formMaq.unidades_por_minuto > 0 && (
                  <p className="text-xs text-blue-500 mt-1">= {(formMaq.unidades_por_minuto * 60).toLocaleString('es-CO')} u/hora</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <input value={formMaq.descripcion} onChange={e => setFormMaq({ ...formMaq, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalMaq(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
              <button onClick={guardarMaq} disabled={cargando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {cargando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL LÍNEA ── */}
      {modalLinea && (
        <Modal titulo={editandoLinea ? 'Editar línea' : 'Nueva línea de producción'} onClose={() => setModalLinea(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input value={formLinea.nombre} onChange={e => setFormLinea({ ...formLinea, nombre: e.target.value })}
                placeholder="Ej: 1 - Extrusión"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">¿Cómo se mide la producción? <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => setFormLinea({ ...formLinea, tipo_medicion: 'unidades' })}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                    ${formLinea.tipo_medicion === 'unidades'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                  <span className="text-2xl">📦</span>
                  <span>Unidades / hora</span>
                </button>
                <button type="button"
                  onClick={() => setFormLinea({ ...formLinea, tipo_medicion: 'kilos' })}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                    ${formLinea.tipo_medicion === 'kilos'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                  <span className="text-2xl">⚖️</span>
                  <span>Kilos / hora</span>
                </button>
              </div>
            </div>

            {editandoLinea && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                ⚠️ Si cambias el nombre, se actualizará automáticamente en todas las máquinas y usuarios vinculados.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalLinea(false)}
                className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
              <button onClick={guardarLinea} disabled={cargando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {cargando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  )
}