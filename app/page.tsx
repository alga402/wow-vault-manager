'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // States: Global Data
  const [logs, setLogs] = useState<any[]>([])
  const [gtAccounts, setGtAccounts] = useState<any[]>([])
  const [currentRate, setCurrentRate] = useState('0')
  const [dbDailyCode, setDbDailyCode] = useState('123')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [pdfUrl, setPdfUrl] = useState('')

  // States: User Specific
  const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [absensiCode, setAbsensiCode] = useState('')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [totalWorkTime, setTotalWorkTime] = useState('0j 0m')

  const PASSWORD_ADMIN = "12345"

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setUser(session?.user ?? null)
      if(session?.user) { checkAttendance(session.user.id); calculateHours(session.user.id) }
    })
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchGlobalData()
    return () => clearInterval(timer)
  }, [])

  const fetchGlobalData = async () => {
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(10)
    if (l) setLogs(l)
    const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
    if (s) { setDbDailyCode(s.daily_code || '123'); setCurrentRate(s.rate_value || '0'); setPdfUrl(s.schedule_pdf_url || '') }
    const { data: gt } = await supabase.from('gt_accounts').select('*').order('expiry_date', { ascending: true })
    if (gt) setGtAccounts(gt)
  }

  const checkAttendance = async (uid: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*').eq('user_id', uid).gte('check_in_time', today).single()
    setAttendanceData(data)
  }

  const calculateHours = async (uid: string) => {
    const { data } = await supabase.from('attendance').select('check_in_time, check_out_time').eq('user_id', uid).not('check_out_time', 'is', null)
    if (data) {
      let mins = 0; data.forEach(r => { mins += Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000) })
      setTotalWorkTime(`${Math.floor(mins/60)}j ${mins%60}m`)
    }
  }

  const getDaysLeft = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center border border-gray-200">
          <h1 className="text-3xl font-black text-gray-800 italic mb-8 uppercase tracking-tighter">Vault Login</h1>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all">Connect Google</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-800 font-sans p-2 md:p-6 pb-24 relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER (DESKTOP & MOBILE INFO) */}
        <header className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg">V</div>
            <div><h1 className="text-xl font-black text-gray-900 uppercase">Vault Manager v8</h1><p className="text-[10px] font-bold text-blue-600">{user.email}</p></div>
          </div>
          <div className="flex gap-2">
            <div className="bg-green-50 px-5 py-2 rounded-xl text-center border border-green-100">
              <p className="text-[8px] font-black text-green-600 uppercase">Rate</p>
              <p className="text-md font-black text-green-700">IDR {currentRate}</p>
            </div>
            <div className="bg-gray-50 px-5 py-2 rounded-xl text-center border border-gray-100">
              <p className="text-[8px] font-black text-gray-500 uppercase">Shift</p>
              <p className="text-md font-black text-gray-800 font-mono">{totalWorkTime}</p>
            </div>
          </div>
        </header>

        {/* 1. MONITORING GT (HITUNG MUNDUR) */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase ml-2 flex items-center gap-2">
            <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></span> Subscription Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gtAccounts.map((acc) => {
              const daysLeft = getDaysLeft(acc.expiry_date)
              return (
                <div key={acc.id} className={`p-5 rounded-2xl border transition-all ${daysLeft <= 0 ? 'bg-red-50 border-red-200' : daysLeft <= 7 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-sm uppercase truncate">{acc.name}</h3>
                    <span className={`text-[8px] px-2 py-1 rounded-md font-black ${daysLeft <= 0 ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-600'}`}>{daysLeft <= 0 ? 'EXPIRED' : 'ACTIVE'}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div><p className="text-[9px] text-gray-500 font-bold uppercase italic">Expiry:</p><p className="text-xs font-mono font-bold">{new Date(acc.expiry_date).toLocaleDateString('id-ID')}</p></div>
                    <div className="text-right"><p className={`text-3xl font-black font-mono leading-none ${daysLeft <= 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-600' : 'text-blue-600'}`}>{daysLeft}</p><p className="text-[8px] font-black text-gray-400 uppercase">Days Left</p></div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 2. TAB CONTENT (LOGS / DUTY / MAP) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* TAB: GOLD LOGS */}
          {activeTab === 'gold' && (
            <>
              <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm self-start">
                <h2 className="text-[10px] font-black text-gray-800 mb-6 uppercase border-l-4 border-blue-600 pl-3">Input Gold</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault(); setLoading(true)
                  await supabase.from('gold_logs').insert([{ farmer_name: user.email?.split('@')[0], gold_amount: parseInt(gold), server_name: serverName, status: 'Pending', user_id: user.id }])
                  setGold(''); setServerName(''); fetchGlobalData(); setLoading(false)
                }} className="space-y-4">
                  <input type="text" placeholder="Server Name" className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs font-bold outline-none" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <input type="number" placeholder="Gold Amount" className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs font-bold outline-none" value={gold} onChange={e=>setGold(e.target.value)} required />
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl text-[10px] tracking-widest hover:bg-blue-700 transition-all uppercase italic">Submit Gold</button>
                </form>
              </div>
              <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Farmer Activity</h3>
                  <button onClick={fetchGlobalData} className="text-[10px] font-black text-blue-600">REFRESH ↻</button>
                </div>
                <table className="w-full text-left text-xs italic">
                  <thead><tr className="text-gray-400 border-b border-gray-50 uppercase text-[9px] font-black"><th className="p-4">Farmer</th><th className="p-4">Server</th><th className="p-4 text-right">Amount</th></tr></thead>
                  <tbody className="divide-y divide-gray-50 font-bold">
                    {logs.map(i => (
                      <tr key={i.id} className="hover:bg-blue-50/30 transition-all"><td className="p-4 text-gray-700">{i.farmer_name}</td><td className="p-4 text-gray-400 font-mono">{i.server_name}</td><td className="p-4 text-right text-blue-600">{i.gold_amount.toLocaleString()} G</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB: DUTY/ABSENSI */}
          {activeTab === 'absen' && (
            <div className="lg:col-span-12 max-w-md mx-auto w-full py-8">
              <div className="bg-white p-10 rounded-[3rem] border border-gray-200 shadow-2xl text-center">
                <div className="h-20 w-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-4xl mb-6">{!attendanceData ? '🔓' : '🚨'}</div>
                <h2 className="text-2xl font-black mb-2 uppercase">{!attendanceData ? 'Start Shift' : 'End Shift'}</h2>
                <input type="text" placeholder="Access Code" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-2xl text-center font-mono text-3xl mb-6 outline-none uppercase" value={absensiCode} onChange={e=>setAbsensiCode(e.target.value.toUpperCase())} />
                <button onClick={async () => {
                  if (absensiCode !== dbDailyCode) return alert("KODE SALAH!"); setLoading(true)
                  if (!attendanceData) await supabase.from('attendance').insert([{ user_id: user.id, farmer_name: user.email?.split('@')[0] }])
                  else await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id)
                  setAbsensiCode(''); checkAttendance(user.id); calculateHours(user.id); setLoading(false)
                }} className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl tracking-[0.5em] uppercase text-xs transition-all">Execute Duty</button>
              </div>
            </div>
          )}

          {/* TAB: MAP/PIKET */}
          {activeTab === 'piket' && (
            <div className="lg:col-span-12 bg-white rounded-3xl border border-gray-200 p-4 h-[600px] shadow-sm">
              {pdfUrl ? <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full rounded-2xl grayscale hover:grayscale-0 transition-all" /> : <div className="h-full flex items-center justify-center text-gray-300 font-black italic uppercase tracking-widest">No Map Strategy Loaded</div>}
            </div>
          )}
        </div>
      </div>

      {/* --- FLOATING COMPONENTS --- */}
      {/* MUSIC PLAYER */}
      <div className="fixed bottom-24 md:bottom-6 left-6 z-50 group">
        <div className="bg-white border border-gray-200 p-3 rounded-2xl shadow-xl flex items-center gap-4 w-[60px] group-hover:w-[300px] transition-all duration-500 overflow-hidden border-l-4 border-l-blue-600">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white animate-spin-slow shadow-lg shadow-blue-500/30">🎵</div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <p className="text-[9px] font-black mb-1 uppercase text-gray-400">Vault Radio</p>
            <audio controls className="h-6 w-full scale-90 origin-left"><source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" /></audio>
          </div>
        </div>
      </div>

      {/* ADMIN PANEL (JELAS) */}
      <div className="fixed bottom-24 md:bottom-6 right-6 z-50">
        <button onClick={() => { const p = prompt("Password Admin:"); if(p===PASSWORD_ADMIN) setIsAdmin(!isAdmin); }} className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-xl text-[10px] font-black tracking-widest uppercase hover:scale-105 transition-all">
          {isAdmin ? '🛡️ Close Admin' : '🛡️ Admin Login'}
        </button>
        {isAdmin && (
          <div className="absolute bottom-16 right-0 bg-white border border-gray-200 p-6 rounded-3xl shadow-2xl w-80 space-y-4 animate-in slide-in-from-bottom-5">
            <p className="text-[10px] font-black text-blue-600 uppercase italic border-b pb-2">Master Admin Control</p>
            <div>
              <label className="text-[8px] font-black text-gray-400 uppercase">Update GT Subscriptions</label>
              <form onSubmit={async (e) => {
                e.preventDefault(); const n = (e.target as any).n.value; const d = (e.target as any).d.value
                await supabase.from('gt_accounts').insert([{ name: n, expiry_date: d }]); fetchGlobalData(); (e.target as any).reset()
              }} className="space-y-2 mt-1">
                <input name="n" type="text" placeholder="Account Name" className="w-full bg-gray-50 border p-2 rounded-lg text-[10px] font-bold" required />
                <input name="d" type="date" className="w-full bg-gray-50 border p-2 rounded-lg text-[10px] font-bold" required />
                <button className="w-full bg-blue-600 text-white text-[8px] py-2 rounded-lg font-black uppercase">Add Account</button>
              </form>
            </div>
            <div>
              <label className="text-[8px] font-black text-gray-400 uppercase">Global Rate & Daily Code</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input type="number" placeholder="Rate" className="w-full bg-gray-50 border p-2 rounded-lg text-xs font-black" value={currentRate} onChange={async (e)=>{ setCurrentRate(e.target.value); await supabase.from('global_settings').update({ rate_value: e.target.value }).eq('id', 'current_rate'); }} />
                <input type="text" placeholder="Code" className="w-full bg-gray-50 border p-2 rounded-lg text-xs font-black" value={dbDailyCode} onChange={async (e)=>{ setDbDailyCode(e.target.value.toUpperCase()); await supabase.from('global_settings').update({ daily_code: e.target.value.toUpperCase() }).eq('id', 'current_rate'); }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-around items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button onClick={()=>setActiveTab('gold')} className={`flex flex-col items-center gap-1 ${activeTab==='gold'?'text-blue-600':'text-gray-400 opacity-50'}`}><span className="text-xl">💰</span><span className="text-[9px] font-black">LOGS</span></button>
        <button onClick={()=>setActiveTab('absen')} className={`flex flex-col items-center gap-1 ${activeTab==='absen'?'text-blue-600':'text-gray-400 opacity-50'}`}><span className="text-xl">⚔️</span><span className="text-[9px] font-black">DUTY</span></button>
        <button onClick={()=>setActiveTab('piket')} className={`flex flex-col items-center gap-1 ${activeTab==='piket'?'text-blue-600':'text-gray-400 opacity-50'}`}><span className="text-xl">📅</span><span className="text-[9px] font-black">MAP</span></button>
      </nav>

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>
    </main>
  )
}