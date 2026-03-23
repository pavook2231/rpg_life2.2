import React from "react";

type Props = {
  children: React.ReactNode;
  resetKeys?: unknown[];
  fallback: (args: { error: Error; reset: () => void }) => React.ReactNode;
};

type State = {
  error: Error | null;
};

function areResetKeysEqual(previous: unknown[] = [], next: unknown[] = []) {
  if (previous.length !== next.length) {
    return false;
  }

  for (let index = 0; index < previous.length; index += 1) {
    if (!Object.is(previous[index], next[index])) {
      return false;
    }
  }

  return true;
}

export class ScreenRenderBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[screen-render-boundary]", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && !areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
      });
    }

    return this.props.children;
  }
}
