'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

export default function Home() {
  // --- STATES ---
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('gold')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [logs, setLogs] = useState<any[]>([])
  const [gtAccounts, setGtAccounts] = useState<any[]>([])
  const [currentRate, setCurrentRate] = useState('0')
  const [dbDailyCode, setDbDailyCode] = useState('123')
  const [pdfUrl, setPdfUrl] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  const [gold, setGold] = useState('')
  const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('S.T.A.R.S')
  const [absensiCode, setAbsensiCode] = useState('')
  const [attendanceData, setAttendanceData] = useState<any>(null)

  const PASSWORD_ADMIN = "12345"

  // --- LOGIC FUNCTIONS ---
  
  const fetchGlobalData = useCallback(async () => {
    const [logsRes, settingsRes, gtRes] = await Promise.all([
      supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('global_settings').select('*').eq('id', 'current_rate').maybeSingle(),
      supabase.from('gt_accounts').select('*').order('expiry_date', { ascending: true })
    ])

    if (logsRes.data) setLogs(logsRes.data)
    if (gtRes.data) setGtAccounts(gtRes.data)
    if (settingsRes.data) {
      setDbDailyCode(settingsRes.data.daily_code || '123')
      setCurrentRate(settingsRes.data.rate_value || '0')
      setPdfUrl(settingsRes.data.schedule_pdf_url || '')
    }
  }, [])

  const fetchUserStats = useCallback(async (uid: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: att } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', uid)
      .gte('created_at', today)
      .maybeSingle()
    setAttendanceData(att)
  }, [])

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        fetchUserStats(session.user.id)
      }
    }
    
    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) fetchUserStats(currentUser.id)
    })

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchGlobalData()
    
    return () => {
      subscription.unsubscribe()
      clearInterval(timer)
    }
  }, [fetchGlobalData, fetchUserStats])

  // --- HANDLERS ---

  const handleGoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const goldAmount = parseInt(gold)
    if (isNaN(goldAmount) || goldAmount <= 0) return alert("❌ JUMLAH GOLD TIDAK VALID!")
    if (!serverName.trim()) return alert("❌ MASUKKAN NAMA SERVER!")
    
    setLoading(true)
    try {
      const { error } = await supabase.from('gold_logs').insert([{ 
        farmer_name: user?.email?.split('@')[0], 
        gold_amount: goldAmount, 
        server_name: `${faction} | ${serverName.toUpperCase()}`,
        status: 'Pending', 
        user_id: user?.id 
      }])
      if (error) throw error
      setGold(''); setServerName(''); alert("✅ DATA TRANSMITTED!"); fetchGlobalData()
    } catch (err: any) { alert("❌ ERROR: " + err.message) }
    finally { setLoading(false) }
  }

  // --- ADMIN ACTIONS ---

  const updateLogStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('gold_logs').update({ status: newStatus }).eq('id', id)
    if (!error) fetchGlobalData()
  }

  const deleteLog = async (id: string) => {
    if (!confirm("Hapus log ini secara permanen?")) return
    const { error } = await supabase.from('gold_logs').delete().eq('id', id)
    if (!error) fetchGlobalData()
  }

  const saveGlobalSetting = async (field: string, value: string) => {
    try {
      await supabase.from('global_settings').update({ [field]: value }).eq('id', 'current_rate')
      fetchGlobalData()
    } catch (e) { console.error("Update failed") }
  }

  const sendWhatsAppNotification = (farmer: string, amount: number, server: string) => {
    const rate = parseInt(currentRate) || 0
    const gross = amount * rate
    const inputFee = prompt(`Masukkan nominal POTONGAN (Biaya Admin/TF) untuk ${farmer}:`, "0")
    if (inputFee === null) return 
    const fee = parseInt(inputFee) || 0
    const net = gross - fee

    const message = `*VAULT OS - PAYMENT REPORT*\n----------------------------------\n*Farmer:* ${farmer}\n*Server:* ${server}\n*Gold:* ${amount.toLocaleString()} G\n*Gross:* Rp ${gross.toLocaleString()}\n*Potongan:* Rp ${fee.toLocaleString()}\n----------------------------------\n*NETTO: Rp ${net.toLocaleString()}*\n----------------------------------\nStatus: *PAID / CAIR* ✅\n_Processed by Vault OS Terminal_`
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const getPendingSummary = () => {
    const summary: Record<string, number> = {}
    logs.filter(l => l.status === 'Pending').forEach(l => {
      summary[l.farmer_name] = (summary[l.farmer_name] || 0) + l.gold_amount
    })
    return summary
  }

  if (!user) return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="h-16 w-16 bg-blue-600 rounded-2xl animate-spin mb-6 shadow-2xl shadow-blue-500/50" />
      <p className="italic font-black text-white uppercase tracking-[0.5em] animate-pulse">Initializing Vault OS...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-800 p-3 md:p-8 pb-32 font-sans selection:bg-blue-100">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-white border border-slate-200 p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-slate-900 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-slate-200">V</div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter italic">Vault OS <span className="text-blue-600">v13.5</span></h1>
              <p className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping" />
                {currentTime.toLocaleTimeString('id-ID')} • LOCAL TERMINAL
              </p>
            </div>
          </div>

          <nav className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
            {[{id:'gold', l:'GOLD LEDGER'}, {id:'absen', l:'DUTY STATUS'}, {id:'piket', l:'TACTICAL MAP'}].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${activeTab === t.id ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                {t.l}
              </button>
            ))}
          </nav>

          <div className="bg-blue-600 px-6 py-3 rounded-2xl text-white shadow-xl shadow-blue-100 flex items-center gap-6">
            <div className="text-right">
              <p className="text-[8px] font-black uppercase opacity-70 tracking-widest">Rate / G</p>
              <p className="text-lg font-black italic font-mono leading-none">IDR {currentRate}</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="bg-white/20 hover:bg-white/40 px-4 py-2 rounded-xl text-[9px] font-black transition-colors">EXIT</button>
          </div>
        </header>

        {/* ADMIN QUICK VIEW */}
        {isAdmin && (
          <div className="grid grid-cols-1 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="bg-slate-900 p-7 rounded-[3rem] border-b-[12px] border-blue-600 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl font-black italic text-white select-none">DATA</div>
              <h4 className="text-[10px] font-black text-blue-400 uppercase mb-5 tracking-[0.4em] italic flex items-center gap-2">
                <span className="h-2 w-2 bg-blue-500 rounded-full" /> Unpaid Earnings Cluster
              </h4>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {Object.entries(getPendingSummary()).map(([name, amount]: any) => (
                  <div key={name} className="bg-white/5 p-6 rounded-[2.2rem] min-w-[180px] border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group">
                    <p className="text-[9px] font-black text-blue-300 uppercase truncate mb-1">{name}</p>
                    <p className="text-3xl font-black text-white font-mono">{amount.toLocaleString()}<span className="text-[10px] ml-1 text-slate-500">G</span></p>
                    <p className="text-[9px] text-green-400 font-bold mt-2 opacity-80 group-hover:opacity-100">Est: Rp {(amount * (parseInt(currentRate) || 0)).toLocaleString()}</p>
                  </div>
                ))}
                {Object.keys(getPendingSummary()).length === 0 && <p className="text-slate-500 text-[10px] font-bold italic uppercase tracking-[0.3em] py-4">Scanning: No unpaid logs detected...</p>}
              </div>
            </div>
          </div>
        )}

        {/* EXPIRY TRACKER */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {gtAccounts.map(acc => {
            const days = Math.ceil((new Date(acc.expiry_date).getTime() - new Date().getTime()) / (1000*60*60*24))
            const isCritical = days <= 5
            return (
              <div key={acc.id} className={`p-5 rounded-[2rem] border shadow-sm transition-all hover:scale-[1.02] bg-white ${isCritical ? 'border-red-500 bg-red-50/50' : 'border-slate-100'}`}>
                <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest truncate">{acc.name}</p>
                <div className="flex items-end justify-between">
                   <p className={`text-2xl font-black font-mono leading-none ${isCritical ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                    {days}
                  </p>
                  <span className={`text-[9px] font-black uppercase ${isCritical ? 'text-red-500' : 'text-slate-300'}`}>
                    {days < 0 ? 'EXPIRED' : 'DAYS LEFT'}
                  </span>
                </div>
              </div>
            )
          })}
        </section>

        {/* WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
          {activeTab === 'gold' && (
            <>
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 mb-8 uppercase tracking-[0.2em] border-l-4 border-blue-600 pl-4 italic">Submission Portal</h3>
                  <form onSubmit={handleGoldSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                      {['S.T.A.R.S', 'UMBRELLA'].map(f => (
                        <button key={f} type="button" onClick={()=>setFaction(f)} className={`py-3.5 rounded-xl text-[10px] font-black transition-all ${faction===f ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-500'}`}>{f}</button>
                      ))}
                    </div>
                    <input type="text" placeholder="SERVER / NOTES" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black focus:bg-white focus:border-blue-500 outline-none uppercase transition-all" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                    <div className="bg-slate-900 p-8 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 text-white/5 text-6xl font-black italic">GOLD</div>
                      <p className="text-[9px] font-black text-blue-400 mb-2 uppercase tracking-[0.3em] italic relative z-10">Unit Amount</p>
                      <input type="number" placeholder="0" className="w-full bg-transparent text-white text-6xl font-black text-center outline-none relative z-10 font-mono" value={gold} onChange={e=>setGold(e.target.value)} required />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-6 rounded-2xl text-[11px] tracking-[0.4em] uppercase hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-200 disabled:opacity-50">
                      {loading ? 'SYNCHRONIZING...' : 'EXECUTE LOG'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden h-fit">
                <div className="p-7 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Network Ledger</h3>
                  <button onClick={fetchGlobalData} className="text-[9px] font-black text-blue-600 bg-blue-50 px-5 py-2.5 rounded-full hover:bg-blue-100 transition-all active:rotate-180">REFRESH SYNC</button>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs italic">
                    <thead className="bg-slate-50 text-slate-400 font-black text-[9px] uppercase font-mono">
                      <tr><th className="p-6">Farmer</th><th className="p-6">Metadata</th><th className="p-6">Valuation</th><th className="p-6">Status</th>{isAdmin && <th className="p-6 text-center">Control</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                      {logs.map(i => {
                        const gross = i.gold_amount * (parseInt(currentRate) || 0)
                        return (
                          <tr key={i.id} className="hover:bg-blue-50/30 transition-all border-l-4 border-transparent hover:border-blue-500 group">
                            <td className="p-6 text-slate-700 uppercase font-black">{i.farmer_name}</td>
                            <td className="p-6 text-slate-400 font-mono text-[10px]">{i.server_name}</td>
                            <td className="p-6">
                              <p className="text-blue-600 font-black text-base">{i.gold_amount.toLocaleString()} G</p>
                              <p className="text-[10px] text-slate-400 font-mono">Rp {gross.toLocaleString()}</p>
                            </td>
                            <td className="p-6">
                              <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-tighter ${i.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600 animate-pulse'}`}>
                                {i.status}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="p-6">
                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {i.status === 'Pending' ? (
                                    <button onClick={()=>updateLogStatus(i.id, 'Paid')} className="bg-green-600 text-white p-2.5 rounded-xl text-[9px] px-4 font-black shadow-lg hover:bg-green-700 transition-colors">SET PAID</button>
                                  ) : (
                                    <button onClick={()=>sendWhatsAppNotification(i.farmer_name, i.gold_amount, i.server_name)} className="bg-blue-500 text-white p-2.5 rounded-xl text-[9px] px-4 font-black shadow-lg hover:bg-blue-600 transition-colors">REPORT</button>
                                  )}
                                  <button onClick={()=>deleteLog(i.id)} className="bg-red-50 text-red-600 p-2.5 rounded-xl text-[9px] px-4 font-black hover:bg-red-100">DEL</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                      {logs.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black italic uppercase tracking-widest text-[10px]">No Data Streams Detected</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'piket' && (
            <div className="lg:col-span-12 bg-white rounded-[3.5rem] border border-slate-200 p-10 min-h-[700px] flex flex-col items-center justify-center shadow-sm">
              {pdfUrl ? (
                <div className="w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="relative inline-block group">
                    <img src={pdfUrl} alt="Tactical Map" className="max-w-full max-h-[70vh] mx-auto rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.2)] border-[12px] border-white transition-transform group-hover:scale-[1.01]" />
                    <div className="absolute inset-0 rounded-[3rem] ring-1 ring-black/5 pointer-events-none"></div>
                  </div>
                  <div className="flex justify-center gap-4">
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-block bg-slate-900 text-white text-[10px] font-black px-12 py-5 rounded-[1.5rem] uppercase tracking-[0.4em] hover:bg-blue-600 transition-all shadow-2xl active:scale-95">Expand Visualization</a>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-9xl mb-6 opacity-10 grayscale">🛰️</div>
                  <p className="font-black italic uppercase text-slate-300 text-sm tracking-[0.6em]">Awaiting Map Transmission...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'absen' && (
            <div className="lg:col-span-12 flex justify-center py-20">
              <div className="bg-white p-14 rounded-[5rem] border border-slate-200 shadow-[0_40px_80px_rgba(0,0,0,0.05)] text-center w-full max-w-lg animate-in slide-in-from-bottom-8 duration-500">
                <div className={`h-32 w-32 mx-auto rounded-[3rem] flex items-center justify-center text-6xl mb-10 shadow-2xl transition-all duration-700 ${attendanceData ? 'bg-red-50 text-red-500 rotate-12' : 'bg-green-50 text-green-500 animate-bounce'}`}>
                  {attendanceData ? '⛔' : '⚡'}
                </div>
                <h2 className="text-3xl font-black uppercase mb-3 italic tracking-tighter">{attendanceData ? 'Duty Lockdown' : 'Duty Ignition'}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-10">Enter Authorization Key to Proceed</p>
                
                <input type="password" placeholder="••••" className="w-full bg-slate-50 border-4 border-slate-100 p-8 rounded-[2.5rem] text-center font-mono text-5xl mb-10 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner tracking-[0.5em]" value={absensiCode} onChange={e=>setAbsensiCode(e.target.value.toUpperCase())} />
                
                <button 
                  disabled={loading}
                  onClick={async () => {
                    if (absensiCode !== dbDailyCode) return alert("❌ ACCESS DENIED: INVALID AUTHORIZATION KEY");
                    setLoading(true);
                    try {
                      if (!attendanceData) {
                        await supabase.from('attendance').insert([{ user_id: user.id, farmer_name: user.email?.split('@')[0] }])
                      } else {
                        await supabase.from('attendance').update({ check_out_time: new Date().toISOString() }).eq('id', attendanceData.id)
                      }
                      setAbsensiCode(''); fetchUserStats(user.id); alert("✅ PROTOCOL EXECUTED SUCCESSFULLY")
                    } catch (e) { alert("❌ SYSTEM ERROR") } 
                    finally { setLoading(false) }
                  }} className="w-full bg-slate-900 text-white font-black py-7 rounded-[2rem] uppercase text-[12px] tracking-[0.5em] hover:bg-blue-600 shadow-2xl disabled:opacity-50 transition-all active:scale-95">
                  {loading ? 'EXECUTING...' : 'AUTHORIZE PROTOCOL'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING ADMIN TRIGGER */}
      <div className="fixed bottom-32 right-6 md:bottom-12 md:right-12 z-[80]">
        <button onClick={() => { 
          if(isAdmin) { setIsAdmin(false); return; }
          const p = prompt("Enter Security Clearance:"); 
          if(p===PASSWORD_ADMIN) setIsAdmin(true); 
          else if(p !== null) alert("❌ UNAUTHORIZED ACCESS ATTEMPT");
        }} className={`px-10 py-6 rounded-[2rem] shadow-2xl font-black text-[10px] tracking-widest uppercase transition-all border-b-[10px] flex items-center gap-3 ${isAdmin ? 'bg-red-600 border-red-800 text-white rotate-0' : 'bg-slate-900 border-slate-700 text-white hover:scale-110 active:scale-95'}`}>
          {isAdmin ? 'TERMINATE SESSION' : '🛡️ SYSTEM OVERRIDE'}
        </button>
      </div>

      {/* ADMIN MASTER CONTROL PANEL */}
      {isAdmin && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] p-12 space-y-10 shadow-2xl relative animate-in zoom-in-95 duration-500">
            <button onClick={()=>setIsAdmin(false)} className="absolute top-12 right-12 font-black text-slate-300 hover:text-red-500 transition-colors uppercase text-[10px] tracking-widest">Close Terminal</button>
            <h2 className="text-3xl font-black uppercase italic border-l-[12px] border-blue-600 pl-8 leading-none">Global Control<br/><span className="text-sm font-bold text-slate-400 not-italic tracking-[0.3em]">MASTER OVERRIDE</span></h2>
            
            <div className="space-y-8 overflow-y-auto max-h-[60vh] pr-6 custom-scrollbar">
              {/* Enrollment */}
              <div className="bg-slate-50 p-8 rounded-[3rem]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Hardware Deployment (GT Accounts)</p>
                <form onSubmit={async (e) => {
                  e.preventDefault(); 
                  const target = e.target as any;
                  const n = target.n.value; 
                  const d = target.d.value;
                  const { error } = await supabase.from('gt_accounts').insert([{ name: n, expiry_date: d }]); 
                  if(!error) {
                    fetchGlobalData(); target.reset(); alert("✅ ACCOUNT DEPLOYED TO GRID");
                  }
                }} className="flex flex-col gap-4">
                  <input name="n" placeholder="Target Identifier / Account Name" className="w-full p-5 rounded-2xl text-xs font-black border-none shadow-sm focus:ring-4 ring-blue-500/10 outline-none uppercase" required />
                  <div className="flex gap-4">
                    <input name="d" type="date" className="flex-1 p-5 rounded-2xl text-xs font-black border-none shadow-sm outline-none" required />
                    <button className="bg-blue-600 text-white px-10 rounded-2xl font-black text-[11px] uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">DEPLOY</button>
                  </div>
                </form>
              </div>

              {/* Rates & Keys */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-7 rounded-[2.5rem]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-3 tracking-widest">Market Value / Unit</label>
                  <div className="flex items-center bg-white rounded-2xl p-2 shadow-sm">
                    <span className="pl-4 font-black text-slate-300">Rp</span>
                    <input type="number" className="w-full bg-transparent p-4 rounded-xl text-2xl font-black border-none text-blue-600 focus:ring-0 outline-none font-mono" value={currentRate} onChange={(e)=>setCurrentRate(e.target.value)} onBlur={(e)=>saveGlobalSetting('rate_value', e.target.value)} />
                  </div>
                </div>
                <div className="bg-slate-50 p-7 rounded-[2.5rem]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-3 tracking-widest">Daily Access Key</label>
                  <input type="text" className="w-full bg-white p-6 rounded-2xl text-2xl font-black border-none shadow-sm focus:ring-4 ring-blue-400/10 outline-none uppercase text-center tracking-widest font-mono" value={dbDailyCode} onChange={(e)=>setDbDailyCode(e.target.value.toUpperCase())} onBlur={(e)=>saveGlobalSetting('daily_code', e.target.value.toUpperCase())} />
                </div>
              </div>

              {/* Map */}
              <div className="bg-slate-50 p-8 rounded-[3rem]">
                <label className="text-[9px] font-black uppercase italic text-slate-400 block mb-4 tracking-widest">Tactical Visualization Link (Image URL)</label>
                <input type="text" className="w-full bg-white p-5 rounded-2xl text-[11px] font-bold border-none shadow-sm focus:ring-4 ring-blue-400/10 outline-none" value={pdfUrl} placeholder="Enter Direct Image URL (PNG/JPG/GIF)..." onChange={(e)=>setPdfUrl(e.target.value)} onBlur={(e)=>saveGlobalSetting('schedule_pdf_url', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-100 p-8 flex justify-around items-center z-[100] rounded-t-[4rem] shadow-[0_-20px_50px_rgba(0,0,0,0.08)] md:hidden">
        {[{id:'gold', i:'💰', l:'GOLD'}, {id:'absen', i:'🛡️', l:'DUTY'}, {id:'piket', i:'📡', l:'MAP'}].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex flex-col items-center gap-2 transition-all duration-500 ${activeTab===t.id ? 'scale-125 -translate-y-4' : 'opacity-20 grayscale'}`}>
            <span className="text-4xl drop-shadow-lg">{t.i}</span>
            <span className={`text-[10px] font-black tracking-widest ${activeTab===t.id ? 'text-blue-600' : 'text-slate-400'}`}>{t.l}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}