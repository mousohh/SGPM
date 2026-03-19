const express = require('express')
const router = express.Router()
const { listar, crear, actualizar, eliminar } = require('../controllers/usuariosController')
const { authenticateToken, authorizeRole } = require('../middlewares/auth')

router.get('/', authenticateToken, authorizeRole('admin', 'supervisor'), listar)
router.post('/', authenticateToken, authorizeRole('admin'), crear)
router.put('/:id', authenticateToken, authorizeRole('admin'), actualizar)
router.delete('/:id', authenticateToken, authorizeRole('admin'), eliminar)

module.exports = router