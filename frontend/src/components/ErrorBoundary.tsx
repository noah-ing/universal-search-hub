'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: error.stack || '',
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Here you would typically send to your error tracking service
    // e.g., Sentry, LogRocket, etc.
    const errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    };

    // Log error details for debugging
    console.error('Error details:', errorDetails);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-[400px] flex items-center justify-center bg-[#1A1F2A] rounded-lg p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-500 mb-2">
              Something went wrong
            </h2>
            <div className="text-gray-400 mb-4">
              An error occurred while rendering this component
            </div>
            <details className="text-left bg-[#151922] rounded-lg p-4 max-w-2xl mx-auto overflow-auto">
              <summary className="text-gray-300 cursor-pointer mb-2">
                Error Details
              </summary>
              <pre className="text-sm text-gray-400 whitespace-pre-wrap break-words">
                {this.state.error?.message}
                {'\n\n'}
                {this.state.errorInfo}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC to wrap components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
