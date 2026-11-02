import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * The last line before a blank page. Sits above the routes, so it can't use the router or the design's providers:
 * going home is a real page load, which also picks up a new version of the app if that's what went wrong.
 */
export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('The app crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-testid="app-error" className="flex min-h-dvh flex-col justify-center gap-4 bg-background px-6 text-foreground">
        <h1 className="fx text-6xl">Something broke</h1>
        <p className="text-xl">The app hit a problem. If you were training, your session is saved and you can pick it up from home.</p>
        <button type="button" onClick={() => window.location.reload()} className="plate plate-lime fx h-14 text-3xl">
          Reload
        </button>
        <button type="button" onClick={() => window.location.assign('/')} className="plate plate-graphite fx h-14 text-3xl">
          Go home
        </button>
      </div>
    );
  }
}
