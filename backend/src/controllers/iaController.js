const Groq = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function tryParseJSON(text) {
  try { return { ok: true, data: JSON.parse(text) } } catch {}
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    try { return { ok: true, data: JSON.parse(text.slice(first, last + 1)) } } catch {}
  }
  return { ok: false, raw: text }
}

function validarDatos(datos) {
  const faltantes = []
  if (!datos || typeof datos !== 'object') faltantes.push('datos')
  if (!Array.isArray(datos?.maquinas)) faltantes.push('maquinas')
  if (!Array.isArray(datos?.top_motivos)) faltantes.push('top_motivos')
  if (!Array.isArray(datos?.paros_por_maquina_motivo)) faltantes.push('paros_por_maquina_motivo')
  if (faltantes.length) {
    const e = new Error(`Payload inválido: ${faltantes.join(', ')}`)
    e.status = 400
    throw e
  }
}

const analizarOEE = async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Falta GROQ_API_KEY en el servidor' })
    }

    const { datos } = req.body
    validarDatos(datos)

    const resumen = {
      dias: Number(datos.periodo?.dias) || 0,
      oee: datos.oee_global,
      maquinas: datos.maquinas.slice(0, 5).map(m => ({
        nombre: m.nombre, linea: m.linea, disponibilidad: m.disponibilidad_pct,
        paros: m.total_paros, minutos: Math.round(m.minutos_perdidos || 0),
        costo: Math.round(m.costo_perdido || 0)
      })),
      motivos: datos.top_motivos.slice(0, 5).map(mo => ({
        nombre: mo.nombre, categoria: mo.categoria,
        paros: mo.total_paros, minutos: Math.round(mo.minutos_perdidos || 0),
        costo: Math.round(mo.costo_perdido || 0)
      })),
      detalle: datos.paros_por_maquina_motivo.slice(0, 10).map(p => ({
        maquina: p.maquina, linea: p.linea, motivo: p.motivo,
        paros: p.total_paros, costo: Math.round(p.costo_perdido || 0),
        duracion_prom_min: p.duracion_promedio_min
      }))
    }

    const prompt = `Eres un experto en mantenimiento industrial y OEE para plantas de producción de empaques plásticos. Analiza los datos y genera recomendaciones accionables en español.

PERÍODO: ${resumen.dias} días | OEE GLOBAL: ${resumen.oee}%
MÁQUINAS: ${JSON.stringify(resumen.maquinas)}
MOTIVOS: ${JSON.stringify(resumen.motivos)}
DETALLE: ${JSON.stringify(resumen.detalle)}

Responde ÚNICAMENTE con JSON válido sin markdown ni texto adicional con esta estructura exacta:
{"resumen_ejecutivo":"string","nivel_oee":"string","causas_raiz":[{"maquina":"string","linea":"string","causa_probable":"string","evidencia":"string","impacto_cop":0}],"plan_accion":[{"prioridad":1,"accion":"string","maquina_o_area":"string","tipo":"mantenimiento_preventivo","plazo":"inmediato","impacto_esperado":"string","ahorro_estimado_cop":0}],"recomendaciones_mantenimiento":[{"equipo":"string","recomendacion":"string","frecuencia":"semanal","justificacion":"string"}],"alertas_criticas":["string"]}`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1500
    })

    const texto = completion.choices[0]?.message?.content?.replace(/```json|```/g, '').trim() || ''
    const parsed = tryParseJSON(texto)

    if (parsed.ok) {
      return res.json(parsed.data)
    } else {
      return res.status(422).json({ error: 'La IA no devolvió JSON válido', raw: parsed.raw })
    }
  } catch (error) {
    console.error('[IA analizarOEE] ERROR:', error?.message || error)
    return res.status(500).json({ error: error?.message || 'Error interno' })
  }
}

module.exports = { analizarOEE }