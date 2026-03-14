'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [farmer, setFarmer] = useState(''); const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde'); const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false); const [globalRate, setGlobalRate] = useState('0.5')
  const [logs, setLogs] = useState<any[]>([]); const [gtAccounts, setGtAccounts] = useState<any[]>([])
  const [filterFaksi, setFilterFaksi] = useState('All')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [showMusic, setShowMusic] = useState(true)
  
  // VIDEO ID DJ WAGHYU SEBAGAI DEFAULT
  const [videoID, setVideoID] = useState('B6Nnxo_rk-g') 

  const PASSWORD_ADMIN = "12345"

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
        
        {/* HEADER */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 tracking-tighter text-shadow-glow">VAULT COMMAND</h1>
            <div className="flex items-center gap-2 mt-1">
               <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
               <p className="text-[11px] font-mono font-bold text-slate-500">{currentTime.toLocaleTimeString('id-ID')} — {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          <button onClick={() => {if(isAdmin) setIsAdmin(false); else if(prompt("Key:")===PASSWORD_ADMIN) setIsAdmin(true)}} className="text-[10px] font-black px-5 py-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-yellow-500/50 transition-all uppercase tracking-[0.2em]">{isAdmin ? 'Logout' : 'Admin Login'}</button>
        </div>

        {/* GT MONITORING */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {gtAccounts.map(ac => (
            <div key={ac.id} className={`p-4 rounded-2xl border transition-all ${getSisaHari(ac.expiry_date) <= 3 ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-[#12141c] border-slate-800 shadow-xl'}`}>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-white"><span>{ac.account_name}</span><span className="text-yellow-500">{getSisaHari(ac.expiry_date)}D</span></div>
              {isAdmin && <button onClick={async() => {const t=prompt("YYYY-MM-DD:"); if(t) {await supabase.from('gt_accounts').update({expiry_date:t}).eq('id',ac.id); fetchData()}}} className="text-[8px] mt-2 text-slate-600 hover:text-white font-bold uppercase italic">Update Date</button>}
            </div>
          ))}
          {isAdmin && <button onClick={async() => {const n=prompt("Name:"); const t=prompt("YYYY-MM-DD:"); if(n&&t) {await supabase.from('gt_accounts').insert([{account_name:n, expiry_date:t}]); fetchData()}}} className="border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-slate-600 hover:text-yellow-500 transition-all font-black text-xl">+</button>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            {/* RADIO UNIT */}
            <div className="bg-[#12141c] border border-slate-800 p-4 rounded-3xl shadow-2xl">
               <div className="flex justify-between items-center mb-3 px-1">
                 <p className="text-[10px] font-black uppercase text-yellow-500 italic animate-pulse tracking-widest">● Radio Active</p>
                 <button onClick={() => setShowMusic(!showMusic)} className="text-[8px] font-black bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">{showMusic ? 'MINIMIZE' : 'EXPAND'}</button>
               </div>
               {showMusic && (
                 <div className="space-y-3">
                   <div className="rounded-2xl overflow-hidden border border-slate-800 relative pt-[56.25%] bg-black shadow-inner">
                     <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${videoID}?autoplay=1&mute=0&loop=1&playlist=${videoID}`} allow="autoplay; encrypted-media" allowFullScreen></iframe>
                   </div>
                   <p className="text-[8px] text-center font-bold text-slate-600 uppercase italic tracking-widest">⚠️ Click player to start DJ Waghyu</p>
                   {isAdmin && <button onClick={() => {const id=prompt("ID Video:"); if(id) setVideoID(id)}} className="w-full text-[8px] font-black text-slate-700 hover:text-yellow-500 uppercase italic">Change Station ID</button>}
                 </div>
               )}
            </div>

            {/* FORM */}
            <div className="bg-[#12141c] p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1.5 ${faction==='Horde'?'bg-red-600':'bg-blue-600'}`}></div>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">Deposit Gold</h2>
                <div className="text-right"><p className="text-2xl font-black text-yellow-500 leading-none font-mono">Rp {globalRate}</p><p className="text-[8px] font-bold text-slate-600 mt-1 uppercase italic tracking-tighter">Updated: {lastUpdate}</p></div>
              </div>
              <form onSubmit={handleDeposit} className="space-y-4">
                <input type="text" placeholder="Farmer Name" className="w-full bg-[#08090d] border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-yellow-500/50" value={farmer} onChange={e=>setFarmer(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Server" className="bg-[#08090d] border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-yellow-500/50" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <select className="bg-[#08090d] border border-slate-800 p-4 rounded-2xl text-[10px] font-black uppercase" value={faction} onChange={e=>setFaction(e.target.value)}>
                    <option value="Horde">🔴 Horde</option><option value="Alliance">🔵 Alliance</option>
                  </select>
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/10 p-5 rounded-2xl text-center">
                  <p className="text-[9px] font-black text-yellow-600 uppercase mb-1 tracking-widest">Gold Amount</p>
                  <input type="number" className="w-full bg-transparent text-4xl font-mono font-black text-yellow-500 outline-none text-center" value={gold} onChange={e=>setGold(e.target.value)} required />
                </div>
                {isAdmin && <button type="button" onClick={handleUpdateRate} className="w-full py-2.5 border border-yellow-500/20 rounded-xl text-[9px] font-black text-yellow-500/50 hover:bg-yellow-500 hover:text-black uppercase transition-all tracking-widest">Update Rate (Save)</button>}
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-black font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-yellow-500/10 hover:brightness-110 active:scale-95 transition-all">{loading ? 'Processing...' : 'Confirm Deposit'}</button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6 text-center">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#12141c] p-6 rounded-3xl border border-slate-800 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 italic">Vault Ready</p>
                <h3 className="text-4xl font-black text-white italic">{stok.toLocaleString()}<span className="text-sm text-slate-600 ml-1 font-bold">G</span></h3>
              </div>
              <div className="bg-[#12141c] p-6 rounded-3xl border border-slate-800 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 italic">Market Value</p>
                <h3 className="text-4xl font-black text-green-500 uppercase italic">Rp {(stok*parseFloat(globalRate)).toLocaleString()}</h3>
              </div>
            </div>
            <div className="bg-[#12141c] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="flex gap-2 p-4 bg-black/20 border-b border-slate-800/50">
                {['All','Horde','Alliance'].map(f=><button key={f} onClick={()=>setFilterFaksi(f)} className={`px-5 py-2 text-[10px] font-black rounded-xl transition-all ${filterFaksi===f?'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20':'text-slate-500 hover:bg-slate-800 uppercase tracking-widest'}`}>{f.toUpperCase()}</button>)}
              </div>
              <table className="w-full text-left text-xs italic">
                <tbody className="divide-y divide-slate-800/50">
                  {filtered.map(i=>(
                    <tr key={i.id} className={`hover:bg-white/[0.02] transition-all ${i.status==='Sold'?'opacity-20 grayscale':''}`}>
                      <td className="p-5">
                        <p className="font-black text-white uppercase text-sm tracking-tighter">{i.farmer_name}</p>
                        <p className={`text-[9px] font-black uppercase ${i.faction==='Horde'?'text-red-500':'text-blue-500'}`}>{i.faction} • {i.server_name}</p>
                      </td>
                      <td className="p-5 text-right"><p className="text-lg font-mono font-black text-yellow-500">{i.gold_amount.toLocaleString()} G</p></td>
                      <td className="p-5 text-right"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${i.status==='Sold'?'bg-green-500/10 text-green-500':'bg-yellow-500 text-black'}`}>{i.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}