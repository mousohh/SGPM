let audioCtx = null
let alarmaInterval = null
let alarmaActiva = false

const getCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export const sonarAlerta = (tipo = 'paro') => {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (tipo === 'paro') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } else if (tipo === 'critico') {
      osc.frequency.setValueAtTime(1100, ctx.currentTime)
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.12)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.24)
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.36)
      gain.gain.setValueAtTime(0.5, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    }
  } catch (e) {
    console.warn('Audio no disponible:', e)
  }
}

export const hablarParo = (maquinaNombre, motivoNombre) => {
  try {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const msg = new SpeechSynthesisUtterance(
      `Paro registrado. Máquina ${maquinaNombre}. Motivo: ${motivoNombre}`
    )
    msg.lang = 'es-CO'
    msg.rate = 0.95
    msg.pitch = 1
    msg.volume = 1
    window.speechSynthesis.speak(msg)
  } catch (e) {
    console.warn('Voz no disponible:', e)
  }
}

const sonarUnCicloAlarma = () => {
  try {
    const ctx = getCtx()
  
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.4
      osc.frequency.setValueAtTime(1200, t)
      osc.frequency.setValueAtTime(900, t + 0.15)
      gain.gain.setValueAtTime(0.6, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.3)
    }
  } catch (e) {
    console.warn('Audio no disponible:', e)
  }
}

export const iniciarAlarma = (maquinaNombre, motivoNombre) => {
  if (alarmaActiva) return
  alarmaActiva = true

  sonarUnCicloAlarma()
  hablarParo(maquinaNombre, `${motivoNombre}, lleva demasiado tiempo sin cerrar`)

  alarmaInterval = setInterval(() => {
    sonarUnCicloAlarma()
  }, 8000)
}

export const detenerAlarma = () => {
  alarmaActiva = false
  if (alarmaInterval) {
    clearInterval(alarmaInterval)
    alarmaInterval = null
  }
  try { window.speechSynthesis?.cancel() } catch (e) {}
}

export const alarmaEstaActiva = () => alarmaActiva