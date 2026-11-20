import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cpu,
  Factory,
  Layers,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import { EngineeringDiagramSvg } from './EngineeringDiagramSvg.tsx';
import type { EngineeringComponentSpec } from './engineeringTypes.ts';

interface LearningInspectorModalProps {
  component: EngineeringComponentSpec | null;
  exploredCount: number;
  totalComponents: number;
  onClose: () => void;
}

export const LearningInspectorModal: React.FC<LearningInspectorModalProps> = ({
  component,
  exploredCount,
  totalComponents,
  onClose,
}) => {
  if (!component) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/55 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Engineering Learning Mode: ${component.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl h-full max-h-[92vh] bg-[#070E1F] border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-500/25 bg-[#0A142B] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono-tech text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
              <BookOpen size={13} />
              <span>Engineering Learning Mode · {component.subsystem}</span>
              <span className="text-emerald-300">
                ({exploredCount}/{totalComponents} Explored)
              </span>
            </div>
            <h2 className="font-heading font-bold text-xl sm:text-2xl text-white mt-1">
              {component.name}
            </h2>
            <p className="font-mono-tech text-xs text-amber-300 mt-0.5">
              {component.engineeringField}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close component information (ESC)"
            className="p-2 rounded-xl bg-slate-900 border border-white/15 hover:border-cyan-400 text-slate-200 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Technical Breakdown */}
        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-4 text-sm">
          <EngineeringDiagramSvg kind={component.diagramKind} title={component.name} />

          {/* Q1 & Q2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0D1730] border border-white/10 space-y-1">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-cyan-300">
                1. What is this component?
              </div>
              <p className="text-slate-200 leading-relaxed text-xs sm:text-sm">
                {component.whatIsIt}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0D1730] border border-white/10 space-y-1">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-cyan-300">
                2. What does it do?
              </div>
              <p className="text-slate-200 leading-relaxed text-xs sm:text-sm">
                {component.whatDoesItDo}
              </p>
            </div>
          </div>

          {/* Q3 */}
          <div className="p-3.5 rounded-xl bg-[#0D1730] border border-cyan-500/20 space-y-1">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Cpu size={12} /> 3. How does it work?
            </div>
            <p className="text-slate-200 leading-relaxed text-xs sm:text-sm">
              {component.howItWorks}
            </p>
          </div>

          {/* Q4 & Q5 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0D1730] border border-white/10 space-y-1">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Wrench size={12} /> 4. Engineering Discipline
              </div>
              <p className="text-white font-sora font-semibold text-xs sm:text-sm">
                {component.engineeringField}
              </p>
              <p className="text-xs text-emerald-300 mt-1">
                Impact: {component.performanceImpact}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0D1730] border border-white/10 space-y-1.5">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Layers size={12} /> 5. Materials Used
              </div>
              <ul className="space-y-1 text-xs text-slate-200">
                {component.materials.map((m) => (
                  <li key={m} className="flex items-start gap-1.5">
                    <span className="text-cyan-400">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Q6: Advantages & Disadvantages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-500/30 space-y-1.5">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> 6a. Advantages
              </div>
              <ul className="space-y-1 text-xs text-emerald-100">
                {component.advantages.map((a) => (
                  <li key={a}>+ {a}</li>
                ))}
              </ul>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-950/35 border border-amber-500/30 space-y-1.5">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <AlertTriangle size={12} /> 6b. Disadvantages &amp; Trade-Offs
              </div>
              <ul className="space-y-1 text-xs text-amber-100">
                {component.disadvantages.map((d) => (
                  <li key={d}>- {d}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Q7 & Q8 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-500/35 space-y-1">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <ShieldAlert size={12} /> 7. What happens if it fails?
              </div>
              <p className="text-xs text-rose-100 leading-relaxed">
                {component.whatHappensIfItFails}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0D1730] border border-white/10 space-y-1.5">
              <div className="font-mono-tech text-[10px] uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Factory size={12} /> 8. Real-Life Applications
              </div>
              <ul className="space-y-1 text-xs text-slate-200">
                {component.realLifeUses.map((u) => (
                  <li key={u}>• {u}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Technical Specs Table */}
          <div className="p-3.5 rounded-xl bg-[#040914] border border-white/10">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 mb-2">
              Simulated Engineering Specifications
            </div>
            <div className="grid grid-cols-2 gap-2">
              {component.specs.map((s) => (
                <div key={s.label} className="px-2.5 py-1.5 rounded-lg bg-[#0D1730] border border-white/5">
                  <div className="font-mono-tech text-[10px] text-slate-400">{s.label}</div>
                  <div className="font-mono-tech text-xs font-bold text-cyan-200">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
