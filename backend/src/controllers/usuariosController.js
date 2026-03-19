const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')
const bcrypt = require('bcryptjs')

const listar = async (req, res) => {
  try {
    const usuarios = await sequelize.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.maquina_id, u.linea, u.activo, u.creado_en, u.whatsapp, u.costo_hora,
       m.nombre as maquina_nombre
       FROM usuarios u
       LEFT JOIN maquinas m ON u.maquina_id = m.id
       ORDER BY u.nombre`,
      { type: QueryTypes.SELECT }
    )
    res.json(usuarios)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
}

const crear = async (req, res) => {
  const { nombre, email, password, rol, linea, whatsapp, costo_hora } = req.body
  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' })
  }
  try {
    const hash = await bcrypt.hash(password, 10)
    await sequelize.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, linea, whatsapp, costo_hora)
       VALUES (:nombre, :email, :hash, :rol, :linea, :whatsapp, :costo_hora)`,
      {
        replacements: {
          nombre, email, hash, rol,
          linea: linea || null,
          whatsapp: whatsapp || null,
          costo_hora: costo_hora || null
        },
        type: QueryTypes.INSERT
      }
    )
    res.status(201).json({ message: 'Usuario creado correctamente' })
  } catch (error) {
    console.error('ERROR CREAR USUARIO:', error.message, error.original?.message)
    if (error.original?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email ya está registrado' })
    }
    res.status(500).json({ error: 'Error al crear usuario' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const { nombre, email, password, rol, linea, activo, whatsapp, costo_hora } = req.body
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await sequelize.query(
        `UPDATE usuarios SET nombre=:nombre, email=:email, password_hash=:hash, rol=:rol,
         linea=:linea, activo=:activo, whatsapp=:whatsapp, costo_hora=:costo_hora WHERE id=:id`,
        {
          replacements: {
            id, nombre, email, hash, rol,
            linea: linea || null,
            activo: activo ?? true,
            whatsapp: whatsapp || null,
            costo_hora: costo_hora || null
          },
          type: QueryTypes.UPDATE
        }
      )
    } else {
      await sequelize.query(
        `UPDATE usuarios SET nombre=:nombre, email=:email, rol=:rol,
         linea=:linea, activo=:activo, whatsapp=:whatsapp, costo_hora=:costo_hora WHERE id=:id`,
        {
          replacements: {
            id, nombre, email, rol,
            linea: linea || null,
            activo: activo ?? true,
            whatsapp: whatsapp || null,
            costo_hora: costo_hora || null
          },
          type: QueryTypes.UPDATE
        }
      )
    }
    res.json({ message: 'Usuario actualizado correctamente' })
  } catch (error) {
    console.error('ERROR ACTUALIZAR USUARIO:', error.message)
    res.status(500).json({ error: 'Error al actualizar usuario' })
  }
}

const eliminar = async (req, res) => {
  const { id } = req.params
  try {
    await sequelize.query(
      'UPDATE usuarios SET activo = false WHERE id = :id',
      { replacements: { id }, type: QueryTypes.UPDATE }
    )
    res.json({ message: 'Usuario desactivado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar usuario' })
  }
}

module.exports = { listar, crear, actualizar, eliminar }