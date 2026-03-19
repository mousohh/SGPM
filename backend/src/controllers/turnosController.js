const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')

// ── LINEAS ────────────────────────────────────────────────────────
const listarLineas = async (req, res) => {
  try {
    const lineas = await sequelize.query(
      `SELECT l.*,
        COUNT(DISTINCT t.id) as total_turnos,
        COUNT(DISTINCT m.id) as total_maquinas
       FROM lineas_produccion l
       LEFT JOIN turnos_linea t ON t.linea_id = l.id AND t.activo = 1
       LEFT JOIN maquinas m ON m.linea = l.nombre
       GROUP BY l.id
       ORDER BY l.nombre ASC`,
      { type: QueryTypes.SELECT }
    )
    res.json(lineas)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar lineas' })
  }
}

const crearLinea = async (req, res) => {
  const { nombre, codigo, descripcion } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' })
  try {
    await sequelize.query(
      `INSERT INTO lineas_produccion (nombre, codigo, descripcion) VALUES (?, ?, ?)`,
      { replacements: [nombre, codigo || null, descripcion || null], type: QueryTypes.INSERT }
    )
    res.json({ message: 'Linea creada correctamente' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al crear linea' })
  }
}

const actualizarLinea = async (req, res) => {
  const { id } = req.params
  const { nombre, codigo, descripcion, activa } = req.body
  try {
    await sequelize.query(
      `UPDATE lineas_produccion SET nombre=?, codigo=?, descripcion=?, activa=? WHERE id=?`,
      { replacements: [nombre, codigo || null, descripcion || null, activa ? 1 : 0, id], type: QueryTypes.UPDATE }
    )
    res.json({ message: 'Linea actualizada' })
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar linea' })
  }
}

const eliminarLinea = async (req, res) => {
  const { id } = req.params
  try {
    await sequelize.query(`DELETE FROM lineas_produccion WHERE id=?`, { replacements: [id], type: QueryTypes.DELETE })
    res.json({ message: 'Linea eliminada' })
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar linea' })
  }
}

// ── TURNOS ────────────────────────────────────────────────────────
const listarTurnos = async (req, res) => {
  const { linea_id } = req.query
  try {
    const where = linea_id ? `WHERE t.linea_id = ${parseInt(linea_id)}` : ''
    const turnos = await sequelize.query(
      `SELECT t.*, l.nombre as linea_nombre
       FROM turnos_linea t
       JOIN lineas_produccion l ON l.id = t.linea_id
       ${where}
       ORDER BY l.nombre, t.hora_inicio`,
      { type: QueryTypes.SELECT }
    )
    res.json(turnos)
  } catch (e) {
    res.status(500).json({ error: 'Error al listar turnos' })
  }
}

const crearTurno = async (req, res) => {
  const { linea_id, nombre, hora_inicio, hora_fin } = req.body
  if (!linea_id || !nombre || !hora_inicio || !hora_fin)
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  try {
    await sequelize.query(
      `INSERT INTO turnos_linea (linea_id, nombre, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)`,
      { replacements: [linea_id, nombre, hora_inicio, hora_fin], type: QueryTypes.INSERT }
    )
    res.json({ message: 'Turno creado correctamente' })
  } catch (e) {
    res.status(500).json({ error: 'Error al crear turno' })
  }
}

const actualizarTurno = async (req, res) => {
  const { id } = req.params
  const { nombre, hora_inicio, hora_fin, activo } = req.body
  try {
    await sequelize.query(
      `UPDATE turnos_linea SET nombre=?, hora_inicio=?, hora_fin=?, activo=? WHERE id=?`,
      { replacements: [nombre, hora_inicio, hora_fin, activo ? 1 : 0, id], type: QueryTypes.UPDATE }
    )
    res.json({ message: 'Turno actualizado' })
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar turno' })
  }
}

const eliminarTurno = async (req, res) => {
  const { id } = req.params
  try {
    await sequelize.query(`DELETE FROM turnos_linea WHERE id=?`, { replacements: [id], type: QueryTypes.DELETE })
    res.json({ message: 'Turno eliminado' })
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar turno' })
  }
}

// ── DIAS DE TRABAJO ───────────────────────────────────────────────
const getDiasTrabajo = async (req, res) => {
  const { linea_id, mes, anio } = req.query
  if (!linea_id || !mes || !anio)
    return res.status(400).json({ error: 'linea_id, mes y anio requeridos' })
  try {
    const dias = await sequelize.query(
      `SELECT * FROM dias_trabajo
       WHERE linea_id = ${parseInt(linea_id)}
       AND MONTH(fecha) = ${parseInt(mes)}
       AND YEAR(fecha) = ${parseInt(anio)}
       ORDER BY fecha`,
      { type: QueryTypes.SELECT }
    )
    res.json(dias)
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener dias' })
  }
}

const toggleDiaTrabajo = async (req, res) => {
  const { linea_id, fecha, trabaja, nota } = req.body
  if (!linea_id || !fecha) return res.status(400).json({ error: 'linea_id y fecha requeridos' })
  try {
    await sequelize.query(
      `INSERT INTO dias_trabajo (linea_id, fecha, trabaja, nota)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE trabaja=VALUES(trabaja), nota=VALUES(nota)`,
      { replacements: [linea_id, fecha, trabaja ? 1 : 0, nota || null], type: QueryTypes.INSERT }
    )
    res.json({ message: 'Dia actualizado' })
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar dia' })
  }
}

const setDiasMasivos = async (req, res) => {
  const { linea_id, mes, anio, dias_semana, nota } = req.body
  // dias_semana: array de 0-6 (0=domingo, 1=lunes...)
  if (!linea_id || !mes || !anio || !dias_semana)
    return res.status(400).json({ error: 'Parametros requeridos' })
  try {
    const primerDia = new Date(anio, mes - 1, 1)
    const ultimoDia = new Date(anio, mes, 0)
    const inserts = []
    for (let d = new Date(primerDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay()
      const trabaja = dias_semana.includes(diaSemana) ? 1 : 0
      const fecha = d.toISOString().slice(0, 10)
      inserts.push(`(${parseInt(linea_id)}, '${fecha}', ${trabaja}, ${nota ? `'${nota}'` : 'NULL'})`)
    }
    if (inserts.length > 0) {
      await sequelize.query(
        `INSERT INTO dias_trabajo (linea_id, fecha, trabaja, nota) VALUES ${inserts.join(',')}
         ON DUPLICATE KEY UPDATE trabaja=VALUES(trabaja), nota=VALUES(nota)`,
        { type: QueryTypes.INSERT }
      )
    }
    res.json({ message: `${inserts.length} dias configurados` })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al configurar dias masivos' })
  }
}

module.exports = {
  listarLineas, crearLinea, actualizarLinea, eliminarLinea,
  listarTurnos, crearTurno, actualizarTurno, eliminarTurno,
  getDiasTrabajo, toggleDiaTrabajo, setDiasMasivos
}