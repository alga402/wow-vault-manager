'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Data States
  const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde')
  const [absensiCode, setAbsensiCode] = useState(''); const [dbDailyCode, setDbDailyCode] = useState('123')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [pdfUrl, setPdfUrl] = useState(''); const [totalWorkTime, setTotalWorkTime] = useState('0j 0m')
  const [logs, setLogs] = useState<any[]>([]); const [currentTime, setCurrentTime] = useState(new Date())

  const PASSWORD_ADMIN = "12345"

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setUser(session?.user ?? null)
      if(session?.user) { checkTodayAttendance(session.user.id); calculateTotalHours(session.user.id) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { checkTodayAttendance(session.user.id); calculateTotalHours(session.user.id) }
    })
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchData()
    return () => { subscription.unsubscribe(); clearInterval(timer) }
  }, [])

  const fetchData = async () => {
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(10)
    if (l) setLogs(l)
    const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
    if (s) { setDbDailyCode(s.daily_code || '123'); setPdfUrl(s.schedule_pdf_url || '') }
  }

  const checkTodayAttendance = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*').eq('user_id', userId).gte('check_in_time', today).single()
    setAttendanceData(data)
  }

  const calculateTotalHours = async (userId: string) => {
    const { data } = await supabase.from('attendance').select('check_in_time, check_out_time').eq('user_id', userId).not('check_out_time', 'is', null)
    if (data) {
      let mins = 0; data.forEach(r => { mins += Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000) })
      setTotalWorkTime(`${Math.floor(mins/60)}j ${mins%60}m`)
    }
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: (e.target as any).email.value, password: (e.target as any).password.value })
    if (error) alert(error.message); setLoading(false)
  }

  const handleAbsensi = async () => {
    if (absensiCode !== dbDailyCode) return alert("KODE SALAH!")
    setLoading(true)
    if (!attendanceData) await supabase.from('attendance').insert([{ user_id: user.id, farmer_name: user.email?.split('@')[0] }])
    else await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id)
    setAbsensiCode(''); checkTodayAttendance(user.id); setLoading(false); calculateTotalHours(user.id)
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await supabase.from('gold_logs').insert([{ farmer_name: user.email?.split('@')[0], gold_amount: parseInt(gold), server_name: serverName, faction, status: 'Pending', user_id: user.id }])
    setGold(''); setServerName(''); fetchData(); setLoading(false)
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#05060a] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/10 blur-[150px] rounded-full"></div>
        
        <div className="bg-black/60 backdrop-blur-2xl p-8 md:p-12 rounded-3xl border border-white/10 w-full max-w-sm shadow-2xl relative z-10 text-center">
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Vault Command</h1>
          <p className="text-yellow-500 text-[9px] font-black tracking-[0.4em] mb-12 uppercase italic">Awaiting Operator Identity</p>
          
          <button onClick={handleGoogleLogin} className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] mb-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
            CONNECT ACCOUNT
          </button>

          <div className="flex items-center gap-4 mb-6 opacity-20"><div className="h-px bg-white flex-1"></div><span className="text-[8px] text-white font-black">OR</span><div className="h-px bg-white flex-1"></div></div>

          <form onSubmit={handleManualAuth} className="space-y-4">
            <input name="email" type="email" placeholder="OPERATOR_ID" className="w-full bg-black/50 border border-white/5 p-4 rounded-xl text-[10px] font-bold text-white outline-none focus:border-yellow-500/50 transition-all" required />
            <input name="password" type="password" placeholder="SECURITY_KEY" className="w-full bg-black/50 border border-white/5 p-4 rounded-xl text-[10px] font-bold text-white outline-none focus:border-yellow-500/50 transition-all" required />
            <button type="submit" className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl text-[11px] tracking-[0.3em] hover:brightness-110 active:scale-95 transition-all shadow-lg">LOGIN_SECURE</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020306] text-slate-300 font-sans p-2 md:p-8 uppercase tracking-tighter overflow-x-hidden relative pb-28 md:pb-8">
      {/* MOBILE HEADER */}
      <header className="md:hidden flex justify-between items-center bg-black/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-yellow-500 rounded-lg flex items-center justify-center font-black text-black italic text-xl shadow-lg shadow-yellow-500/20">V</div>
          <h1 className="text-lg font-black italic text-white tracking-tighter">VAULT_CMD</h1>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-1.5 rounded-lg text-[8px] font-black transition-all border border-red-500/20">EXIT</button>
      </header>

      <div className="max-w-7xl mx-auto space-y-4 md:space-y-8 relative z-10">
        
        {/* DESKTOP HEADER */}
        <header className="hidden md:flex flex-col lg:flex-row justify-between items-center bg-black/40 backdrop-blur-2xl border border-white/5 p-8 rounded-[3rem] shadow-2xl overflow-hidden relative group">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-[2rem] flex items-center justify-center font-black text-black italic text-4xl shadow-2xl border border-yellow-200/20">V</div>
            <div>
              <h1 className="text-3xl font-black italic text-white tracking-tighter leading-none mb-2">VAULT_COMMAND <span className="text-yellow-500 text-[10px] not-italic ml-2 tracking-widest opacity-50">v6.0</span></h1>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,1)]"></span>
                <p className="text-[10px] font-black text-slate-500 tracking-[0.2em]">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8 lg:mt-0">
            <div className="bg-black/40 border border-white/5 px-8 py-5 rounded-[2rem] text-center backdrop-blur-sm">
              <p className="text-[8px] font-black text-slate-500 mb-1 tracking-widest italic">SHIFT_TIME</p>
              <p className="text-xl font-mono text-white font-black">{totalWorkTime}</p>
            </div>
            <div className="bg-black/40 border border-white/5 px-8 py-5 rounded-[2rem] text-center backdrop-blur-sm border-l-yellow-500/20 border-l-4">
              <p className="text-[8px] font-black text-slate-500 mb-1 tracking-widest italic">CLOCK_SYNC</p>
              <p className="text-xl font-mono text-yellow-500 font-black">{currentTime.toLocaleTimeString('id-ID')}</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 rounded-[2rem] text-[10px] font-black transition-all border border-red-500/20 active:scale-95">SIGNOUT</button>
          </div>
        </header>

        {/* MOBILE SHIFT CARD */}
        <div className="md:hidden bg-black/40 border border-white/5 p-5 rounded-2xl flex justify-between items-center shadow-xl">
           <div className="text-left border-l-4 border-l-yellow-500 pl-4">
              <p className="text-[8px] font-black text-slate-500 mb-0.5 tracking-widest italic uppercase">Shift_Hrs</p>
              <p className="text-xl font-mono text-white font-black">{totalWorkTime}</p>
           </div>
           <div className="text-right">
              <p className="text-[8px] font-black text-slate-500 mb-0.5 tracking-widest italic uppercase">Sync_Time</p>
              <p className="text-xl font-mono text-yellow-500 font-black">{currentTime.toLocaleTimeString('id-ID')}</p>
           </div>
        </div>

        {/* MOBILE NAVIGATION BAR (Fixed Bottom) */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/80 backdrop-blur-2xl border-t border-white/5 p-3 flex justify-around items-center rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
          {[
            { id: 'gold', icon: '💰', label: 'VAULT' },
            { id: 'absen', icon: '⚔️', label: 'DUTY' },
            { id: 'piket', icon: '📅', label: 'MAP' }
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === t.id ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 scale-105' : 'text-slate-600 hover:text-white hover:bg-white/5'}`}>
              <span className="text-xl">{t.icon}</span>
              <span className="text-[9px] font-black tracking-[0.2em]">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* DESKTOP NAVIGATION (Jelas saat layar besar) */}
        <nav className="hidden md:flex justify-center gap-3 p-2 bg-white/5 border border-white/5 rounded-[2.5rem] w-fit mx-auto backdrop-blur-xl shadow-2xl">
          {[
            { id: 'gold', icon: '💰', label: 'VAULT' },
            { id: 'absen', icon: '⚔️', label: 'DUTY' },
            { id: 'piket', icon: '📅', label: 'STRAT' }
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-12 py-5 rounded-[2rem] transition-all duration-500 flex items-center gap-4 ${activeTab === t.id ? 'bg-yellow-500 text-black shadow-[0_20px_40px_rgba(234,179,8,0.3)] scale-105' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
              <span className="text-2xl">{t.icon}</span>
              <span className="text-[11px] font-black tracking-[0.3em] hidden md:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* TAB ANIMATION CONTAINER */}
        <div className="min-h-[600px] transition-all duration-700">
          {activeTab === 'gold' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-5">
              <div className="lg:col-span-4 bg-black/40 p-6 md:p-10 rounded-2xl md:rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                <h2 className="text-[10px] md:text-[11px] font-black text-yellow-500 mb-6 md:mb-10 italic tracking-[0.3em] flex items-center gap-3 uppercase decoration-yellow-500/30 underline decoration-4 underline-offset-8">
                   TRANSMIT_GOLD
                </h2>
                <form onSubmit={handleDeposit} className="space-y-4 md:space-y-6">
                  <input type="text" placeholder="SERVER EX: VANILLA_PRO" className="w-full bg-black/50 border border-white/5 p-4 md:p-5 rounded-xl md:rounded-3xl text-[11px] md:text-[12px] font-bold text-white outline-none focus:border-yellow-500/40 transition-all uppercase placeholder:opacity-20" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <select className="w-full bg-black/50 border border-white/5 p-4 md:p-5 rounded-xl md:rounded-3xl text-[10px] md:text-[11px] font-black text-white outline-none" value={faction} onChange={e=>setFaction(e.target.value)}>
                    <option value="Horde">🔴 HORDE</option>
                    <option value="Alliance">🔵 ALLIANCE</option>
                  </select>
                  <div className="bg-black p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-white/5 text-center shadow-inner mt-4 md:mt-8 relative">
                    <p className="text-[9px] font-black text-yellow-600/40 mb-2 md:mb-4 tracking-[0.6em] italic uppercase">G_UNITS</p>
                    <input type="number" placeholder="0000" className="w-full bg-transparent text-5xl md:text-6xl font-mono font-black text-yellow-500 outline-none text-center drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]" value={gold} onChange={e=>setGold(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-black py-5 md:py-6 rounded-xl md:rounded-[2.5rem] text-[12px] md:text-[13px] tracking-[0.6em] shadow-[0_20px_50px_rgba(234,179,8,0.2)] hover:brightness-110 active:scale-95 transition-all mt-4 uppercase">TRANSMIT</button>
                </form>
              </div>

              <div className="lg:col-span-8 bg-black/20 rounded-2xl md:rounded-[4rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="p-5 md:p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                   <span className="text-[10px] md:text-[11px] font-black text-slate-400 tracking-[0.3em] md:tracking-[0.5em] italic uppercase">STREAM_FEED</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-black italic uppercase">
                    <tbody className="divide-y divide-white/5">
                      {logs.length > 0 ? logs.map(i=>(
                        <tr key={i.id} className="group hover:bg-white/[0.04] transition-all">
                          <td className="p-5 md:p-8 text-white">
                            <span className="block text-sm mb-1 font-bold tracking-tight">{i.farmer_name}</span>
                            <span className="text-[8px] text-slate-600 tracking-[0.2em] font-mono">{i.server_name}</span>
                          </td>
                          <td className="p-5 md:p-8 text-right font-mono text-xl md:text-3xl text-yellow-500 group-hover:scale-110 transition-transform duration-500">{i.gold_amount.toLocaleString()} <span className="text-[9px] opacity-40">G</span></td>
                          <td className="p-5 md:p-8 text-right">
                             <span className={`px-4 py-1.5 md:px-6 md:py-2 rounded-full text-[8px] md:text-[9px] tracking-[0.2em] md:tracking-[0.4em] font-black border ${i.status==='Sold'?'text-green-400 border-green-400/20 bg-green-400/5':'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'}`}>
                               {i.status}
                             </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td className="p-10 text-center text-slate-700 tracking-[1em]">NO_LOG</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'absen' && (
            <div className="max-w-2xl mx-auto py-6 md:py-12 animate-in zoom-in-95 duration-700">
              {isAdmin && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 p-6 md:p-10 rounded-2xl md:rounded-[3.5rem] mb-6 md:mb-10 backdrop-blur-3xl animate-pulse">
                  <h3 className="text-[10px] md:text-[11px] font-black text-yellow-500 mb-6 md:mb-8 tracking-[0.4em] md:tracking-[0.6em] text-center uppercase">🛡️ MASTER_UNIT</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-2 md:space-y-3">
                      <p className="text-[8px] md:text-[9px] text-yellow-500/60 ml-4 md:ml-5 font-black uppercase">SET_ACCESS_KEY</p>
                      <input type="text" className="w-full bg-black/60 border border-yellow-500/40 p-4 md:p-5 rounded-xl md:rounded-3xl text-yellow-500 font-mono text-3xl text-center outline-none focus:border-yellow-500" value={dbDailyCode} onChange={async (e) => { const nc = e.target.value.toUpperCase(); setDbDailyCode(nc); await supabase.from('global_settings').update({ daily_code: nc }).eq('id', 'current_rate'); }} />
                    </div>
                    <div className="bg-black/40 p-4 md:p-6 rounded-xl md:rounded-3xl border border-white/5 flex items-center">
                      <p className="text-[9px] text-slate-500 leading-relaxed italic text-center uppercase tracking-[0.1em]">Change this daily. Farmers must use this key to authorize start/end shift.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`p-8 md:p-16 rounded-3xl md:rounded-[5rem] border shadow-2xl text-center bg-black/40 backdrop-blur-3xl transition-all duration-1000 ${!attendanceData ? 'border-green-500/20' : (attendanceData.check_out_time ? 'border-white/5' : 'border-red-500/20')}`}>
                <div className="h-28 w-28 md:h-40 md:w-40 mx-auto rounded-full flex items-center justify-center text-5xl md:text-6xl bg-black border-2 transition-all duration-1000 ${!attendanceData ? 'border-green-500 animate-pulse' : (attendanceData.check_out_time ? 'border-white/10' : 'border-red-500')} mb-8">
                  {!attendanceData ? '🔓' : (attendanceData.check_out_time ? '✅' : '🚨')}
                </div>
                <h2 className="text-2xl md:text-4xl font-black italic text-white mb-2 md:mb-4 uppercase tracking-tighter">
                  {!attendanceData ? 'INITIATE_DUTY' : (attendanceData.check_out_time ? 'SESSION_ARCHIVED' : 'TERMINATE_SHIFT')}
                </h2>
                <p className="text-[10px] md:text-[11px] text-slate-500 font-black tracking-[0.3em] md:tracking-[0.6em] mb-10 md:mb-12 uppercase italic">Verification required via daily access key</p>
                
                {!attendanceData?.check_out_time ? (
                  <div className="space-y-6 md:space-y-8">
                    <input type="text" placeholder="CODE" className="w-full bg-black/60 border border-white/10 p-6 md:p-10 rounded-xl md:rounded-[3rem] text-center font-mono text-5xl md:text-6xl text-yellow-500 outline-none uppercase tracking-[0.4em] md:tracking-[0.6em] focus:border-yellow-500/50 shadow-2xl" value={absensiCode} onChange={e => setAbsensiCode(e.target.value.toUpperCase())} />
                    <button onClick={handleAbsensi} className={`w-full py-6 md:py-8 rounded-xl md:rounded-[3rem] font-black text-[12px] tracking-[0.5em] transition-all duration-700 ${absensiCode === dbDailyCode ? 'bg-white text-black shadow-white/10 shadow-2xl scale-105' : 'bg-slate-900 text-slate-700 opacity-50'}`}>
                      {absensiCode === dbDailyCode ? 'EXECUTE_PROTOCOL' : 'KEY_REQUIRED'}
                    </button>
                  </div>
                ) : (
                  <div className="py-12 border-t border-white/5 mt-8">
                    <p className="text-[11px] font-black text-slate-600 italic tracking-[0.5em] uppercase animate-pulse">SYSTEM_STBY: RETURN_TOMORROW</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'piket' && (
            <div className="bg-black/40 p-4 md:p-10 rounded-2xl md:rounded-[5rem] border border-white/5 shadow-2xl h-[700px] md:h-[850px] animate-in slide-in-from-right-10 duration-1000 relative overflow-hidden backdrop-blur-3xl">
              <div className="flex justify-between items-center mb-6 md:mb-10 px-4 md:px-8 relative z-10">
                <p className="text-[11px] md:text-[12px] font-black text-white tracking-[0.4em] md:tracking-[0.8em] italic uppercase flex items-center gap-3">
                  <span className="h-3 w-3 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,1)]"></span> DEPLOYMENT_MAP
                </p>
                {isAdmin && (
                  <button onClick={async () => { const url = prompt("STRAT_MAP_URL (PDF):"); if(url) { await supabase.from('global_settings').update({ schedule_pdf_url: url }).eq('id', 'current_rate'); setPdfUrl(url); } }} className="text-[8px] md:text-[10px] bg-white text-black px-4 py-2 md:px-8 md:py-3 rounded-xl font-black tracking-[0.1em] md:tracking-[0.3em] hover:bg-yellow-500 transition-all">REPLACE</button>
                )}
              </div>
              {pdfUrl ? (
                <div className="rounded-2xl md:rounded-[4rem] overflow-hidden border-8 border-black shadow-2xl bg-black h-[580px] md:h-[650px] relative group">
                  <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full opacity-60 group-hover:opacity-100 transition-opacity duration-1000 grayscale group-hover:grayscale-0" />
                  <div className="md:hidden absolute top-0 left-0 right-0 bg-yellow-500/20 text-[8px] text-center font-black p-1">⚠️ Mobile: Iframe can be hard to swipe</div>
                </div>
              ) : (
                <div className="h-[580px] flex items-center justify-center border-4 border-dashed border-white/5 rounded-2xl md:rounded-[5rem]">
                   <p className="text-[10px] md:text-[12px] font-black text-slate-800 tracking-[0.5em] md:tracking-[1.5em] italic uppercase">Map_offline</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- FLOATING MUSIC PLAYER v3 (MOBILE ADAPTED) --- */}
        <div className="fixed bottom-28 md:bottom-10 left-4 md:left-10 z-50 group">
           <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-3 md:p-6 rounded-xl md:rounded-[3rem] shadow-[0_15px_30px_rgba(0,0,0,0.8)] flex items-center gap-4 md:gap-8 w-[60px] md:w-[92px] group-hover:w-[350px] md:group-hover:w-[450px] transition-all duration-1000 ease-out overflow-hidden border-l-yellow-500/50">
              <div className="h-8 w-8 md:h-16 md:w-16 bg-gradient-to-tr from-yellow-500 to-orange-500 rounded-lg md:rounded-[1.5rem] flex-shrink-0 flex items-center justify-center animate-spin-slow shadow-lg border border-white/20">
                 <span className="text-xl md:text-3xl drop-shadow-lg text-black">💿</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-700 whitespace-nowrap flex-1 delay-300">
                 <p className="text-[8px] md:text-[10px] font-black text-yellow-500 tracking-[0.2em] md:tracking-[0.4em] mb-2 italic">VAULT_RADIO_ACTIVE</p>
                 <audio controls className="h-6 w-full filter invert contrast-150 brightness-200">
                    <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
                 </audio>
              </div>
           </div>
        </div>

        {/* --- TOMBOL SETUP ADMIN YANG TIDAK TERSEMBUNYI (mobile friendly) --- */}
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50">
          <button 
            onClick={() => { const p = prompt("ADMIN_AUTH:"); if(p===PASSWORD_ADMIN) setIsAdmin(!isAdmin); }} 
            className="flex items-center gap-2 bg-black border border-yellow-500/30 text-yellow-500/80 px-4 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] shadow-2xl hover:bg-yellow-500 hover:text-black hover:border-yellow-500 transition-all active:scale-95 border-b-yellow-500/80"
          >
             <span className="text-sm">🔒</span> ADMIN
          </button>
        </div>

        {/* DESKTOP FOOTER */}
        <footer className="hidden md:block text-center py-20 border-t border-white/5">
           <p className="text-[9px] font-black text-slate-800 tracking-[1.5em] uppercase italic">VAULT_SYSTEM ● LEVEL_9_CLEARANCE ● CYBER_UNIT</p>
        </footer>

      </div>

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #020306; }
        ::-webkit-scrollbar-thumb { background: #12141c; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #eadb0870; }
      `}</style>
    </main>
  )
}