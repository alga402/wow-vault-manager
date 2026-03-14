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
    if (absensiCode !== dbDailyCode) return alert("ACCESS KEY INVALID!")
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
      <main className="min-h-screen bg-[#05060a] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/10 blur-[150px] rounded-full"></div>
        
        <div className="bg-black/40 backdrop-blur-3xl p-12 rounded-[3.5rem] border border-white/10 w-full max-w-md shadow-2xl relative z-10 text-center">
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Vault Command</h1>
          <p className="text-yellow-500 text-[10px] font-black tracking-[0.5em] mb-12 uppercase italic">Awaiting Operator Identity</p>
          
          <button onClick={handleGoogleLogin} className="w-full bg-white text-black font-black py-5 rounded-2xl text-[11px] mb-8 flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)]">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" />
            CONNECT ACCOUNT
          </button>

          <div className="flex items-center gap-4 mb-8 opacity-20"><div className="h-px bg-white flex-1"></div><span className="text-[8px] text-white font-black">OR</span><div className="h-px bg-white flex-1"></div></div>

          <form onSubmit={handleManualAuth} className="space-y-4">
            <input name="email" type="email" placeholder="OPERATOR_ID" className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-[10px] font-bold text-white outline-none focus:border-yellow-500/50 transition-all" required />
            <input name="password" type="password" placeholder="SECURITY_KEY" className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-[10px] font-bold text-white outline-none focus:border-yellow-500/50 transition-all" required />
            <button type="submit" className="w-full bg-yellow-500 text-black font-black py-5 rounded-2xl text-[11px] tracking-[0.3em] hover:brightness-110 active:scale-95 transition-all shadow-lg">LOGIN_SECURE</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020306] text-slate-300 font-sans p-4 md:p-8 uppercase tracking-tighter overflow-x-hidden">
      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* PREMIUM HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-center bg-black/40 backdrop-blur-2xl border border-white/5 p-8 rounded-[3rem] shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full group-hover:bg-yellow-500/10 transition-all duration-700"></div>
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-[2rem] flex items-center justify-center font-black text-black italic text-4xl shadow-2xl border border-yellow-200/20 animate-pulse-slow">V</div>
            <div>
              <h1 className="text-3xl font-black italic text-white tracking-tighter leading-none mb-2">VAULT_COMMAND <span className="text-yellow-500 text-[10px] not-italic ml-2 tracking-widest opacity-50">v5.0</span></h1>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,1)]"></span>
                <p className="text-[10px] font-black text-slate-500 tracking-[0.2em]">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8 lg:mt-0">
            <div className="bg-white/5 border border-white/5 px-8 py-5 rounded-[2rem] text-center backdrop-blur-sm">
              <p className="text-[8px] font-black text-slate-500 mb-1 tracking-widest italic">SHIFT_TIME</p>
              <p className="text-xl font-mono text-white font-black">{totalWorkTime}</p>
            </div>
            <div className="bg-white/5 border border-white/5 px-8 py-5 rounded-[2rem] text-center backdrop-blur-sm border-l-yellow-500/20 border-l-4">
              <p className="text-[8px] font-black text-slate-500 mb-1 tracking-widest italic">CLOCK_SYNC</p>
              <p className="text-xl font-mono text-yellow-500 font-black">{currentTime.toLocaleTimeString('id-ID')}</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 rounded-[2rem] text-[10px] font-black transition-all border border-red-500/20 active:scale-95">SIGNOUT</button>
          </div>
        </header>

        {/* ELEGANT NAVIGATION */}
        <nav className="flex justify-center gap-3 p-2 bg-white/5 border border-white/5 rounded-[2.5rem] w-fit mx-auto backdrop-blur-xl shadow-2xl">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-10">
              <div className="lg:col-span-4 bg-black/40 p-10 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <h2 className="text-[11px] font-black text-yellow-500/50 mb-10 italic tracking-[0.5em] flex items-center gap-3 uppercase">
                   <div className="w-3 h-3 border border-yellow-500 rounded-sm rotate-45"></div> TRANSMIT_GOLD
                </h2>
                <form onSubmit={handleDeposit} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-600 ml-4 tracking-[0.3em]">SERVER_TARGET</label>
                    <input type="text" placeholder="EX: VANILLA_PRO" className="w-full bg-white/5 border border-white/5 p-5 rounded-3xl text-[12px] font-bold text-white outline-none focus:border-yellow-500/40 transition-all uppercase placeholder:opacity-20" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-600 ml-4 tracking-[0.3em]">FACTION_LOADOUT</label>
                    <select className="w-full bg-white/5 border border-white/5 p-5 rounded-3xl text-[11px] font-black text-white outline-none appearance-none cursor-pointer" value={faction} onChange={e=>setFaction(e.target.value)}>
                      <option value="Horde">🔴 HORDE_WAR_CHIEF</option>
                      <option value="Alliance">🔵 ALLIANCE_HERO</option>
                    </select>
                  </div>
                  <div className="bg-black/80 p-12 rounded-[3rem] border border-white/5 text-center shadow-inner mt-8 relative">
                    <p className="text-[10px] font-black text-yellow-600/40 mb-4 tracking-[0.6em] italic">G_VALUE_UNITS</p>
                    <input type="number" placeholder="0000" className="w-full bg-transparent text-6xl font-mono font-black text-yellow-500 outline-none text-center drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]" value={gold} onChange={e=>setGold(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-black py-6 rounded-[2.5rem] text-[13px] tracking-[0.6em] shadow-[0_20px_50px_rgba(234,179,8,0.2)] hover:brightness-110 active:scale-95 transition-all mt-4 uppercase">TRANSMIT_DATA</button>
                </form>
              </div>

              <div className="lg:col-span-8 bg-black/20 rounded-[4rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                   <span className="text-[11px] font-black text-slate-400 tracking-[0.5em] italic flex items-center gap-3">
                     <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span> SYSTEM_LIVE_FEED
                   </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-black italic uppercase">
                    <tbody className="divide-y divide-white/5">
                      {logs.length > 0 ? logs.map(i=>(
                        <tr key={i.id} className="group hover:bg-white/[0.04] transition-all">
                          <td className="p-8 text-white">
                            <span className="block text-base mb-1 font-bold group-hover:text-yellow-500 transition-colors tracking-tight">{i.farmer_name}</span>
                            <span className="text-[9px] text-slate-600 tracking-[0.4em] font-mono">{i.server_name}</span>
                          </td>
                          <td className="p-8 text-right font-mono text-3xl text-yellow-500 group-hover:scale-110 transition-transform duration-500">{i.gold_amount.toLocaleString()} <span className="text-[10px] ml-1 opacity-40">G</span></td>
                          <td className="p-8 text-right">
                             <span className={`px-6 py-2 rounded-full text-[9px] tracking-[0.4em] font-black border ${i.status==='Sold'?'text-green-400 border-green-400/20 bg-green-400/5':'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'}`}>
                               {i.status}
                             </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td className="p-20 text-center text-slate-700 tracking-[2em]">NO_LOG_AVAILABLE</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'absen' && (
            <div className="max-w-2xl mx-auto py-12 animate-in zoom-in-95 duration-700">
              {isAdmin && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 p-10 rounded-[3.5rem] mb-10 backdrop-blur-3xl animate-pulse">
                  <h3 className="text-[11px] font-black text-yellow-500 mb-8 tracking-[0.6em] text-center uppercase">🛡️ MASTER_CONTROL_UNIT</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <p className="text-[9px] text-yellow-500/60 ml-5 font-black uppercase">SET_DAILY_ACCESS_KEY</p>
                      <input type="text" className="w-full bg-black/60 border border-yellow-500/40 p-5 rounded-3xl text-yellow-500 font-mono text-3xl text-center outline-none focus:border-yellow-500 shadow-2xl" value={dbDailyCode} onChange={async (e) => { const nc = e.target.value.toUpperCase(); setDbDailyCode(nc); await supabase.from('global_settings').update({ daily_code: nc }).eq('id', 'current_rate'); }} />
                    </div>
                    <div className="bg-black/40 p-6 rounded-3xl border border-white/5 flex items-center">
                      <p className="text-[10px] text-slate-500 leading-relaxed italic text-center uppercase tracking-[0.2em]">Change this daily. Farmers cannot authorize shift without this key.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`p-16 rounded-[5rem] border shadow-2xl text-center bg-black/40 backdrop-blur-3xl transition-all duration-1000 ${!attendanceData ? 'border-green-500/20 shadow-green-500/5' : (attendanceData.check_out_time ? 'border-white/5' : 'border-red-500/20 shadow-red-500/5')}`}>
                <div className="relative inline-block mb-12">
                   <div className={`h-40 w-40 rounded-full flex items-center justify-center text-6xl bg-black border-2 transition-all duration-1000 ${!attendanceData ? 'border-green-500 animate-pulse' : (attendanceData.check_out_time ? 'border-white/10' : 'border-red-500 animate-bounce')}`}>
                     {!attendanceData ? '🔓' : (attendanceData.check_out_time ? '✅' : '🚨')}
                   </div>
                </div>
                <h2 className="text-4xl font-black italic text-white mb-4 uppercase tracking-tighter">
                  {!attendanceData ? 'INITIATE_SESSION' : (attendanceData.check_out_time ? 'DUTY_ARCHIVED' : 'TERMINATE_SHIFT')}
                </h2>
                <p className="text-[11px] text-slate-500 font-black tracking-[0.6em] mb-12 uppercase italic">Verification required via daily access key</p>
                
                {!attendanceData?.check_out_time ? (
                  <div className="space-y-8">
                    <input type="text" placeholder="KEY_CODE" className="w-full bg-black/60 border border-white/10 p-10 rounded-[3rem] text-center font-mono text-6xl text-yellow-500 outline-none uppercase tracking-[0.6em] focus:border-yellow-500/50 transition-all shadow-2xl" value={absensiCode} onChange={e => setAbsensiCode(e.target.value.toUpperCase())} />
                    <button onClick={handleAbsensi} className={`w-full py-8 rounded-[3rem] font-black text-[13px] tracking-[1em] transition-all duration-700 ${absensiCode === dbDailyCode ? 'bg-white text-black shadow-white/10 shadow-2xl scale-105' : 'bg-slate-900 text-slate-700 opacity-50'}`}>
                      {absensiCode === dbDailyCode ? 'EXECUTE_AUTH' : 'LOCKED'}
                    </button>
                  </div>
                ) : (
                  <div className="py-16 border-t border-white/5 mt-10">
                    <p className="text-[12px] font-black text-slate-600 italic tracking-[1em] uppercase">SYSTEM_STBY: RETURN_TOMORROW</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'piket' && (
            <div className="bg-black/40 p-10 rounded-[5rem] border border-white/5 shadow-2xl h-[850px] animate-in slide-in-from-right-20 duration-1000 relative overflow-hidden backdrop-blur-3xl">
              <div className="flex justify-between items-center mb-10 px-8 relative z-10">
                <p className="text-[12px] font-black text-white tracking-[0.8em] italic uppercase flex items-center gap-5">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full animate-ping"></div> DEPLOYMENT_MAP
                </p>
                {isAdmin && (
                  <button onClick={async () => { const url = prompt("STRAT_MAP_URL (PDF):"); if(url) { await supabase.from('global_settings').update({ schedule_pdf_url: url }).eq('id', 'current_rate'); setPdfUrl(url); } }} className="text-[10px] bg-white text-black px-8 py-3 rounded-full font-black tracking-[0.3em] hover:bg-yellow-500 transition-all">REPLACE_MAP</button>
                )}
              </div>
              {pdfUrl ? (
                <div className="rounded-[4rem] overflow-hidden border-8 border-black shadow-2xl bg-black h-[650px] relative group">
                  <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full opacity-70 group-hover:opacity-100 transition-opacity duration-1000 grayscale group-hover:grayscale-0" />
                  <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20"></div>
                </div>
              ) : (
                <div className="h-[650px] flex items-center justify-center border-4 border-dashed border-white/5 rounded-[5rem]">
                   <p className="text-[12px] font-black text-slate-800 tracking-[1.5em] italic uppercase">DATA_MISSING_OR_ENCRYPTED</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- FLOATING MUSIC PLAYER v2 --- */}
        <div className="fixed bottom-10 left-10 z-50 group">
           <div className="bg-black/80 backdrop-blur-3xl border border-white/10 p-6 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex items-center gap-8 w-[92px] group-hover:w-[450px] transition-all duration-1000 ease-out overflow-hidden">
              <div className="h-16 w-16 bg-gradient-to-tr from-yellow-500 to-orange-500 rounded-[1.5rem] flex-shrink-0 flex items-center justify-center animate-spin-slow shadow-2xl border border-white/20">
                 <span className="text-3xl drop-shadow-lg text-black">💿</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-700 whitespace-nowrap flex-1 delay-300">
                 <p className="text-[10px] font-black text-yellow-500 tracking-[0.4em] mb-3 italic">VAULT_RADIO_ACTIVE</p>
                 <audio controls className="h-10 w-full filter invert contrast-150 brightness-200">
                    <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
                 </audio>
              </div>
           </div>
        </div>

        {/* HIDDEN ADMIN ACCESS */}
        <button 
          onClick={() => { const p = prompt("ADMIN_AUTH:"); if(p===PASSWORD_ADMIN) setIsAdmin(!isAdmin); }} 
          className="fixed bottom-4 right-4 h-6 w-6 bg-white/5 rounded-full hover:bg-yellow-500/20 transition-all cursor-crosshair z-50 opacity-10 hover:opacity-100"
        ></button>

        {/* FOOTER */}
        <footer className="text-center py-24 border-t border-white/5">
           <p className="text-[10px] font-black text-slate-800 tracking-[2em] uppercase italic">VAULT_MANAGEMENT_OS ● EST_2026 ● LEVEL_9_CLEARANCE</p>
        </footer>

      </div>

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .7; } }
      `}</style>
    </main>
  )
}