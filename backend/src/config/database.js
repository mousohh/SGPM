const { Sequelize } = require('sequelize')
require('dotenv').config()

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    timezone: '-05:00',
    dialectOptions: {
      timezone: '-05:00'
    }
  }
)

const conectarDB = async () => {
  try {
    await sequelize.authenticate()
    console.log('Conexión a MySQL exitosa ✅')
  } catch (error) {
    console.error('Error conectando a MySQL ❌', error.message)
  }
}

module.exports = { sequelize, conectarDB }