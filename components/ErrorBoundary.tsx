import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // TODO: send to monitoring service (Sentry, LogRocket, etc.)
    // console.error('Uncaught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // Optional: force reload to recover from irrecoverable state
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial', color: '#111' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ marginBottom: 16 }}>An unexpected error occurred. Please try again.</p>
          <button onClick={this.handleRetry} style={{ padding: '8px 12px', background: '#4F46E5', color: '#fff', borderRadius: 6, border: 0 }}>Retry</button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre style={{ background: '#f6f8fa', padding: 12, marginTop: 16, borderRadius: 6, overflow: 'auto' }}>
              {String(this.state.error.stack || this.state.error.message)}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
