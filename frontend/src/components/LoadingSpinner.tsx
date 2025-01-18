'use client';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function LoadingSpinner({ size = 'medium', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'w-4 h-4 border-2',
    medium: 'w-8 h-8 border-3',
    large: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          border-t-blue-600
          border-r-blue-600/40
          border-b-blue-600/20
          border-l-blue-600/60
          animate-spin
          rounded-full
        `}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

// Loading states for different contexts
export function SearchLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] bg-[#1A1F2A] rounded-lg p-6">
      <LoadingSpinner size="large" className="mb-4" />
      <div className="text-gray-400">Searching vectors...</div>
    </div>
  );
}

export function VisualizationLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] bg-[#1A1F2A] rounded-lg p-6">
      <LoadingSpinner size="large" className="mb-4" />
      <div className="text-gray-400">Preparing visualization...</div>
    </div>
  );
}

export function ResultsLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-[#1A1F2A] rounded-lg p-6">
      <LoadingSpinner size="large" className="mb-4" />
      <div className="text-gray-400">Loading results...</div>
    </div>
  );
}

export function InlineLoading() {
  return (
    <div className="flex items-center justify-center p-2">
      <LoadingSpinner size="small" />
    </div>
  );
}
