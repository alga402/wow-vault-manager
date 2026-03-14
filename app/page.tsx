'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

export default function Home() {
  // --- AUTH & SYSTEM STATE ---
  const [user, setUser] = useState<User | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false) // State untuk Login Farmer
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [activeTab, setActiveTab] = useState('gold')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [appReady, setAppReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // --- GLOBAL DATA STATE ---
  const [logs, setLogs] = useState<any[]>([])
  const [currentRate, setCurrentRate] = useState('0')
  const [dbDailyCode, setDbDailyCode] = useState('123')
  const [pdfUrl, setPdfUrl] = useState('')

  // --- ANALYTICS STATE ---
  const [personalTotalGold, setPersonalTotalGold] = useState(0)
  const [estimatedEarnings, setEstimatedEarnings] = useState(0)

  // --- INPUT & ADMIN STATE ---
  const [gold, setGold] = useState('')
  const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('S.T.A.R.S')
  const [absensiCode, setAbsensiCode] = useState('')
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [newRate, setNewRate] = useState('')
  const [newDailyCode, setNewDailyCode] = useState('')
  const [newPiketUrl, setNewPiketUrl] = useState('') // State baru untuk ganti foto jadwal

  const PASSWORD_ADMIN = "12345"

  // 1. DATA FETCH & ANALYTICS
  const fetchGlobalData = useCallback(async () => {
    try {
      const [logsRes, settingsRes] = await Promise.all([
        supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('global_settings').select('*').eq('id', 'current_rate').maybeSingle()
      ])

      if (logsRes.data) {
        setLogs(logsRes.data)
        const myLogs = logsRes.data.filter(log => log.user_id === user?.id)
        const total = myLogs.reduce((acc, curr) => acc + (Number(curr.gold_amount) || 0), 0)
        setPersonalTotalGold(total)

        if (settingsRes.data) {
          const rateVal = parseInt(settingsRes.data.rate_value || '0')
          setEstimatedEarnings((total / 1000) * rateVal)
        }
      }

      if (settingsRes.data) {
        setDbDailyCode(settingsRes.data.daily_code || '123')
        setCurrentRate(settingsRes.data.rate_value || '0')
        setPdfUrl(settingsRes.data.schedule_pdf_url || '')
      }
    } catch (e) { console.error("SYNC ERROR") }
  }, [user?.id])

  const fetchUserStats = useCallback(async (uid: string) => {
    if (!uid) return
    const { data: att } = await supabase.from('attendance').select('*').eq('user_id', uid).is('check_out_time', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setAttendanceData(att)
  }, [])

  // 2. LIFECYCLE
  useEffect(() => {
    const channel = supabase.channel('vault-live').on('postgres_changes', { event: '*', schema: 'public', table: 'gold_logs' }, () => fetchGlobalData()).on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => fetchGlobalData()).subscribe()
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) { setUser(session.user); await fetchUserStats(session.user.id); }
      setAppReady(true)
    }
    init()
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchGlobalData()
    return () => { supabase.removeChannel(channel); clearInterval(timer); }
  }, [fetchGlobalData, fetchUserStats])

  // LOGIN FUNCTION
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert("AKSES DITOLAK: Periksa Email/Password")
    else { setUser(data.user); await fetchUserStats(data.user.id); }
    setIsLoggingIn(false)
  }

  // 3. ADMIN FUNCTIONS
  const sendWhatsAppNotification = (farmer: string, amount: number, server: string) => {
    const message = `*VAULT OS REPORT*%0A------------------%0A*Operator:* ${farmer.toUpperCase()}%0A*Amount:* ${amount.toLocaleString()}G%0A*Server:* ${server}%0A*Status:* TRANSMITTED%0A------------------%0A_Data telah tercatat di Ledger._`
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const deleteLog = async (id: string) => {
    if(!confirm("DELETE LOG?")) return
    await supabase.from('gold_logs').delete().eq('id', id)
    fetchGlobalData()
  }

  const updateLogStatus = async (id: string, status: string) => {
    await supabase.from('gold_logs').update({ status }).eq('id', id)
    fetchGlobalData()
  }

  const updateGlobalSettings = async (field: string, value: string) => {
    if (!isAdmin || !value) return
    setLoading(true)
    try {
      await supabase.from('global_settings').update({ [field]: value }).eq('id', 'current_rate')
      alert("CORE UPDATED")
      if(field === 'rate_value') setNewRate('');
      if(field === 'daily_code') setNewDailyCode('');
      if(field === 'schedule_pdf_url') setNewPiketUrl('');
    } catch (e) { alert("OVERRIDE FAILED") }
    finally { setLoading(false) }
  }

  const handleGoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!gold || !serverName || loading) return;
    setLoading(true);
    try {
      await supabase.from('gold_logs').insert([{ farmer_name: user?.email?.split('@')[0], gold_amount: parseInt(gold), server_name: `${faction} | ${serverName.toUpperCase()}`, status: 'Pending', user_id: user?.id }])
      setGold(''); setServerName(''); alert("DATA TRANSMITTED");
    } catch (e) { alert("FAILED"); } finally { setLoading(false); }
  }

  const handleAbsensi = async () => {
    if (absensiCode !== dbDailyCode || loading) return alert("INVALID KEY");
    setLoading(true);
    try {
      if (!attendanceData) { await supabase.from('attendance').insert([{ user_id: user?.id, farmer_name: user?.email?.split('@')[0] }]) }
      else { await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id) }
      setAbsensiCode(''); await fetchUserStats(user?.id || ''); alert("SUCCESS");
    } catch (e) { alert("OFFLINE"); } finally { setLoading(false); }
  }

  // --- LOGIN SCREEN IF NO USER ---
  if (!user && appReady) {
    return (
      <main className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <div className="h-20 w-20 bg-slate-900 rounded-[2rem] mx-auto flex items-center justify-center text-white font-black text-4xl mb-4">V</div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Vault OS <span className="text-blue-600">Secure</span></h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator Authentication</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="EMAIL" className="w-full bg-slate-50 p-5 rounded-2xl text-[11px] font-black uppercase outline-none border-2 border-transparent focus:border-blue-500 transition-all" value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" placeholder="PASSWORD" className="w-full bg-slate-50 p-5 rounded-2xl text-[11px] font-black uppercase outline-none border-2 border-transparent focus:border-blue-500 transition-all" value={password} onChange={e=>setPassword(e.target.value)} />
            <button disabled={isLoggingIn} className="w-full font-black py-6 rounded-[2rem] text-[10px] uppercase bg-slate-900 text-white hover:bg-blue-600 shadow-xl transition-all disabled:opacity-50">
              {isLoggingIn ? 'Verifying...' : 'Initialize Session'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  if (!appReady) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black text-[10px] animate-pulse">BOOTING VAULT OS...</div>

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 pb-44">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* HEADER */}
        <header className="bg-white border border-slate-200 p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-slate-900 rounded-[1.8rem] flex items-center justify-center text-white font-black text-3xl">V</div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Vault OS <span className="text-blue-600">14.6</span></h1>
              <p className="text-[10px] font-bold text-slate-400 mt-2 font-mono uppercase tracking-widest">{currentTime.toLocaleTimeString('id-ID')} • <span className="text-green-500">SYSTEM ONLINE</span></p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-[10px] font-black uppercase text-red-500 px-4 hover:opacity-50 transition-all">Terminate Session</button>
        </header>

        {activeTab === 'gold' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
            {/* LEFT: INPUT & ANALYTICS */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 opacity-70">Revenue Intel</p>
                <h4 className="text-4xl font-black mb-1">Rp {estimatedEarnings.toLocaleString('id-ID')}</h4>
                <p className="text-[9px] font-bold opacity-60 uppercase italic tracking-widest">Rate: {currentRate}/1k</p>
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-slate-200">
                <form onSubmit={handleGoldSubmit} className="space-y-4">
                  <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                    {['S.T.A.R.S', 'UMBRELLA'].map(f => (
                      <button key={f} type="button" onClick={()=>setFaction(f)} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${faction===f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{f}</button>
                    ))}
                  </div>
                  <input type="text" placeholder="SERVER NAME" className="w-full bg-slate-50 p-5 rounded-2xl text-[11px] font-black uppercase outline-none" value={serverName} onChange={e=>setServerName(e.target.value)} />
                  <div className="bg-slate-900 p-8 rounded-[2rem] text-center text-white">
                    <p className="text-[9px] font-black text-blue-400 mb-2 uppercase tracking-widest">Amount</p>
                    <input type="number" placeholder="0" className="w-full bg-transparent text-5xl font-black text-center outline-none" value={gold} onChange={e=>setGold(e.target.value)} />
                  </div>
                  <button className="w-full font-black py-6 rounded-[2rem] text-[10px] uppercase bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95 transition-all">Execute Protocol</button>
                </form>
              </div>
            </div>

            {/* RIGHT: LEDGER */}
            <div className="lg:col-span-8 bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Global Asset Ledger</h3>
                 <span className="text-[9px] font-black text-blue-500">ACTIVE RATE: Rp {currentRate}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase bg-slate-50/50">
                      <th className="p-6">Operator</th><th className="p-6">Quantity</th><th className="p-6">State</th>
                      {isAdmin && <th className="p-6 text-center">Admin Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold italic text-[12px]">
                    {logs.map(i => (
                      <tr key={i.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-6 uppercase text-slate-700">{i.farmer_name}</td>
                        <td className="p-6 text-blue-600 font-black">+{i.gold_amount.toLocaleString()}</td>
                        <td className="p-6">
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${i.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{i.status}</span>
                        </td>
                        {isAdmin && (
                          <td className="p-6 flex gap-2 justify-center">
                            {i.status === 'Pending' ? (
                              <button onClick={()=>updateLogStatus(i.id, 'Paid')} className="bg-green-600 text-white px-4 py-2 rounded-xl text-[9px] uppercase">Mark Paid</button>
                            ) : (
                              <button onClick={()=>sendWhatsAppNotification(i.farmer_name, i.gold_amount, i.server_name)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[9px] uppercase font-black">WA Share</button>
                            )}
                            <button onClick={()=>deleteLog(i.id)} className="text-red-400 hover:text-red-600 px-2 font-black text-lg">×</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ADMIN CORE (DENGAN FITUR GANTI FOTO PIKET) */}
        {activeTab === 'admin' && (
          <div className="max-w-md mx-auto space-y-6">
            {!isAdmin ? (
              <div className="bg-white p-12 rounded-[4rem] text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-300 font-black uppercase tracking-widest italic">Clearance Level 5 Required</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-10">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200">
                  <h3 className="text-[10px] font-black text-blue-600 uppercase mb-4 pl-4 border-l-4 border-blue-600">Market Rate</h3>
                  <div className="flex gap-2">
                    <input type="number" placeholder={currentRate} className="flex-1 bg-slate-50 p-5 rounded-2xl text-sm font-black outline-none" value={newRate} onChange={e=>setNewRate(e.target.value)} />
                    <button onClick={()=>updateGlobalSettings('rate_value', newRate)} className="bg-slate-900 text-white px-8 rounded-2xl font-black text-[10px] uppercase">Update</button>
                  </div>
                </div>
                
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-lg">
                  <h3 className="text-[10px] font-black text-green-600 uppercase mb-4 pl-4 border-l-4 border-green-600">Update Jadwal (URL Foto)</h3>
                  <div className="space-y-4">
                    <input type="text" placeholder="Masukkan Link Foto Baru..." className="w-full bg-slate-50 p-5 rounded-2xl text-[10px] font-bold outline-none border-2 border-transparent focus:border-green-400" value={newPiketUrl} onChange={e=>setNewPiketUrl(e.target.value)} />
                    <button onClick={()=>updateGlobalSettings('schedule_pdf_url', newPiketUrl)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-green-100">Sync Jadwal Baru</button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-200">
                  <h3 className="text-[10px] font-black text-orange-600 uppercase mb-4 pl-4 border-l-4 border-orange-600">Access Key</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder={dbDailyCode} className="flex-1 bg-slate-50 p-5 rounded-2xl text-sm font-black outline-none" value={newDailyCode} onChange={e=>setNewDailyCode(e.target.value.toUpperCase())} />
                    <button onClick={()=>updateGlobalSettings('daily_code', newDailyCode)} className="bg-orange-600 text-white px-8 rounded-2xl font-black text-[10px] uppercase">Rotate</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: DUTY & INTEL */}
        {activeTab === 'absen' && <div className="flex justify-center py-10"><div className="bg-white p-14 rounded-[5rem] border shadow-2xl text-center w-full max-w-md"> <div className={`h-20 w-20 mx-auto rounded-3xl flex items-center justify-center text-4xl mb-10 ${attendanceData ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-green-50 text-green-500'}`}> {attendanceData ? '🛑' : '⚡'} </div> <input type="password" placeholder="UNIT KEY" className="w-full bg-slate-50 p-6 rounded-[2rem] text-center text-2xl mb-8 outline-none focus:border-blue-500 border-4 border-transparent font-mono" value={absensiCode} onChange={e=>setAbsensiCode(e.target.value.toUpperCase())} /> <button onClick={handleAbsensi} className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] text-[10px] tracking-widest uppercase active:scale-95 transition-all">{attendanceData ? 'STOP SHIFT' : 'START SHIFT'}</button> </div></div>}
        {activeTab === 'piket' && <div className="bg-white rounded-[4rem] p-4 md:p-12 min-h-[400px] flex items-center justify-center shadow-inner overflow-hidden animate-in zoom-in duration-500"> {pdfUrl ? <img src={pdfUrl} className="rounded-[3rem] shadow-2xl border-8 border-white max-w-full" alt="Jadwal Piket" /> : <p className="text-slate-200 font-black italic uppercase tracking-widest">Searching Uplink...</p>} </div>}
      </div>

      {/* FLOATING ADMIN OVERRIDE */}
      <button onClick={() => { if(isAdmin) { setIsAdmin(false); return; } const p = prompt("SECURITY CLEARANCE:"); if(p === PASSWORD_ADMIN) setIsAdmin(true); }} className={`fixed bottom-36 right-8 z-[110] p-6 rounded-full font-black text-[10px] shadow-2xl transition-all ${isAdmin ? 'bg-red-600 text-white ring-8 ring-red-100 scale-110' : 'bg-slate-900 text-white opacity-40 hover:opacity-100'}`}> {isAdmin ? '🛡️ LOCK' : '🛡️'} </button>

      {/* NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-3xl border-t p-6 pb-10 flex justify-around rounded-t-[3.5rem] shadow-2xl md:max-w-md md:mx-auto md:mb-6 md:rounded-[2.5rem] md:border z-[100]">
        {[{id:'gold', i:'💰', l:'VAULT'}, {id:'absen', i:'🛡️', l:'DUTY'}, {id:'piket', i:'🛰️', l:'INTEL'}, {id:'admin', i:'⚙️', l:'CORE'}].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex flex-col items-center gap-2 transition-all duration-300 ${activeTab===t.id ? 'scale-110 -translate-y-2' : 'opacity-20 grayscale'}`}>
            <span className="text-2xl">{t.i}</span>
            <span className={`text-[9px] font-black tracking-widest uppercase ${activeTab===t.id ? 'text-blue-600' : 'text-slate-400'}`}>{t.l}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}