const express = require('express')
const router = express.Router()
const { authenticateToken, authorizeRole } = require('../middlewares/auth')
const { listar, crear, actualizar, toggleActiva } = require('../controllers/lineasController')

const soloAdmin = [authenticateToken, authorizeRole('admin')]

router.get('/', authenticateToken, listar)
router.post('/', soloAdmin, crear)
router.put('/:id', soloAdmin, actualizar)
router.patch('/:id/toggle', soloAdmin, toggleActiva)

module.exports = router