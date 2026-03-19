const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')
const https = require('https')

const enviarWhatsApp = async (numero, mensaje) => {
  try {
    const msgEncoded = encodeURIComponent(mensaje)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${msgEncoded}&apikey=${process.env.CALLMEBOT_APIKEY}`
    return new Promise((resolve) => {
      https.get(url, (res) => { resolve(res.statusCode) }).on('error', (e) => {
        console.error('[WhatsApp] Error:', e.message); resolve(null)
      })
    })
  } catch (e) { console.error('[WhatsApp] Error:', e.message) }
}

const parosActivos = async (req, res) => {
  try {
    const paros = await sequelize.query(
      `SELECT p.*, 
       m.nombre as maquina_nombre, m.linea, m.costo_hora as costo_hora_maquina, m.unidades_por_minuto,
       mo.nombre as motivo_nombre, mo.color_hex, mo.categoria,
       u.nombre as operador_nombre,
       TIMESTAMPDIFF(SECOND, p.inicio, NOW()) as segundos_transcurridos,
       ROUND((TIMESTAMPDIFF(SECOND, p.inicio, NOW()) / 3600) * m.costo_hora, 0) as costo_perdido,
       mr.id as tiene_registro,
       mr.accion as ultima_accion,
       mr.creado_en as ultima_intervencion,
       mr.costo_intervencion as ultimo_costo_intervencion
       FROM paros p
       JOIN maquinas m ON p.maquina_id = m.id
       JOIN motivos_paro mo ON p.motivo_id = mo.id
       JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN mantenimiento_registros mr ON mr.paro_id = p.id
         AND mr.id = (SELECT MAX(id) FROM mantenimiento_registros WHERE paro_id = p.id)
       WHERE p.fin IS NULL
         AND mo.categoria = 'mantenimiento'
       ORDER BY p.inicio ASC`,
      { type: QueryTypes.SELECT }
    )
    res.json(paros)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener paros activos' })
  }
}

const registrarIntervencion = async (req, res) => {
  const { paro_id, accion, descripcion } = req.body
  const usuario_id = req.user.id

  if (!paro_id || !accion) {
    return res.status(400).json({ error: 'paro_id y accion son requeridos' })
  }

  try {
    const paros = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, m.linea,
       TIMESTAMPDIFF(SECOND, p.inicio, NOW()) as segundos_transcurridos,
       TIMESTAMPDIFF(MINUTE, p.inicio, NOW()) as minutos_transcurridos
       FROM paros p JOIN maquinas m ON p.maquina_id = m.id
       WHERE p.id = :paro_id`,
      { replacements: { paro_id }, type: QueryTypes.SELECT }
    )
    if (!paros.length) return res.status(404).json({ error: 'Paro no encontrado' })
    const paro = paros[0]

    const [tecnico] = await sequelize.query(
      `SELECT costo_hora FROM usuarios WHERE id = :usuario_id`,
      { replacements: { usuario_id }, type: QueryTypes.SELECT }
    )
    const costo_hora_tecnico = parseFloat(tecnico?.costo_hora || 0)
    const segundos = paro.segundos_transcurridos || 0
    const costo_intervencion = Math.round((segundos / 3600) * costo_hora_tecnico)

    await sequelize.query(
      `INSERT INTO mantenimiento_registros 
       (paro_id, usuario_id, accion, descripcion, tiempo_respuesta_min, costo_intervencion, duracion_segundos)
       VALUES (:paro_id, :usuario_id, :accion, :descripcion, :tiempo_respuesta_min, :costo_intervencion, :duracion_segundos)`,
      {
        replacements: {
          paro_id, usuario_id, accion,
          descripcion: descripcion || null,
          tiempo_respuesta_min: paro.minutos_transcurridos || 0,
          costo_intervencion,
          duracion_segundos: segundos
        },
        type: QueryTypes.INSERT
      }
    )

    res.json({ message: 'Intervención registrada correctamente', costo_intervencion })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al registrar intervención' })
  }
}

const historialIntervencion = async (req, res) => {
  const { paro_id } = req.params
  try {
    const registros = await sequelize.query(
      `SELECT mr.*, u.nombre as tecnico_nombre, u.costo_hora as costo_hora_tecnico
       FROM mantenimiento_registros mr
       JOIN usuarios u ON mr.usuario_id = u.id
       WHERE mr.paro_id = :paro_id
       ORDER BY mr.creado_en DESC`,
      { replacements: { paro_id }, type: QueryTypes.SELECT }
    )
    res.json(registros)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' })
  }
}

const notificarTecnicos = async (req, res) => {
  const { paro_id, mensaje_custom } = req.body
  if (!paro_id) return res.status(400).json({ error: 'paro_id es requerido' })
  const paroIdNum = parseInt(paro_id)
  if (isNaN(paroIdNum)) return res.status(400).json({ error: 'paro_id inválido' })

  try {
    const paros = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, m.linea,
       mo.nombre as motivo_nombre,
       TIMESTAMPDIFF(MINUTE, p.inicio, NOW()) as minutos_parada
       FROM paros p
       JOIN maquinas m ON p.maquina_id = m.id
       JOIN motivos_paro mo ON p.motivo_id = mo.id
       WHERE p.id = ${paroIdNum}`,
      { type: QueryTypes.SELECT }
    )
    if (!paros.length) return res.status(404).json({ error: 'Paro no encontrado' })
    const paro = paros[0]

    const tecnicos = await sequelize.query(
      `SELECT * FROM usuarios WHERE rol = 'mantenimiento' AND activo = 1 AND whatsapp IS NOT NULL`,
      { type: QueryTypes.SELECT }
    )
    if (!tecnicos.length) return res.status(404).json({ error: 'No hay tecnicos con WhatsApp registrado' })

    const mensaje = mensaje_custom ||
      `ALERTA MANTENIMIENTO SGPM\n\nMaquina: ${paro.maquina_nombre}\nLinea: ${paro.linea}\nMotivo: ${paro.motivo_nombre}\nTiempo parada: ${paro.minutos_parada} minutos\n\nPor favor atender de inmediato.`

    const resultados = []
    for (const tecnico of tecnicos) {
      const status = await enviarWhatsApp(tecnico.whatsapp, mensaje)
      resultados.push({ tecnico: tecnico.nombre, whatsapp: tecnico.whatsapp, status })
    }
    res.json({ message: `Notificacion enviada a ${resultados.length} tecnico(s)`, resultados })
  } catch (error) {
    console.error('[WhatsApp notificar]', error.message)
    res.status(500).json({ error: 'Error al enviar notificaciones' })
  }
}

const resumenTurno = async (req, res) => {
  try {
    const [stats] = await sequelize.query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN p.fin IS NULL THEN p.id END) as paros_activos,
        COUNT(DISTINCT mr.id) as intervenciones_hoy,
        ROUND(AVG(mr.tiempo_respuesta_min), 1) as tiempo_respuesta_promedio,
        COUNT(DISTINCT CASE WHEN p.fin IS NULL AND TIMESTAMPDIFF(MINUTE, p.inicio, NOW()) > 30 THEN p.id END) as paros_criticos,
        COALESCE(SUM(
          ROUND((TIMESTAMPDIFF(SECOND, p.inicio, COALESCE(p.fin, NOW())) / 3600) * m.costo_hora, 0)
        ), 0) as costo_total_intervenciones_hoy
       FROM paros p
       JOIN maquinas m ON p.maquina_id = m.id
       JOIN motivos_paro mo ON p.motivo_id = mo.id
       LEFT JOIN mantenimiento_registros mr ON mr.paro_id = p.id
         AND DATE(mr.creado_en) = CURDATE()
       WHERE mo.categoria = 'mantenimiento'
         AND DATE(p.inicio) = CURDATE()`,
      { type: QueryTypes.SELECT }
    )
    res.json(stats)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener resumen' })
  }
}

const parosHoy = async (req, res) => {
  try {
    const paros = await sequelize.query(
      `SELECT p.id, p.inicio, p.fin,
        m.nombre as maquina_nombre, m.linea, m.costo_hora as costo_hora_maquina,
        mo.nombre as motivo_nombre, mo.color_hex,
        u.nombre as operador_nombre,
        TIMESTAMPDIFF(SECOND, p.inicio, COALESCE(p.fin, NOW())) as duracion_segundos,
        ROUND((TIMESTAMPDIFF(SECOND, p.inicio, COALESCE(p.fin, NOW())) / 3600) * m.costo_hora, 0) as costo_perdido,
        IF(p.fin IS NULL, 1, 0) as activo
       FROM paros p
       JOIN maquinas m ON p.maquina_id = m.id
       JOIN motivos_paro mo ON p.motivo_id = mo.id
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE mo.categoria = 'mantenimiento'
         AND DATE(p.inicio) = CURDATE()
       ORDER BY p.inicio DESC`,
      { type: QueryTypes.SELECT }
    )
    res.json(paros)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener paros de hoy' })
  }
}

module.exports = { parosActivos, registrarIntervencion, historialIntervencion, notificarTecnicos, resumenTurno, parosHoy }