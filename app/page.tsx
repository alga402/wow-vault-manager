'use client' // WAJIB ADA DI BARIS PERTAMA

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
    if (!error) {
        fetchGlobalData()
        alert(`Status updated to ${newStatus}`)
    }
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

  // --- LAYAR INITIALIZING ---
  if (!user) return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="h-16 w-16 bg-blue-600 rounded-2xl animate-spin mb-6 shadow-2xl shadow-blue-500/50" />
        <p className="italic font-black text-white uppercase tracking-[0.5em] animate-pulse">Initializing Vault OS...</p>
        <button 
            onClick={() => {
                const email = prompt("Email:");
                const pass = prompt("Password:");
                if(email && pass) supabase.auth.signInWithPassword({ email, password: pass })
            }}
            className="mt-8 text-[10px] text-slate-500 font-bold hover:text-white transition-colors"
        >
            [ MANUAL OVERRIDE ]
        </button>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-800 p-3 md:p-8 pb-32 font-sans selection:bg-blue-100">
      {/* ... (Style dan Header tetap sama seperti kode kamu) ... */}
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

        {/* LOGIC VIEW: GOLD LEDGER (Bagian Tabel dengan tombol REPORT) */}
        {activeTab === 'gold' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Input (Sama seperti kodemu) */}
                <div className="lg:col-span-4">
                    {/* ... Form Submit Gold ... */}
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-black text-slate-400 mb-8 uppercase tracking-[0.2em] border-l-4 border-blue-600 pl-4 italic">Submission Portal</h3>
                        <form onSubmit={handleGoldSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                                {['S.T.A.R.S', 'UMBRELLA'].map(f => (
                                    <button key={f} type="button" onClick={()=>setFaction(f)} className={`py-3.5 rounded-xl text-[10px] font-black transition-all ${faction===f ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-500'}`}>{f}</button>
                                ))}
                            </div>
                            <input type="text" placeholder="SERVER / NOTES" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black focus:bg-white focus:border-blue-500 outline-none uppercase transition-all" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden">
                                <p className="text-[9px] font-black text-blue-400 mb-2 uppercase tracking-[0.3em] italic">Unit Amount</p>
                                <input type="number" placeholder="0" className="w-full bg-transparent text-white text-6xl font-black text-center outline-none font-mono" value={gold} onChange={e=>setGold(e.target.value)} required />
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-6 rounded-2xl text-[11px] tracking-[0.4em] uppercase hover:bg-blue-700 shadow-xl disabled:opacity-50">
                                {loading ? 'SYNCHRONIZING...' : 'EXECUTE LOG'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Table Ledger */}
                <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs italic">
                            <thead className="bg-slate-50 text-slate-400 font-black text-[9px] uppercase font-mono">
                                <tr><th className="p-6">Farmer</th><th className="p-6">Metadata</th><th className="p-6">Valuation</th><th className="p-6">Status</th>{isAdmin && <th className="p-6 text-center">Control</th>}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold">
                                {logs.map(i => (
                                    <tr key={i.id} className="hover:bg-blue-50/30 transition-all group">
                                        <td className="p-6 text-slate-700 uppercase font-black">{i.farmer_name}</td>
                                        <td className="p-6 text-slate-400 font-mono text-[10px]">{i.server_name}</td>
                                        <td className="p-6 text-blue-600 font-black">{i.gold_amount.toLocaleString()} G</td>
                                        <td className="p-6">
                                            <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase ${i.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {i.status}
                                            </span>
                                        </td>
                                        {isAdmin && (
                                            <td className="p-6 text-center space-x-2 whitespace-nowrap">
                                                {i.status === 'Pending' ? (
                                                    <button onClick={()=>updateLogStatus(i.id, 'Paid')} className="bg-green-600 text-white px-4 py-2 rounded-xl text-[9px] font-black shadow-lg">SET PAID</button>
                                                ) : (
                                                    <button onClick={()=>sendWhatsAppNotification(i.farmer_name, i.gold_amount, i.server_name)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[9px] font-black shadow-lg">REPORT WA</button>
                                                )}
                                                <button onClick={()=>deleteLog(i.id)} className="text-red-600 bg-red-50 p-2 rounded-xl text-[9px] font-black">DEL</button>
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
        
        {/* ... (Tab Piket & Absen tetap sama) ... */}
      </div>
      
      {/* FLOATING ADMIN TRIGGER */}
      <div className="fixed bottom-32 right-6 md:bottom-12 md:right-12 z-[80]">
        <button onClick={() => { 
          if(isAdmin) { setIsAdmin(false); return; }
          const p = prompt("Enter Security Clearance:"); 
          if(p===PASSWORD_ADMIN) setIsAdmin(true); 
          else if(p !== null) alert("❌ UNAUTHORIZED");
        }} className="bg-slate-900 text-white px-10 py-6 rounded-[2rem] font-black text-[10px] tracking-widest border-b-[10px] border-slate-700 active:scale-95 transition-all">
          {isAdmin ? 'TERMINATE SESSION' : '🛡️ SYSTEM OVERRIDE'}
        </button>
      </div>
    </main>
  )
}