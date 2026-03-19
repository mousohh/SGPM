const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')

const listar = async (req, res) => {
  try {
    const maquinas = await sequelize.query(
      'SELECT * FROM maquinas ORDER BY linea, nombre',
      { type: QueryTypes.SELECT }
    )
    res.json(maquinas)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener máquinas' })
  }
}

const porLinea = async (req, res) => {
  const { linea } = req.params
  try {
    const maquinas = await sequelize.query(
      `SELECT id, nombre, linea, costo_hora, unidades_por_minuto, kilos_por_hora, precio_kilo
       FROM maquinas
       WHERE linea = :linea AND activa = 1
       ORDER BY nombre ASC`,
      { replacements: { linea: decodeURIComponent(linea) }, type: QueryTypes.SELECT }
    )
    res.json(maquinas)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener máquinas de la línea' })
  }
}

const crear = async (req, res) => {
  const { nombre, linea, costo_hora, unidades_por_minuto, kilos_por_hora, precio_kilo, descripcion } = req.body
  if (!nombre || !costo_hora) {
    return res.status(400).json({ error: 'Nombre y costo por hora son requeridos' })
  }
  try {
    await sequelize.query(
      `INSERT INTO maquinas (nombre, linea, costo_hora, unidades_por_minuto, kilos_por_hora, precio_kilo, descripcion)
       VALUES (:nombre, :linea, :costo_hora, :unidades_por_minuto, :kilos_por_hora, :precio_kilo, :descripcion)`,
      {
        replacements: {
          nombre,
          linea: linea || null,
          costo_hora: costo_hora || 0,
          unidades_por_minuto: unidades_por_minuto || null,
          kilos_por_hora: kilos_por_hora || null,
          precio_kilo: precio_kilo || null,
          descripcion: descripcion || null
        },
        type: QueryTypes.INSERT
      }
    )
    res.status(201).json({ message: 'Máquina creada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear máquina' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const { nombre, linea, costo_hora, unidades_por_minuto, kilos_por_hora, precio_kilo,
          descripcion, activa, motivo_desactivacion } = req.body
  try {
    await sequelize.query(
      `UPDATE maquinas SET nombre=:nombre, linea=:linea,
       costo_hora=:costo_hora, unidades_por_minuto=:unidades_por_minuto,
       kilos_por_hora=:kilos_por_hora, precio_kilo=:precio_kilo,
       descripcion=:descripcion, activa=:activa,
       motivo_desactivacion=:motivo_desactivacion
       WHERE id=:id`,
      {
        replacements: {
          id, nombre,
          linea: linea || null,
          costo_hora: costo_hora || 0,
          unidades_por_minuto: unidades_por_minuto || null,
          kilos_por_hora: kilos_por_hora || null,
          precio_kilo: precio_kilo || null,
          descripcion: descripcion || null,
          activa: activa ?? true,
          // Al activar limpiar el motivo, al desactivar guardarlo
          motivo_desactivacion: activa ? null : (motivo_desactivacion || null)
        },
        type: QueryTypes.UPDATE
      }
    )
    res.json({ message: 'Máquina actualizada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar máquina' })
  }
}

const eliminar = async (req, res) => {
  const { id } = req.params
  try {
    await sequelize.query(
      'UPDATE maquinas SET activa = false WHERE id = :id',
      { replacements: { id }, type: QueryTypes.UPDATE }
    )
    res.json({ message: 'Máquina desactivada correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar máquina' })
  }
}

module.exports = { listar, porLinea, crear, actualizar, eliminar }