const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')

const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }

  try {
    const usuarios = await sequelize.query(
      'SELECT * FROM usuarios WHERE email = :email AND activo = true LIMIT 1',
      { replacements: { email }, type: QueryTypes.SELECT }
    )

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const usuario = usuarios[0]
    const passwordValida = await bcrypt.compare(password, usuario.password_hash)

    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        maquina_id: usuario.maquina_id,
        linea: usuario.linea
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        maquina_id: usuario.maquina_id,
        linea: usuario.linea
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el servidor' })
  }
}

const getMe = async (req, res) => {
  res.json({ usuario: req.user })
}

module.exports = { login, getMe }