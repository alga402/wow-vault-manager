'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [farmer, setFarmer] = useState('')
  const [gold, setGold] = useState('')
  const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [globalRate, setGlobalRate] = useState('0.5')
  const [daftarSetoran, setDaftarSetoran] = useState<any[]>([])
  const [subs, setSubs] = useState<any>(null)
  const [filterFaksi, setFilterFaksi] = useState('All')

  const PASSWORD_ADMIN = "01236" // Ganti sesuai keinginan

  // --- AMBIL DATA DARI DATABASE ---
  const fetchAllData = async () => {
    const { data: logs } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false })
    if (logs) setDaftarSetoran(logs)

    const { data: s } = await supabase.from('subscriptions').select('*').single()
    if (s) setSubs(s)
  }

  useEffect(() => { fetchAllData() }, [])

  // --- FUNGSI LOGIKA ---
  const handleLogin = () => {
    const p = prompt("Enter Admin Key:")
    if (p === PASSWORD_ADMIN) { setIsAdmin(true); alert("Welcome, Boss.") }
  }

  const getSisaHari = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('gold_logs').insert([{
      farmer_name: farmer, gold_amount: parseInt(gold), server_name: serverName,
      faction, rate_snapshot: parseFloat(globalRate), status: 'Pending'
    }])
    if (!error) { setFarmer(''); setGold(''); setServerName(''); fetchAllData() }
    setLoading(false)
  }

  const handleStatusChange = async (id: string, current: string) => {
    if (!isAdmin) return
    let newStatus = current === 'Pending' ? 'Sold' : 'Pending'
    let pot = 0
    if (newStatus === 'Sold') {
      const p = prompt("Masukkan Potongan Biaya (IDR):", "0")
      if (p === null) return
      pot = parseFloat(p) || 0
    }
    await supabase.from('gold_logs').update({ status: newStatus, deduction: pot }).eq('id', id)
    fetchAllData()
  }

  const shareWA = (item: any) => {
    const kotor = item.gold_amount * item.rate_snapshot
    const bersih = kotor - (item.deduction || 0)
    const pesan = `*─ WOW VAULT RECEIPT ─*\n👤 Farmer: ${item.farmer_name}\n💰 Gold: ${item.gold_amount.toLocaleString()} G\n📈 Rate: Rp ${item.rate_snapshot}\n❌ Pot: Rp ${item.deduction.toLocaleString()}\n🔥 *NET: Rp ${bersih.toLocaleString()}*\n✅ STATUS: PAID`
    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank')
  }

  // --- PERHITUNGAN STOK ---
  const dataFiltered = filterFaksi === 'All' ? daftarSetoran : daftarSetoran.filter(i => i.faction === filterFaksi)
  const pendingGold = dataFiltered.filter(i => i.status === 'Pending').reduce((t, i) => t + i.gold_amount, 0)

  return (
    <main className="min-h-screen bg-[#0a0c10] text-slate-300 p-4 font-sans tracking-tight">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER & GT MONITORING */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/50 pb-8">
          <div>
            <h1 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">WOW VAULT PRO</h1>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Logistics Command Center</p>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && subs && (
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${getSisaHari(subs.expiry_date) <= 3 ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-green-500/10 border-green-500/30'}`}>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase">GT Expiry</p>
                  <p className={`text-sm font-black ${getSisaHari(subs.expiry_date) <= 3 ? 'text-red-500' : 'text-green-500'}`}>{getSisaHari(subs.expiry_date)} Days Left</p>
                </div>
                <button onClick={async () => {
                  const t = prompt("Update Expiry (YYYY-MM-DD):")
                  if(t) { await supabase.from('subscriptions').update({expiry_date: t}).eq('id', subs.id); fetchAllData() }
                }} className="text-xs grayscale hover:grayscale-0">⚙️</button>
              </div>
            )}
            <button onClick={isAdmin ? () => setIsAdmin(false) : handleLogin} className="text-[10px] font-black px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 hover:border-yellow-500/50 transition-all uppercase tracking-widest">
              {isAdmin ? 'Exit Admin' : 'Admin Login'}
            </button>
          </div>
        </div>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: FORM & RATE CONTROL */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#11141b] p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${faction === 'Horde' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
              <h2 className="text-xs font-black uppercase mb-6 text-slate-500 flex justify-between">
                Deposit Form 
                <span className="text-yellow-500">Rate: Rp {globalRate}</span>
              </h2>
              <form onSubmit={handleDeposit} className="space-y-4">
                <input type="text" placeholder="Farmer Name" className="w-full bg-[#0a0c10] border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-yellow-500/50" value={farmer} onChange={(e)=>setFarmer(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Server" className="bg-[#0a0c10] border border-slate-800 p-4 rounded-2xl text-sm outline-none" value={serverName} onChange={(e)=>setServerName(e.target.value)} required />
                  <select className="bg-[#0a0c10] border border-slate-800 p-4 rounded-2xl text-xs font-bold" value={faction} onChange={(e)=>setFaction(e.target.value)}>
                    <option value="Horde">🔴 Horde</option>
                    <option value="Alliance">🔵 Alliance</option>
                  </select>
                </div>
                <div className="bg-[#0a0c10] p-4 rounded-2xl border border-slate-800">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Gold Amount</p>
                  <input type="number" className="w-full bg-transparent text-3xl font-mono font-black text-yellow-500 outline-none" value={gold} onChange={(e)=>setGold(e.target.value)} required />
                </div>
                {isAdmin && (
                  <button type="button" onClick={()=>setGlobalRate(prompt("Set Rate Global:", globalRate) || globalRate)} className="w-full text-[9px] font-black text-slate-500 hover:text-yellow-500 uppercase">Change Market Rate</button>
                )}
                <button type="submit" disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-yellow-500/10">
                  {loading ? 'Processing...' : 'Confirm Deposit'}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT: LISTS & STATS */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#11141b] p-6 rounded-3xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Global Stock</p>
                <h3 className="text-3xl font-black text-white">{pendingGold.toLocaleString()}<span className="text-xs text-slate-600 ml-1">G</span></h3>
              </div>
              <div className="bg-[#11141b] p-6 rounded-3xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Stock Value</p>
                <h3 className="text-3xl font-black text-green-500">Rp {(pendingGold * parseFloat(globalRate)).toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-[#11141b] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-4 bg-[#161a23] border-b border-slate-800 flex gap-2">
                {['All', 'Horde', 'Alliance'].map(f => (
                  <button key={f} onClick={()=>setFilterFaksi(f)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${filterFaksi === f ? 'bg-yellow-500 text-black' : 'text-slate-500 hover:bg-slate-800'}`}>{f.toUpperCase()}</button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-600 uppercase border-b border-slate-800">
                      <th className="p-5 text-center">Farmer</th>
                      <th className="p-5 text-right">Gold Info</th>
                      <th className="p-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {dataFiltered.map((item) => (
                      <tr key={item.id} className={`transition-all ${item.status === 'Sold' ? 'opacity-20 grayscale' : ''}`}>
                        <td className="p-5">
                          <p className="text-sm font-black text-white">{item.farmer_name}</p>
                          <p className={`text-[8px] font-black uppercase ${item.faction === 'Horde' ? 'text-red-500' : 'text-blue-500'}`}>{item.faction} • {item.server_name}</p>
                        </td>
                        <td className="p-5 text-right">
                          <p className="text-sm font-mono font-black text-yellow-500">{item.gold_amount.toLocaleString()} G</p>
                          <p className="text-[8px] text-slate-600 italic">Rate {item.rate_snapshot}</p>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col items-center gap-2">
                            <button onClick={()=>handleStatusChange(item.id, item.status)} className={`px-4 py-1.5 rounded-full text-[9px] font-black border transition-all ${item.status === 'Sold' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500 text-black border-transparent animate-pulse'}`}>
                              {item.status === 'Sold' ? '● SOLD' : '⏳ PENDING'}
                            </button>
                            {item.status === 'Sold' && (
                              <button onClick={()=>shareWA(item)} className="text-[8px] font-black text-blue-500 underline uppercase tracking-tighter">Share Receipt</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}