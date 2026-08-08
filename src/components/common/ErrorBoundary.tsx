import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
          <div className="bg-white/5 border border-red-500/30 p-8 rounded-[2.5rem] max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white mb-2">¡Ups! Algo salió mal</h2>
              <p className="text-gray-400 text-sm">
                Hubo un problema procesando esta pantalla. La conexión o los datos pueden tener un formato inesperado.
              </p>
              <div className="mt-4 p-4 bg-black/40 rounded-xl overflow-auto text-left">
                <p className="text-red-400 font-mono text-xs">{this.state.error?.message}</p>
                <p className="text-red-400/50 font-mono text-[10px] mt-2 whitespace-pre-wrap">{this.state.error?.stack}</p>
              </div>
            </div>
            <button
              onClick={() => {
                // @ts-ignore
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="w-full bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={18} /> RECARGAR PANTALLA
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

export default ErrorBoundary;
