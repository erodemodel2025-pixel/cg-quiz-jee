import React from 'react';

export type PixelIconName =
  | 'quiz'
  | 'science'
  | 'math'
  | 'technology'
  | 'engineering'
  | 'timer'
  | 'score'
  | 'trophy'
  | 'question'
  | 'settings'
  | 'profile'
  | 'heart'
  | 'bookmark'
  | 'flame'
  | 'book'
  | 'arcade'
  | 'play'
  | 'flag'
  | 'check'
  | 'close'
  | 'menu'
  | 'sound-on'
  | 'sound-off'
  | 'sun'
  | 'moon'
  | 'target'
  | 'refresh';

export type PixelIllustrationName =
  | 'question_block'
  | 'lab'
  | 'computer'
  | 'books'
  | 'tools'
  | 'trophy'
  | 'rocket'
  | 'compass'
  | 'oops'
  | 'robot'
  | 'circuit'
  | 'crown'
  | 'diamond_trophy'
  | 'medal_gold'
  | 'medal_silver'
  | 'medal_bronze'
  | 'shield';

interface PixelLogoProps {
  variant?: 'desktop' | 'mobile' | 'hero';
  className?: string;
}

/**
 * Original chunky voxel/block-style CG QUIZ logo — zero copyrighted textures or assets.
 */
export const PixelLogo: React.FC<PixelLogoProps> = ({ variant = 'desktop', className = '' }) => {
  if (variant === 'hero') {
    return (
      <div className={`inline-flex flex-col items-center select-none ${className}`} aria-label="CG QUIZ">
        <div className="flex items-center gap-3 sm:gap-4 mb-1">
          <svg
            viewBox="0 0 24 24"
            className="w-12 h-12 sm:w-16 sm:h-16 pixelated shrink-0 animate-pixel-bob"
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="20" height="20" fill="#0B0F1A" />
            <rect x="4" y="4" width="16" height="16" fill="#FACC15" />
            <rect x="4" y="4" width="16" height="2" fill="#FEF08A" />
            <rect x="4" y="4" width="2" height="16" fill="#FEF08A" />
            <rect x="4" y="18" width="16" height="2" fill="#CA8A04" />
            <rect x="18" y="4" width="2" height="16" fill="#CA8A04" />
            <rect x="6" y="6" width="1" height="1" fill="#A16207" />
            <rect x="17" y="6" width="1" height="1" fill="#A16207" />
            <rect x="6" y="17" width="1" height="1" fill="#A16207" />
            <rect x="17" y="17" width="1" height="1" fill="#A16207" />
            <rect x="9" y="7" width="6" height="2" fill="#1E293B" />
            <rect x="13" y="9" width="2" height="2" fill="#1E293B" />
            <rect x="11" y="11" width="4" height="2" fill="#1E293B" />
            <rect x="11" y="13" width="2" height="1" fill="#1E293B" />
            <rect x="11" y="15" width="2" height="2" fill="#1E293B" />
            <rect x="9" y="7" width="1" height="1" fill="#FFFFFF" />
          </svg>

          <div className="voxel-title-stack text-left">
            <div className="voxel-hero-cg font-pixel text-3xl sm:text-5xl md:text-6xl leading-none tracking-wider">
              CG
            </div>
            <div className="voxel-hero-quiz font-pixel text-2xl sm:text-4xl md:text-5xl leading-none tracking-widest mt-1">
              QUIZ
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 18 18"
        className="w-8 h-8 pixelated shrink-0"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="16" height="16" fill="#0B0F1A" />
        <rect x="2" y="2" width="14" height="14" fill="#22C55E" />
        <rect x="2" y="2" width="14" height="2" fill="#86EFAC" />
        <rect x="2" y="14" width="14" height="2" fill="#15803D" />
        <rect x="4" y="5" width="4" height="2" fill="#FFFFFF" />
        <rect x="4" y="7" width="2" height="4" fill="#FFFFFF" />
        <rect x="4" y="11" width="4" height="2" fill="#FFFFFF" />
        <rect x="10" y="5" width="4" height="2" fill="#FACC15" />
        <rect x="10" y="7" width="2" height="4" fill="#FACC15" />
        <rect x="10" y="11" width="4" height="2" fill="#FACC15" />
        <rect x="12" y="9" width="2" height="2" fill="#FACC15" />
      </svg>

      {variant === 'mobile' ? (
        <span className="font-pixel text-xs leading-none tracking-wider text-[var(--exam-text)]">
          CG<span className="text-[var(--voxel-green)]">Q</span>
        </span>
      ) : (
        <span className="flex flex-col leading-none text-left">
          <span className="font-pixel text-xs sm:text-sm tracking-wider text-[var(--exam-text)]">
            CG <span className="text-[var(--voxel-green)]">QUIZ</span>
          </span>
        </span>
      )}
    </span>
  );
};

interface PixelIconProps {
  name: PixelIconName;
  size?: number;
  className?: string;
}

export const PixelIcon: React.FC<PixelIconProps> = ({ name, size = 18, className = '' }) => {
  const renderGlyph = () => {
    switch (name) {
      case 'play':
        return (
          <>
            <rect x="4" y="3" width="2" height="10" />
            <rect x="6" y="4" width="2" height="8" />
            <rect x="8" y="5" width="2" height="6" />
            <rect x="10" y="6" width="2" height="4" />
            <rect x="12" y="7" width="2" height="2" />
          </>
        );
      case 'quiz':
        return (
          <>
            <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="6" y="5" width="4" height="2" />
            <rect x="8" y="7" width="2" height="2" />
            <rect x="7" y="10" width="2" height="2" />
          </>
        );
      case 'science':
        return (
          <>
            <rect x="6" y="2" width="4" height="2" />
            <rect x="7" y="4" width="2" height="3" />
            <rect x="5" y="7" width="6" height="2" />
            <rect x="3" y="9" width="10" height="4" />
            <rect x="4" y="13" width="8" height="1" />
          </>
        );
      case 'math':
        return (
          <>
            <rect x="3" y="2" width="4" height="2" />
            <rect x="4" y="1" width="2" height="4" />
            <rect x="9" y="3" width="4" height="2" />
            <rect x="3" y="10" width="4" height="2" />
            <rect x="9" y="9" width="4" height="2" />
            <rect x="9" y="12" width="4" height="2" />
          </>
        );
      case 'technology':
        return (
          <>
            <rect x="2" y="3" width="12" height="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="5" y="5" width="2" height="2" />
            <rect x="9" y="5" width="2" height="2" />
            <rect x="6" y="8" width="4" height="1" />
            <rect x="6" y="12" width="4" height="1" />
            <rect x="4" y="13" width="8" height="1" />
          </>
        );
      case 'engineering':
        return (
          <>
            <rect x="6" y="2" width="4" height="2" />
            <rect x="6" y="12" width="4" height="2" />
            <rect x="2" y="6" width="2" height="4" />
            <rect x="12" y="6" width="2" height="4" />
            <rect x="4" y="4" width="8" height="8" />
            <rect x="6" y="6" width="4" height="4" fill="var(--exam-surface)" />
          </>
        );
      case 'timer':
        return (
          <>
            <rect x="6" y="1" width="4" height="2" />
            <rect x="4" y="4" width="8" height="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="7" y="6" width="2" height="4" />
            <rect x="9" y="8" width="2" height="2" />
          </>
        );
      case 'score':
        return (
          <>
            <rect x="7" y="1" width="2" height="4" />
            <rect x="5" y="5" width="6" height="2" />
            <rect x="1" y="6" width="14" height="2" />
            <rect x="3" y="8" width="10" height="2" />
            <rect x="4" y="10" width="3" height="4" />
            <rect x="9" y="10" width="3" height="4" />
          </>
        );
      case 'trophy':
        return (
          <>
            <rect x="4" y="2" width="8" height="6" />
            <rect x="2" y="3" width="2" height="3" />
            <rect x="12" y="3" width="2" height="3" />
            <rect x="6" y="8" width="4" height="3" />
            <rect x="4" y="11" width="8" height="3" />
          </>
        );
      case 'question':
        return (
          <>
            <rect x="5" y="2" width="6" height="2" />
            <rect x="9" y="4" width="2" height="3" />
            <rect x="7" y="7" width="3" height="2" />
            <rect x="7" y="11" width="2" height="3" />
          </>
        );
      case 'settings':
        return (
          <>
            <rect x="6" y="2" width="4" height="12" />
            <rect x="2" y="6" width="12" height="4" />
            <rect x="4" y="4" width="8" height="8" />
            <rect x="6" y="6" width="4" height="4" fill="var(--exam-surface)" />
          </>
        );
      case 'profile':
        return (
          <>
            <rect x="5" y="2" width="6" height="5" />
            <rect x="3" y="9" width="10" height="5" />
          </>
        );
      case 'heart':
        return (
          <>
            <rect x="2" y="4" width="4" height="4" />
            <rect x="10" y="4" width="4" height="4" />
            <rect x="4" y="3" width="3" height="6" />
            <rect x="9" y="3" width="3" height="6" />
            <rect x="6" y="5" width="4" height="6" />
            <rect x="7" y="11" width="2" height="2" />
          </>
        );
      case 'bookmark':
        return (
          <>
            <rect x="4" y="2" width="8" height="10" />
            <rect x="4" y="12" width="3" height="2" />
            <rect x="9" y="12" width="3" height="2" />
          </>
        );
      case 'flame':
        return (
          <>
            <rect x="7" y="2" width="2" height="3" />
            <rect x="5" y="5" width="6" height="3" />
            <rect x="4" y="8" width="8" height="4" />
            <rect x="5" y="12" width="6" height="2" />
          </>
        );
      case 'book':
        return (
          <>
            <rect x="2" y="3" width="5" height="10" />
            <rect x="9" y="3" width="5" height="10" />
            <rect x="7" y="4" width="2" height="9" />
          </>
        );
      case 'arcade':
        return (
          <>
            <rect x="2" y="5" width="12" height="7" />
            <rect x="4" y="7" width="3" height="1" fill="var(--exam-surface)" />
            <rect x="5" y="6" width="1" height="3" fill="var(--exam-surface)" />
            <rect x="10" y="7" width="1" height="1" fill="var(--exam-surface)" />
            <rect x="11" y="8" width="1" height="1" fill="var(--exam-surface)" />
          </>
        );
      case 'flag':
        return (
          <>
            <rect x="3" y="2" width="2" height="12" />
            <rect x="5" y="2" width="8" height="6" />
          </>
        );
      case 'check':
        return (
          <>
            <rect x="11" y="4" width="2" height="2" />
            <rect x="9" y="6" width="2" height="2" />
            <rect x="7" y="8" width="2" height="2" />
            <rect x="5" y="10" width="2" height="2" />
            <rect x="3" y="8" width="2" height="2" />
          </>
        );
      case 'close':
        return (
          <>
            <rect x="3" y="3" width="2" height="2" />
            <rect x="5" y="5" width="2" height="2" />
            <rect x="7" y="7" width="2" height="2" />
            <rect x="9" y="9" width="2" height="2" />
            <rect x="11" y="11" width="2" height="2" />
            <rect x="11" y="3" width="2" height="2" />
            <rect x="9" y="5" width="2" height="2" />
            <rect x="5" y="9" width="2" height="2" />
            <rect x="3" y="11" width="2" height="2" />
          </>
        );
      case 'menu':
        return (
          <>
            <rect x="2" y="3" width="12" height="2" />
            <rect x="2" y="7" width="12" height="2" />
            <rect x="2" y="11" width="12" height="2" />
          </>
        );
      case 'sound-on':
        return (
          <>
            <rect x="2" y="6" width="3" height="4" />
            <rect x="5" y="4" width="2" height="8" />
            <rect x="7" y="2" width="2" height="12" />
            <rect x="11" y="5" width="1" height="6" />
            <rect x="13" y="3" width="1" height="10" />
          </>
        );
      case 'sound-off':
        return (
          <>
            <rect x="2" y="6" width="3" height="4" />
            <rect x="5" y="4" width="2" height="8" />
            <rect x="7" y="2" width="2" height="12" />
            <rect x="11" y="5" width="2" height="2" />
            <rect x="13" y="9" width="2" height="2" />
            <rect x="13" y="5" width="2" height="2" />
            <rect x="11" y="9" width="2" height="2" />
          </>
        );
      case 'sun':
        return (
          <>
            <rect x="7" y="1" width="2" height="2" />
            <rect x="7" y="13" width="2" height="2" />
            <rect x="1" y="7" width="2" height="2" />
            <rect x="13" y="7" width="2" height="2" />
            <rect x="5" y="5" width="6" height="6" />
          </>
        );
      case 'moon':
        return (
          <>
            <rect x="6" y="2" width="5" height="2" />
            <rect x="4" y="4" width="4" height="8" />
            <rect x="6" y="12" width="5" height="2" />
            <rect x="10" y="10" width="2" height="2" />
          </>
        );
      case 'target':
        return (
          <>
            <rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="6" y="6" width="4" height="4" />
          </>
        );
      case 'refresh':
        return (
          <>
            <rect x="4" y="3" width="8" height="2" />
            <rect x="10" y="5" width="2" height="3" />
            <rect x="4" y="11" width="8" height="2" />
            <rect x="4" y="8" width="2" height="3" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      className={`pixelated shrink-0 ${className}`}
      aria-hidden="true"
    >
      {renderGlyph()}
    </svg>
  );
};

interface PixelIllustrationProps {
  name: PixelIllustrationName;
  size?: number;
  className?: string;
}

export const PixelIllustration: React.FC<PixelIllustrationProps> = ({
  name,
  size = 56,
  className = '',
}) => {
  const renderArt = () => {
    switch (name) {
      case 'question_block':
        return (
          <>
            <rect x="3" y="3" width="18" height="18" fill="#0B0F1A" />
            <rect x="5" y="5" width="14" height="14" fill="#FACC15" />
            <rect x="5" y="5" width="14" height="2" fill="#FEF08A" />
            <rect x="5" y="17" width="14" height="2" fill="#CA8A04" />
            <rect x="9" y="7" width="6" height="2" fill="#1E293B" />
            <rect x="13" y="9" width="2" height="2" fill="#1E293B" />
            <rect x="11" y="11" width="4" height="2" fill="#1E293B" />
            <rect x="11" y="14" width="2" height="2" fill="#1E293B" />
            <rect x="2" y="2" width="2" height="2" fill="#38BDF8" />
            <rect x="20" y="4" width="2" height="2" fill="#4ADE80" />
          </>
        );
      case 'lab':
        return (
          <>
            <rect x="9" y="2" width="6" height="2" fill="#94A3B8" />
            <rect x="10" y="4" width="4" height="5" fill="#CBD5E1" />
            <rect x="7" y="9" width="10" height="3" fill="#CBD5E1" />
            <rect x="5" y="12" width="14" height="8" fill="#0B0F1A" />
            <rect x="6" y="12" width="12" height="7" fill="#22C55E" />
            <rect x="6" y="12" width="12" height="2" fill="#86EFAC" />
            <rect x="9" y="15" width="2" height="2" fill="#DCFCE7" />
            <rect x="13" y="14" width="2" height="2" fill="#DCFCE7" />
          </>
        );
      case 'computer':
        return (
          <>
            <rect x="2" y="3" width="20" height="14" fill="#0B0F1A" />
            <rect x="4" y="5" width="16" height="10" fill="#0EA5E9" />
            <rect x="5" y="6" width="14" height="8" fill="#0F172A" />
            <rect x="7" y="8" width="4" height="2" fill="#38BDF8" />
            <rect x="7" y="11" width="8" height="2" fill="#4ADE80" />
            <rect x="12" y="8" width="4" height="2" fill="#FACC15" />
            <rect x="9" y="17" width="6" height="2" fill="#64748B" />
            <rect x="6" y="19" width="12" height="2" fill="#94A3B8" />
          </>
        );
      case 'books':
        return (
          <>
            <rect x="3" y="15" width="18" height="5" fill="#0B0F1A" />
            <rect x="4" y="16" width="16" height="3" fill="#EF4444" />
            <rect x="6" y="16" width="2" height="3" fill="#FCA5A5" />
            <rect x="5" y="10" width="16" height="5" fill="#0B0F1A" />
            <rect x="6" y="11" width="14" height="3" fill="#3B82F6" />
            <rect x="8" y="11" width="2" height="3" fill="#93C5FD" />
            <rect x="4" y="5" width="15" height="5" fill="#0B0F1A" />
            <rect x="5" y="6" width="13" height="3" fill="#22C55E" />
            <rect x="7" y="6" width="2" height="3" fill="#86EFAC" />
          </>
        );
      case 'tools':
        return (
          <>
            <rect x="9" y="3" width="6" height="18" fill="#94A3B8" />
            <rect x="3" y="9" width="18" height="6" fill="#94A3B8" />
            <rect x="5" y="5" width="14" height="14" fill="#64748B" />
            <rect x="7" y="7" width="10" height="10" fill="#FACC15" />
            <rect x="9" y="9" width="6" height="6" fill="#0F172A" />
          </>
        );
      case 'trophy':
        return (
          <>
            <rect x="5" y="3" width="14" height="2" fill="#FEF08A" />
            <rect x="5" y="5" width="14" height="7" fill="#FACC15" />
            <rect x="2" y="5" width="3" height="5" fill="#EAB308" />
            <rect x="19" y="5" width="3" height="5" fill="#EAB308" />
            <rect x="7" y="12" width="10" height="2" fill="#CA8A04" />
            <rect x="10" y="14" width="4" height="3" fill="#EAB308" />
            <rect x="6" y="17" width="12" height="4" fill="#0B0F1A" />
            <rect x="7" y="18" width="10" height="2" fill="#475569" />
            <rect x="10" y="7" width="4" height="2" fill="#FFFFFF" />
          </>
        );
      case 'diamond_trophy':
        return (
          <>
            <rect x="5" y="2" width="14" height="2" fill="#BAE6FD" />
            <rect x="4" y="4" width="16" height="7" fill="#38BDF8" />
            <rect x="2" y="5" width="2" height="4" fill="#0284C7" />
            <rect x="20" y="5" width="2" height="4" fill="#0284C7" />
            <rect x="7" y="11" width="10" height="3" fill="#0EA5E9" />
            <rect x="10" y="14" width="4" height="3" fill="#0284C7" />
            <rect x="6" y="17" width="12" height="4" fill="#0B0F1A" />
            <rect x="7" y="18" width="10" height="2" fill="#FACC15" />
            <rect x="9" y="6" width="6" height="2" fill="#FFFFFF" />
            <rect x="11" y="5" width="2" height="4" fill="#FFFFFF" />
          </>
        );
      case 'crown':
        return (
          <>
            <rect x="3" y="16" width="18" height="4" fill="#0B0F1A" />
            <rect x="4" y="9" width="16" height="8" fill="#FACC15" />
            <rect x="4" y="5" width="3" height="4" fill="#FEF08A" />
            <rect x="10" y="4" width="4" height="5" fill="#FEF08A" />
            <rect x="17" y="5" width="3" height="4" fill="#FEF08A" />
            <rect x="6" y="12" width="2" height="2" fill="#EF4444" />
            <rect x="11" y="11" width="2" height="3" fill="#38BDF8" />
            <rect x="16" y="12" width="2" height="2" fill="#22C55E" />
          </>
        );
      case 'medal_gold':
      case 'medal_silver':
      case 'medal_bronze': {
        const main = name === 'medal_gold' ? '#FACC15' : name === 'medal_silver' ? '#CBD5E1' : '#FB923C';
        const hi = name === 'medal_gold' ? '#FEF08A' : name === 'medal_silver' ? '#F8FAFC' : '#FDBA74';
        const sh = name === 'medal_gold' ? '#CA8A04' : name === 'medal_silver' ? '#64748B' : '#C2410C';
        return (
          <>
            <rect x="8" y="2" width="3" height="6" fill="#EF4444" />
            <rect x="13" y="2" width="3" height="6" fill="#3B82F6" />
            <rect x="6" y="8" width="12" height="12" fill="#0B0F1A" />
            <rect x="7" y="9" width="10" height="10" fill={main} />
            <rect x="7" y="9" width="10" height="2" fill={hi} />
            <rect x="7" y="17" width="10" height="2" fill={sh} />
            <rect x="11" y="12" width="2" height="4" fill="#0B0F1A" />
          </>
        );
      }
      case 'shield':
        return (
          <>
            <rect x="4" y="3" width="16" height="10" fill="#0B0F1A" />
            <rect x="6" y="13" width="12" height="4" fill="#0B0F1A" />
            <rect x="9" y="17" width="6" height="3" fill="#0B0F1A" />
            <rect x="5" y="4" width="14" height="9" fill="#38BDF8" />
            <rect x="7" y="13" width="10" height="3" fill="#0EA5E9" />
            <rect x="10" y="16" width="4" height="3" fill="#0284C7" />
            <rect x="11" y="6" width="2" height="8" fill="#FEF08A" />
            <rect x="8" y="9" width="8" height="2" fill="#FEF08A" />
          </>
        );
      case 'circuit':
        return (
          <>
            <rect x="5" y="5" width="14" height="14" fill="#0B0F1A" />
            <rect x="6" y="6" width="12" height="12" fill="#1E293B" />
            <rect x="8" y="8" width="8" height="8" fill="#FACC15" />
            <rect x="10" y="10" width="4" height="4" fill="#0B0F1A" />
            <rect x="2" y="8" width="3" height="2" fill="#22C55E" />
            <rect x="2" y="14" width="3" height="2" fill="#22C55E" />
            <rect x="19" y="8" width="3" height="2" fill="#22C55E" />
            <rect x="19" y="14" width="3" height="2" fill="#22C55E" />
            <rect x="8" y="2" width="2" height="3" fill="#38BDF8" />
            <rect x="14" y="2" width="2" height="3" fill="#38BDF8" />
            <rect x="8" y="19" width="2" height="3" fill="#38BDF8" />
            <rect x="14" y="19" width="2" height="3" fill="#38BDF8" />
          </>
        );
      case 'robot':
        return (
          <>
            <rect x="11" y="2" width="2" height="3" fill="#FACC15" />
            <rect x="5" y="5" width="14" height="11" fill="#0B0F1A" />
            <rect x="6" y="6" width="12" height="9" fill="#A855F7" />
            <rect x="8" y="9" width="2" height="2" fill="#38BDF8" />
            <rect x="14" y="9" width="2" height="2" fill="#38BDF8" />
            <rect x="9" y="13" width="6" height="1" fill="#E9D5FF" />
            <rect x="7" y="16" width="10" height="5" fill="#475569" />
          </>
        );
      case 'rocket':
        return (
          <>
            <rect x="11" y="2" width="2" height="2" fill="#EF4444" />
            <rect x="9" y="4" width="6" height="3" fill="#EF4444" />
            <rect x="8" y="7" width="8" height="8" fill="#E2E8F0" />
            <rect x="10" y="9" width="4" height="4" fill="#38BDF8" />
            <rect x="5" y="12" width="3" height="4" fill="#EF4444" />
            <rect x="16" y="12" width="3" height="4" fill="#EF4444" />
            <rect x="9" y="15" width="6" height="3" fill="#F97316" />
            <rect x="10" y="18" width="4" height="3" fill="#FACC15" />
          </>
        );
      case 'compass':
        return (
          <>
            <rect x="4" y="4" width="16" height="16" fill="#0B0F1A" />
            <rect x="5" y="5" width="14" height="14" fill="#38BDF8" />
            <rect x="7" y="7" width="4" height="4" fill="#22C55E" />
            <rect x="13" y="8" width="4" height="5" fill="#22C55E" />
            <rect x="8" y="13" width="5" height="4" fill="#22C55E" />
            <rect x="11" y="9" width="2" height="2" fill="#FACC15" />
          </>
        );
      case 'oops':
        return (
          <>
            <rect x="4" y="5" width="16" height="14" fill="#0B0F1A" />
            <rect x="5" y="6" width="14" height="12" fill="#EF4444" />
            <rect x="5" y="6" width="14" height="2" fill="#FCA5A5" />
            <rect x="7" y="9" width="2" height="2" fill="#FFFFFF" />
            <rect x="15" y="9" width="2" height="2" fill="#FFFFFF" />
            <rect x="8" y="14" width="2" height="2" fill="#1E293B" />
            <rect x="10" y="13" width="4" height="2" fill="#1E293B" />
            <rect x="14" y="14" width="2" height="2" fill="#1E293B" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`pixelated shrink-0 ${className}`}
      aria-hidden="true"
    >
      {renderArt()}
    </svg>
  );
};

export type MascotMood = 'idle' | 'happy' | 'excited' | 'thinking' | 'sad' | 'boss';

/**
 * BIT-BOT — original CG QUIZ animated 2D engineering builder mascot!
 */
export const PixelMascot: React.FC<{
  mood?: MascotMood;
  size?: number;
  className?: string;
}> = ({ mood = 'idle', size = 84, className = '' }) => {
  const eyeColor =
    mood === 'excited'
      ? '#22FF66'
      : mood === 'boss'
        ? '#FF6B00'
        : mood === 'sad'
          ? '#94A3B8'
          : '#38BDF8';

  const antennaColor =
    mood === 'excited'
      ? '#22FF66'
      : mood === 'sad'
        ? '#64748B'
        : '#FACC15';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`pixelated shrink-0 ${mood === 'sad' ? '' : 'animate-pixel-bob'} ${className}`}
      aria-hidden="true"
    >
      {/* Antenna spark */}
      <rect x="15" y="1" width="2" height="2" fill={antennaColor} />
      <rect x="15" y="3" width="2" height="3" fill="#94A3B8" />
      {mood === 'excited' && (
        <>
          <rect x="11" y="1" width="2" height="2" fill="#FEF08A" />
          <rect x="19" y="1" width="2" height="2" fill="#FEF08A" />
        </>
      )}

      {/* Yellow Engineering Hardhat */}
      <rect x="7" y="5" width="18" height="3" fill="#FACC15" />
      <rect x="5" y="8" width="22" height="2" fill="#EAB308" />
      <rect x="14" y="5" width="4" height="3" fill="#FEF08A" />

      {/* Robot Head Shell */}
      <rect x="6" y="10" width="20" height="11" fill="#0B0F1A" />
      <rect x="7" y="11" width="18" height="9" fill="#334155" />
      {/* Visor Screen */}
      <rect x="9" y="12" width="14" height="7" fill="#0F172A" />

      {/* Expressive Eyes */}
      {mood === 'excited' ? (
        <>
          <rect x="10" y="14" width="3" height="2" fill={eyeColor} />
          <rect x="11" y="13" width="1" height="1" fill={eyeColor} />
          <rect x="19" y="14" width="3" height="2" fill={eyeColor} />
          <rect x="20" y="13" width="1" height="1" fill={eyeColor} />
        </>
      ) : mood === 'sad' ? (
        <>
          <rect x="10" y="15" width="3" height="2" fill={eyeColor} />
          <rect x="19" y="15" width="3" height="2" fill={eyeColor} />
          <rect x="13" y="17" width="6" height="1" fill="#64748B" />
        </>
      ) : (
        <>
          <rect x="10" y="13" width="3" height="3" fill={eyeColor} />
          <rect x="19" y="13" width="3" height="3" fill={eyeColor} />
          <rect x="11" y="13" width="1" height="1" fill="#FFFFFF" />
          <rect x="20" y="13" width="1" height="1" fill="#FFFFFF" />
        </>
      )}

      {/* Mouth */}
      {mood === 'happy' || mood === 'excited' ? (
        <>
          <rect x="12" y="17" width="8" height="1" fill="#22C55E" />
          <rect x="13" y="18" width="6" height="1" fill="#22C55E" />
        </>
      ) : mood === 'thinking' ? (
        <rect x="14" y="17" width="4" height="1" fill="#FACC15" />
      ) : mood === 'sad' ? (
        <rect x="13" y="18" width="6" height="1" fill="#EF4444" />
      ) : (
        <rect x="13" y="17" width="6" height="1" fill="#38BDF8" />
      )}

      {/* Chest Chassis + Power Core */}
      <rect x="8" y="21" width="16" height="8" fill="#0B0F1A" />
      <rect x="9" y="22" width="14" height="6" fill="#475569" />
      <rect x="14" y="23" width="4" height="4" fill={mood === 'excited' ? '#FACC15' : '#22C55E'} />

      {/* Arms / Wrench */}
      <rect x="4" y="22" width="4" height="4" fill="#94A3B8" />
      <rect x="24" y="22" width="4" height="4" fill="#94A3B8" />
      {mood !== 'sad' && (
        <>
          <rect x="26" y="18" width="2" height="5" fill="#CBD5E1" />
          <rect x="25" y="16" width="4" height="2" fill="#CBD5E1" />
        </>
      )}

      {/* Feet */}
      <rect x="9" y="29" width="5" height="2" fill="#0B0F1A" />
      <rect x="18" y="29" width="5" height="2" fill="#0B0F1A" />
    </svg>
  );
};

/**
 * Animated voxel wall torch for Trophy Room & Hero stages.
 */
export const PixelTorch: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => (
  <svg
    viewBox="0 0 16 24"
    width={size * 0.68}
    height={size}
    shapeRendering="crispEdges"
    className={`pixelated shrink-0 ${className}`}
    aria-hidden="true"
  >
    {/* Flame */}
    <g className="animate-pixel-torch">
      <rect x="7" y="1" width="2" height="3" fill="#FEF08A" />
      <rect x="5" y="4" width="6" height="4" fill="#FACC15" />
      <rect x="4" y="7" width="8" height="3" fill="#F97316" />
      <rect x="6" y="5" width="4" height="3" fill="#FFFFFF" opacity="0.65" />
    </g>
    {/* Torch Collar */}
    <rect x="4" y="10" width="8" height="2" fill="#475569" />
    {/* Wooden Handle */}
    <rect x="6" y="12" width="4" height="10" fill="#78350F" />
    <rect x="7" y="12" width="1" height="10" fill="#92400E" />
  </svg>
);

export const PixelLoader: React.FC<{ label?: string }> = ({ label = 'LOADING...' }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div className="flex items-end gap-1.5 h-6" aria-hidden="true">
        <span className="w-3 h-3 bg-[var(--voxel-green)] border-2 border-[#0B0F1A] voxel-loader-block" />
        <span className="w-3 h-5 bg-[var(--voxel-gold)] border-2 border-[#0B0F1A] voxel-loader-block [animation-delay:120ms]" />
        <span className="w-3 h-6 bg-[var(--voxel-cyan)] border-2 border-[#0B0F1A] voxel-loader-block [animation-delay:240ms]" />
        <span className="w-3 h-4 bg-[var(--voxel-gold)] border-2 border-[#0B0F1A] voxel-loader-block [animation-delay:360ms]" />
        <span className="w-3 h-3 bg-[var(--voxel-green)] border-2 border-[#0B0F1A] voxel-loader-block [animation-delay:480ms]" />
      </div>
      <div className="font-pixel text-[10px] tracking-wider text-[var(--exam-text-muted)]">
        {label}
      </div>
    </div>
  );
};
