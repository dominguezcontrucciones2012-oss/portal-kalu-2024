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
    if (error.message.includes('Failed to fetch dynamically imported module') || error.message.includes('Importing a module script failed')) {
      // Si falla un chunk, forzamos una recarga con cache busting
      setTimeout(() => {
        window.location.href = window.location.pathname + '?t=' + new Date().getTime();
      }, 1000);
      return;
    }
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.error?.message.includes('Failed to fetch dynamically imported module') || this.state.error?.message.includes('Importing a module script failed')) {
        return (
          <div style={{ padding: 40, color: 'white', backgroundColor: '#0f172a', height: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{fontSize: '24px', fontWeight: 'bold'}}>Instalando actualización...</h2>
            <p style={{color: '#94a3b8', marginTop: 10, textAlign: 'center'}}>La aplicación se está reiniciando para aplicar la nueva versión.</p>
            <button onClick={() => window.location.href = window.location.pathname + '?t=' + new Date().getTime()} style={{ padding: '12px 24px', marginTop: 30, cursor: 'pointer', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              Haz clic aquí si no se recarga sola
            </button>
          </div>
        );
      }

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
