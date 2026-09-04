import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

// A recoverable fallback around the app shell (docs/06 Phase 6) — an
// unhandled render error anywhere below this (a bad response shape, a null
// dereference) would otherwise unmount the whole tree to a blank page, as
// happened with the pre-fix crypto.randomUUID() crash.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in app shell:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="max-w-sm text-sm text-slate-600">
            Reloading usually fixes this. Your applications are saved — nothing was lost.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
