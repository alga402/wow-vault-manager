'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [farmer, setFarmer] = useState(''); const [gold, setGold] = useState(''); const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde'); const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false); const [globalRate, setGlobalRate] = useState('0.5')
  const [logs, setLogs] = useState<any[]>([]); const [gtAccounts, setGtAccounts] = useState<any[]>([])
  const [filterFaksi, setFilterFaksi] = useState('All')

  const PASSWORD_ADMIN = "01236"

  const fetchData = async () => {
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false })
    if (l) setLogs(l)
    const { data: g } = await supabase.from('gt_accounts').select('*').order('expiry_date', { ascending: true })
    if (g) setGtAccounts(g)
  }

  useEffect(() => { fetchData() }, [])

  const getSisaHari = (d: string) => Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await supabase.from('gold_logs').insert([{ farmer_name: farmer, gold_amount: parseInt(gold), server_name: serverName, faction, rate_snapshot: parseFloat(globalRate), status: 'Pending' }])
    setFarmer(''); setGold(''); setServerName(''); fetchData(); setLoading(false)
  }

  const handleStatus = async (id: string, current: string) => {
    if (!isAdmin) return
    let st = current === 'Pending' ? 'Sold' : 'Pending'; let pot = 0
    if (st === 'Sold') pot = parseFloat(prompt("Potongan Biaya (IDR):", "0") || "0")
    await supabase.from('gold_logs').update({ status: st, deduction: pot }).eq('id', id); fetchData()
  }

  const sendWA = (i: any) => {
    const k = i.gold_amount * i.rate_snapshot; const b = k - (i.deduction || 0)
    const p = `*─ WOW VAULT RECEIPT ─*\n👤 Farmer: ${i.farmer_name}\n💰 Gold: ${i.gold_amount.toLocaleString()} G\n📈 Rate: Rp ${i.rate_snapshot}\n❌ Pot: Rp ${i.deduction.toLocaleString()}\n🔥 *NET: Rp ${b.toLocaleString()}*\n✅ PAID`
    window.open(`https://wa.me/?text=${encodeURIComponent(p)}`, '_blank')
  }

  const filtered = filterFaksi === 'All' ? logs : logs.filter(i => i.faction === filterFaksi)
  const stok = filtered.filter(i => i.status === 'Pending').reduce((t, i) => t + i.gold_amount, 0)

  return (
    <main className="min-h-screen bg-[#08090d] text-slate-300 p-4 font-sans tracking-tight">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">VAULT COMMAND</h1>
          <button onClick={() => {if(isAdmin) setIsAdmin(false); else if(prompt("Key:")===PASSWORD_ADMIN) setIsAdmin(true)}} className="text-[10px] font-bold px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 uppercase tracking-widest">
            {isAdmin ? 'Logout Admin' : 'Admin Login'}
          </button>
        </div>

        {/* GT MONITORING (PER ACCOUNT) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {gtAccounts.map(ac => (
            <div key={ac.id} className={`p-3 rounded-xl border ${getSisaHari(ac.expiry_date) <= 3 ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-[#12141c] border-slate-800'}`}>
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-white truncate">{ac.account_name}</p>
                <span className="text-[9px] font-black bg-black/40 px-1.5 rounded text-yellow-500">{getSisaHari(ac.expiry_date)}D</span>
              </div>
              {isAdmin && <button onClick={async() => {const t=prompt("YYYY-MM-DD:"); if(t) await supabase.from('gt_accounts').update({expiry_date:t}).eq('id',ac.id); fetchData()}} className="text-[8px] mt-1 text-slate-500 hover:text-white">SET DATE</button>}
            </div>
          ))}
          {isAdmin && <button onClick={async() => {const n=prompt("Name:"); const t=prompt("YYYY-MM-DD:"); if(n&&t) await supabase.from('gt_accounts').insert([{account_name:n, expiry_date:t}]); fetchData()}} className="border-2 border-dashed border-slate-800 rounded-xl text-slate-600 text-xs">+</button>}
        </div>

        {/* MAIN CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#12141c] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${faction==='Horde'?'bg-red-600':'bg-blue-600'}`}></div>
              <h2 className="text-[10px] font-black uppercase text-slate-500 mb-4 flex justify-between">Deposit Form <span className="text-yellow-500">Rate: {globalRate}</span></h2>
              <form onSubmit={handleDeposit} className="space-y-3">
                <input type="text" placeholder="Farmer Name" className="w-full bg-[#08090d] border border-slate-800 p-3 rounded-xl text-sm outline-none" value={farmer} onChange={e=>setFarmer(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Server" className="bg-[#08090d] border border-slate-800 p-3 rounded-xl text-sm outline-none" value={serverName} onChange={e=>setServerName(e.target.value)} required />
                  <select className="bg-[#08090d] border border-slate-800 p-3 rounded-xl text-xs font-bold" value={faction} onChange={e=>setFaction(e.target.value)}>
                    <option value="Horde">🔴 Horde</option><option value="Alliance">🔵 Alliance</option>
                  </select>
                </div>
                <input type="number" placeholder="Gold Amount" className="w-full bg-[#08090d] border border-slate-800 p-4 rounded-xl text-2xl font-mono font-bold text-yellow-500 outline-none" value={gold} onChange={e=>setGold(e.target.value)} required />
                {isAdmin && <button type="button" onClick={()=>setGlobalRate(prompt("Rate Global:",globalRate)||globalRate)} className="text-[8px] w-full text-slate-600">Update Market Rate</button>}
                <button type="submit" className="w-full bg-yellow-500 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-yellow-500/10">Confirm Gold</button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#12141c] p-4 rounded-2xl border border-slate-800 text-center"><p className="text-[8px] text-slate-500 uppercase">Ready Stock</p><h3 className="text-xl font-black text-white">{stok.toLocaleString()} G</h3></div>
              <div className="bg-[#12141c] p-4 rounded-2xl border border-slate-800 text-center"><p className="text-[8px] text-slate-500 uppercase">Market Value</p><h3 className="text-xl font-black text-green-500">Rp {(stok*parseFloat(globalRate)).toLocaleString()}</h3></div>
            </div>

            <div className="bg-[#12141c] rounded-2xl border border-slate-800 overflow-hidden">
              <div className="flex gap-2 p-3 bg-black/20">
                {['All','Horde','Alliance'].map(f=><button key={f} onClick={()=>setFilterFaksi(f)} className={`px-3 py-1 text-[9px] font-black rounded-md ${filterFaksi===f?'bg-yellow-500 text-black':'text-slate-500'}`}>{f.toUpperCase()}</button>)}
              </div>
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-slate-800/50">
                  {filtered.map(i=>(
                    <tr key={i.id} className={`${i.status==='Sold'?'opacity-20 grayscale':''}`}>
                      <td className="p-4"><p className="font-black text-white">{i.farmer_name}</p><p className={`text-[8px] font-black ${i.faction==='Horde'?'text-red-500':'text-blue-500'}`}>{i.faction} • {i.server_name}</p></td>
                      <td className="p-4 text-right font-mono font-bold text-yellow-500">{i.gold_amount.toLocaleString()} G</td>
                      <td className="p-4 text-center">
                        <button onClick={()=>handleStatus(i.id, i.status)} className={`px-3 py-1 rounded-full text-[8px] font-black ${i.status==='Sold'?'bg-green-500/10 text-green-500':'bg-yellow-500 text-black animate-pulse'}`}>{i.status==='Sold'?'● SOLD':'⏳ PENDING'}</button>
                        {i.status==='Sold'&&<button onClick={()=>sendWA(i)} className="block text-[7px] mt-1 text-blue-500 underline uppercase">Receipt</button>}
                      </td>
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