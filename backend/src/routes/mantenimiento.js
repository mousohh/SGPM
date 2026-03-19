const express = require('express')
const router = express.Router()
const { authenticateToken, authorizeRole } = require('../middlewares/auth')
const {
  parosActivos, registrarIntervencion,
  historialIntervencion, notificarTecnicos, resumenTurno, parosHoy
} = require('../controllers/mantenimientoController')


router.get('/paros-activos', authenticateToken, authorizeRole('admin', 'supervisor', 'mantenimiento'), parosActivos)
router.post('/intervenir', authenticateToken, authorizeRole('admin', 'supervisor', 'mantenimiento'), registrarIntervencion)
router.get('/historial/:paro_id', authenticateToken, authorizeRole('admin', 'supervisor', 'mantenimiento'), historialIntervencion)
router.post('/notificar', authenticateToken, authorizeRole('admin', 'supervisor'), notificarTecnicos)
router.get('/resumen-turno', authenticateToken, authorizeRole('admin', 'supervisor', 'mantenimiento'), resumenTurno)
router.get('/paros-hoy', authenticateToken, parosHoy)

module.exports = router