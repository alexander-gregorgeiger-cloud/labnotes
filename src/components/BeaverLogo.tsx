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
      {/* Goggle strap - going back from face */}
      <path d="M10 18.5 Q15 16 21 17.5 Q26 17 30 19.5" stroke="white" strokeWidth="1.2" fill="none" opacity="0.6"/>
      {/* Goggle lens - more forward on face, closer to snout */}
      <ellipse cx="24" cy="18.5" rx="4.5" ry="3.2" fill="rgba(255,255,255,0.12)" stroke="white" strokeWidth="0.9"/>
      {/* Big expressive eye behind goggle */}
      <ellipse cx="24" cy="18.5" rx="2.5" ry="2.8" fill="white"/>
      <circle cx="25" cy="18.5" r="1.8" fill="#312783"/>
      <circle cx="25.5" cy="17.8" r="0.6" fill="white"/>
      {/* Smile */}
      <path d="M26 24.5 Q28 26 30 25" stroke="#d17e00" strokeWidth="0.5" fill="none"/>
      {/* Teeth */}
      <rect x="27" y="24.5" width="1" height="1.6" rx="0.3" fill="white"/>
      <rect x="28.2" y="24.5" width="1" height="1.6" rx="0.3" fill="white"/>
      {/* Arm reaching up to pipette top */}
      <ellipse cx="31" cy="24" rx="2.5" ry="1.3" fill="#d17e00" transform="rotate(-40 31 24)"/>
      {/* Paw gripping near top of handle */}
      <circle cx="34" cy="21" r="2" fill="#d17e00"/>
      {/* Eppendorf pipette - paw at top grip area */}
      <g transform="translate(35.5, 13) rotate(6)">
        {/* Plunger button */}
        <rect x="-1" y="-3" width="2" height="3" rx="1" fill="#94a3b8"/>
        {/* Handle/grip body */}
        <rect x="-2" y="0" width="4" height="9" rx="2" fill="#e2e8f0"/>
        {/* Finger hook */}
        <rect x="-2.5" y="3.5" width="5" height="1.2" rx="0.4" fill="#cbd5e1"/>
        {/* Volume window */}
        <rect x="-0.6" y="1.5" width="1.2" height="2" rx="0.3" fill="white"/>
        {/* Lower shaft */}
        <rect x="-0.8" y="9" width="1.6" height="4" rx="0.4" fill="#cbd5e1"/>
        {/* Tip ejector */}
        <rect x="-2" y="8.5" width="1.5" height="1" rx="0.3" fill="#94a3b8"/>
        {/* Pipette tip */}
        <path d="M-0.5 13 L0.5 13 L0.1 18 L-0.1 18 Z" fill="white" opacity="0.85"/>
        {/* Liquid drop */}
        <ellipse cx="0" cy="19" rx="0.5" ry="0.7" fill="#4a3a9f" opacity="0.7"/>
      </g>
      {/* Tail */}
      <ellipse cx="9" cy="39" rx="6" ry="1.8" fill="#d17e00"/>
      {/* Feet */}
      <ellipse cx="16" cy="41" rx="2.5" ry="1" fill="#d17e00"/>
      <ellipse cx="24" cy="41" rx="2.5" ry="1" fill="#d17e00"/>
    </svg>
  )
}
