const jwt = require('jsonwebtoken')

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' })
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' })
    }
    next()
  }
}

module.exports = { authenticateToken, authorizeRole }