import React from 'react';
import type { EngineeringDiagramKind } from './engineeringTypes.ts';

interface EngineeringDiagramSvgProps {
  kind: EngineeringDiagramKind;
  title?: string;
}

export const EngineeringDiagramSvg: React.FC<EngineeringDiagramSvgProps> = ({ kind, title }) => {
  return (
    <div className="rounded-xl bg-[#040914] border border-cyan-500/30 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono-tech text-[10px] uppercase tracking-wider text-cyan-300">
          CAD Technical Schematic
        </span>
        {title && (
          <span className="font-mono-tech text-[10px] text-slate-400 truncate max-w-[180px]">
            {title}
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 320 140"
        className="w-full h-32 rounded-lg bg-[#071022]"
        role="img"
        aria-label={title ? `${title} technical schematic` : 'Engineering component schematic'}
      >
        <defs>
          <pattern id={`grid-${kind}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(56,189,248,0.09)" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width="320" height="140" fill={`url(#grid-${kind})`} />

        {kind === 'engine-block' && (
          <g stroke="#38BDF8" strokeWidth="1.6" fill="none">
            <rect x="44" y="34" width="232" height="72" rx="6" fill="rgba(15,23,42,0.85)" />
            {[78, 128, 178, 228].map((cx, i) => (
              <g key={cx}>
                <rect x={cx - 16} y="42" width="32" height="46" rx="3" stroke="#22D3EE" />
                <rect x={cx - 13} y={48 + (i % 2) * 14} width="26" height="14" fill="rgba(56,189,248,0.28)" />
                <line x1={cx} y1={62 + (i % 2) * 14} x2={cx} y2="98" stroke="#F59E0B" strokeWidth="2" />
                <circle cx={cx} cy="98" r="5" fill="#F59E0B" />
              </g>
            ))}
            <line x1="56" y1="98" x2="264" y2="98" stroke="#94A3B8" strokeWidth="2.5" />
            <text x="160" y="22" fill="#BAE6FD" fontSize="9" fontFamily="monospace" textAnchor="middle" stroke="none">
              PISTON-CRANK RECIPROCATING ASSEMBLY
            </text>
          </g>
        )}

        {kind === 'forced-induction' && (
          <g stroke="#38BDF8" strokeWidth="1.6" fill="none">
            <circle cx="92" cy="70" r="30" fill="rgba(34,211,238,0.12)" />
            <circle cx="92" cy="70" r="13" stroke="#F59E0B" />
            <circle cx="226" cy="70" r="30" fill="rgba(249,115,22,0.12)" stroke="#F97316" />
            <circle cx="226" cy="70" r="13" stroke="#F97316" />
            <line x1="105" y1="70" x2="213" y2="70" stroke="#E2E8F0" strokeWidth="3.5" />
            <path d="M 92 40 L 160 22 L 260 22" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 2" />
            <path d="M 40 112 L 196 112 L 226 100" stroke="#F97316" strokeWidth="2" />
            <text x="92" y="122" fill="#67E8F9" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              COMPRESSOR
            </text>
            <text x="226" y="122" fill="#FDBA74" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              TURBINE
            </text>
            <text x="160" y="16" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              COMPRESSED INTAKE CHARGE →
            </text>
          </g>
        )}

        {kind === 'cooling' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <rect x="64" y="28" width="192" height="84" rx="6" fill="rgba(14,116,144,0.15)" />
            {[42, 56, 70, 84, 98].map((y) => (
              <line key={y} x1="74" y1={y} x2="246" y2={y} stroke="#22D3EE" strokeWidth="1.2" />
            ))}
            <circle cx="160" cy="70" r="24" stroke="#94A3B8" strokeWidth="2" fill="rgba(15,23,42,0.7)" />
            <path d="M160 48 L166 70 L160 92 L154 70 Z" fill="#38BDF8" stroke="none" />
            <path d="M138 70 L160 64 L182 70 L160 76 Z" fill="#38BDF8" stroke="none" />
            <text x="160" y="126" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              CROSS-FLOW FIN CORE + HEAT REJECTION
            </text>
          </g>
        )}

        {(kind === 'transmission' || kind === 'differential') && (
          <g stroke="#38BDF8" strokeWidth="1.6" fill="none">
            <circle cx="95" cy="70" r="28" fill="rgba(37,99,235,0.18)" />
            <circle cx="162" cy="70" r="20" stroke="#22D3EE" fill="rgba(6,182,212,0.18)" />
            <circle cx="222" cy="70" r="26" stroke="#F59E0B" fill="rgba(245,158,11,0.14)" />
            <line x1="36" y1="70" x2="284" y2="70" stroke="#CBD5E1" strokeWidth="2.4" />
            <line x1="222" y1="24" x2="222" y2="116" stroke="#F59E0B" strokeWidth="2.4" />
            <text x="160" y="20" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              {kind === 'differential' ? 'TORQUE VECTORING GEARSET' : 'MULTI-STAGE RATIO GEARBOX'}
            </text>
          </g>
        )}

        {kind === 'suspension' && (
          <g stroke="#38BDF8" strokeWidth="1.6" fill="none">
            <line x1="62" y1="30" x2="178" y2="30" stroke="#94A3B8" strokeWidth="3" />
            <line x1="62" y1="108" x2="206" y2="108" stroke="#22D3EE" strokeWidth="3" />
            <path d="M150 32 L134 44 L166 56 L134 68 L166 80 L134 92 L150 104" stroke="#F59E0B" strokeWidth="2.2" />
            <rect x="206" y="42" width="42" height="66" rx="6" fill="rgba(30,41,59,0.9)" stroke="#60A5FA" />
            <text x="160" y="128" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              COILOVER SPRING-DAMPER + CONTROL ARM
            </text>
          </g>
        )}

        {kind === 'brakes' && (
          <g stroke="#38BDF8" strokeWidth="1.6" fill="none">
            <circle cx="150" cy="68" r="44" fill="rgba(148,163,184,0.16)" stroke="#CBD5E1" strokeWidth="2.5" />
            <circle cx="150" cy="68" r="18" stroke="#64748B" />
            <path d="M180 34 A46 46 0 0 1 196 84 L176 80 A26 26 0 0 0 166 48 Z" fill="rgba(239,68,68,0.65)" stroke="#F87171" />
            <text x="160" y="128" fill="#FCA5A5" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              HYDRAULIC CALIPER CLAMPING FRICTION ROTOR
            </text>
          </g>
        )}

        {kind === 'ecu-electrical' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <rect x="108" y="34" width="104" height="72" rx="6" fill="rgba(16,185,129,0.14)" stroke="#10B981" />
            <rect x="134" y="50" width="52" height="40" rx="4" stroke="#22D3EE" fill="rgba(34,211,238,0.18)" />
            {[46, 62, 78, 94].map((y) => (
              <g key={y}>
                <line x1="60" y1={y} x2="108" y2={y} stroke="#FACC15" />
                <line x1="212" y1={y} x2="260" y2={y} stroke="#38BDF8" />
              </g>
            ))}
            <text x="160" y="74" fill="#A7F3D0" fontSize="9" fontFamily="monospace" textAnchor="middle" stroke="none">
              MCU / CAN
            </text>
            <text x="160" y="126" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              SENSOR INPUTS → ECU LOGIC → ACTUATORS
            </text>
          </g>
        )}

        {kind === 'aero' && (
          <g stroke="#38BDF8" strokeWidth="1.6" fill="none">
            <path d="M40 90 Q105 46 185 50 L256 76 L278 88 L40 94 Z" fill="rgba(37,99,235,0.22)" />
            <path d="M24 62 Q120 32 284 42" stroke="#22D3EE" strokeDasharray="5 3" />
            <path d="M24 76 Q115 44 286 56" stroke="#38BDF8" strokeDasharray="5 3" />
            <path d="M36 106 L284 106" stroke="#10B981" strokeDasharray="4 2" />
            <text x="160" y="24" fill="#67E8F9" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              LAMINAR FLOW · DOWNFORCE VECTOR ↓ · LOW DRAG
            </text>
          </g>
        )}

        {kind === 'soc-silicon' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <rect x="76" y="26" width="168" height="88" rx="6" fill="rgba(16,185,129,0.12)" stroke="#34D399" />
            <rect x="92" y="38" width="60" height="64" rx="4" fill="rgba(34,211,238,0.2)" stroke="#22D3EE" />
            <rect x="162" y="38" width="66" height="28" rx="3" fill="rgba(168,85,247,0.22)" stroke="#C084FC" />
            <rect x="162" y="74" width="66" height="28" rx="3" fill="rgba(245,158,11,0.2)" stroke="#FBBF24" />
            <text x="122" y="73" fill="#67E8F9" fontSize="9" fontFamily="monospace" textAnchor="middle" stroke="none">
              CPU+GPU
            </text>
            <text x="195" y="55" fill="#E9D5FF" fontSize="8" fontFamily="monospace" textAnchor="middle" stroke="none">
              LPDDR5X
            </text>
            <text x="195" y="91" fill="#FDE68A" fontSize="8" fontFamily="monospace" textAnchor="middle" stroke="none">
              NPU/PMIC
            </text>
            <text x="160" y="128" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              MONOLITHIC SILICON DIE &amp; PCB INTERCONNECT
            </text>
          </g>
        )}

        {kind === 'display-stack' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            {[36, 52, 68, 84].map((y, idx) => (
              <rect
                key={y}
                x="62"
                y={y}
                width="196"
                height="10"
                rx="2"
                fill={['rgba(186,230,253,0.35)', 'rgba(56,189,248,0.25)', 'rgba(168,85,247,0.3)', 'rgba(16,185,129,0.28)'][idx]}
                stroke={['#E0F2FE', '#38BDF8', '#C084FC', '#34D399'][idx]}
              />
            ))}
            <text x="160" y="24" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              COVER GLASS → DIGITIZER → OLED MATRIX → DDIC
            </text>
          </g>
        )}

        {kind === 'battery-bms' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <rect x="74" y="34" width="136" height="72" rx="6" fill="rgba(16,185,129,0.16)" stroke="#10B981" />
            <rect x="216" y="42" width="38" height="56" rx="4" fill="rgba(245,158,11,0.2)" stroke="#FBBF24" />
            <line x1="210" y1="54" x2="216" y2="54" stroke="#EF4444" strokeWidth="2.5" />
            <line x1="210" y1="86" x2="216" y2="86" stroke="#94A3B8" strokeWidth="2.5" />
            <text x="142" y="73" fill="#6EE7B7" fontSize="10" fontFamily="monospace" textAnchor="middle" stroke="none">
              LI-ION CELL 3.87V
            </text>
            <text x="235" y="73" fill="#FDE68A" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              BMS
            </text>
            <text x="160" y="126" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              CC/CV CHARGING + PROTECTION MOSFET CIRCUIT
            </text>
          </g>
        )}

        {kind === 'camera-ois' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <circle cx="80" cy="68" r="24" stroke="#60A5FA" fill="rgba(59,130,246,0.15)" />
            <ellipse cx="142" cy="68" rx="9" ry="26" stroke="#22D3EE" fill="rgba(34,211,238,0.22)" />
            <ellipse cx="166" cy="68" rx="7" ry="22" stroke="#22D3EE" fill="rgba(34,211,238,0.22)" />
            <rect x="206" y="40" width="22" height="56" rx="3" stroke="#F59E0B" fill="rgba(245,158,11,0.2)" />
            <line x1="48" y1="56" x2="206" y2="56" stroke="#93C5FD" strokeDasharray="3 2" />
            <line x1="48" y1="80" x2="206" y2="80" stroke="#93C5FD" strokeDasharray="3 2" />
            <text x="160" y="126" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              MULTI-ELEMENT OPTICS → OIS VCM ACTUATOR → CMOS
            </text>
          </g>
        )}

        {kind === 'connectivity-rf' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <rect x="116" y="44" width="88" height="52" rx="5" fill="rgba(56,189,248,0.16)" />
            <path d="M74 44 C56 58, 56 82, 74 96" stroke="#22D3EE" />
            <path d="M58 34 C34 54, 34 86, 58 106" stroke="#22D3EE" opacity="0.6" />
            <path d="M246 44 C264 58, 264 82, 246 96" stroke="#A855F7" />
            <path d="M262 34 C286 54, 286 86, 262 106" stroke="#A855F7" opacity="0.6" />
            <text x="160" y="74" fill="#E0F2FE" fontSize="9" fontFamily="monospace" textAnchor="middle" stroke="none">
              RF TRANSCEIVER
            </text>
            <text x="160" y="126" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              5G / WI-FI / GPS / NFC PHASED ANTENNA ARRAY
            </text>
          </g>
        )}

        {kind === 'thermal-chassis' && (
          <g stroke="#38BDF8" strokeWidth="1.5" fill="none">
            <rect x="52" y="34" width="216" height="70" rx="10" stroke="#94A3B8" strokeWidth="2.2" fill="rgba(30,41,59,0.65)" />
            <rect x="78" y="46" width="144" height="46" rx="4" fill="rgba(249,115,22,0.22)" stroke="#FB923C" />
            <path d="M96 69 L204 69" stroke="#FDBA74" strokeWidth="2" strokeDasharray="6 3" />
            <text x="150" y="62" fill="#FED7AA" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              VAPOR CHAMBER + GRAPHITE SPREADER
            </text>
            <text x="160" y="126" fill="#BAE6FD" fontSize="8.5" fontFamily="monospace" textAnchor="middle" stroke="none">
              TWO-PHASE HEAT SPREADING &amp; STRUCTURAL CHASSIS
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
