'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [farmer, setFarmer] = useState(''); const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde'); const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false); const [globalRate, setGlobalRate] = useState('0.5')
  const [logs, setLogs] = useState<any[]>([]); const [gtAccounts, setGtAccounts] = useState<any[]>([])
  const [filterFaksi, setFilterFaksi] = useState('All')
  
  // TIME & MUSIC STATES
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [showMusic, setShowMusic] = useState(true) // Kita set true agar langsung muncul

  const PASSWORD_ADMIN = "01236"

  // Jam Real-time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false })
    if (l) setLogs(l)
    const { data: g } = await supabase.from('gt_accounts').select('*').order('expiry_date', { ascending: true })
    if (g) setGtAccounts(g)
    const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
    if (s) {
      setGlobalRate(s.rate_value.toString())
      setLastUpdate(new Date(s.updated_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleUpdateRate = async () => {
    const newRate = prompt("Set Rate Baru:", globalRate)
    if (newRate) {
      await supabase.from('global_settings').update({ rate_value: parseFloat(newRate), updated_at: new Date().toISOString() }).eq('id', 'current_rate')
      fetchData()
    }
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await supabase.from('gold_logs').insert([{ farmer_name: farmer, gold_amount: parseInt(gold), server_name: serverName, faction, rate_snapshot: parseFloat(globalRate), status: 'Pending' }])
    setFarmer(''); setGold(''); setServerName(''); fetchData(); setLoading(false)
  }

  const getSisaHari = (d: string) => Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  const filtered = filterFaksi === 'All' ? logs : logs.filter(i => i.faction === filterFaksi)
  const stok = filtered.filter(i => i.status === 'Pending').reduce((t, i) => t + i.gold_amount, 0)

  return (
    <main className="min-h-screen bg-[#08090d] text-slate-300 p-4 font-sans tracking-tight">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER & CLOCK */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">VAULT COMMAND</h1>
            <div className="flex items-center gap-2 mt-1">
               <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
               <p className="text-[11px] font-mono font-bold text-slate-400 lowercase">{currentTime.toLocaleTimeString('id-ID')} — {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          <button onClick={() => {if(isAdmin) setIsAdmin(false); else if(prompt("Key:")===PASSWORD_ADMIN) setIsAdmin(true)}} className="text-[10px] font-bold px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 uppercase tracking-widest">{isAdmin ? 'Logout Admin' : 'Admin Login'}</button>
        </div>

        {/* GT MONITORING */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {gtAccounts.map(ac => (
            <div key={ac.id} className={`p-3 rounded-xl border ${getSisaHari(ac.expiry_date) <= 3 ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-[#12141c] border-slate-800'}`}>
              <div className="flex justify-between items-center text-[10px] font-bold text-white uppercase"><span>{ac.account_name}</span><span className="text-yellow-500">{getSisaHari(ac.expiry_date)}D</span></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: FORM & MUSIC */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* MUSIC PLAYER (AUTOPLAY READY) */}
            <div className="bg-[#12141c] border border-slate-800 p-4 rounded-2xl shadow-xl overflow-hidden">
               <div className="flex justify-between items-center mb-2">
                 <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic">Vault Radio — Streaming Now</p>
                 <button onClick={() => setShowMusic(!showMusic)} className="text-[8px] bg-slate-800 px-2 py-1 rounded hover:bg-yellow-500 hover:text-black transition-all">
                    {showMusic ? 'MINIMIZE' : 'MAXIMIZE'}
                 </button>
               </div>
               {showMusic && (
                 <div className="rounded-xl overflow-hidden border border-slate-800 relative pt-[56.25%] bg-black">
                   {/* Link YouTube dengan Autoplay=1 dan Mute=1 agar langsung nyala */}
                   <iframe className="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1" allow="autoplay; encrypted-media" allowFullScreen></iframe>
                 </div>
               )}
            </div>

            <div className="bg-[#12141c] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${faction==='Horde'?'bg-red-600':'bg-blue-600'}`}></div>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-[10px] font-black uppercase text-slate-500 italic underline decoration-yellow-500/50">Deposit Form</h2>
                <div className="text-right"><p className="text-xl font-black text-yellow-500 leading-none">Rp {globalRate}</p><p className="text-[7px] font-bold text-slate-600 mt-1 uppercase italic">Last Update: {lastUpdate}</p></div>
              </div>
              <form onSubmit={handleDeposit} className="space-y-3">
                <input type="text" placeholder="Farmer Name" className="w-full bg-[#08090d] border border-slate-800 p-3 rounded-xl text-sm outline-none" value={farmer} onChange={e=>setFarmer(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Server" className="bg-[#08090d] border border-slate-800 p-3 rounded-xl text-sm outline-none" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <select className="bg-[#08090d] border border-slate-800 p-3 rounded-xl text-xs font-bold" value={faction} onChange={e=>setFaction(e.target.value)}>
                    <option value="Horde">🔴 Horde</option><option value="Alliance">🔵 Alliance</option>
                  </select>
                </div>
                <input type="number" placeholder="Gold Amount" className="w-full bg-[#08090d] border border-slate-800 p-4 rounded-xl text-2xl font-mono font-bold text-yellow-500 outline-none" value={gold} onChange={e=>setGold(e.target.value)} required />
                {isAdmin && <button type="button" onClick={handleUpdateRate} className="w-full py-2 border border-yellow-500/20 rounded-lg text-[8px] font-black text-yellow-500/50 hover:bg-yellow-500 hover:text-black uppercase transition-all">Update Rate Permanently</button>}
                <button type="submit" className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-yellow-500/10 active:scale-95 transition-all">Confirm Gold</button>
              </form>
            </div>
          </div>

          {/* RIGHT: STATS & LIST */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#12141c] p-4 rounded-2xl border border-slate-800 text-center"><p className="text-[8px] text-slate-500 uppercase">Current Stock</p><h3 className="text-xl font-black text-white">{stok.toLocaleString()} G</h3></div>
              <div className="bg-[#12141c] p-4 rounded-2xl border border-slate-800 text-center"><p className="text-[8px] text-slate-500 uppercase">Valuation</p><h3 className="text-xl font-black text-green-500 uppercase">Rp {(stok*parseFloat(globalRate)).toLocaleString()}</h3></div>
            </div>
            <div className="bg-[#12141c] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="flex gap-2 p-3 bg-black/20">{['All','Horde','Alliance'].map(f=><button key={f} onClick={()=>setFilterFaksi(f)} className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${filterFaksi===f?'bg-yellow-500 text-black shadow-md':'text-slate-500 hover:bg-slate-800'}`}>{f.toUpperCase()}</button>)}</div>
              <table className="w-full text-left text-xs"><tbody className="divide-y divide-slate-800/50">
                  {filtered.map(i=>(
                    <tr key={i.id} className={`hover:bg-white/[0.01] transition-all ${i.status==='Sold'?'opacity-20 grayscale':''}`}>
                      <td className="p-4"><p className="font-black text-white italic uppercase tracking-tighter">{i.farmer_name}</p><p className={`text-[8px] font-black ${i.faction==='Horde'?'text-red-500':'text-blue-500'}`}>{i.faction} • {i.server_name}</p></td>
                      <td className="p-4 text-right font-mono font-bold text-yellow-500 italic">{i.gold_amount.toLocaleString()} G</td>
                      <td className="p-4 text-center font-black italic uppercase text-[8px] text-slate-500">{i.status}</td>
                    </tr>
                  ))}
              </tbody></table>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}