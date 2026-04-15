export default function BeaverLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#312783"/>
      {/* Tail */}
      <ellipse cx="7" cy="37" rx="7.5" ry="3.5" fill="#8B6914" transform="rotate(-10 7 37)"/>
      <line x1="2" y1="36" x2="12" y2="36" stroke="#6B4F10" strokeWidth="0.4" opacity="0.4"/>
      <line x1="2.5" y1="37.5" x2="11.5" y2="37.5" stroke="#6B4F10" strokeWidth="0.4" opacity="0.4"/>
      {/* Body */}
      <ellipse cx="20" cy="32" rx="11" ry="9" fill="#F39200"/>
      <ellipse cx="20" cy="34" rx="7" ry="5.5" fill="#f5a623"/>
      {/* Head */}
      <ellipse cx="25" cy="19" rx="10.5" ry="9.5" fill="#F39200"/>
      {/* Cheek/snout */}
      <ellipse cx="32" cy="22" rx="4" ry="3" fill="#f5a623"/>
      {/* Ear */}
      <circle cx="17" cy="11" r="3.5" fill="#d17e00"/>
      <circle cx="17" cy="11" r="1.8" fill="#f5a623"/>
      {/* Nose */}
      <ellipse cx="34" cy="21" rx="1.6" ry="1.1" fill="#231b6b"/>
      {/* Goggles */}
      <path d="M15 19.5 Q21 17 29 19 Q32 18.5 35 20.5" stroke="white" strokeWidth="1" fill="none" opacity="0.45"/>
      <ellipse cx="30" cy="19.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="0.8"/>
      {/* Eye */}
      <ellipse cx="30" cy="19.5" rx="2.3" ry="2.6" fill="white"/>
      <circle cx="31" cy="19.5" r="1.7" fill="#312783"/>
      <circle cx="31.5" cy="18.8" r="0.55" fill="white"/>
      {/* Teeth */}
      <rect x="32" y="24" width="1" height="1.6" rx="0.3" fill="white"/>
      <rect x="33.2" y="24" width="1" height="1.6" rx="0.3" fill="white"/>
      {/* Feet */}
      <ellipse cx="16" cy="41" rx="3" ry="1.2" fill="#d17e00"/>
      <ellipse cx="24" cy="41" rx="3" ry="1.2" fill="#d17e00"/>
      {/* Pipette behind arm (drawn first) — 30° up-right */}
      <g transform="translate(39, 27) rotate(30)">
        <rect x="-0.8" y="-2.5" width="1.6" height="2.5" rx="0.8" fill="#94a3b8"/>
        <rect x="-1.5" y="0" width="3" height="8" rx="1.5" fill="#e2e8f0"/>
        <rect x="-1.8" y="3" width="3.6" height="0.9" rx="0.3" fill="#cbd5e1"/>
        <rect x="-0.4" y="1" width="0.8" height="1.3" rx="0.2" fill="white"/>
        <rect x="-0.5" y="8" width="1" height="3.5" rx="0.25" fill="#cbd5e1"/>
        <path d="M-0.3 11.5 L0.3 11.5 L0.08 16 L-0.08 16 Z" fill="white" opacity="0.75"/>
        <ellipse cx="0" cy="16.5" rx="0.35" ry="0.5" fill="#4a3a9f" opacity="0.6"/>
      </g>
      {/* Arm in FRONT — from body going right, lower position */}
      <path d="M30 30 Q34 28 38 27" stroke="#d17e00" strokeWidth="3" strokeLinecap="round" fill="none"/>
      {/* Paw gripping pipette */}
      <circle cx="38.5" cy="26.5" r="2" fill="#d17e00"/>
    </svg>
  )
}
