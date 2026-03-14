'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // -- GLOBAL DATA STATES --
  const [logs, setLogs] = useState<any[]>([])
  const [gtAccounts, setGtAccounts] = useState<any[]>([])
  const [currentRate, setCurrentRate] = useState('0')
  const [dbDailyCode, setDbDailyCode] = useState('123')
  const [pdfUrl, setPdfUrl] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  // -- USER INPUT STATES --
  const [gold, setGold] = useState(''); 
  const [serverName, setServerName] = useState('')
  const [absensiCode, setAbsensiCode] = useState('')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [totalWorkTime, setTotalWorkTime] = useState('0j 0m')

  const PASSWORD_ADMIN = "12345"

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setUser(session?.user ?? null)
      if(session?.user) { fetchUserStats(session.user.id) }
    })
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchGlobalData()
    return () => clearInterval(timer)
  }, [])

  const fetchGlobalData = async () => {
    try {
      // 1. Ambil Logs Gold
      const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(15)
      if (l) setLogs(l)
      
      // 2. Ambil Settings (Rate & Code)
      const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
      if (s) { 
        setDbDailyCode(s.daily_code || '123')
        setCurrentRate(s.rate_value || '0')
        setPdfUrl(s.schedule_pdf_url || '')
      }

      // 3. Ambil Akun GT
      const { data: gt } = await supabase.from('gt_accounts').select('*').order('expiry_date', { ascending: true })
      if (gt) setGtAccounts(gt)
    } catch (e) { console.error("Fetch Error:", e) }
  }

  const fetchUserStats = async (uid: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: att } = await supabase.from('attendance').select('*').eq('user_id', uid).gte('check_in_time', today).single()
    setAttendanceData(att)
    
    const { data: allAtt } = await supabase.from('attendance').select('check_in_time, check_out_time').eq('user_id', uid).not('check_out_time', 'is', null)
    if (allAtt) {
      let mins = 0
      allAtt.forEach(r => { 
        mins += Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000) 
      })
      setTotalWorkTime(`${Math.floor(mins/60)}j ${mins%60}m`)
    }
  }

  const handleGoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gold || !serverName) return
    setLoading(true)
    try {
      const { error } = await supabase.from('gold_logs').insert([{ 
        farmer_name: user.email?.split('@')[0], 
        gold_amount: parseInt(gold), 
        server_name: serverName, 
        status: 'Pending', 
        user_id: user.id 
      }])
      if (error) throw error
      setGold(''); setServerName('')
      await fetchGlobalData()
      alert("✅ Data Berhasil Terkirim!")
    } catch (err: any) {
      alert("❌ Gagal: " + err.message)
    } finally { setLoading(false) }
  }

  const handleAbsensi = async () => {
    if (absensiCode !== dbDailyCode) return alert("❌ KODE AKSES SALAH!")
    setLoading(true)
    try {
      if (!attendanceData) {
        await supabase.from('attendance').insert([{ user_id: user.id, farmer_name: user.email?.split('@')[0] }])
      } else {
        await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id)
      }
      setAbsensiCode('')
      await fetchUserStats(user.id)
      alert("✅ Status Berhasil Diperbarui!")
    } catch (err: any) {
      alert("❌ Error: " + err.message)
    } finally { setLoading(false) }
  }

  const getDaysLeft = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center border border-gray-100">
          <h1 className="text-3xl font-black text-gray-800 italic mb-8 uppercase tracking-tighter">Vault OS</h1>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">Connect with Google</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-800 p-3 md:p-8 pb-32 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER AREA */}
        <header className="bg-white border border-gray-200 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-md">V</div>
            <div>
              <h1 className="text-lg font-black text-gray-900 uppercase leading-none mb-1">Vault Manager v10</h1>
              <p className="text-[9px] font-bold text-blue-500 uppercase">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-green-50 px-4 py-2 rounded-xl text-center border border-green-100">
              <p className="text-[7px] font-black text-green-600 uppercase">Live Rate</p>
              <p className="text-sm font-black text-green-700 tracking-tighter">IDR {currentRate}</p>
            </div>
            <div className="flex-1 md:flex-none bg-gray-50 px-4 py-2 rounded-xl text-center border border-gray-100">
              <p className="text-[7px] font-black text-gray-500 uppercase">Total Work</p>
              <p className="text-sm font-black text-gray-800 font-mono">{totalWorkTime}</p>
            </div>
          </div>
        </header>

        {/* 1. MONITORING GT (SISA HARI) */}
        <section className="space-y-3">
          <h2 className="text-[9px] font-black text-gray-400 tracking-[0.2em] uppercase ml-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-blue-500 rounded-full"></span> Subscription Monitoring
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gtAccounts.length > 0 ? gtAccounts.map((acc) => {
              const daysLeft = getDaysLeft(acc.expiry_date)
              const statusColor = daysLeft <= 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-500' : 'text-blue-600'
              return (
                <div key={acc.id} className={`p-4 rounded-2xl border bg-white shadow-sm transition-all ${daysLeft <= 0 ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                  <p className="font-black text-[9px] text-gray-400 uppercase truncate mb-1">{acc.name}</p>
                  <div className="flex justify-between items-end">
                    <p className={`text-2xl font-black font-mono leading-none tracking-tighter ${statusColor}`}>{daysLeft}</p>
                    <span className="text-[8px] font-black text-gray-300 uppercase italic">Days Left</span>
                  </div>
                </div>
              )
            }) : (
              <div className="col-span-full py-4 text-center border border-dashed rounded-2xl text-[10px] font-black text-gray-300 uppercase">No Subscription Data</div>
            )}
          </div>
        </section>

        {/* 2. TAB NAVIGATION (DESKTOP) */}
        <div className="hidden md:flex gap-4 mb-2">
           {['gold', 'absen', 'piket'].map((t) => (
             <button key={t} onClick={()=>setActiveTab(t)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>
               {t === 'gold' ? '💰 Gold Logs' : t === 'absen' ? '⚔️ Duty Control' : '📅 Schedule'}
             </button>
           ))}
        </div>

        {/* 3. MAIN CONTENT AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[400px]">
          
          {/* TAB: GOLD LOGS */}
          {activeTab === 'gold' && (
            <>
              <div className="lg:col-span-4 bg-white p-6 rounded-[2.5rem] border border-gray-200 shadow-sm self-start">
                <h3 className="text-[10px] font-black text-gray-400 mb-6 uppercase border-l-4 border-blue-500 pl-3">Transmit_Gold</h3>
                <form onSubmit={handleGoldSubmit} className="space-y-4">
                  <input type="text" placeholder="Server (e.g. V-01)" className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs font-bold outline-none focus:bg-white" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                    <p className="text-[8px] font-black text-gray-400 mb-1 uppercase tracking-widest">Amount Units</p>
                    <input type="number" placeholder="0" className="w-full bg-transparent text-4xl font-black text-gray-800 text-center outline-none" value={gold} onChange={e=>setGold(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-black py-4 rounded-xl text-xs tracking-[0.2em] hover:bg-black transition-all uppercase">{loading ? 'Processing...' : 'Submit Data'}</button>
                </form>
              </div>
              <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Recent Activity</h3>
                  <button onClick={fetchGlobalData} className="text-[9px] font-black text-blue-600">REFRESH ↻</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs italic">
                    <thead className="bg-gray-50/50 text-gray-400 font-black text-[9px] uppercase"><tr className="border-b border-gray-100"><th className="p-4">Operator</th><th className="p-4">Server</th><th className="p-4 text-right">Amount</th></tr></thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                      {logs.map(i => (
                        <tr key={i.id} className="hover:bg-blue-50/20 transition-all"><td className="p-4 text-gray-700">{i.farmer_name}</td><td className="p-4 text-gray-400 font-mono text-[10px]">{i.server_name}</td><td className="p-4 text-right text-blue-600 font-mono">{i.gold_amount.toLocaleString()} G</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {logs.length === 0 && <div className="p-10 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Waiting for incoming data...</div>}
                </div>
              </div>
            </>
          )}

          {/* TAB: DUTY (ABSENSI) */}
          {activeTab === 'absen' && (
            <div className="lg:col-span-12 max-w-md mx-auto w-full flex items-center justify-center py-4">
              <div className="bg-white p-10 rounded-[3rem] border border-gray-200 shadow-xl text-center w-full">
                <div className={`h-24 w-24 mx-auto rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-inner ${!attendanceData ? 'bg-green-50' : 'bg-red-50 animate-pulse'}`}>
                  {!attendanceData ? '🔓' : '🚨'}
                </div>
                <h2 className="text-xl font-black mb-1 uppercase tracking-tighter">{!attendanceData ? 'Start Shift' : 'End Mission'}</h2>
                <p className="text-[10px] text-gray-400 font-bold mb-8 italic uppercase">Status: {!attendanceData ? 'Offline' : 'Active Duty'}</p>
                <input type="text" placeholder="CODE" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-2xl text-center font-mono text-4xl mb-6 outline-none uppercase" value={absensiCode} onChange={e=>setAbsensiCode(e.target.value.toUpperCase())} />
                <button onClick={handleAbsensi} disabled={loading} className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl tracking-[0.4em] uppercase text-xs hover:bg-black transition-all shadow-xl">{loading ? '...' : 'Execute'}</button>
              </div>
            </div>
          )}

          {/* TAB: JADWAL PIKET */}
          {activeTab === 'piket' && (
            <div className="lg:col-span-12 bg-white rounded-[2.5rem] border border-gray-200 p-4 md:p-8 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
               {pdfUrl ? (
                 <div className="w-full flex flex-col items-center">
                    {pdfUrl.match(/\.(jpeg|jpg|gif|png)$/) ? (
                      <img src={pdfUrl} alt="Jadwal" className="max-w-full max-h-[600px] object-contain rounded-2xl shadow-lg" />
                    ) : (
                      <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-[600px] rounded-2xl" />
                    )}
                    <a href={pdfUrl} target="_blank" className="mt-6 text-[10px] font-black text-blue-600 bg-blue-50 px-6 py-2 rounded-full uppercase tracking-widest">Open Original Source</a>
                 </div>
               ) : (
                 <div className="text-center opacity-20"><p className="text-5xl mb-4">📅</p><p className="text-xs font-black uppercase italic tracking-[0.5em]">No_Data_Sync</p></div>
               )}
            </div>
          )}
        </div>
      </div>

      {/* --- FLOATING ELEMENTS --- */}
      
      {/* 1. MUSIC PLAYER */}
      <div className="fixed bottom-24 md:bottom-8 left-4 md:left-8 z-[100] group">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200 p-3 rounded-2xl shadow-2xl flex items-center gap-4 w-[56px] group-hover:w-[280px] transition-all duration-500 overflow-hidden border-l-4 border-l-blue-600">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white animate-spin-slow">🎵</div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <p className="text-[8px] font-black mb-1 uppercase text-gray-400">Vault_Radio_Stream</p>
            <audio controls className="h-6 w-full scale-75 origin-left brightness-110"><source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" /></audio>
          </div>
        </div>
      </div>

      {/* 2. ADMIN PANEL */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[100]">
        <button onClick={() => { const p = prompt("Admin Password:"); if(p===PASSWORD_ADMIN) setIsAdmin(!isAdmin); }} className="bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl text-[9px] font-black tracking-widest uppercase flex items-center gap-2 border-b-4 border-blue-600">
          {isAdmin ? '🛡️ CLOSE' : '🛡️ ADMIN'}
        </button>
        {isAdmin && (
          <div className="absolute bottom-16 right-0 bg-white border border-gray-200 p-6 rounded-[2.5rem] shadow-2xl w-[320px] max-w-[90vw] space-y-4 animate-in slide-in-from-bottom-5">
            <h4 className="text-[10px] font-black text-blue-600 uppercase italic border-b pb-2">Master Terminal Control</h4>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <label className="text-[8px] font-black text-gray-400 uppercase">Add GT Subscription</label>
                <form onSubmit={async (e) => {
                  e.preventDefault(); const n = (e.target as any).n.value; const d = (e.target as any).d.value
                  await supabase.from('gt_accounts').insert([{ name: n, expiry_date: d }]); fetchGlobalData(); (e.target as any).reset()
                }} className="space-y-2 mt-2">
                  <input name="n" placeholder="Account Name" className="w-full bg-white border p-2 rounded-lg text-[10px] font-bold outline-none" required />
                  <input name="d" type="date" className="w-full bg-white border p-2 rounded-lg text-[10px] font-bold outline-none" required />
                  <button className="w-full bg-blue-600 text-white text-[8px] py-2 rounded-lg font-black uppercase">Add Account</button>
                </form>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase">Rate IDR</label>
                  <input type="number" className="w-full bg-gray-50 border p-2 rounded-lg text-xs font-black mt-1" value={currentRate} onChange={async (e)=>{ setCurrentRate(e.target.value); await supabase.from('global_settings').update({ rate_value: e.target.value }).eq('id', 'current_rate'); }} />
                </div>
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase">Duty Code</label>
                  <input type="text" className="w-full bg-gray-50 border p-2 rounded-lg text-xs font-black mt-1 uppercase" value={dbDailyCode} onChange={async (e)=>{ setDbDailyCode(e.target.value.toUpperCase()); await supabase.from('global_settings').update({ daily_code: e.target.value.toUpperCase() }).eq('id', 'current_rate'); }} />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase italic">Schedule URL (Img/PDF)</label>
                <input type="text" className="w-full bg-gray-50 border p-2 rounded-lg text-[10px] font-bold mt-1" value={pdfUrl} placeholder="https://..." onChange={async (e)=>{ setPdfUrl(e.target.value); await supabase.from('global_settings').update({ schedule_pdf_url: e.target.value }).eq('id', 'current_rate'); }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-4 flex justify-around items-center z-[90] rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {[
          { id: 'gold', icon: '💰', label: 'LOGS' },
          { id: 'absen', icon: '⚔️', label: 'DUTY' },
          { id: 'piket', icon: '📅', label: 'MAP' }
        ].map((t) => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab===t.id ? 'text-blue-600 scale-110' : 'text-gray-300'}`}>
            <span className="text-xl">{t.icon}</span>
            <span className="text-[8px] font-black tracking-widest">{t.label}</span>
          </button>
        ))}
      </nav>

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 15s linear infinite; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </main>
  )
}