const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')

const listar = async (req, res) => {
  try {
    const lineas = await sequelize.query(
      `SELECT l.*,
        COUNT(m.id) as total_maquinas,
        SUM(CASE WHEN m.activa = 1 THEN 1 ELSE 0 END) as maquinas_activas
       FROM lineas_produccion l
       LEFT JOIN maquinas m ON m.linea = l.nombre
       GROUP BY l.id
       ORDER BY l.nombre ASC`,
      { type: QueryTypes.SELECT }
    )
    res.json(lineas)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener líneas' })
  }
}

const crear = async (req, res) => {
  const { nombre, tipo_medicion } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })
  try {
    await sequelize.query(
      `INSERT INTO lineas_produccion (nombre, tipo_medicion) VALUES (:nombre, :tipo_medicion)`,
      {
        replacements: { nombre, tipo_medicion: tipo_medicion || 'unidades' },
        type: QueryTypes.INSERT
      }
    )
    res.status(201).json({ message: 'Línea creada correctamente' })
  } catch (error) {
    if (error.original?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una línea con ese nombre' })
    }
    res.status(500).json({ error: 'Error al crear línea' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const { nombre, tipo_medicion } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })
  try {
    const [linea] = await sequelize.query(
      `SELECT nombre FROM lineas_produccion WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    )
    if (!linea) return res.status(404).json({ error: 'Línea no encontrada' })

    await sequelize.query(
      `UPDATE lineas_produccion SET nombre=:nombre, tipo_medicion=:tipo_medicion WHERE id=:id`,
      {
        replacements: { id, nombre, tipo_medicion: tipo_medicion || 'unidades' },
        type: QueryTypes.UPDATE
      }
    )

    if (linea.nombre !== nombre) {
      await sequelize.query(
        `UPDATE maquinas SET linea = :nombre WHERE linea = :anterior`,
        { replacements: { nombre, anterior: linea.nombre }, type: QueryTypes.UPDATE }
      )
      await sequelize.query(
        `UPDATE usuarios SET linea = :nombre WHERE linea = :anterior`,
        { replacements: { nombre, anterior: linea.nombre }, type: QueryTypes.UPDATE }
      )
    }

    res.json({ message: 'Línea actualizada correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar línea' })
  }
}

const toggleActiva = async (req, res) => {
  const { id } = req.params
  try {
    const [linea] = await sequelize.query(
      `SELECT l.*, l.nombre,
        (SELECT COUNT(*) FROM usuarios u
         JOIN maquinas m ON m.id = u.maquina_id
         WHERE m.linea = l.nombre AND u.activo = 1) as operadores_en_uso
       FROM lineas_produccion l WHERE l.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    )
    if (!linea) return res.status(404).json({ error: 'Línea no encontrada' })

    if (linea.activa && linea.operadores_en_uso > 0) {
      return res.status(400).json({
        error: `No se puede desactivar. Hay ${linea.operadores_en_uso} operador(es) trabajando en esta línea.`
      })
    }

    if (linea.activa) {
      const [paros] = await sequelize.query(
        `SELECT COUNT(*) as total FROM paros p
         JOIN maquinas m ON m.id = p.maquina_id
         WHERE m.linea = :nombre AND p.fin IS NULL`,
        { replacements: { nombre: linea.nombre }, type: QueryTypes.SELECT }
      )
      if (paros.total > 0) {
        return res.status(400).json({
          error: `No se puede desactivar. Hay ${paros.total} paro(s) activo(s) en esta línea.`
        })
      }
    }

    await sequelize.query(
      `UPDATE lineas_produccion SET activa = :activa WHERE id = :id`,
      { replacements: { id, activa: !linea.activa }, type: QueryTypes.UPDATE }
    )

    res.json({ message: `Línea ${!linea.activa ? 'activada' : 'desactivada'} correctamente` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cambiar estado de la línea' })
  }
}

module.exports = { listar, crear, actualizar, toggleActiva }