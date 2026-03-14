'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // States Data
  const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde')
  const [absensiCode, setAbsensiCode] = useState(''); const [dbDailyCode, setDbDailyCode] = useState('123')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [totalWorkTime, setTotalWorkTime] = useState('0j 0m')
  const [logs, setLogs] = useState<any[]>([]); const [globalRate, setGlobalRate] = useState('0.5')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Auth States
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isRegister, setIsRegister] = useState(false)

  const PASSWORD_ADMIN = "01236"

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
    const { error } = isRegister ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message); else if (isRegister) alert("Cek email verifikasi!"); setLoading(false)
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
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5 w-full max-w-md shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-yellow-500/10 blur-[100px]"></div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter text-center uppercase">Vault Command</h1>
          <p className="text-yellow-500 text-[10px] text-center uppercase tracking-[0.4em] mb-10 font-black italic">Security Access Required</p>
          
          <button onClick={handleGoogleLogin} className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] mb-6 flex items-center justify-center gap-3 hover:scale-[1.02] transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
            SIGN IN WITH GOOGLE
          </button>

          <div className="flex items-center gap-4 mb-6 opacity-20"><div className="h-px bg-white flex-1"></div><span className="text-[8px] text-white">OR</span><div className="h-px bg-white flex-1"></div></div>

          <form onSubmit={handleManualAuth} className="space-y-4">
            <input type="email" placeholder="EMAIL_ADDRESS" className="w-full bg-[#050505] border border-white/5 p-4 rounded-xl text-[10px] font-bold text-white outline-none focus:border-yellow-500/50" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input type="password" placeholder="PASSWORD_SECURE" className="w-full bg-[#050505] border border-white/5 p-4 rounded-xl text-[10px] font-bold text-white outline-none focus:border-yellow-500/50" value={password} onChange={e=>setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl text-[11px] tracking-widest hover:brightness-110 shadow-xl transition-all">
              {loading ? 'PROCESSING...' : (isRegister ? 'CREATE ACCOUNT' : 'LOGIN SYSTEM')}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-8 text-[9px] font-black text-slate-600 uppercase hover:text-white transition-all tracking-[0.2em]">
            {isRegister ? '← BACK TO LOGIN' : 'NEW FARMER? REGISTER HERE'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050505] text-slate-300 font-sans p-4 md:p-8 uppercase tracking-tight">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TOP NAVBAR */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a0a0a] border border-white/5 p-6 rounded-[2.5rem] shadow-2xl relative">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-[1.2rem] flex items-center justify-center font-black text-black italic text-2xl shadow-lg shadow-yellow-500/20">V</div>
            <div>
              <h1 className="text-xl font-black italic text-white tracking-tighter leading-none">VAULT_COMMAND <span className="text-yellow-500 text-[10px] not-italic ml-2 tracking-widest uppercase opacity-50">OS_V3.0</span></h1>
              <p className="text-[9px] font-black text-slate-600 mt-2 tracking-[0.2em]">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-8 items-center bg-black/40 p-4 rounded-3xl border border-white/5">
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-500 tracking-widest italic">TOTAL_DUTY</p>
              <p className="text-lg font-mono text-white font-black">{totalWorkTime}</p>
            </div>
            <div className="text-right border-l border-white/10 pl-8">
              <p className="text-[8px] font-black text-slate-500 tracking-widest italic">CLOCK</p>
              <p className="text-lg font-mono text-yellow-500 font-black">{currentTime.toLocaleTimeString('id-ID')}</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[8px] font-black px-4 py-2 rounded-xl border border-red-500/20 transition-all uppercase">Logout</button>
          </div>
        </div>

        {/* NAVIGATION SYSTEM */}
        <div className="flex justify-center gap-3 p-2 bg-[#0a0a0a] border border-white/5 rounded-[2rem] w-fit mx-auto shadow-2xl">
          {[
            { id: 'gold', icon: '💰', label: 'DEPOSIT' },
            { id: 'absen', icon: '🛡️', label: 'DUTY_LOG' },
            { id: 'piket', icon: '📅', label: 'SCHEDULE' }
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-8 py-4 rounded-2xl transition-all flex items-center gap-3 ${activeTab === t.id ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 scale-105' : 'text-slate-600 hover:bg-white/5'}`}>
              <span className="text-lg">{t.icon}</span>
              <span className="text-[10px] font-black tracking-[0.2em] hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* MODULE CONTENT */}
        <div className="min-h-[500px] transition-all duration-500">
          
          {/* 💰 GOLD TAB */}
          {activeTab === 'gold' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-4 bg-[#0a0a0a] p-8 rounded-[3rem] border border-white/5 shadow-2xl relative">
                <div className="absolute top-0 left-10 w-20 h-1 bg-yellow-500 rounded-b-full"></div>
                <h2 className="text-[10px] font-black text-slate-500 mb-8 italic tracking-[0.3em] uppercase underline decoration-yellow-500/50">Report_Submission</h2>
                <form onSubmit={handleDeposit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-600 ml-2">SERVER_IDENTITY</label>
                    <input type="text" placeholder="ENTER SERVER..." className="w-full bg-[#050505] border border-white/5 p-4 rounded-2xl text-xs font-bold text-white outline-none focus:border-yellow-500/50 uppercase" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-600 ml-2">FACTION_SIDE</label>
                    <select className="w-full bg-[#050505] border border-white/5 p-4 rounded-2xl text-[10px] font-black text-white" value={faction} onChange={e=>setFaction(e.target.value)}>
                      <option value="Horde">🔴 HORDE_LEGION</option>
                      <option value="Alliance">🔵 ALLIANCE_FORCE</option>
                    </select>
                  </div>
                  <div className="bg-[#050505] p-8 rounded-[2rem] border border-white/5 text-center mt-6">
                    <p className="text-[8px] font-black text-yellow-600 mb-2 tracking-[0.3em]">GOLD_TRANSMIT_UNIT</p>
                    <input type="number" placeholder="0" className="w-full bg-transparent text-5xl font-mono font-black text-yellow-500 outline-none text-center" value={gold} onChange={e=>setGold(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-black py-5 rounded-[2rem] text-[11px] tracking-[0.3em] shadow-xl hover:brightness-110 active:scale-95 transition-all">
                    {loading ? 'TRANSMITTING...' : 'EXECUTE_DEPOSIT'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-8 bg-[#0a0a0a] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                   <span className="text-[9px] font-black text-slate-500 tracking-[0.3em] uppercase italic">Realtime_Feed_System</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-black italic uppercase">
                    <tbody className="divide-y divide-white/5">
                      {logs.map(i=>(
                        <tr key={i.id} className="hover:bg-white/[0.02] transition-all">
                          <td className="p-6 text-white">
                            <span className="block">{i.farmer_name}</span>
                            <span className="text-[8px] text-slate-600 tracking-widest">{i.server_name}</span>
                          </td>
                          <td className="p-6 text-right font-mono text-xl text-yellow-500">{i.gold_amount.toLocaleString()} G</td>
                          <td className="p-6 text-right"><span className={`px-4 py-1.5 rounded-full text-[8px] tracking-[0.2em] ${i.status==='Sold'?'text-green-400 bg-green-400/10':'text-yellow-500 bg-yellow-500/10'}`}>{i.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 🛡️ ABSEN TAB */}
          {activeTab === 'absen' && (
            <div className="max-w-xl mx-auto animate-in zoom-in-95 duration-500 py-10">
              <div className={`p-12 rounded-[4rem] border shadow-2xl text-center bg-[#0a0a0a] transition-all duration-700 ${!attendanceData ? 'border-green-500/20' : (attendanceData.check_out_time ? 'border-white/5' : 'border-red-500/20')}`}>
                <div className="h-24 w-24 mx-auto bg-black border border-white/5 rounded-full flex items-center justify-center text-4xl mb-8 shadow-inner">
                  {!attendanceData ? '🛰️' : (attendanceData.check_out_time ? '🔋' : '⚡')}
                </div>
                <h2 className="text-3xl font-black italic text-white mb-2 uppercase tracking-tighter italic">
                  {!attendanceData ? 'Initialize_Duty' : (attendanceData.check_out_time ? 'Duty_Secured' : 'End_Protocol')}
                </h2>
                <p className="text-[9px] text-slate-600 font-black tracking-[0.4em] mb-10 uppercase italic">Verification_Identity_Auth</p>
                
                {!attendanceData?.check_out_time ? (
                  <div className="space-y-6">
                    <input type="text" placeholder="INPUT_SECURE_CODE" className="w-full bg-[#050505] border border-white/5 p-6 rounded-[2rem] text-center font-mono text-4xl text-yellow-500 outline-none uppercase tracking-[0.4em] focus:border-yellow-500/40" value={absensiCode} onChange={e => setAbsensiCode(e.target.value.toUpperCase())} />
                    <button onClick={handleAbsensi} className={`w-full py-6 rounded-[2.5rem] font-black text-[11px] tracking-[0.5em] transition-all duration-500 ${absensiCode === dbDailyCode ? 'bg-white text-black shadow-white/20 shadow-2xl' : 'bg-slate-900 text-slate-700'}`}>
                      {absensiCode === dbDailyCode ? 'EXECUTE_CONFIRMATION' : 'LOCKED_WAITING_CODE'}
                    </button>
                  </div>
                ) : (
                  <div className="py-10 border-t border-white/5 mt-6">
                    <p className="text-[11px] font-black text-slate-400 italic tracking-[0.4em] uppercase">Duty finished. System standby.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 📅 PIKET TAB */}
          {activeTab === 'piket' && (
            <div className="bg-[#0a0a0a] p-4 md:p-10 rounded-[4rem] border border-white/5 shadow-2xl h-[750px] animate-in slide-in-from-right-4 duration-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                 <h1 className="text-9xl font-black italic">MAP</h1>
              </div>
              <div className="flex justify-between items-center mb-8 px-4 relative z-10">
                <p className="text-[10px] font-black text-white tracking-[0.4em] italic uppercase decoration-yellow-500 underline underline-offset-8">● Deployment_Schedule</p>
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse delay-75"></div>
                </div>
              </div>
              {pdfUrl ? (
                <div className="rounded-[2.5rem] overflow-hidden border border-white/10 bg-black h-[600px] shadow-inner relative z-10">
                  <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full opacity-80 hover:opacity-100 transition-opacity duration-700" />
                </div>
              ) : (
                <div className="h-[600px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem]">
                   <p className="text-[10px] font-black text-slate-700 tracking-[0.5em] italic uppercase">System_Map_Offline</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="text-center pt-10 pb-20 border-t border-white/5">
           <p className="text-[8px] font-black text-slate-800 tracking-[1.5em] uppercase">Vault Management System © 2026 ● High-Integrity Protocol</p>
        </div>

      </div>
    </main>
  )
}