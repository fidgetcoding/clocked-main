import { Component, Suspense, type ReactNode } from 'react';

interface Props {
  /** The camera's code couldn't load or crashed. The session carries on without it. */
  onFailed: () => void;
  children: ReactNode;
}

/** Keeps a camera failure inside the camera. Most often this is a new version going out mid-visit, so its files have moved. */
export class CameraBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('The camera failed to load:', error);
    this.props.onFailed();
  }

  render() {
    if (this.state.failed) return null;
    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}
