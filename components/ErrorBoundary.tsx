'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * ErrorBoundary — Catches render errors and shows a graceful fallback.
 * Wrap any risky component (charts, WebSocket-driven UI) with this.
 *
 * Usage:
 *   <ErrorBoundary label="Chart">
 *     <SodexProfessionalChart ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, padding: 32, minHeight: 180,
          background: 'rgba(255,107,107,0.04)', border: '1px solid rgba(255,107,107,0.15)',
          borderRadius: 16, color: '#888',
        }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b', marginBottom: 4 }}>
              {this.props.label ? `${this.props.label} crashed` : 'Something went wrong'}
            </div>
            <div style={{ fontSize: 11, color: '#555', maxWidth: 280 }}>{this.state.message}</div>
          </div>
          <button
            onClick={this.reset}
            style={{
              padding: '6px 18px', borderRadius: 8,
              border: '1px solid rgba(255,107,107,0.3)',
              background: 'rgba(255,107,107,0.08)',
              color: '#ff6b6b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
