const express = require('express')
const router = express.Router()
const { resumen, paretoMotivos, disponibilidad, pareto, tendencia, lineas, seriesTemporal, resumenSupervisor, resumenInicio, oee } = require('../controllers/reportesController')
const { authenticateToken, authorizeRole } = require('../middlewares/auth')

router.get('/disponibilidad', authenticateToken, authorizeRole('admin'), disponibilidad)
router.get('/pareto', authenticateToken, authorizeRole('admin'), pareto)
router.get('/tendencia', authenticateToken, authorizeRole('admin'), tendencia)
router.get('/resumen', authenticateToken, authorizeRole('admin'), resumen)
router.get('/lineas', authenticateToken, authorizeRole('admin'), lineas)
router.get('/series-temporal', authenticateToken, authorizeRole('admin'), seriesTemporal)
router.get('/resumen-supervisor', authenticateToken, authorizeRole('admin', 'supervisor'), resumenSupervisor)
router.get('/resumen-inicio', authenticateToken, authorizeRole('admin'), resumenInicio)
router.get('/oee', authenticateToken, oee)

module.exports = router