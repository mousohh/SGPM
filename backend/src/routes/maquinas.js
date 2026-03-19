const express = require('express')
const router = express.Router()
const { authenticateToken, authorizeRole } = require('../middlewares/auth')
const { listar, porLinea, crear, actualizar, eliminar } = require('../controllers/maquinasController')

router.get('/', authenticateToken, listar)
router.get('/por-linea/:linea', authenticateToken, porLinea)
router.post('/', authenticateToken, authorizeRole('admin'), crear)
router.put('/:id', authenticateToken, authorizeRole('admin'), actualizar)
router.delete('/:id', authenticateToken, authorizeRole('admin'), eliminar)

module.exports = router