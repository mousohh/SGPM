const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')

const listar = async (req, res) => {
  try {
    const motivos = await sequelize.query(
      'SELECT * FROM motivos_paro ORDER BY categoria, nombre',
      { type: QueryTypes.SELECT }
    )
    res.json(motivos)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener motivos' })
  }
}

const crear = async (req, res) => {
  const { nombre, categoria, color_hex } = req.body
  if (!nombre || !categoria) {
    return res.status(400).json({ error: 'Nombre y categoría son requeridos' })
  }
  try {
    await sequelize.query(
      'INSERT INTO motivos_paro (nombre, categoria, color_hex) VALUES (:nombre, :categoria, :color_hex)',
      { replacements: { nombre, categoria, color_hex: color_hex || '#64748b' }, type: QueryTypes.INSERT }
    )
    res.status(201).json({ message: 'Motivo creado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al crear motivo' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const { nombre, categoria, color_hex, activo } = req.body
  try {
    await sequelize.query(
      'UPDATE motivos_paro SET nombre=:nombre, categoria=:categoria, color_hex=:color_hex, activo=:activo WHERE id=:id',
      { replacements: { id, nombre, categoria, color_hex: color_hex || '#64748b', activo: activo ?? true }, type: QueryTypes.UPDATE }
    )
    res.json({ message: 'Motivo actualizado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar motivo' })
  }
}

const eliminar = async (req, res) => {
  const { id } = req.params
  try {
    await sequelize.query(
      'UPDATE motivos_paro SET activo = false WHERE id = :id',
      { replacements: { id }, type: QueryTypes.UPDATE }
    )
    res.json({ message: 'Motivo desactivado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar motivo' })
  }
}

module.exports = { listar, crear, actualizar, eliminar }