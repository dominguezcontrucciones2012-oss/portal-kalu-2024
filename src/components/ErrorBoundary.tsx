import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  state: {hasError: boolean, error: Error | null} = { hasError: false, error: null };
  props: {children: React.ReactNode};

  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white', backgroundColor: '#990000', height: '100vh', fontFamily: 'sans-serif' }}>
          <h2>Oops, the app crashed!</h2>
          <p>{this.state.error?.toString()}</p>
          <pre style={{ fontSize: 10, background: '#000', padding: 10, overflow: 'auto' }}>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20, cursor: 'pointer' }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
