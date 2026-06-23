/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the tree so a single bad SMILES or
 * malformed API payload shows a recoverable message instead of a blank page.
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl shadow-sm p-6 text-left">
          <h1 className="text-sm font-bold text-rose-900 mb-2 font-mono uppercase tracking-wider">
            Something went wrong
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            The interface hit an unexpected error and stopped rendering. Your
            saved lab experiments are untouched. You can try to recover, or
            reload the page.
          </p>
          <pre className="text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-100 rounded p-2 mb-4 whitespace-pre-wrap break-words max-h-32 overflow-auto">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="px-3 py-2 bg-[#0A355C] hover:bg-[#07243E] text-white font-bold text-xs uppercase tracking-wider rounded font-mono transition-all cursor-pointer"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded font-mono transition-all cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
