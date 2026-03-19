const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middlewares/auth')
const { iniciar, cerrar, activos, historial, resumenTurno, editarTiempos, estadoTurno, eliminar } = require('../controllers/parosController')

router.post('/iniciar', authenticateToken, iniciar)
router.put('/:id/cerrar', authenticateToken, cerrar)
router.get('/activos', authenticateToken, activos)
router.get('/historial', authenticateToken, historial)
router.get('/resumen-turno', authenticateToken, resumenTurno)
router.get('/estado-turno', authenticateToken, estadoTurno)
router.put('/:id/editar-tiempos', authenticateToken, editarTiempos)
router.delete('/:id', authenticateToken, eliminar)

module.exports = router