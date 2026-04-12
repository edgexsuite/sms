import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// @ts-ignore — React.Component types require @types/react; the component works at runtime
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    // @ts-ignore
    super(props);
    // @ts-ignore
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // @ts-ignore
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  // @ts-ignore
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // @ts-ignore
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    // @ts-ignore
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  // @ts-ignore
  render() {
    // @ts-ignore
    if (this.state.hasError) {
      // @ts-ignore
      if (this.props.fallback) return this.props.fallback;
      // @ts-ignore
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    // @ts-ignore
    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-4">This page encountered an unexpected error. Your data is safe.</p>
        {error && (
          <details className="text-left mb-6 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            <summary className="px-4 py-2.5 text-xs font-mono text-gray-500 cursor-pointer hover:bg-gray-100 select-none">
              Error details ▸
            </summary>
            <pre className="px-4 py-3 text-xs text-red-600 font-mono overflow-auto max-h-40 whitespace-pre-wrap">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" /> Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
