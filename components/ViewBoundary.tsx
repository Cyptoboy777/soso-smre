'use client';
import React from 'react';

type Props = { resetKey: string; onHome: () => void; children: React.ReactNode };
type State = { error: Error | null; n: number };

/** If one screen throws while rendering, show a calm message for that screen only. The header, wallet and other tabs keep working,
 * instead of the whole app turning into a blank page. */
export default class ViewBoundary extends React.Component<Props, State> {
  state: State = { error: null, n: 0 };
  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('View crashed:', this.props.resetKey, error, info.componentStack); }
  componentDidUpdate(prev: Props) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState((s) => ({ error: null, n: s.n + 1 })); }
  copy = () => {
    const e = this.state.error;
    const text = `SoSwapDEX screen error\nview: ${this.props.resetKey}\n${e?.name}: ${e?.message}\n${(e?.stack ?? '').split('\n').slice(0, 4).join('\n')}`;
    try { void navigator.clipboard?.writeText(text); } catch { /* ignore */ }
  };
  render() {
    if (!this.state.error) return <React.Fragment key={this.state.n}>{this.props.children}</React.Fragment>;
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center">
        <div className="text-base font-semibold text-zinc-100">This screen could not load</div>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">Something unexpected happened while showing it. Your wallet and funds are not affected. Try again, or go back to Home.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => this.setState((s) => ({ error: null, n: s.n + 1 }))} className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-black hover:bg-orange-400">Try again</button>
          <button type="button" onClick={() => { this.setState((s) => ({ error: null, n: s.n + 1 })); this.props.onHome(); }} className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-200 hover:bg-white/[0.08]">Go to Home</button>
        </div>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 mr-3 text-[11px] text-zinc-400 underline hover:text-zinc-200">Reload page</button>
        <button type="button" onClick={this.copy} className="mt-3 text-[11px] text-zinc-500 underline hover:text-zinc-300">Copy details for support</button>
      </div>
    );
  }
}
