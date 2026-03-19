const { sequelize } = require("../config/database");
const { QueryTypes } = require("sequelize");

const SEGUNDOS_TURNO = 28800   // 8 horas por turno
const TURNOS_DIA     = 3       // 3 turnos por día = 24h laborales

const disponibilidad = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const fi = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ff = fecha_fin || new Date().toISOString().slice(0, 10);

  // Días en el rango (mínimo 1)
  const dias = Math.max(1,
    Math.ceil((new Date(ff) - new Date(fi)) / (1000 * 60 * 60 * 24)) + 1
  )
  // Tiempo planificado por máquina en segundos
  const segundosPlanificados = SEGUNDOS_TURNO * TURNOS_DIA * dias

  try {
    const data = await sequelize.query(
      `SELECT 
        m.id, m.nombre, m.linea, m.costo_hora, m.unidades_por_minuto,
        COUNT(p.id) as total_paros,
        COALESCE(SUM(p.duracion_segundos), 0) as segundos_perdidos,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 3600 * m.costo_hora, 0) as costo_perdido,
        CASE WHEN m.linea = '3 - Sellado' AND m.unidades_por_minuto > 0
          THEN ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60 * m.unidades_por_minuto, 0)
          ELSE NULL
        END as unidades_no_producidas,
        ROUND(
          GREATEST(0,
            (1 - COALESCE(SUM(p.duracion_segundos), 0) / :segundosPlanificados) * 100
          ), 1
        ) as disponibilidad_pct
      FROM maquinas m
      LEFT JOIN paros p ON m.id = p.maquina_id 
        AND p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fi 
        AND DATE(p.inicio) <= :ff
      WHERE m.activa = true
      GROUP BY m.id, m.nombre, m.linea, m.costo_hora, m.unidades_por_minuto
      ORDER BY segundos_perdidos DESC`,
      { replacements: { fi, ff, segundosPlanificados }, type: QueryTypes.SELECT },
    );
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener disponibilidad" });
  }
};

const paretoMotivos = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const fi = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ff = fecha_fin || new Date().toISOString().slice(0, 10);

  try {
    const data = await sequelize.query(
      `SELECT 
        mo.id, mo.nombre, mo.categoria, mo.color_hex,
        COUNT(p.id) as total_paros,
        COALESCE(SUM(p.duracion_segundos), 0) as segundos_perdidos,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos
      FROM motivos_paro mo
      LEFT JOIN paros p ON mo.id = p.motivo_id
        AND p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fi
        AND DATE(p.inicio) <= :ff
      WHERE mo.activo = true
      GROUP BY mo.id, mo.nombre, mo.categoria, mo.color_hex
      HAVING total_paros > 0
      ORDER BY segundos_perdidos DESC`,
      { replacements: { fi, ff }, type: QueryTypes.SELECT },
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pareto" });
  }
};

const tendencia = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const fi = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ff = fecha_fin || new Date().toISOString().slice(0, 10);

  try {
    const data = await sequelize.query(
      `SELECT 
        DATE(p.inicio) as fecha,
        COUNT(p.id) as total_paros,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos
      FROM paros p
      WHERE p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fi
        AND DATE(p.inicio) <= :ff
      GROUP BY DATE(p.inicio)
      ORDER BY fecha ASC`,
      { replacements: { fi, ff }, type: QueryTypes.SELECT },
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener tendencia" });
  }
};

const resumen = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const fi = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ff = fecha_fin || new Date().toISOString().slice(0, 10);

  try {
    const [totales] = await sequelize.query(
      `SELECT 
        COUNT(p.id) as total_paros,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 3600, 1) as horas_perdidas,
        ROUND(AVG(p.duracion_segundos) / 60, 1) as duracion_promedio_min,
        ROUND(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0) as costo_total_perdido
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fi
        AND DATE(p.inicio) <= :ff`,
      { replacements: { fi, ff }, type: QueryTypes.SELECT },
    );

    const [maquinaCritica] = await sequelize.query(
      `SELECT m.nombre, SUM(p.duracion_segundos) as segundos,
       ROUND(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0) as costo_perdido
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fi
        AND DATE(p.inicio) <= :ff
      GROUP BY m.id, m.nombre
      ORDER BY segundos DESC
      LIMIT 1`,
      { replacements: { fi, ff }, type: QueryTypes.SELECT },
    );

    res.json({
      total_paros: totales.total_paros || 0,
      horas_perdidas: totales.horas_perdidas || 0,
      duracion_promedio_min: totales.duracion_promedio_min || 0,
      costo_total_perdido: totales.costo_total_perdido || 0,
      maquina_critica: maquinaCritica?.nombre || "—",
      costo_maquina_critica: maquinaCritica?.costo_perdido || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener resumen" });
  }
};

const pareto = async (req, res) => {
  const { fecha_inicio, fecha_fin, granularidad, linea } = req.query
  const fi = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const ff = fecha_fin || new Date().toISOString().slice(0, 10)

  try {
    const replacements = { fi, ff }
    let whereLinea = ''
    if (linea) {
      whereLinea = "AND m.linea = :linea"
      replacements.linea = linea
    }

    let sql = ''
    if (granularidad === 'hora') {
      sql = `SELECT mo.nombre, mo.color_hex, mo.categoria,
        DATE_FORMAT(p.inicio, '%Y-%m-%d %H:00') as periodo,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos,
        ROUND(SUM(p.duracion_segundos) / 3600 * m.costo_hora, 0) as costo_perdido
      FROM paros p
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL AND DATE(p.inicio) >= :fi AND DATE(p.inicio) <= :ff ${whereLinea}
      GROUP BY DATE_FORMAT(p.inicio, '%Y-%m-%d %H:00'), mo.id, mo.nombre, mo.color_hex, mo.categoria, m.costo_hora
      ORDER BY periodo ASC, minutos_perdidos DESC`
    } else if (granularidad === 'mes') {
      sql = `SELECT mo.nombre, mo.color_hex, mo.categoria,
        DATE_FORMAT(p.inicio, '%Y-%m') as periodo,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos,
        ROUND(SUM(p.duracion_segundos) / 3600 * m.costo_hora, 0) as costo_perdido
      FROM paros p
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL AND DATE(p.inicio) >= :fi AND DATE(p.inicio) <= :ff ${whereLinea}
      GROUP BY DATE_FORMAT(p.inicio, '%Y-%m'), mo.id, mo.nombre, mo.color_hex, mo.categoria, m.costo_hora
      ORDER BY periodo ASC, minutos_perdidos DESC`
    } else {
      sql = `SELECT mo.nombre, mo.color_hex, mo.categoria,
        DATE(p.inicio) as periodo,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos,
        ROUND(SUM(p.duracion_segundos) / 3600 * m.costo_hora, 0) as costo_perdido
      FROM paros p
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL AND DATE(p.inicio) >= :fi AND DATE(p.inicio) <= :ff ${whereLinea}
      GROUP BY DATE(p.inicio), mo.id, mo.nombre, mo.color_hex, mo.categoria, m.costo_hora
      ORDER BY periodo ASC, minutos_perdidos DESC`
    }

    const data = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT })
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener pareto' })
  }
}

const lineas = async (req, res) => {
  try {
    const data = await sequelize.query(
      `SELECT DISTINCT linea FROM maquinas 
       WHERE linea IS NOT NULL AND linea != '' AND activa = true
       ORDER BY linea`,
      { type: QueryTypes.SELECT },
    );
    res.json(data.map((d) => d.linea));
  } catch (error) {
    res.status(500).json({ error: "Error al obtener líneas" });
  }
};

const seriesTemporal = async (req, res) => {
  const { fecha_inicio, fecha_fin, granularidad, linea } = req.query
  const fi = fecha_inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const ff = fecha_fin || new Date().toISOString().slice(0, 10)

  try {
    let selectFecha, groupBy
    if (granularidad === 'hora') {
      selectFecha = `DATE_FORMAT(p.inicio, '%Y-%m-%d %H:00:00') as periodo`
      groupBy = `DATE_FORMAT(p.inicio, '%Y-%m-%d %H:00:00')`
    } else if (granularidad === 'mes') {
      selectFecha = `DATE_FORMAT(p.inicio, '%Y-%m-01') as periodo`
      groupBy = `DATE_FORMAT(p.inicio, '%Y-%m-01')`
    } else {
      selectFecha = `DATE(p.inicio) as periodo`
      groupBy = `DATE(p.inicio)`
    }

    let whereLinea = ''
    const replacements = { fi, ff }
    if (linea) {
      whereLinea = 'AND m.linea = :linea'
      replacements.linea = linea
    }

    const data = await sequelize.query(
      `SELECT
        ${selectFecha},
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos,
        ROUND(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0) as costo_perdido,
        ROUND(SUM(
          CASE WHEN m.linea = '3 - Sellado' AND m.unidades_por_minuto > 0
            THEN (p.duracion_segundos / 60) * m.unidades_por_minuto
            ELSE 0
          END
        ), 0) as unidades_no_producidas
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fi
        AND DATE(p.inicio) <= :ff
        ${whereLinea}
      GROUP BY ${groupBy}
      ORDER BY periodo ASC`,
      { replacements, type: QueryTypes.SELECT }
    )
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener series temporales' })
  }
}

const resumenSupervisor = async (req, res) => {
  const { linea, turno_inicio, turno_fin } = req.query
  if (!linea || !turno_inicio || !turno_fin) {
    return res.status(400).json({ error: 'Faltan parámetros' })
  }
  try {
    const [kpis] = await sequelize.query(
      `SELECT
        COUNT(p.id) as total_paros,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos,
        ROUND(COALESCE(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0), 0) as costo_perdido,
        ROUND(COALESCE(SUM(
          CASE WHEN m.linea = '3 - Sellado' AND m.unidades_por_minuto > 0
            THEN (p.duracion_segundos / 60) * m.unidades_por_minuto ELSE 0 END
        ), 0), 0) as unidades_no_producidas
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL
        AND m.linea = :linea
        AND p.inicio >= :turno_inicio
        AND p.inicio <= :turno_fin`,
      { replacements: { linea, turno_inicio, turno_fin }, type: QueryTypes.SELECT }
    )

    const maquinas = await sequelize.query(
      `SELECT
        m.id, m.nombre,
        COUNT(p.id) as total_paros,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos,
        ROUND(COALESCE(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0), 0) as costo_perdido,
        ROUND(GREATEST(0, 100 - (COALESCE(SUM(p.duracion_segundos), 0) /
          TIMESTAMPDIFF(SECOND, :turno_inicio, :turno_fin) * 100)), 1) as disponibilidad_pct
      FROM maquinas m
      LEFT JOIN paros p ON m.id = p.maquina_id
        AND p.fin IS NOT NULL
        AND p.inicio >= :turno_inicio
        AND p.inicio <= :turno_fin
      WHERE m.linea = :linea AND m.activa = true
      GROUP BY m.id, m.nombre
      ORDER BY minutos_perdidos DESC`,
      { replacements: { linea, turno_inicio, turno_fin }, type: QueryTypes.SELECT }
    )

    const motivos = await sequelize.query(
      `SELECT
        mo.nombre, mo.color_hex, mo.categoria,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos
      FROM paros p
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL
        AND m.linea = :linea
        AND p.inicio >= :turno_inicio
        AND p.inicio <= :turno_fin
      GROUP BY mo.id, mo.nombre, mo.color_hex, mo.categoria
      ORDER BY minutos_perdidos DESC`,
      { replacements: { linea, turno_inicio, turno_fin }, type: QueryTypes.SELECT }
    )

    const historial = await sequelize.query(
      `SELECT
        p.id, p.inicio, p.fin, p.duracion_segundos, p.observaciones,
        m.nombre as maquina_nombre, m.linea, m.costo_hora, m.unidades_por_minuto,
        mo.nombre as motivo_nombre, mo.color_hex, mo.categoria,
        u.nombre as operador_nombre,
        ROUND((p.duracion_segundos / 3600) * m.costo_hora, 0) as costo_perdido
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.fin IS NOT NULL
        AND m.linea = :linea
        AND p.inicio >= :turno_inicio
        AND p.inicio <= :turno_fin
      ORDER BY p.inicio DESC`,
      { replacements: { linea, turno_inicio, turno_fin }, type: QueryTypes.SELECT }
    )

    res.json({ kpis, maquinas, motivos, historial })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener resumen supervisor' })
  }
}

const resumenInicio = async (req, res) => {
  try {
    const ahora = new Date()
    const hoy = ahora.toISOString().slice(0, 10)
    const totalMin = ahora.getHours() * 60 + ahora.getMinutes()

    let turnoInicio, turnoFin, turnoNombre
    if (totalMin >= 330 && totalMin <= 809) {
      turnoNombre = 'Mañana'
      turnoInicio = new Date(ahora); turnoInicio.setHours(5, 30, 0, 0)
      turnoFin = new Date(ahora); turnoFin.setHours(13, 29, 59, 999)
    } else if (totalMin >= 810 && totalMin <= 1289) {
      turnoNombre = 'Tarde'
      turnoInicio = new Date(ahora); turnoInicio.setHours(13, 30, 0, 0)
      turnoFin = new Date(ahora); turnoFin.setHours(21, 29, 59, 999)
    } else {
      turnoNombre = 'Noche'
      turnoInicio = new Date(ahora)
      if (totalMin >= 1290) { turnoInicio.setHours(21, 30, 0, 0) }
      else { turnoInicio.setDate(turnoInicio.getDate() - 1); turnoInicio.setHours(21, 30, 0, 0) }
      turnoFin = new Date(ahora)
      if (totalMin < 330) { turnoFin.setHours(5, 29, 59, 999) }
      else { turnoFin.setDate(turnoFin.getDate() + 1); turnoFin.setHours(5, 29, 59, 999) }
    }

    const toLocalISO = (d) => {
      const offset = d.getTimezoneOffset()
      const local = new Date(d.getTime() - offset * 60000)
      return local.toISOString().slice(0, 19).replace('T', ' ')
    }
    const ti = toLocalISO(turnoInicio)
    const tf = toLocalISO(turnoFin)

    const maquinasEstado = await sequelize.query(
      `SELECT
        COUNT(DISTINCT m.id) as total_maquinas,
        COUNT(DISTINCT p.maquina_id) as maquinas_paradas
      FROM maquinas m
      LEFT JOIN paros p ON m.id = p.maquina_id AND p.fin IS NULL
      WHERE m.activa = true`,
      { type: QueryTypes.SELECT }
    )

    const disponibilidadTurno = await sequelize.query(
      `SELECT
        ROUND(GREATEST(0, 100 - (COALESCE(SUM(p.duracion_segundos), 0) /
          (TIMESTAMPDIFF(SECOND, :ti, :tf) * COUNT(DISTINCT m.id) + 1) * 100)), 1) as disponibilidad_pct,
        COUNT(p.id) as total_paros,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos,
        ROUND(COALESCE(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0), 0) as costo_perdido
      FROM maquinas m
      LEFT JOIN paros p ON m.id = p.maquina_id
        AND p.fin IS NOT NULL
        AND p.inicio >= :ti
        AND p.inicio <= :tf
      WHERE m.activa = true`,
      { replacements: { ti, tf }, type: QueryTypes.SELECT }
    )

    const parosActivos = await sequelize.query(
      `SELECT p.id, p.inicio,
        m.nombre as maquina_nombre, m.linea,
        mo.nombre as motivo_nombre, mo.color_hex, mo.categoria,
        u.nombre as operador_nombre,
        TIMESTAMPDIFF(MINUTE, p.inicio, NOW()) as minutos_transcurridos,
        ROUND((TIMESTAMPDIFF(SECOND, p.inicio, NOW()) / 3600) * m.costo_hora, 0) as costo_acumulado
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.fin IS NULL
      ORDER BY p.inicio ASC`,
      { type: QueryTypes.SELECT }
    )

    const topMotivos = await sequelize.query(
      `SELECT mo.nombre, mo.color_hex,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos
      FROM paros p
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      JOIN maquinas m ON p.maquina_id = m.id
      WHERE p.fin IS NOT NULL
        AND p.inicio >= :ti AND p.inicio <= :tf
      GROUP BY mo.id, mo.nombre, mo.color_hex
      ORDER BY minutos_perdidos DESC
      LIMIT 3`,
      { replacements: { ti, tf }, type: QueryTypes.SELECT }
    )

    const ultimosParos = await sequelize.query(
      `SELECT p.inicio, p.fin, p.duracion_segundos,
        m.nombre as maquina_nombre, m.linea,
        mo.nombre as motivo_nombre, mo.color_hex,
        ROUND((p.duracion_segundos / 3600) * m.costo_hora, 0) as costo_perdido
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      WHERE p.fin IS NOT NULL AND DATE(p.inicio) = :hoy
      ORDER BY p.fin DESC
      LIMIT 5`,
      { replacements: { hoy }, type: QueryTypes.SELECT }
    )

    const estado = maquinasEstado[0] || { total_maquinas: 0, maquinas_paradas: 0 }
    const turno = disponibilidadTurno[0] || { disponibilidad_pct: 0, total_paros: 0, minutos_perdidos: 0, costo_perdido: 0 }

    res.json({
      turnoNombre,
      maquinas_operando: (estado.total_maquinas - estado.maquinas_paradas),
      maquinas_paradas: estado.maquinas_paradas,
      total_maquinas: estado.total_maquinas,
      disponibilidad_pct: Math.max(0, turno.disponibilidad_pct || 0),
      total_paros_turno: turno.total_paros || 0,
      minutos_perdidos_turno: turno.minutos_perdidos || 0,
      costo_perdido_turno: turno.costo_perdido || 0,
      paros_activos: parosActivos,
      top_motivos: topMotivos,
      ultimos_paros: ultimosParos
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener resumen de inicio' })
  }
}

const oee = async (req, res) => {
  const { fecha_inicio, fecha_fin, linea } = req.query
  try {
    const fechaInicioFinal = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const fechaFinFinal = fecha_fin || new Date().toISOString().slice(0, 10)
    const dias = Math.max(1, Math.ceil((new Date(fechaFinFinal) - new Date(fechaInicioFinal)) / (1000 * 60 * 60 * 24)) + 1)
    const minutosTurno = 480
    const replacements = { fecha_inicio: fechaInicioFinal, fecha_fin: fechaFinFinal }
    let whereLinea = ''
    if (linea) { whereLinea = 'AND m.linea = :linea'; replacements.linea = linea }

    const maquinasOEE = await sequelize.query(
      `SELECT 
        m.id, m.nombre, m.linea,
        COUNT(p.id) as total_paros,
        COALESCE(SUM(p.duracion_segundos), 0) as segundos_perdidos,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos,
        ROUND(COALESCE(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0), 0) as costo_perdido,
        :minutos_turno * :dias as minutos_planificados,
        ROUND(GREATEST(0,
          ((:minutos_turno * :dias - COALESCE(SUM(p.duracion_segundos), 0) / 60) / (:minutos_turno * :dias)) * 100
        ), 1) as disponibilidad_pct
      FROM maquinas m
      LEFT JOIN paros p ON p.maquina_id = m.id
        AND p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fecha_inicio
        AND DATE(p.inicio) <= :fecha_fin
      WHERE m.activa = 1 ${whereLinea}
      GROUP BY m.id, m.nombre, m.linea
      ORDER BY disponibilidad_pct ASC`,
      { replacements: { ...replacements, minutos_turno: minutosTurno, dias }, type: QueryTypes.SELECT }
    )

    const lineasOEE = await sequelize.query(
      `SELECT 
        m.linea,
        COUNT(DISTINCT m.id) as total_maquinas,
        COUNT(p.id) as total_paros,
        ROUND(COALESCE(SUM(p.duracion_segundos), 0) / 60, 1) as minutos_perdidos,
        ROUND(COALESCE(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0), 0) as costo_perdido,
        ROUND(GREATEST(0,
          ((:minutos_turno * :dias * COUNT(DISTINCT m.id) - COALESCE(SUM(p.duracion_segundos), 0) / 60) 
          / (:minutos_turno * :dias * COUNT(DISTINCT m.id))) * 100
        ), 1) as disponibilidad_pct
      FROM maquinas m
      LEFT JOIN paros p ON p.maquina_id = m.id
        AND p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fecha_inicio
        AND DATE(p.inicio) <= :fecha_fin
      WHERE m.activa = 1 AND m.linea IS NOT NULL ${whereLinea}
      GROUP BY m.linea
      ORDER BY disponibilidad_pct ASC`,
      { replacements: { ...replacements, minutos_turno: minutosTurno, dias }, type: QueryTypes.SELECT }
    )

    const topMotivos = await sequelize.query(
      `SELECT 
        mo.nombre, mo.color_hex, mo.categoria,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos,
        ROUND(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0) as costo_perdido
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      WHERE p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fecha_inicio
        AND DATE(p.inicio) <= :fecha_fin
        ${whereLinea}
      GROUP BY mo.id, mo.nombre, mo.color_hex, mo.categoria
      ORDER BY minutos_perdidos DESC
      LIMIT 8`,
      { replacements, type: QueryTypes.SELECT }
    )

    const parosPorMaquinaMotivo = await sequelize.query(
      `SELECT 
        m.nombre as maquina, m.linea,
        mo.nombre as motivo, mo.categoria,
        COUNT(p.id) as total_paros,
        ROUND(SUM(p.duracion_segundos) / 60, 1) as minutos_perdidos,
        ROUND(SUM((p.duracion_segundos / 3600) * m.costo_hora), 0) as costo_perdido,
        ROUND(AVG(p.duracion_segundos) / 60, 1) as duracion_promedio_min
      FROM paros p
      JOIN maquinas m ON p.maquina_id = m.id
      JOIN motivos_paro mo ON p.motivo_id = mo.id
      WHERE p.fin IS NOT NULL
        AND DATE(p.inicio) >= :fecha_inicio
        AND DATE(p.inicio) <= :fecha_fin
        ${whereLinea}
      GROUP BY m.id, mo.id
      ORDER BY costo_perdido DESC
      LIMIT 30`,
      { replacements, type: QueryTypes.SELECT }
    )

    const totalMaquinas = maquinasOEE.length
    const oeeGlobal = totalMaquinas > 0
      ? Math.round(maquinasOEE.reduce((acc, m) => acc + Math.max(0, m.disponibilidad_pct), 0) / totalMaquinas * 10) / 10
      : 0

    res.json({
      periodo: { fecha_inicio: fechaInicioFinal, fecha_fin: fechaFinFinal, dias },
      oee_global: oeeGlobal,
      maquinas: maquinasOEE,
      lineas: lineasOEE,
      top_motivos: topMotivos,
      paros_por_maquina_motivo: parosPorMaquinaMotivo
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al calcular OEE' })
  }
}

module.exports = { resumen, paretoMotivos, disponibilidad, pareto, tendencia, lineas, seriesTemporal, resumenSupervisor, resumenInicio, oee }