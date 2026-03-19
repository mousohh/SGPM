const express = require('express')
const cors = require('cors')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
require('dotenv').config()
const { conectarDB } = require('./config/database')
const authRoutes = require('./routes/auth')
const maquinasRoutes = require('./routes/maquinas')
const motivosRoutes = require('./routes/motivos')
const usuariosRoutes = require('./routes/usuarios')
const parosRoutes = require('./routes/paros')
const reportesRoutes = require('./routes/reportes')
const iaRoutes = require('./routes/ia')
const mantenimientoRoutes = require('./routes/mantenimiento')
const turnosRoutes = require('./routes/turnos')
const lineasRoutes = require('./routes/lineas')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(cors())
app.use(express.json({ limit: '1mb' })) 


app.use((req, res, next) => {
  req.io = io
  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/maquinas', maquinasRoutes)
app.use('/api/motivos', motivosRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/paros', parosRoutes)
app.use('/api/reportes', reportesRoutes)
app.use('/api/ia', iaRoutes)
app.use('/api/mantenimiento', mantenimientoRoutes)
app.use('/api/turnos', turnosRoutes)
app.use('/api/lineas', lineasRoutes)
app.get('/api/ping', (req, res) => {
  res.json({ message: 'Servidor SGPM funcionando ✅' })
})

app.use(express.static(path.join(__dirname, '../../frontend/dist')))
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist', 'index.html'))
})

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`)
  socket.on('disconnect', () => console.log(`Cliente desconectado: ${socket.id}`))
})

conectarDB()

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})

