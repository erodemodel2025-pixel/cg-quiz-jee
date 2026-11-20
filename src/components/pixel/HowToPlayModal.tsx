import React from 'react';
import { arcadeAudio } from '../../audio/arcadeAudio.ts';
import { PixelIcon, PixelIllustration } from './PixelArtAssets.tsx';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
  onStartQuiz: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  open,
  onClose,
  onStartQuiz,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="exam-card max-w-lg w-full p-6 sm:p-7 relative space-y-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
      >
        <button
          type="button"
          onClick={() => {
            arcadeAudio.playSfx('click');
            onClose();
          }}
          aria-label="Close how to play dialog"
          className="exam-btn exam-btn-secondary p-2 min-h-[38px] absolute top-4 right-4"
        >
          <PixelIcon name="close" size={16} />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <PixelIllustration name="question_block" size={44} />
          <div>
            <h2
              id="how-to-play-title"
              className="font-pixel text-sm sm:text-base text-[var(--exam-text)]"
            >
              HOW TO PLAY
            </h2>
            <p className="text-xs sm:text-sm text-[var(--exam-text-secondary)] mt-1">
              3 quick steps to level up your brain.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="exam-card-subtle p-3.5 flex items-start gap-3">
            <span className="w-7 h-7 bg-[var(--voxel-green)] text-[#0B0F1A] border-2 border-[#0B0F1A] font-pixel text-xs flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <div className="font-display-pixel text-sm font-bold text-[var(--exam-text)]">
                Pick a Quiz or Category
              </div>
              <p className="text-xs sm:text-sm text-[var(--exam-text-secondary)] mt-0.5">
                Jump straight into a 10-question Quick Quiz, or choose from 12 engineering branches including CS, AI, Robotics, Mechanical, Civil, and Electrical.
              </p>
            </div>
          </div>

          <div className="exam-card-subtle p-3.5 flex items-start gap-3">
            <span className="w-7 h-7 bg-[var(--voxel-gold)] text-[#0B0F1A] border-2 border-[#0B0F1A] font-pixel text-xs flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <div className="font-display-pixel text-sm font-bold text-[var(--exam-text)]">
                Answer Before Time Runs Out
              </div>
              <p className="text-xs sm:text-sm text-[var(--exam-text-secondary)] mt-0.5">
                Tap a blocky answer tile and hit Check Answer for instant tips, or test yourself in Mock Exam and Survival modes.
              </p>
            </div>
          </div>

          <div className="exam-card-subtle p-3.5 flex items-start gap-3">
            <span className="w-7 h-7 bg-[var(--voxel-cyan)] text-[#0B0F1A] border-2 border-[#0B0F1A] font-pixel text-xs flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <div className="font-display-pixel text-sm font-bold text-[var(--exam-text)]">
                Review Mistakes & Climb Ranks
              </div>
              <p className="text-xs sm:text-sm text-[var(--exam-text-secondary)] mt-0.5">
                Wrong answers are saved to My Mistakes automatically with smart explanations so every run makes you sharper.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onClose();
              onStartQuiz();
            }}
            className="exam-btn exam-btn-primary w-full sm:w-auto px-6 text-xs sm:text-sm"
          >
            <PixelIcon name="play" size={14} /> START QUIZ NOW
          </button>
        </div>
      </div>
    </div>
  );
};
