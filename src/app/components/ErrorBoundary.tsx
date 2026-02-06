import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Component name for error context */
  componentName?: string;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error for debugging
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
      if (this.props.componentName) {
        console.error(`Component: ${this.props.componentName}`);
      }
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send to error tracking service (Sentry, etc.) in production
    // Example:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack,
    //       },
    //     },
    //     tags: {
    //       component: this.props.componentName || 'Unknown',
    //     },
    //   });
    // }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
                {this.props.componentName && (
                  <p className="text-xs text-slate-500 mt-0.5">in {this.props.componentName}</p>
                )}
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-md p-3 border border-white/[0.05]">
              <p className="text-slate-300 text-sm">{errorMessage}</p>
            </div>

            {isDev && this.state.errorInfo && (
              <details className="bg-white/[0.02] rounded-md p-3 border border-white/[0.05]">
                <summary className="text-xs text-slate-400 cursor-pointer mb-2">
                  Error Details (Dev Mode)
                </summary>
                <pre className="text-xs text-slate-500 overflow-auto max-h-40">
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                variant="outline"
                className="flex-1"
              >
                Reload Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="ghost"
                className="flex-1"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>

            {!isDev && (
              <p className="text-xs text-slate-500 text-center pt-2">
                If this problem persists, please contact support.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}






