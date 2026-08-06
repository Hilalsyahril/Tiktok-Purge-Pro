/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {

  return (
    <div className="w-full h-screen bg-[#0A0A0C] text-[#E4E4E7] font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-[#111114] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FE2C55] rounded-lg flex items-center justify-center shadow-lg shadow-[#FE2C55]/20">
            <span className="text-white font-bold text-xs">TT</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">TikTok Purge <span className="text-[#FE2C55]">Pro</span></h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] -mt-1">Automation Suite v3.4.2</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
          <div className="w-2 h-2 rounded-full bg-[#2ECC71] animate-pulse"></div>
          <span className="text-xs font-medium text-white/70">Engine Ready</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Sidebar Controls */}
        <aside className="w-[320px] flex flex-col gap-4">
          <div className="bg-[#111114] border border-white/5 rounded-2xl p-5 flex flex-col gap-6">
            <section>
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3 block">Operation Mode</label>
              <div className="grid gap-2">
                {['Remove Reposts', 'Unlike Videos', 'Clear Favorites'].map((mode, i) => (
                  <button key={mode} className={`w-full flex items-center justify-between p-3 rounded-xl border ${i === 0 ? 'border-[#FE2C55]/50 bg-[#FE2C55]/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'} text-white transition-all`}>
                    <span className="text-sm font-medium">{mode}</span>
                    {i === 0 && <div className="w-2 h-2 rounded-full bg-[#FE2C55]"></div>}
                  </button>
                ))}
              </div>
            </section>
            
            <button className="w-full bg-[#FE2C55] hover:bg-[#ff4065] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#FE2C55]/20 transition-all flex items-center justify-center gap-2">
              START AUTOMATION
            </button>
          </div>
        </aside>

        {/* Dashboard Content */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-6">
            {['Processed', 'Current Batch', 'Account Status'].map((stat, i) => (
              <div key={stat} className="bg-[#111114] border border-white/5 rounded-2xl p-5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">{stat}</p>
                <div className="text-3xl font-mono font-bold">{i === 0 ? '452' : i === 1 ? '42/104' : 'SAFE'}</div>
              </div>
            ))}
          </div>
          
          <div className="flex-1 bg-[#050505] border border-white/5 rounded-2xl p-6 font-mono text-[13px] text-white/50 overflow-y-auto">
            [14:28:16] Success: Removed repost for item #38.<br />
            [14:28:19] Applying micro-delay: 2.1s (Human-simulated)<br />
            [14:28:24] Success: Removed repost for item #39.
          </div>
        </div>
      </main>
    </div>
  );
}

