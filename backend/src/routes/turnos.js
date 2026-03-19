const express = require('express')
const router = express.Router()
const { authenticateToken, authorizeRole } = require('../middlewares/auth')
const {
  listarLineas, crearLinea, actualizarLinea, eliminarLinea,
  listarTurnos, crearTurno, actualizarTurno, eliminarTurno,
  getDiasTrabajo, toggleDiaTrabajo, setDiasMasivos
} = require('../controllers/turnosController')

const soloAdmin = [authenticateToken, authorizeRole('admin')]

router.get('/lineas', authenticateToken, listarLineas)
router.post('/lineas', ...soloAdmin, crearLinea)
router.put('/lineas/:id', ...soloAdmin, actualizarLinea)
router.delete('/lineas/:id', ...soloAdmin, eliminarLinea)

router.get('/turnos', authenticateToken, listarTurnos)
router.post('/turnos', ...soloAdmin, crearTurno)
router.put('/turnos/:id', ...soloAdmin, actualizarTurno)
router.delete('/turnos/:id', ...soloAdmin, eliminarTurno)

router.get('/dias', authenticateToken, getDiasTrabajo)
router.post('/dias/toggle', ...soloAdmin, toggleDiaTrabajo)
router.post('/dias/masivo', ...soloAdmin, setDiasMasivos)

module.exports = router