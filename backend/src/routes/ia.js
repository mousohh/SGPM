const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middlewares/auth')
const { analizarOEE } = require('../controllers/iaController')

router.post('/analizar-oee', authenticateToken, analizarOEE)

module.exports = router