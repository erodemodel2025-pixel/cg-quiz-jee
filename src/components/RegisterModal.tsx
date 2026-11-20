import React, { useEffect, useState } from 'react';
import { AlertTriangle, UserPlus, X } from 'lucide-react';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { CLASS_OPTIONS, type ClassOption } from '../../shared/types.ts';

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  subtitle?: string;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  open,
  onClose,
  onSuccess,
  subtitle,
}) => {
  const { registerPlayer } = useArcade();
  const [name, setName] = useState('');
  const [className, setClassName] = useState<ClassOption | ''>('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Enter a player name (at least 2 characters).');
      arcadeAudio.playSfx('wrong');
      return;
    }
    if (!className) {
      setError('Select your class before entering the studio.');
      arcadeAudio.playSfx('wrong');
      return;
    }

    setSubmitting(true);
    const res = await registerPlayer(trimmed, className);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not register player.');
      return;
    }

    onClose();
    onSuccess?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="studio-card-solid max-w-md w-full p-6 relative border-2 border-[var(--studio-border-strong)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-modal-title"
      >
        <button
          type="button"
          onClick={() => {
            arcadeAudio.playSfx('click');
            onClose();
          }}
          aria-label="Close registration modal"
          className="studio-btn studio-btn-ghost p-2 min-h-[36px] absolute top-4 right-4"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-md">
            <UserPlus size={20} />
          </div>
          <div>
            <h2 id="register-modal-title" className="font-heading font-bold text-lg text-[var(--studio-text)]">
              Studio Sign-In
            </h2>
            <p className="font-mono-tech text-[11px] font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">
              Save Progress, Cars &amp; Smartphones
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--studio-text-secondary)] mb-5">
          {subtitle ||
            'Enter a new handle to create a profile, or enter your existing Creator Name and Class to sign back in and continue earning XP.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="player-name-input"
              className="block font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)] mb-2"
            >
              Creator Name
            </label>
            <input
              id="player-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. NovaEngineer"
              className="studio-input w-full px-3.5 py-2.5 text-base"
              autoFocus
            />
          </div>

          <div>
            <span className="block font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)] mb-2">
              Select Class
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {CLASS_OPTIONS.map((cls) => {
                const selected = className === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setClassName(cls);
                    }}
                    className={`studio-btn text-xs py-2 px-2 min-h-[38px] ${
                      selected ? 'studio-btn-primary' : 'studio-btn-ghost'
                    }`}
                  >
                    {cls.replace('Class ', 'Cls ')}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-[#DC2626] text-white px-3.5 py-2.5 text-sm font-medium flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onClose();
              }}
              className="studio-btn studio-btn-ghost flex-1 py-2.5 text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="studio-btn studio-btn-primary flex-1 py-2.5 text-xs sm:text-sm"
            >
              {submitting ? 'Saving...' : 'Enter Studio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
