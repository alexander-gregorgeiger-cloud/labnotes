export default function BeaverLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="50" cy="62" rx="28" ry="24" fill="#8B6914" />
      {/* Belly */}
      <ellipse cx="50" cy="66" rx="18" ry="16" fill="#D4A54A" />
      {/* Head */}
      <circle cx="50" cy="36" r="22" fill="#A07818" />
      {/* Ears */}
      <circle cx="32" cy="20" r="8" fill="#8B6914" />
      <circle cx="32" cy="20" r="5" fill="#D4A54A" />
      <circle cx="68" cy="20" r="8" fill="#8B6914" />
      <circle cx="68" cy="20" r="5" fill="#D4A54A" />
      {/* Face - white area */}
      <ellipse cx="50" cy="40" rx="14" ry="12" fill="#E8D5A0" />
      {/* Eyes */}
      <circle cx="42" cy="33" r="4" fill="white" />
      <circle cx="58" cy="33" r="4" fill="white" />
      <circle cx="43" cy="33" r="2.5" fill="#1E293B" />
      <circle cx="59" cy="33" r="2.5" fill="#1E293B" />
      <circle cx="43.8" cy="32" r="0.8" fill="white" />
      <circle cx="59.8" cy="32" r="0.8" fill="white" />
      {/* Nose */}
      <ellipse cx="50" cy="39" rx="4" ry="3" fill="#5C3D0E" />
      {/* Teeth */}
      <rect x="47" y="43" width="3" height="5" rx="1" fill="white" stroke="#D4A54A" strokeWidth="0.5" />
      <rect x="50.5" y="43" width="3" height="5" rx="1" fill="white" stroke="#D4A54A" strokeWidth="0.5" />
      {/* Cheeks */}
      <circle cx="36" cy="40" r="4" fill="#E8A0A0" opacity="0.3" />
      <circle cx="64" cy="40" r="4" fill="#E8A0A0" opacity="0.3" />
      {/* Lab coat / collar */}
      <path d="M30 55 Q35 50 42 52 L42 58 Q36 56 30 58 Z" fill="white" opacity="0.9" />
      <path d="M70 55 Q65 50 58 52 L58 58 Q64 56 70 58 Z" fill="white" opacity="0.9" />
      {/* Flask held by beaver */}
      <g transform="translate(62, 58) rotate(15)">
        {/* Flask body */}
        <path d="M0 0 L3 0 L3 8 L8 18 L-5 18 L0 8 Z" fill="#C8E6FF" stroke="#312783" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Flask neck */}
        <rect x="0" y="-3" width="3" height="4" rx="0.5" fill="#C8E6FF" stroke="#312783" strokeWidth="1.2" />
        {/* Liquid */}
        <path d="M-3 14 L6 14 L8 18 L-5 18 Z" fill="#312783" opacity="0.5" />
        {/* Bubbles */}
        <circle cx="2" cy="12" r="1" fill="#312783" opacity="0.3" />
        <circle cx="4" cy="15" r="0.7" fill="#312783" opacity="0.3" />
      </g>
      {/* Tail */}
      <ellipse cx="50" cy="88" rx="14" ry="5" fill="#6B4F10" />
      {/* Tail pattern */}
      <line x1="40" y1="88" x2="60" y2="88" stroke="#5C3D0E" strokeWidth="0.5" opacity="0.3" />
      <line x1="42" y1="86" x2="58" y2="86" stroke="#5C3D0E" strokeWidth="0.5" opacity="0.3" />
      <line x1="42" y1="90" x2="58" y2="90" stroke="#5C3D0E" strokeWidth="0.5" opacity="0.3" />
      {/* Safety goggles on head */}
      <path d="M38 30 Q40 28 44 29 Q46 28 50 28 Q54 28 56 29 Q60 28 62 30" stroke="#312783" strokeWidth="1.5" fill="none" opacity="0.6" />
    </svg>
  )
}
