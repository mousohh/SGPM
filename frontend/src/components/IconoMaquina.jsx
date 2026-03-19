// Componente compartido — copiar a frontend/src/components/IconoMaquina.jsx

export default function IconoMaquina({ nombre, enParo = false }) {
  const n = nombre?.toLowerCase() || ''
  const color = enParo ? '#ef4444' : '#22c55e'
  const colorClaro = enParo ? '#fca5a5' : '#86efac'
  const colorOscuro = enParo ? '#b91c1c' : '#15803d'

  if (n.includes('extrus')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="5" y="25" width="60" height="30" rx="4" fill={color} />
      <rect x="60" y="33" width="30" height="14" rx="2" fill={colorOscuro} />
      <rect x="88" y="36" width="22" height="8" rx="1" fill={colorClaro} />
      <circle cx="20" cy="20" r="8" fill={colorOscuro} />
      <circle cx="20" cy="20" r="4" fill={colorClaro} />
      <rect x="10" y="55" width="12" height="15" rx="2" fill={colorOscuro} />
      <rect x="38" y="55" width="12" height="15" rx="2" fill={colorOscuro} />
      {enParo
        ? <circle cx="100" cy="40" r="5" fill="#fbbf24" opacity="0.9"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="1s" repeatCount="indefinite"/></circle>
        : <circle cx="100" cy="40" r="4" fill="#fbbf24" />
      }
    </svg>
  )

  if (n.includes('sella')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="10" y="15" width="100" height="20" rx="3" fill={color} />
      <rect x="10" y="45" width="100" height="20" rx="3" fill={colorOscuro} />
      <rect x="40" y="35" width="40" height="10" rx="1" fill={colorClaro} />
      <rect x="20" y="10" width="8" height="10" rx="1" fill={colorOscuro} />
      <rect x="92" y="10" width="8" height="10" rx="1" fill={colorOscuro} />
      <rect x="20" y="65" width="8" height="10" rx="1" fill={colorOscuro} />
      <rect x="92" y="65" width="8" height="10" rx="1" fill={colorOscuro} />
      {enParo && <rect x="40" y="37" width="40" height="6" rx="1" fill="#fbbf24" opacity="0.7"><animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.8s" repeatCount="indefinite"/></rect>}
    </svg>
  )

  if (n.includes('impres')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="15" y="30" width="90" height="35" rx="4" fill={color} />
      <rect x="25" y="15" width="70" height="20" rx="3" fill={colorOscuro} />
      <rect x="35" y="52" width="50" height="8" rx="1" fill={colorClaro} />
      <rect x="45" y="60" width="30" height="12" rx="1" fill="white" opacity="0.8" />
      <circle cx="95" cy="38" r="4" fill="#fbbf24" />
    </svg>
  )

  if (n.includes('cort')) return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="10" y="20" width="100" height="40" rx="4" fill={color} />
      <rect x="20" y="35" width="80" height="10" rx="1" fill={colorClaro} />
      <polygon points="55,25 65,25 60,55" fill={colorOscuro} />
      <rect x="15" y="60" width="15" height="10" rx="2" fill={colorOscuro} />
      <rect x="90" y="60" width="15" height="10" rx="2" fill={colorOscuro} />
    </svg>
  )

  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <rect x="15" y="20" width="90" height="45" rx="6" fill={color} />
      <circle cx="35" cy="42" r="12" fill={colorOscuro} />
      <circle cx="35" cy="42" r="6" fill={colorClaro} />
      <rect x="55" y="30" width="40" height="8" rx="2" fill={colorOscuro} />
      <rect x="55" y="44" width="30" height="8" rx="2" fill={colorOscuro} />
      <rect x="25" y="65" width="15" height="8" rx="2" fill={colorOscuro} />
      <rect x="80" y="65" width="15" height="8" rx="2" fill={colorOscuro} />
      {enParo && <circle cx="95" cy="28" r="5" fill="#fbbf24"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/></circle>}
    </svg>
  )
}