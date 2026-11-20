import React from 'react';
import { PixelIllustration } from './pixel/PixelArtAssets.tsx';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onGoHome?: () => void;
  onReportError?: (msg: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onReportError?.(error.message || 'Unexpected UI error');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto my-12 px-4">
          <div className="exam-card p-6 sm:p-8 text-center space-y-4">
            <PixelIllustration name="oops" size={58} className="mx-auto" />
            <h2 className="font-pixel text-sm text-[var(--exam-text)]">OOPS!</h2>
            <p className="text-sm text-[var(--exam-text-secondary)]">
              Something went wrong while loading this view. Your progress and saved data are safe.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="exam-btn exam-btn-primary text-sm"
              >
                TRY AGAIN
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false });
                  this.props.onGoHome?.();
                }}
                className="exam-btn exam-btn-secondary text-sm"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
