'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

export default function Home() {
  // --- AUTH & SYSTEM STATE ---
  const [user, setUser] = useState<User | null>(null)
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
  const [feePercent, setFeePercent] = useState('0')

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
  const [newPiketUrl, setNewPiketUrl] = useState('')
  const [newFee, setNewFee] = useState('')

  const PASSWORD_ADMIN = "12345"
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 1. DATA FETCH & ANALYTICS (Rate per 1 Gold)
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
          const rateVal = parseFloat(settingsRes.data.rate_value || '0')
          // KALKULASI: Total Gold langsung dikali rate (karena rate per 1 gold)
          setEstimatedEarnings(total * rateVal)
        }
      }

      if (settingsRes.data) {
        setDbDailyCode(settingsRes.data.daily_code || '123')
        setCurrentRate(settingsRes.data.rate_value || '0')
        setPdfUrl(settingsRes.data.schedule_pdf_url || '')
        setFeePercent(settingsRes.data.fee_percent || '0')
      }
    } catch (e) { console.error("SYNC ERROR") }
  }, [user?.id])

  const fetchUserStats = useCallback(async (uid: string) => {
    if (!uid) return
    const { data: att } = await supabase.from('attendance').select('*').eq('user_id', uid).is('check_out_time', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setAttendanceData(att)
  }, [])

  useEffect(() => {
    const channel = supabase.channel('vault-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gold_logs' }, () => fetchGlobalData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => fetchGlobalData())
      .subscribe()

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) { 
        setUser(session.user); 
        await fetchUserStats(session.user.id); 
      }
      setAppReady(true)
    }

    init()
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchGlobalData()
    return () => { supabase.removeChannel(channel); clearInterval(timer); }
  }, [fetchGlobalData, fetchUserStats])

  // AUDIO TRIGGER (Auto-play saat klik pertama di app)
  const playBootSound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }
  }

  const handleLogout = async () => {
    if(confirm("Keluar dari sistem?")) {
      await supabase.auth.signOut()
      window.location.reload()
    }
  }

  const handleGoogleLogin = async () => {
    playBootSound()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) alert("LOGIN ERROR: " + error.message)
    setLoading(false)
  }

  // 3. WHATSAPP STRUK (Kalkulasi Rate per 1 Gold)
  const sendWhatsAppNotification = (farmer: string, amount: number, server: string) => {
    const rate = parseFloat(currentRate)
    const fee = parseInt(feePercent)
    
    const kotor = amount * rate
    const potonganValue = (fee / 100) * kotor
    const bersih = kotor - potonganValue

    const message = `*VAULT OS - STRUK PENCAIRAN*%0A` +
      `------------------------------------------%0A` +
      `*STATUS:* 🟢 SUDAH CAIR (PAID)%0A` +
      `*OPERATOR:* ${farmer.toUpperCase()}%0A` +
      `*SERVER:* ${server}%0A` +
      `------------------------------------------%0A` +
      `*HASIL TANI:* ${amount.toLocaleString()} GOLD%0A` +
      `*RATE SAAT INI:* Rp ${rate.toLocaleString('id-ID')}/1 Gold%0A` +
      `------------------------------------------%0A` +
      `*ESTIMASI KOTOR:* Rp ${kotor.toLocaleString('id-ID')}%0A` +
      `*POTONGAN ADMIN (${fee}%):* -Rp ${potonganValue.toLocaleString('id-ID')}%0A` +
      `------------------------------------------%0A` +
      `*TOTAL DANA CAIR:* %0A` +
      `👉 *Rp ${bersih.toLocaleString('id-ID')}*%0A` +
      `------------------------------------------%0A` +
      `_Struk ini adalah bukti sah pencairan._%0A` +
      `_Terima kasih, Agen!_`
    
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
      alert("SISTEM DIUPDATE: Sinkronisasi Berhasil.");
      if(field === 'rate_value') setNewRate('');
      if(field === 'daily_code') setNewDailyCode('');
      if(field === 'schedule_pdf_url') setNewPiketUrl('');
      if(field === 'fee_percent') setNewFee('');
      await fetchGlobalData()
    } catch (e) { alert("OVERRIDE FAILED") }
    finally { setLoading(false) }
  }

  const handleGoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!gold || !serverName || loading) return;
    setLoading(true);
    try {
      const farmerName = user?.user_metadata.full_name || user?.email?.split('@')[0]
      await supabase.from('gold_logs').insert([{ 
        farmer_name: farmerName, 
        gold_amount: parseInt(gold), 
        server_name: `${faction} | ${serverName.toUpperCase()}`, 
        status: 'Pending', 
        user_id: user?.id 
      }])
      setGold(''); setServerName(''); alert("DATA TRANSMITTED");
    } catch (e) { alert("FAILED"); } finally { setLoading(false); }
  }

  const handleAbsensi = async () => {
    if (absensiCode !== dbDailyCode || loading) return alert("INVALID KEY");
    setLoading(true);
    try {
      const farmerName = user?.user_metadata.full_name || user?.email?.split('@')[0]
      if (!attendanceData) { 
        await supabase.from('attendance').insert([{ user_id: user?.id, farmer_name: farmerName }]) 
      } else { 
        await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id) 
      }
      setAbsensiCode(''); await fetchUserStats(user?.id || ''); alert("SUCCESS");
    } catch (e) { alert("OFFLINE"); } finally { setLoading(false); }
  }

  // --- RENDER LOGIC (UI) ---
  if (!user && appReady) {
    return (
      <main className="min-h-screen bg-[#020617] flex items-center justify-center p-6" onClick={playBootSound}>
        <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" loop />
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-[4rem] p-12 shadow-[0_0_50px_rgba(30,144,255,0.3)] text-center space-y-10 animate-in fade-in zoom-in duration-700">
          <div className="space-y-4">
            <div className="h-24 w-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[2.5rem] mx-auto flex items-center justify-center text-white font-black text-5xl shadow-[0_0_30px_rgba(37,99,235,0.5)]">V</div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Vault OS <span className="text-blue-400">Access</span></h2>
            <p className="text-[11px] font-bold text-blue-300 uppercase tracking-[0.3em] opacity-60">Authentication Required</p>
          </div>
          <button onClick={handleGoogleLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-[2rem] flex items-center justify-center gap-4 transition-all active:scale-95 group shadow-xl border border-blue-400/30">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-6 w-6 brightness-200" alt="Google" />
            <span className="font-black text-[12px] uppercase tracking-wider">Continue with Google</span>
          </button>
        </div>
      </main>
    )
  }

  if (!appReady) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black text-[12px] tracking-[0.5em] animate-pulse italic">INITIALIZING VAULT CORE...</div>

  return (
    <main className="min-h-screen bg-[#020617] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 text-slate-100 pb-44 selection:bg-blue-500/30">
      <audio ref={audioRef} src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3" />
      
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8" onClick={playBootSound}>
        
        {/* HEADER: Modern Cyber Look */}
        <header className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white font-black text-3xl overflow-hidden shadow-lg ring-4 ring-white/5">
                {user?.user_metadata.avatar_url ? <img src={user.user_metadata.avatar_url} /> : 'V'}
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-white">Vault OS <span className="text-blue-500">14.7</span></h1>
              <p className="text-[10px] font-bold text-blue-400 mt-2 font-mono uppercase tracking-widest opacity-80">
                {user?.user_metadata.full_name || user?.email} • <span className="text-green-400 animate-pulse">ACTIVE_UPLINK</span>
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-500/10 text-red-400 border border-red-500/20 font-black text-[10px] uppercase px-8 py-4 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg">Terminate Session</button>
        </header>

        {activeTab === 'gold' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT: ANALYTICS */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8 rounded-[3rem] text-white shadow-[0_20px_40px_rgba(0,0,0,0.3)] border border-white/20 relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-all duration-700"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 text-blue-100">Market Revenue Intel</p>
                <h4 className="text-4xl font-black mb-1 drop-shadow-md">Rp {estimatedEarnings.toLocaleString('id-ID')}</h4>
                <p className="text-[9px] font-bold text-blue-200 uppercase italic tracking-tighter">Net Projection: {personalTotalGold.toLocaleString()} Gold x Rp {currentRate}</p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg p-8 rounded-[3rem] border border-white/10 shadow-2xl relative">
                <form onSubmit={handleGoldSubmit} className="space-y-4">
                  <div className="flex p-1.5 bg-black/40 rounded-2xl gap-1 border border-white/5">
                    {['S.T.A.R.S', 'UMBRELLA'].map(f => (
                      <button key={f} type="button" onClick={()=>setFaction(f)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${faction===f ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}>{f}</button>
                    ))}
                  </div>
                  <input type="text" placeholder="TARGET SERVER" className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ring-blue-500 text-white placeholder:text-slate-600" value={serverName} onChange={e=>setServerName(e.target.value)} />
                  <div className="bg-slate-900/80 p-8 rounded-[2rem] text-center border border-blue-500/20 shadow-inner">
                    <p className="text-[9px] font-black text-blue-400 mb-2 uppercase tracking-widest">Quantity of Gold</p>
                    <input type="number" placeholder="0" className="w-full bg-transparent text-5xl font-black text-center outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={gold} onChange={e=>setGold(e.target.value)} />
                  </div>
                  <button disabled={loading} className="w-full font-black py-6 rounded-[2rem] text-[10px] uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.3)] active:scale-95 transition-all border border-blue-400/20">Execute Data Transmission</button>
                </form>
              </div>
            </div>

            {/* RIGHT: LEDGER */}
            <div className="lg:col-span-8 bg-white/5 backdrop-blur-md rounded-[3.5rem] border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic flex items-center gap-2"><span className="h-2 w-2 bg-blue-500 rounded-full animate-ping"></span> Live Global Ledger</h3>
                  <div className="text-right">
                    <span className="block text-[11px] font-black text-white uppercase tracking-tighter">Rate: Rp {parseFloat(currentRate).toLocaleString('id-ID')} / 1 Gold</span>
                    <span className="block text-[9px] font-black text-red-400 uppercase tracking-tighter opacity-70 italic">Security Fee: {feePercent}%</span>
                  </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-500 uppercase bg-black/20">
                      <th className="p-6">Operator</th><th className="p-6">Quantity</th><th className="p-6">State</th>
                      {isAdmin && <th className="p-6 text-center">Protocol</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-bold italic text-[12px]">
                    {logs.map(i => (
                      <tr key={i.id} className="hover:bg-blue-500/5 transition-colors group">
                        <td className="p-6 uppercase text-slate-300 group-hover:text-white transition-colors">{i.farmer_name}</td>
                        <td className="p-6 text-blue-400 font-black">+{i.gold_amount.toLocaleString()}</td>
                        <td className="p-6">
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${i.status === 'Paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>{i.status}</span>
                        </td>
                        {isAdmin && (
                          <td className="p-6 flex gap-2 justify-center">
                            {i.status === 'Pending' ? (
                              <button onClick={()=>updateLogStatus(i.id, 'Paid')} className="bg-green-600 text-white px-4 py-2 rounded-xl text-[9px] uppercase shadow-lg shadow-green-600/20">Verify</button>
                            ) : (
                              <button onClick={()=>sendWhatsAppNotification(i.farmer_name, i.gold_amount, i.server_name)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[9px] uppercase shadow-lg shadow-blue-600/20">Send Struk</button>
                            )}
                            <button onClick={()=>deleteLog(i.id)} className="text-red-500/50 px-2 font-black text-lg hover:text-red-500 transition-colors">×</button>
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

        {/* TAB: ADMIN CORE */}
        {activeTab === 'admin' && (
          <div className="max-w-md mx-auto space-y-6">
            {!isAdmin ? (
              <div className="bg-white/5 backdrop-blur-xl p-12 rounded-[4rem] text-center border-2 border-dashed border-white/10">
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] italic animate-pulse">Clearance Level 5 Required</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[3rem] border border-blue-500/30 shadow-[0_0_30px_rgba(37,99,235,0.1)]">
                  <h3 className="text-[10px] font-black text-blue-400 uppercase mb-4 pl-4 border-l-4 border-blue-500">Financial Setup</h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-500 ml-2 uppercase">Rate Value (Per 1 Gold)</label>
                      <div className="flex gap-2">
                        <input type="number" step="any" placeholder={`Rp ${currentRate}`} className="flex-1 bg-black/40 border border-white/5 p-5 rounded-2xl text-sm font-black outline-none text-white" value={newRate} onChange={e=>setNewRate(e.target.value)} />
                        <button onClick={()=>updateGlobalSettings('rate_value', newRate)} className="bg-white text-black px-8 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-400 transition-all">Set</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-red-400 ml-2 uppercase">Service Fee (%)</label>
                      <div className="flex gap-2">
                        <input type="number" placeholder={`${feePercent}%`} className="flex-1 bg-black/40 border border-white/5 p-5 rounded-2xl text-sm font-black outline-none text-white" value={newFee} onChange={e=>setNewFee(e.target.value)} />
                        <button onClick={()=>updateGlobalSettings('fee_percent', newFee)} className="bg-red-600 text-white px-8 rounded-2xl font-black text-[10px] uppercase">Set</button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[3rem] border border-green-500/30 shadow-sm">
                  <h3 className="text-[10px] font-black text-green-400 uppercase mb-4 pl-4 border-l-4 border-green-500">Intel Media Uplink</h3>
                  <input type="text" placeholder="Image/PDF URL..." className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-[10px] font-bold outline-none mb-3 text-white" value={newPiketUrl} onChange={e=>setNewPiketUrl(e.target.value)} />
                  <button onClick={()=>updateGlobalSettings('schedule_pdf_url', newPiketUrl)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-green-600/20">Sync Data Stream</button>
                </div>

                <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[3rem] border border-orange-500/30 shadow-sm">
                  <h3 className="text-[10px] font-black text-orange-400 uppercase mb-4 pl-4 border-l-4 border-orange-500">Daily Duty Key</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder={`Current: ${dbDailyCode}`} className="flex-1 bg-black/40 border border-white/5 p-5 rounded-2xl text-sm font-black outline-none text-white uppercase" value={newDailyCode} onChange={e=>setNewDailyCode(e.target.value.toUpperCase())} />
                    <button onClick={()=>updateGlobalSettings('daily_code', newDailyCode)} className="bg-orange-600 text-white px-8 rounded-2xl font-black text-[10px] uppercase">Rotate</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'absen' && (
          <div className="flex justify-center py-10">
            <div className="bg-white/5 backdrop-blur-2xl p-14 rounded-[5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] text-center w-full max-w-md animate-in zoom-in duration-500"> 
              <div className={`h-24 w-24 mx-auto rounded-[2rem] flex items-center justify-center text-5xl mb-10 shadow-2xl ${attendanceData ? 'bg-red-500/10 text-red-500 animate-pulse border border-red-500/30' : 'bg-green-500/10 text-green-500 border border-green-500/30'}`}> 
                {attendanceData ? '🛑' : '⚡'} 
              </div> 
              <h2 className="text-white font-black uppercase italic tracking-widest mb-6 opacity-80">{attendanceData ? 'Shift in Progress' : 'Ready for Duty'}</h2>
              <input type="password" placeholder="ENTER UNIT KEY" className="w-full bg-black/40 border border-white/10 p-6 rounded-[2rem] text-center text-2xl mb-8 outline-none focus:border-blue-500 transition-all font-mono text-white tracking-[0.5em]" value={absensiCode} onChange={e=>setAbsensiCode(e.target.value.toUpperCase())} /> 
              <button onClick={handleAbsensi} className={`w-full font-black py-6 rounded-[2rem] text-[10px] tracking-[0.3em] uppercase transition-all shadow-xl ${attendanceData ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} text-white`}>
                {attendanceData ? 'TERMINATE SHIFT' : 'INITIALIZE SHIFT'}
              </button> 
            </div>
          </div>
        )}
        
        {activeTab === 'piket' && (
          <div className="bg-white/5 backdrop-blur-md rounded-[4rem] p-4 md:p-12 min-h-[500px] flex items-center justify-center shadow-inner overflow-hidden border border-white/10"> 
            {pdfUrl ? <img src={pdfUrl} className="rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] border-8 border-white/5 max-w-full animate-in fade-in duration-1000" alt="Intel Schedule" /> : <div className="text-center space-y-4"><div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div><p className="text-slate-500 font-black italic uppercase tracking-[0.5em]">Awaiting Satellite Uplink...</p></div>} 
          </div>
        )}
      </div>

      {/* FLOATING ADMIN TOGGLE */}
      <button onClick={() => { if(isAdmin) { setIsAdmin(false); return; } const p = prompt("SECURITY CLEARANCE:"); if(p === PASSWORD_ADMIN) setIsAdmin(true); }} className={`fixed bottom-36 right-8 z-[110] p-6 rounded-full font-black text-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all ${isAdmin ? 'bg-red-600 text-white ring-8 ring-red-500/20 scale-110' : 'bg-slate-800 text-white opacity-40 hover:opacity-100 border border-white/10'}`}> {isAdmin ? '🛡️ LOCK' : '🛡️'} </button>

      {/* NAVIGATION BAR: Floating Glassmorphism */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:max-w-md bg-black/60 backdrop-blur-3xl border border-white/10 p-6 flex justify-around rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-in slide-in-from-bottom-10 duration-1000">
        {[{id:'gold', i:'💰', l:'VAULT'}, {id:'absen', i:'🛡️', l:'DUTY'}, {id:'piket', i:'🛰️', l:'INTEL'}, {id:'admin', i:'⚙️', l:'CORE'}].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex flex-col items-center gap-2 transition-all duration-300 ${activeTab===t.id ? 'scale-110 -translate-y-2' : 'opacity-30 grayscale hover:opacity-60'}`}>
            <span className="text-2xl drop-shadow-md">{t.i}</span>
            <span className={`text-[9px] font-black tracking-widest uppercase ${activeTab===t.id ? 'text-blue-400' : 'text-slate-400'}`}>{t.l}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}