const { sequelize } = require('../config/database')
const { QueryTypes } = require('sequelize')

// ── Detecta turno global (tabla vieja, compatibilidad) ────────────
const detectarTurnoGlobal = async () => {
  const ahora = new Date()
  const horaActual = ahora.toTimeString().slice(0, 8)
  const turnos = await sequelize.query('SELECT * FROM turnos', { type: QueryTypes.SELECT })
  for (const turno of turnos) {
    const inicio = turno.hora_inicio
    const fin = turno.hora_fin
    if (inicio < fin) {
      if (horaActual >= inicio && horaActual < fin) return turno.id
    } else {
      if (horaActual >= inicio || horaActual < fin) return turno.id
    }
  }
  return null
}

// ── Verifica si hoy es día laborable para la línea ───────────────
const verificarDiaLaboral = async (linea_nombre) => {
  const hoy = new Date().toISOString().slice(0, 10)
  const [linea] = await sequelize.query(
    `SELECT id FROM lineas_produccion WHERE nombre = ? AND activa = 1 LIMIT 1`,
    { replacements: [linea_nombre], type: QueryTypes.SELECT }
  )
  if (!linea) return { permitido: true }

  const [dia] = await sequelize.query(
    `SELECT trabaja FROM dias_trabajo WHERE linea_id = ? AND fecha = ? LIMIT 1`,
    { replacements: [linea.id, hoy], type: QueryTypes.SELECT }
  )
  if (!dia) return { permitido: true }

  return { permitido: dia.trabaja === 1 || dia.trabaja === true }
}

// ── Detecta turno activo para la línea ───────────────────────────
const detectarTurnoLinea = async (linea_nombre) => {
  const ahora = new Date()
  const horaActual = ahora.toTimeString().slice(0, 8)

  const [linea] = await sequelize.query(
    `SELECT id FROM lineas_produccion WHERE nombre = ? AND activa = 1 LIMIT 1`,
    { replacements: [linea_nombre], type: QueryTypes.SELECT }
  )
  if (!linea) return { turno_linea_id: null, turno_nombre: null, fuera_horario: false }

  const turnos = await sequelize.query(
    `SELECT * FROM turnos_linea WHERE linea_id = ? AND activo = 1 ORDER BY hora_inicio`,
    { replacements: [linea.id], type: QueryTypes.SELECT }
  )

  for (const t of turnos) {
    const inicio = t.hora_inicio.slice(0, 8)
    const fin = t.hora_fin.slice(0, 8)
    if (inicio < fin) {
      if (horaActual >= inicio && horaActual < fin)
        return { turno_linea_id: t.id, turno_nombre: t.nombre, fuera_horario: false }
    } else {
      if (horaActual >= inicio || horaActual < fin)
        return { turno_linea_id: t.id, turno_nombre: t.nombre, fuera_horario: false }
    }
  }

  if (turnos.length > 0) {
    return { turno_linea_id: null, turno_nombre: null, fuera_horario: true }
  }

  return { turno_linea_id: null, turno_nombre: null, fuera_horario: false }
}

const iniciar = async (req, res) => {
  const { maquina_id, motivo_id, observaciones, codigo_orden } = req.body
  const usuario_id = req.user.id

  if (!maquina_id || !motivo_id) {
    return res.status(400).json({ error: 'Máquina y motivo son requeridos' })
  }

  try {
    const parosAbiertos = await sequelize.query(
      'SELECT id FROM paros WHERE maquina_id = :maquina_id AND fin IS NULL',
      { replacements: { maquina_id }, type: QueryTypes.SELECT }
    )
    if (parosAbiertos.length > 0) {
      return res.status(400).json({ error: 'Esta máquina ya tiene un paro activo' })
    }

    const [maquina] = await sequelize.query(
      `SELECT linea FROM maquinas WHERE id = ?`,
      { replacements: [maquina_id], type: QueryTypes.SELECT }
    )
    const linea_nombre = maquina?.linea || null

    if (linea_nombre) {
      const { permitido } = await verificarDiaLaboral(linea_nombre)
      if (!permitido) {
        return res.status(403).json({
          error: 'dia_no_laborable',
          mensaje: 'Hoy no es día laborable para esta línea. No se pueden registrar paros.'
        })
      }
    }

    const { turno_nombre, fuera_horario } = linea_nombre
      ? await detectarTurnoLinea(linea_nombre)
      : { turno_nombre: null, fuera_horario: false }

    if (fuera_horario) {
      return res.status(200).json({
        advertencia: true,
        tipo: 'fuera_horario',
        mensaje: 'La hora actual está fuera del horario de turnos configurado para esta línea. ¿Deseas registrar el paro de todas formas?'
      })
    }

    const turno_id = await detectarTurnoGlobal()

    await sequelize.query(
      `INSERT INTO paros (maquina_id, usuario_id, motivo_id, turno_id, inicio, observaciones, codigo_orden)
       VALUES (:maquina_id, :usuario_id, :motivo_id, :turno_id, NOW(), :observaciones, :codigo_orden)`,
      {
        replacements: {
          maquina_id, usuario_id, motivo_id,
          turno_id: turno_id || null,
          observaciones: observaciones || null,
          codigo_orden: codigo_orden || null
        },
        type: QueryTypes.INSERT
      }
    )

    const paros = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, m.linea, mo.nombre as motivo_nombre, mo.color_hex,
       u.nombre as operador_nombre
       FROM paros p
       JOIN maquinas m ON p.maquina_id = m.id
       JOIN motivos_paro mo ON p.motivo_id = mo.id
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.maquina_id = :maquina_id AND p.fin IS NULL
       LIMIT 1`,
      { replacements: { maquina_id }, type: QueryTypes.SELECT }
    )

    const fechaHoy = new Date().toISOString().slice(0, 10)
    const [conteo] = await sequelize.query(
      `SELECT COUNT(*) as total FROM paros WHERE maquina_id = :maquina_id AND DATE(inicio) = :fechaHoy`,
      { replacements: { maquina_id, fechaHoy }, type: QueryTypes.SELECT }
    )

    req.io.emit('paro:iniciado', {
      paroId: paros[0].id,
      maquinaId: maquina_id,
      maquinaNombre: paros[0].maquina_nombre,
      motivoNombre: paros[0].motivo_nombre,
      colorHex: paros[0].color_hex,
      linea: paros[0].linea,
      inicio: paros[0].inicio,
      operador: paros[0].operador_nombre || req.user.nombre,
      totalParosTurno: parseInt(conteo.total) || 0
    })

    res.status(201).json({
      message: 'Paro iniciado',
      paro: paros[0],
      turno_nombre: turno_nombre || null
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al iniciar paro' })
  }
}

const cerrar = async (req, res) => {
  const { id } = req.params
  try {
    const paros = await sequelize.query(
      'SELECT * FROM paros WHERE id = :id AND fin IS NULL',
      { replacements: { id }, type: QueryTypes.SELECT }
    )
    if (paros.length === 0) {
      return res.status(404).json({ error: 'Paro no encontrado o ya cerrado' })
    }
    await sequelize.query(
      `UPDATE paros SET fin = NOW(), duracion_segundos = TIMESTAMPDIFF(SECOND, inicio, NOW()) WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    )
    const paroActualizado = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, mo.nombre as motivo_nombre
       FROM paros p JOIN maquinas m ON p.maquina_id = m.id JOIN motivos_paro mo ON p.motivo_id = mo.id
       WHERE p.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    )
    req.io.emit('paro:cerrado', {
      paroId: Number(id),
      maquinaId: paroActualizado[0].maquina_id,
      maquinaNombre: paroActualizado[0].maquina_nombre,
      duracion_segundos: paroActualizado[0].duracion_segundos
    })
    res.json({ message: 'Paro cerrado', paro: paroActualizado[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cerrar paro' })
  }
}

const activos = async (req, res) => {
  try {
    const paros = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, m.linea, m.costo_hora, m.unidades_por_minuto,
       mo.nombre as motivo_nombre, mo.color_hex, mo.categoria,
       u.nombre as operador_nombre,
       TIMESTAMPDIFF(SECOND, p.inicio, NOW()) as segundos_transcurridos,
       ROUND((TIMESTAMPDIFF(SECOND, p.inicio, NOW()) / 3600) * m.costo_hora, 0) as costo_perdido,
       CASE WHEN m.linea = '3 - Sellado' AND m.unidades_por_minuto > 0
         THEN ROUND((TIMESTAMPDIFF(SECOND, p.inicio, NOW()) / 60) * m.unidades_por_minuto, 0)
         ELSE NULL
       END as unidades_no_producidas
       FROM paros p
       JOIN maquinas m ON p.maquina_id = m.id
       JOIN motivos_paro mo ON p.motivo_id = mo.id
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.fin IS NULL
       ORDER BY p.inicio ASC`,
      { type: QueryTypes.SELECT }
    )
    res.json(paros)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener paros activos' })
  }
}

const historial = async (req, res) => {
  const { fecha_inicio, fecha_fin, maquina_id, motivo_id } = req.query
  try {
    let where = 'WHERE p.fin IS NOT NULL'
    const replacements = {}
    if (fecha_inicio) { where += ' AND DATE(p.inicio) >= :fecha_inicio'; replacements.fecha_inicio = fecha_inicio }
    if (fecha_fin)    { where += ' AND DATE(p.inicio) <= :fecha_fin';    replacements.fecha_fin = fecha_fin }
    if (maquina_id)   { where += ' AND p.maquina_id = :maquina_id';      replacements.maquina_id = maquina_id }
    if (motivo_id)    { where += ' AND p.motivo_id = :motivo_id';        replacements.motivo_id = motivo_id }
    const paros = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, m.linea, m.costo_hora, m.unidades_por_minuto,
       mo.nombre as motivo_nombre, mo.color_hex, mo.categoria,
       u.nombre as operador_nombre,
       ROUND((p.duracion_segundos / 3600) * m.costo_hora, 0) as costo_perdido,
       CASE WHEN m.linea = '3 - Sellado' AND m.unidades_por_minuto > 0
         THEN ROUND((p.duracion_segundos / 60) * m.unidades_por_minuto, 0)
         ELSE NULL
       END as unidades_no_producidas
       FROM paros p JOIN maquinas m ON p.maquina_id = m.id JOIN motivos_paro mo ON p.motivo_id = mo.id
       JOIN usuarios u ON p.usuario_id = u.id
       ${where} ORDER BY p.inicio DESC LIMIT 500`,
      { replacements, type: QueryTypes.SELECT }
    )
    res.json(paros)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' })
  }
}

const resumenTurno = async (req, res) => {
  const { maquina_id, turno_inicio, turno_fin } = req.query
  if (!maquina_id || !turno_inicio || !turno_fin) {
    return res.status(400).json({ error: 'Faltan parámetros' })
  }
  try {
    const [data] = await sequelize.query(
      `SELECT COUNT(p.id) as total_paros,
        COALESCE(SUM(p.duracion_segundos), 0) as segundos_perdidos,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos,
        ROUND(COALESCE(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0), 0) as costo_perdido,
        CASE WHEN m.linea = '3 - Sellado' AND m.unidades_por_minuto > 0
          THEN ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60 * m.unidades_por_minuto, 0)
          ELSE NULL
        END as unidades_no_producidas
      FROM paros p JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.maquina_id = :maquina_id AND p.fin IS NOT NULL
        AND p.inicio >= :turno_inicio AND p.inicio <= :turno_fin`,
      { replacements: { maquina_id, turno_inicio, turno_fin }, type: QueryTypes.SELECT }
    )
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen de turno' })
  }
}

const estadoTurno = async (req, res) => {
  const { maquina_id } = req.query
  if (!maquina_id) return res.status(400).json({ error: 'maquina_id requerido' })
  try {
    const [maquina] = await sequelize.query(
      `SELECT linea FROM maquinas WHERE id = ?`,
      { replacements: [parseInt(maquina_id)], type: QueryTypes.SELECT }
    )
    if (!maquina?.linea) return res.json({ en_turno: true, dia_laborable: true })
    const { permitido } = await verificarDiaLaboral(maquina.linea)
    const { turno_nombre, fuera_horario } = await detectarTurnoLinea(maquina.linea)
    res.json({
      dia_laborable: permitido,
      en_turno: !fuera_horario,
      turno_nombre,
      linea: maquina.linea
    })
  } catch {
    res.json({ en_turno: true, dia_laborable: true })
  }
}

const editarTiempos = async (req, res) => {
  const { id } = req.params
  const { inicio, fin, razon, maquina_id, usuario_id } = req.body
  const rol = req.user.rol
  if (rol !== 'admin' && rol !== 'supervisor') return res.status(403).json({ error: 'Sin permiso para editar paros' })
  if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin son requeridos' })
  if (!razon || !razon.trim()) return res.status(400).json({ error: 'Debes indicar la razón del cambio' })
  const inicioDate = new Date(inicio)
  const finDate = new Date(fin)
  if (finDate <= inicioDate) return res.status(400).json({ error: 'El fin debe ser posterior al inicio' })
  const duracion_segundos = Math.round((finDate - inicioDate) / 1000)
  try {
    const paros = await sequelize.query(
      'SELECT p.*, m.costo_hora, m.unidades_por_minuto, m.linea FROM paros p JOIN maquinas m ON p.maquina_id = m.id WHERE p.id = :id',
      { replacements: { id }, type: QueryTypes.SELECT }
    )
    if (!paros.length) return res.status(404).json({ error: 'Paro no encontrado' })
    const paro = paros[0]

    let costoHora = paro.costo_hora
    let unidadesPorMinuto = paro.unidades_por_minuto
    let linea = paro.linea
    if (maquina_id && maquina_id != paro.maquina_id) {
      const maqNueva = await sequelize.query(
        'SELECT costo_hora, unidades_por_minuto, linea FROM maquinas WHERE id = :maquina_id',
        { replacements: { maquina_id }, type: QueryTypes.SELECT }
      )
      if (maqNueva.length) {
        costoHora = maqNueva[0].costo_hora
        unidadesPorMinuto = maqNueva[0].unidades_por_minuto
        linea = maqNueva[0].linea
      }
    }

    const costo_perdido = Math.round((duracion_segundos / 3600) * costoHora)
    const unidades_no_producidas = (linea === '3 - Sellado' && unidadesPorMinuto > 0)
      ? Math.round((duracion_segundos / 60) * unidadesPorMinuto) : null

    const campos = ['inicio = :inicio', 'fin = :fin', 'duracion_segundos = :duracion_segundos']
    const replacements = { inicio, fin, duracion_segundos, id }
    if (maquina_id) { campos.push('maquina_id = :maquina_id'); replacements.maquina_id = maquina_id }
    if (usuario_id) { campos.push('usuario_id = :usuario_id'); replacements.usuario_id = usuario_id }

    await sequelize.query(
      `UPDATE paros SET ${campos.join(', ')} WHERE id = :id`,
      { replacements, type: QueryTypes.UPDATE }
    )

    const ahora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
    let notaExtra = ''
    if (maquina_id && maquina_id != paro.maquina_id) notaExtra += `, maquina_id=${maquina_id}`
    if (usuario_id && usuario_id != paro.usuario_id) notaExtra += `, operador_id=${usuario_id}`

    await sequelize.query(
      `UPDATE paros SET observaciones = CONCAT(COALESCE(observaciones, ''), :nota) WHERE id = :id`,
      {
        replacements: {
          nota: `\n[Editado ${ahora} por ${req.user.nombre} (${rol}) — Razón: ${razon.trim()} | inicio=${inicio}, fin=${fin}, duración=${Math.floor(duracion_segundos/60)}m ${duracion_segundos%60}s${notaExtra}]`,
          id
        },
        type: QueryTypes.UPDATE
      }
    )
    const paroActualizado = await sequelize.query(
      `SELECT p.*, m.nombre as maquina_nombre, mo.nombre as motivo_nombre
       FROM paros p JOIN maquinas m ON p.maquina_id = m.id JOIN motivos_paro mo ON p.motivo_id = mo.id
       WHERE p.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    )
    res.json({ message: 'Paro actualizado', paro: paroActualizado[0], duracion_segundos, costo_perdido, unidades_no_producidas })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al editar paro' })
  }
}

const eliminar = async (req, res) => {
  const { id } = req.params
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo el admin puede eliminar paros' })
  try {
    // Primero eliminar los registros de mantenimiento asociados al paro
    await sequelize.query(
      'DELETE FROM mantenimiento_registros WHERE paro_id = :id',
      { replacements: { id }, type: QueryTypes.DELETE }
    )
    // Luego eliminar el paro sin conflicto de llave foránea
    await sequelize.query(
      'DELETE FROM paros WHERE id = :id',
      { replacements: { id }, type: QueryTypes.DELETE }
    )
    res.json({ message: 'Paro eliminado correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar paro' })
  }
}

module.exports = { iniciar, cerrar, activos, historial, resumenTurno, editarTiempos, estadoTurno, eliminar }