import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  readonly error: Error | null;
}

/** Contains a crashing view so the rest of the dashboard (and the disclaimer) stay usable. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[dsa] view crashed', error, info.componentStack);
  }

  override componentDidUpdate(previous: { resetKey?: string }): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error !== null)
      this.setState({ error: null });
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-3 text-sm"
      >
        <p className="font-medium">This view hit an error and was stopped. Your data is safe.</p>
        <p className="text-muted">{this.state.error.message}</p>
        <div>
          <button
            type="button"
            className="h-8 rounded-lg border border-border px-3 text-sm"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
