'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [farmer, setFarmer] = useState('')
  const [gold, setGold] = useState('')
  const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde')
  const [itemRate, setItemRate] = useState('0.5')
  const [loading, setLoading] = useState(false)
  const [daftarSetoran, setDaftarSetoran] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  
  // --- STATE UNTUK FILTER ---
  const [filterFaksi, setFilterFaksi] = useState('All')

  const passwordAdmin = "02126064042Qq"

  const loginAdmin = () => {
    const input = prompt("Admin Password:");
    if (input === passwordAdmin) setIsAdmin(true);
  }

  const ambilData = async () => {
    const { data, error } = await supabase
      .from('gold_logs')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setDaftarSetoran(data)
  }

  useEffect(() => {
    ambilData()
  }, [])

  const kirimData = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase
      .from('gold_logs')
      .insert([{ 
        farmer_name: farmer, 
        gold_amount: parseInt(gold), 
        server_name: serverName,
        faction: faction,
        rate_snapshot: parseFloat(itemRate)
      }])

    if (!error) {
      setFarmer(''); setGold(''); setServerName(''); ambilData()
    }
    setLoading(false)
  }

  const hapusData = async (id: string) => {
    if (!isAdmin) return;
    if (confirm("Hapus data ini?")) {
      await supabase.from('gold_logs').delete().eq('id', id)
      ambilData()
    }
  }

  // --- LOGIKA FILTER DATA ---
  const dataFiltered = filterFaksi === 'All' 
    ? daftarSetoran 
    : daftarSetoran.filter(item => item.faction === filterFaksi)

  const totalGold = dataFiltered.reduce((total, item) => total + item.gold_amount, 0)
  const totalRupiah = dataFiltered.reduce((total, item) => total + (item.gold_amount * (item.rate_snapshot || 0)), 0)

  const kirimWA = () => {
    let pesan = `*WOW GOLD REPORT [${filterFaksi.toUpperCase()}]*\n\n` +
                dataFiltered.map((item) => 
                  `👤 ${item.farmer_name} [${item.faction === 'Horde' ? '🔴' : '🔵'}]\n💰 ${item.gold_amount.toLocaleString()} G\n---`
                ).join('\n') +
                `\n\n*TOTAL GOLD: ${totalGold.toLocaleString()} G*\n*TOTAL IDR: Rp ${totalRupiah.toLocaleString('id-ID')}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-[#0b0d12] text-gray-200 gap-6">
      
      {/* HEADER */}
      <div className="w-full max-w-6xl flex justify-between items-end border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-yellow-500 italic tracking-tighter uppercase">WoW Vault</h1>
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em]">Horde & Alliance Database</p>
        </div>
        {!isAdmin && <button onClick={loginAdmin} className="text-[10px] text-gray-700 uppercase font-bold hover:text-yellow-600 transition-colors">Admin Access</button>}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl">
        
        {/* FORM INPUT */}
        <div className="bg-[#161920] p-6 rounded-2xl border border-gray-800 w-full lg:w-96 shadow-2xl relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${faction === 'Horde' ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]'}`}></div>
          
          <form onSubmit={kirimData} className="flex flex-col gap-4 mt-2">
            <input 
              type="text" placeholder="Farmer Name" 
              className="p-3 rounded-lg bg-[#0b0d12] border border-gray-800 focus:border-yellow-600 outline-none text-sm"
              value={farmer} onChange={(e) => setFarmer(e.target.value)} required
            />
            
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="text" placeholder="Server Name" 
                className="p-3 rounded-lg bg-[#0b0d12] border border-gray-800 focus:border-yellow-600 outline-none text-sm"
                value={serverName} onChange={(e) => setServerName(e.target.value)} required
              />
              <select 
                className={`p-3 rounded-lg bg-[#0b0d12] border border-gray-800 outline-none text-sm font-bold ${faction === 'Horde' ? 'text-red-500' : 'text-blue-500'}`}
                value={faction} onChange={(e) => setFaction(e.target.value)}
              >
                <option value="Horde">🔴 HORDE</option>
                <option value="Alliance">🔵 ALLIANCE</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1">Gold</label>
                <input 
                  type="number" className="w-full p-3 rounded-lg bg-[#0b0d12] border border-gray-800 focus:border-yellow-600 outline-none text-yellow-500 font-bold"
                  value={gold} onChange={(e) => setGold(e.target.value)} required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1">Rate</label>
                <input 
                  type="number" step="0.01" 
                  className="w-full p-3 rounded-lg bg-[#0b0d12] border border-gray-800 focus:border-green-600 outline-none text-green-500 font-bold"
                  value={itemRate} onChange={(e) => setItemRate(e.target.value)} required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="bg-yellow-600 hover:bg-yellow-500 text-gray-950 p-4 rounded-xl font-black uppercase text-xs transition-all shadow-lg active:scale-95 mt-2">
              Confirm Deposit
            </button>
          </form>
        </div>

        {/* DATA DISPLAY */}
        <div className="flex-1 space-y-4">
          
          {/* FILTER TAB */}
          <div className="flex gap-2 p-1 bg-[#161920] rounded-xl border border-gray-800 w-fit">
            {['All', 'Horde', 'Alliance'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterFaksi(f)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                  filterFaksi === f 
                  ? 'bg-gray-800 text-yellow-500 shadow-inner' 
                  : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161920] p-5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Gold ({filterFaksi})</p>
              <h2 className="text-3xl font-black text-white">{totalGold.toLocaleString()} G</h2>
            </div>
            <div className="bg-[#161920] p-5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-green-600">Total Value ({filterFaksi})</p>
              <h2 className="text-3xl font-black text-green-500 text-right">Rp {totalRupiah.toLocaleString('id-ID')}</h2>
            </div>
          </div>

          <div className="bg-[#161920] rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0b0d12] text-gray-600 uppercase tracking-tighter border-b border-gray-800">
                    <th className="p-4 font-black">Farmer</th>
                    <th className="p-4 font-black">Server</th>
                    <th className="p-4 text-right font-black">Gold</th>
                    <th className="p-4 text-right font-black">Rate</th>
                    <th className="p-4 text-right font-black text-green-700">Subtotal</th>
                    {isAdmin && <th className="p-4 text-center font-black">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {dataFiltered.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-gray-700 font-bold uppercase tracking-widest italic">No data for {filterFaksi}</td></tr>
                  ) : (
                    dataFiltered.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-4">
                          <div className="font-bold text-gray-200">{item.farmer_name}</div>
                          <div className={`text-[9px] font-black uppercase ${item.faction === 'Horde' ? 'text-red-600' : 'text-blue-600'}`}>
                             {item.faction === 'Horde' ? '● HORDE' : '● ALLIANCE'}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-gray-500">{item.server_name}</td>
                        <td className="p-4 text-right text-yellow-500 font-bold font-mono">{item.gold_amount.toLocaleString()}</td>
                        <td className="p-4 text-right text-gray-600 font-mono text-[10px]">{item.rate_snapshot}</td>
                        <td className="p-4 text-right text-green-500 font-bold font-mono">
                          Rp {(item.gold_amount * (item.rate_snapshot || 0)).toLocaleString('id-ID')}
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-center">
                            <button onClick={() => hapusData(item.id)} className="text-gray-800 hover:text-red-600 transition-colors">✖</button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={kirimWA} className="w-full p-3 bg-green-800/10 text-green-600 font-black text-[10px] uppercase hover:bg-green-600 hover:text-white transition-all border-t border-gray-800">
              Share {filterFaksi} Report to WhatsApp
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}