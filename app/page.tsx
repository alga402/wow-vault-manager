'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)

  // -- States Data --
  const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde')
  const [absensiCode, setAbsensiCode] = useState(''); const [dbDailyCode, setDbDailyCode] = useState('123')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([]); const [totalWorkTime, setTotalWorkTime] = useState('0j 0m')

  useEffect(() => {
    // Cek Sesi User saat halaman dibuka
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        checkTodayAttendance(session.user.id)
      }
    })

    // Pantau perubahan login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkTodayAttendance(session.user.id)
        calculateTotalHours(session.user.id)
      }
    })

    fetchData()
    return () => subscription.unsubscribe()
  }, [])

  const fetchData = async () => {
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(10)
    if (l) setLogs(l)
    const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
    if (s) setDbDailyCode(s.daily_code || '123')
  }

  // --- LOGIKA LOGIN ---
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = isRegister 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    
    if (error) alert(error.message)
    else if (isRegister) alert("Cek email kamu untuk verifikasi!")
    setLoading(false)
  }

  // --- LOGIKA ABSENSI ---
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

  const handleAbsensi = async () => {
    if (absensiCode !== dbDailyCode) return alert("KODE SALAH!")
    setLoading(true)
    if (!attendanceData) {
      await supabase.from('attendance').insert([{ user_id: user.id, farmer_name: user.email?.split('@')[0] }])
    } else {
      await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id)
    }
    setAbsensiCode(''); checkTodayAttendance(user.id); setLoading(false); calculateTotalHours(user.id)
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await supabase.from('gold_logs').insert([{ farmer_name: user.email?.split('@')[0], gold_amount: parseInt(gold), server_name: serverName, faction, status: 'Pending', user_id: user.id }])
    setGold(''); setServerName(''); fetchData(); setLoading(false)
  }

  // --- TAMPILAN LOGIN ---
  if (!user) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 text-white font-sans uppercase">
        <div className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5 w-full max-w-md shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter mb-2">VAULT COMMAND</h1>
          <p className="text-yellow-500 text-[10px] font-black tracking-[0.4em] mb-10">Security Protocol v3</p>
          
          <button onClick={handleGoogleLogin} className="w-full bg-white text-black font-black py-4 rounded-2xl text-[11px] mb-6 flex items-center justify-center gap-3 hover:scale-[1.02] transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
            Sign in with Google
          </button>

          <div className="flex items-center gap-4 mb-6 opacity-20"><div className="h-px bg-white flex-1"></div><span className="text-[8px]">OR</span><div className="h-px bg-white flex-1"></div></div>

          <form onSubmit={handleManualAuth} className="space-y-4">
            <input type="email" placeholder="EMAIL" className="w-full bg-[#050505] border border-white/5 p-4 rounded-xl text-xs outline-none focus:border-yellow-500/50" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input type="password" placeholder="PASSWORD" className="w-full bg-[#050505] border border-white/5 p-4 rounded-xl text-xs outline-none focus:border-yellow-500/50" value={password} onChange={e=>setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl text-[11px] tracking-widest">{isRegister ? 'REGISTER' : 'LOGIN'}</button>
          </form>
          
          <button onClick={() => setIsRegister(!isRegister)} className="mt-6 text-[8px] text-slate-500 font-black tracking-widest hover:text-white">
            {isRegister ? 'ALREADY HAVE ACCOUNT? LOGIN' : 'NEW FARMER? CREATE ACCOUNT'}
          </button>
        </div>
      </main>
    )
  }

  // --- TAMPILAN DASHBOARD ---
  return (
    <main className="min-h-screen bg-[#050505] text-slate-300 font-sans p-4 md:p-8 uppercase">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a0a0a] border border-white/5 p-6 rounded-[2rem] shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-yellow-500 rounded-2xl flex items-center justify-center font-black text-black italic text-xl">V</div>
            <div>
              <h1 className="text-xl font-black italic text-white tracking-tighter">VAULT_COMMAND</h1>
              <p className="text-[8px] font-black text-slate-600 tracking-widest italic">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-500 tracking-widest italic">TOTAL_DUTY</p>
              <p className="text-lg font-mono text-white font-black">{totalWorkTime}</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="bg-red-500/10 text-red-500 text-[8px] font-black px-4 py-2 rounded-xl border border-red-500/20">LOGOUT</button>
          </div>
        </div>

        {/* NAV */}
        <div className="flex justify-center gap-2 p-1 bg-[#0a0a0a] border border-white/5 rounded-2xl w-fit mx-auto">
          {['gold', 'absen'].map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-10 py-3 rounded-xl transition-all font-black text-[10px] tracking-widest ${activeTab === t ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-600'}`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="min-h-[400px]">
          {activeTab === 'gold' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-2">
              <div className="lg:col-span-4 bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <h2 className="text-[10px] font-black text-slate-500 mb-6 italic tracking-widest underline decoration-yellow-500">SUBMIT_GOLD</h2>
                <form onSubmit={handleDeposit} className="space-y-4">
                  <input type="text" placeholder="SERVER" className="w-full bg-[#050505] border border-white/5 p-4 rounded-xl text-xs font-bold text-white outline-none" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <div className="bg-[#050505] p-6 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-yellow-600 mb-1">G_AMOUNT</p>
                    <input type="number" placeholder="0" className="w-full bg-transparent text-4xl font-mono font-black text-yellow-500 outline-none text-center" value={gold} onChange={e=>setGold(e.target.value)} required />
                  </div>
                  <button type="submit" className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl text-[10px] tracking-widest">TRANSMIT</button>
                </form>
              </div>
              <div className="lg:col-span-8 bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-[11px] font-black italic uppercase">
                  <tbody className="divide-y divide-white/5">
                    {logs.map(i=>(
                      <tr key={i.id} className="hover:bg-white/[0.02]"><td className="p-5 text-white">{i.farmer_name}</td><td className="p-5 text-right font-mono text-yellow-500">{i.gold_amount.toLocaleString()} G</td><td className="p-5 text-right uppercase text-[8px] text-slate-500">{i.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'absen' && (
            <div className="max-w-md mx-auto animate-in zoom-in-95">
              <div className={`p-10 rounded-[3rem] border shadow-2xl text-center bg-[#0a0a0a] ${!attendanceData ? 'border-green-500/20' : (attendanceData.check_out_time ? 'border-white/5' : 'border-red-500/20')}`}>
                <h2 className="text-xl font-black italic text-white mb-6 uppercase tracking-tighter">
                  {!attendanceData ? 'Start_Duty' : (attendanceData.check_out_time ? 'Duty_Done' : 'End_Duty')}
                </h2>
                {!attendanceData?.check_out_time ? (
                  <div className="space-y-4">
                    <input type="text" placeholder="SECURE_CODE" className="w-full bg-[#050505] border border-white/5 p-5 rounded-2xl text-center font-mono text-3xl text-yellow-500 outline-none uppercase tracking-[0.3em]" value={absensiCode} onChange={e => setAbsensiCode(e.target.value.toUpperCase())} />
                    <button onClick={handleAbsensi} className={`w-full py-5 rounded-2xl font-black text-[10px] tracking-[0.5em] ${absensiCode === dbDailyCode ? 'bg-white text-black' : 'bg-slate-900 text-slate-700'}`}>
                      {absensiCode === dbDailyCode ? 'CONFIRM' : 'LOCKED'}
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] font-black text-slate-600 italic tracking-widest">SESSION_FINISHED</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}