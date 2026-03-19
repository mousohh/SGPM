const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { conectarDB } = require('./config/database')
const authRoutes = require('./routes/auth')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)

app.get('/api/ping', (req, res) => {
  res.json({ message: 'Servidor SGPM funcionando ✅' })
})

conectarDB()

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})