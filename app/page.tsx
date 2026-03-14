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
  const [absensiCode, setAbsensiCode] = useState('')
  const [dbDailyCode, setDbDailyCode] = useState('123')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [totalWorkTime, setTotalWorkTime] = useState('0j 0m')
  const [logs, setLogs] = useState<any[]>([]); const [globalRate, setGlobalRate] = useState('0.5')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Auth States
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isRegister, setIsRegister] = useState(false)

  const PASSWORD_ADMIN = "12345"

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setUser(session?.user ?? null)
      if(session?.user) { checkTodayAttendance(session.user.id); calculateTotalHours(session.user.id) }
    })
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchData()
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(10)
    if (l) setLogs(l)
    const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
    if (s) { setGlobalRate(s.rate_value.toString()); setDbDailyCode(s.daily_code || '123'); setPdfUrl(s.schedule_pdf_url || '') }
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    if (isRegister) { const { error } = await supabase.auth.signUp({ email, password }); if (error) alert(error.message); else alert("Berhasil! Silakan Login.") }
    else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) alert(error.message) }
    setLoading(false)
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
    await supabase.from('gold_logs').insert([{ farmer_name: user.email?.split('@')[0], gold_amount: parseInt(gold), server_name: serverName, faction, rate_snapshot: parseFloat(globalRate), status: 'Pending', user_id: user.id }])
    setGold(''); setServerName(''); fetchData(); setLoading(false)
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 w-full max-w-md shadow-2xl">
          <h1 className="text-3xl font-black text-white mb-2 italic tracking-tighter text-center italic uppercase">Vault Command</h1>
          <p className="text-yellow-500 text-[9px] text-center uppercase tracking-[0.3em] mb-8 font-black">Authorized Access Only</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="EMAIL" className="w-full bg-[#050505] border border-white/5 p-4 rounded-2xl text-sm outline-none text-white font-bold" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input type="password" placeholder="PASSWORD" className="w-full bg-[#050505] border border-white/5 p-4 rounded-2xl text-sm outline-none text-white font-bold" value={password} onChange={e=>setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-yellow-500 text-black font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:brightness-110 shadow-xl transition-all">
              {loading ? 'Processing...' : (isRegister ? 'Register' : 'Access System')}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-[9px] font-black text-slate-600 uppercase hover:text-white transition-all tracking-widest">
            {isRegister ? 'Back to Login' : 'Create New Privacy Account'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050505] text-slate-300 font-sans p-4 md:p-6 uppercase">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a0a0a] border border-white/5 p-6 rounded-[2rem] shadow-2xl space-y-4 md:space-y-0 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <div className="h-10 w-10 bg-yellow-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20 font-black text-black italic">V</div>
            <div>
              <h1 className="text-lg font-black italic text-white leading-none tracking-tighter">VAULT_COMMAND</h1>
              <p className="text-[8px] font-black text-slate-600 mt-1 tracking-widest uppercase">Operator: {user.email}</p>
            </div>
          </div>
          <div className="flex gap-6 items-center z-10">
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-500 tracking-widest">SERVER_TIME</p>
              <p className="text-sm font-mono text-yellow-500 font-black">{currentTime.toLocaleTimeString('id-ID')}</p>
            </div>
            <div className="text-right border-l border-white/5 pl-6">
              <p className="text-[8px] font-black text-slate-500 tracking-widest">TOTAL_DUTY</p>
              <p className="text-sm font-mono text-white font-black">{totalWorkTime}</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="bg-red-500/10 text-red-500 text-[8px] font-black px-4 py-2 rounded-lg border border-red-500/20">LOGOUT</button>
          </div>
        </div>

        {/* NAV SYSTEM */}
        <div className="flex justify-center gap-2 p-1.5 bg-[#0a0a0a] border border-white/5 rounded-2xl w-fit mx-auto shadow-xl">
          {[{id:'gold', icon:'💰'}, {id:'absen', icon:'🛡️'}, {id:'piket', icon:'📅'}].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-8 py-3 rounded-xl transition-all ${activeTab === t.id ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-600 hover:bg-white/5'}`}>
              <span className="text-sm font-black">{t.icon} <span className="text-[10px] ml-2 hidden md:inline">{t.id.toUpperCase()}</span></span>
            </button>
          ))}
        </div>

        {/* MODULES */}
        <div className="min-h-[500px]">
          {activeTab === 'gold' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-2">
              <div className="lg:col-span-4 bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <h2 className="text-[10px] font-black text-slate-500 mb-6 italic tracking-widest underline decoration-yellow-500">SETOR_GOLD</h2>
                <form onSubmit={handleDeposit} className="space-y-4">
                  <input type="text" placeholder="SERVER_NAME" className="w-full bg-[#050505] border border-white/5 p-4 rounded-2xl text-sm font-bold text-white outline-none" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <select className="w-full bg-[#050505] border border-white/5 p-4 rounded-2xl text-[10px] font-black text-white" value={faction} onChange={e=>setFaction(e.target.value)}>
                    <option value="Horde">🔴 HORDE</option><option value="Alliance">🔵 ALLIANCE</option>
                  </select>
                  <div className="bg-[#050505] p-6 rounded-3xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-yellow-600 mb-1 tracking-widest">AMOUNT_G</p>
                    <input type="number" placeholder="0" className="w-full bg-transparent text-4xl font-mono font-black text-yellow-500 outline-none text-center" value={gold} onChange={e=>setGold(e.target.value)} required />
                  </div>
                  <button type="submit" className="w-full bg-yellow-500 text-black font-black py-5 rounded-2xl text-[11px] tracking-[0.3em] shadow-xl hover:scale-[0.98] transition-all">TRANSMIT</button>
                </form>
              </div>
              <div className="lg:col-span-8 bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-[11px] font-black italic uppercase">
                  <tbody className="divide-y divide-white/5">
                    {logs.map(i=>(
                      <tr key={i.id} className="hover:bg-white/[0.02]">
                        <td className="p-5 text-white">{i.farmer_name} <span className="text-[8px] text-slate-600 ml-2">[{i.server_name}]</span></td>
                        <td className="p-5 text-right font-mono text-yellow-500">{i.gold_amount.toLocaleString()} G</td>
                        <td className="p-5 text-right"><span className={`px-3 py-1 rounded-full text-[8px] ${i.status==='Sold'?'text-green-500 bg-green-500/10':'text-yellow-500 bg-yellow-500/10'}`}>{i.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'absen' && (
            <div className="max-w-md mx-auto animate-in zoom-in-95">
              <div className={`p-10 rounded-[3rem] border shadow-2xl text-center bg-[#0a0a0a] ${!attendanceData ? 'border-green-500/20' : (attendanceData.check_out_time ? 'border-white/5' : 'border-red-500/20')}`}>
                <div className="text-4xl mb-6">{!attendanceData ? '🟢' : (attendanceData.check_out_time ? '⚪' : '🔴')}</div>
                <h2 className="text-xl font-black italic text-white mb-6 uppercase tracking-tighter italic">
                  {!attendanceData ? 'Start_Duty' : (attendanceData.check_out_time ? 'Duty_Done' : 'End_Duty')}
                </h2>
                {!attendanceData?.check_out_time ? (
                  <div className="space-y-4">
                    <input type="text" placeholder="SECURE_CODE" className="w-full bg-[#050505] border border-white/5 p-5 rounded-2xl text-center font-mono text-3xl text-yellow-500 outline-none uppercase tracking-[0.3em]" value={absensiCode} onChange={e => setAbsensiCode(e.target.value.toUpperCase())} />
                    <button onClick={handleAbsensi} className={`w-full py-5 rounded-2xl font-black text-[10px] tracking-[0.5em] transition-all ${absensiCode === dbDailyCode ? 'bg-white text-black' : 'bg-slate-900 text-slate-700 cursor-not-allowed'}`}>
                      {absensiCode === dbDailyCode ? 'CONFIRM_DUTY' : 'LOCKED'}
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] font-black text-slate-600 italic tracking-widest">RE-AUTHORIZATION_REQUIRED_TOMORROW</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'piket' && (
            <div className="bg-[#0a0a0a] p-4 rounded-[2.5rem] border border-white/5 shadow-2xl h-[700px] animate-in slide-in-from-right-2">
              <div className="flex justify-between items-center mb-4 px-2">
                <p className="text-[10px] font-black text-slate-500 tracking-widest italic">DEPLOYMENT_MAP</p>
                <button onClick={() => {if(prompt("Admin Key:")===PASSWORD_ADMIN) setIsAdmin(true)}} className="text-[8px] text-slate-800">.</button>
                {isAdmin && <button onClick={async () => { const url = prompt("PDF URL:"); if(url) { await supabase.from('global_settings').update({ schedule_pdf_url: url }).eq('id', 'current_rate'); setPdfUrl(url); } }} className="text-[8px] bg-white text-black px-3 py-1 rounded font-black">UPDATE_PDF</button>}
              </div>
              {pdfUrl ? <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-[600px] rounded-2xl opacity-80" /> : <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-700 italic">SYSTEM_OFFLINE</div>}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}