export default function BeaverLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="24" cy="24" r="24" fill="#312783" />

      {/* Beaver head — abstract geometric */}
      <ellipse cx="24" cy="22" rx="12" ry="11" fill="#F39200" />

      {/* Ears */}
      <circle cx="15" cy="13" r="4" fill="#F39200" />
      <circle cx="33" cy="13" r="4" fill="#F39200" />
      <circle cx="15" cy="13" r="2.2" fill="#d17e00" />
      <circle cx="33" cy="13" r="2.2" fill="#d17e00" />

      {/* Face lighter area */}
      <ellipse cx="24" cy="24" rx="8" ry="7" fill="#f5a623" />

      {/* Eyes — simple dots */}
      <circle cx="20" cy="20" r="2" fill="#312783" />
      <circle cx="28" cy="20" r="2" fill="#312783" />
      <circle cx="20.5" cy="19.5" r="0.6" fill="white" />
      <circle cx="28.5" cy="19.5" r="0.6" fill="white" />

      {/* Nose */}
      <ellipse cx="24" cy="24" rx="2.5" ry="1.8" fill="#231b6b" />

      {/* Teeth — minimal */}
      <rect x="22.5" y="26" width="1.4" height="2.5" rx="0.5" fill="white" />
      <rect x="24.2" y="26" width="1.4" height="2.5" rx="0.5" fill="white" />

      {/* Flask — abstract, small, bottom right */}
      <g transform="translate(32, 30) scale(0.8)">
        <path d="M2 0 L5 0 L5 5 L8 12 L-1 12 L2 5 Z" fill="white" opacity="0.9" />
        <rect x="2" y="-2" width="3" height="3" rx="0.5" fill="white" opacity="0.9" />
        <path d="M0 9 L7 9 L8 12 L-1 12 Z" fill="#4a3a9f" opacity="0.7" />
      </g>

      {/* Tail — flat geometric */}
      <ellipse cx="24" cy="40" rx="8" ry="2.5" fill="#d17e00" />
      <line x1="18" y1="40" x2="30" y2="40" stroke="#231b6b" strokeWidth="0.3" opacity="0.3" />
      <line x1="19" y1="38.5" x2="29" y2="38.5" stroke="#231b6b" strokeWidth="0.3" opacity="0.3" />
      <line x1="19" y1="41.5" x2="29" y2="41.5" stroke="#231b6b" strokeWidth="0.3" opacity="0.3" />
    </svg>
  )
}
