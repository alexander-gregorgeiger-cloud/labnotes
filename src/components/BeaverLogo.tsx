export default function BeaverLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#312783"/>
      {/* Body */}
      <ellipse cx="20" cy="33" rx="11" ry="8" fill="#F39200"/>
      <ellipse cx="20" cy="35" rx="7" ry="5" fill="#f5a623"/>
      {/* Head */}
      <ellipse cx="20" cy="19" rx="10.5" ry="10" fill="#F39200"/>
      {/* Ear */}
      <circle cx="12" cy="11" r="3.5" fill="#d17e00"/>
      <circle cx="12" cy="11" r="1.8" fill="#f5a623"/>
      {/* Snout */}
      <ellipse cx="28" cy="22" rx="4.5" ry="3" fill="#f5a623"/>
      <ellipse cx="30.5" cy="21" rx="1.8" ry="1.2" fill="#231b6b"/>
      {/* Goggle strap */}
      <path d="M10 20 Q16 17 24 19 Q28 18.5 31 21" stroke="white" strokeWidth="1.2" fill="none" opacity="0.55"/>
      {/* Goggle lens — far forward, sitting on the snout bridge */}
      <ellipse cx="26" cy="19.5" rx="4.5" ry="3.2" fill="rgba(255,255,255,0.13)" stroke="white" strokeWidth="0.9"/>
      {/* Eye behind goggle */}
      <ellipse cx="26" cy="19.5" rx="2.5" ry="2.8" fill="white"/>
      <circle cx="27" cy="19.5" r="1.8" fill="#312783"/>
      <circle cx="27.5" cy="18.8" r="0.6" fill="white"/>
      {/* Smile */}
      <path d="M27 25 Q29 26.5 31 25.5" stroke="#d17e00" strokeWidth="0.5" fill="none"/>
      {/* Teeth */}
      <rect x="27.5" y="25" width="1" height="1.6" rx="0.3" fill="white"/>
      <rect x="28.7" y="25" width="1" height="1.6" rx="0.3" fill="white"/>
      {/* Arm reaching up high to pipette top */}
      <ellipse cx="32" cy="22" rx="2.5" ry="1.2" fill="#d17e00" transform="rotate(-45 32 22)"/>
      {/* Paw gripping at the very top of the handle, near plunger */}
      <circle cx="35" cy="18" r="2" fill="#d17e00"/>
      {/* Eppendorf pipette — paw at top */}
      <g transform="translate(36.5, 10) rotate(6)">
        {/* Plunger button */}
        <rect x="-1" y="-3.5" width="2" height="3.5" rx="1" fill="#94a3b8"/>
        {/* Handle/grip body */}
        <rect x="-2" y="0" width="4" height="10" rx="2" fill="#e2e8f0"/>
        {/* Finger hook */}
        <rect x="-2.5" y="4" width="5" height="1.2" rx="0.4" fill="#cbd5e1"/>
        {/* Volume window */}
        <rect x="-0.6" y="1.5" width="1.2" height="2.2" rx="0.3" fill="white"/>
        {/* Lower shaft */}
        <rect x="-0.8" y="10" width="1.6" height="4.5" rx="0.4" fill="#cbd5e1"/>
        {/* Tip ejector */}
        <rect x="-2" y="9.5" width="1.5" height="1" rx="0.3" fill="#94a3b8"/>
        {/* Pipette tip */}
        <path d="M-0.5 14.5 L0.5 14.5 L0.1 20 L-0.1 20 Z" fill="white" opacity="0.85"/>
        {/* Liquid drop */}
        <ellipse cx="0" cy="21" rx="0.5" ry="0.7" fill="#4a3a9f" opacity="0.7"/>
      </g>
      {/* Tail */}
      <ellipse cx="9" cy="39" rx="6" ry="1.8" fill="#d17e00"/>
      {/* Feet */}
      <ellipse cx="16" cy="41" rx="2.5" ry="1" fill="#d17e00"/>
      <ellipse cx="24" cy="41" rx="2.5" ry="1" fill="#d17e00"/>
    </svg>
  )
}
