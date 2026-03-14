'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  // States untuk Form
  const [farmer, setFarmer] = useState('')
  const [gold, setGold] = useState('')
  const [serverName, setServerName] = useState('')
  const [faction, setFaction] = useState('Horde')
  const [loading, setLoading] = useState(false)
  
  // States untuk Bisnis
  const [daftarSetoran, setDaftarSetoran] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filterFaksi, setFilterFaksi] = useState('All')
  const [globalRate, setGlobalRate] = useState('0.5') // FITUR 1: LIVE RATE CONTROL

  const PASSWORD_ADMIN = "01236"

  const loginAdmin = () => {
    const input = prompt("Admin Access Key:");
    if (input === PASSWORD_ADMIN) setIsAdmin(true);
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
        rate_snapshot: parseFloat(globalRate), // Menggunakan rate global yang sedang aktif
        deduction: 0,
        status: 'Pending'
      }])

    if (!error) {
      setFarmer(''); setGold(''); setServerName(''); 
      ambilData();
    }
    setLoading(false)
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!isAdmin) return;
    let newStatus = '';
    let finalDeduction = 0;

    if (currentStatus === 'Pending') {
      const inputPotongan = prompt("Pencairan Dana: Masukkan Biaya Admin/Potongan (IDR):", "0");
      if (inputPotongan === null) return;
      finalDeduction = parseFloat(inputPotongan) || 0;
      newStatus = 'Sold';
    } else {
      if (!confirm("Balikkan ke Pending?")) return;
      newStatus = 'Pending';
      finalDeduction = 0;
    }

    const { error } = await supabase.from('gold_logs').update({ status: newStatus, deduction: finalDeduction }).eq(id, id);
    if (!error) ambilData();
  }

  // FITUR 4: WHATSAPP RECEIPT GENERATOR (CANTIK)
  const kirimNotaWA = (item: any) => {
    const kotor = item.gold_amount * item.rate_snapshot;
    const bersih = kotor - (item.deduction || 0);
    const pesan = `*─ WOW VAULT OFFICIAL RECEIPT ─*\n\n` +
                  `✅ *STATUS:* PAID / LUNAS\n` +
                  `👤 *FARMER:* ${item.farmer_name}\n` +
                  `📅 *DATE:* ${new Date(item.created_at).toLocaleDateString()}\n\n` +
                  `*DETAIL:* \n` +
                  `💰 ${item.gold_amount.toLocaleString()} Gold\n` +
                  `📈 Rate: Rp ${item.rate_snapshot}\n` +
                  `--------------------------\n` +
                  `💵 Subtotal: Rp ${kotor.toLocaleString()}\n` +
                  `❌ Potongan: Rp ${item.deduction.toLocaleString()}\n` +
                  `--------------------------\n` +
                  `🔥 *TOTAL TERIMA: Rp ${bersih.toLocaleString()}*\n\n` +
                  `*Terima kasih sudah berkontribusi!*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank');
  }

  const dataFiltered = filterFaksi === 'All' ? daftarSetoran : daftarSetoran.filter(i => i.faction === filterFaksi);
  const goldPending = dataFiltered.filter(i => i.status === 'Pending').reduce((t, i) => t + i.gold_amount, 0);

  return (
    <main className="min-h-screen bg-[#08090d] text-slate-300 font-sans p-4 md:p-8">
      
      {/* GLOWING HEADER */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 italic tracking-tighter">
            VAULT COMMAND
          </h1>
          <p className="text-[10px] font-bold text-slate-500 tracking-[0.4em] uppercase">Gold Logistics Management</p>
        </div>

        {/* LIVE RATE CONTROL (ADMIN ONLY) */}
        <div className="bg-[#12141c] border border-yellow-500/20 p-4 rounded-2xl flex items-center gap-4 shadow-xl shadow-yellow-500/5">
          <div>
            <p className="text-[9px] font-bold text-yellow-500 uppercase mb-1">Current Market Rate</p>
            <div className="flex items-center gap-2">
               <span className="text-xl font-mono font-bold text-white">Rp {globalRate}</span>
               {isAdmin && (
                 <button onClick={() => setGlobalRate(prompt("Set New Global Rate:", globalRate) || globalRate)} className="text-[10px] bg-yellow-600/10 text-yellow-500 px-2 py-1 rounded border border-yellow-500/30 hover:bg-yellow-500 hover:text-black transition-all">EDIT</button>
               )}
            </div>
          </div>
          <div className="h-10 w-[1px] bg-slate-800 mx-2"></div>
          <button onClick={isAdmin ? () => setIsAdmin(false) : loginAdmin} className={`text-[10px] font-bold px-4 py-2 rounded-lg transition-all ${isAdmin ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
            {isAdmin ? 'LOGOUT ADMIN' : 'ADMIN LOGIN'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: INPUT FORM */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#12141c] p-6 rounded-3xl border border-slate-800/50 shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${faction === 'Horde' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-yellow-500"></span> New Deposit
            </h2>
            <form onSubmit={kirimData} className="space-y-4">
              <input type="text" placeholder="Farmer Name" className="w-full bg-[#08090d] border border-slate-800 p-4 rounded-xl text-sm focus:border-yellow-500 outline-none transition-all" value={farmer} onChange={(e) => setFarmer(e.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Server" className="w-full bg-[#08090d] border border-slate-800 p-4 rounded-xl text-sm outline-none" value={serverName} onChange={(e) => setServerName(e.target.value)} required />
                <select className={`bg-[#08090d] border border-slate-800 p-4 rounded-xl text-xs font-bold outline-none ${faction === 'Horde' ? 'text-red-500' : 'text-blue-500'}`} value={faction} onChange={(e) => setFaction(e.target.value)}>
                  <option value="Horde">HORDE</option>
                  <option value="Alliance">ALLIANCE</option>
                </select>
              </div>
              <div className="bg-yellow-500/5 border border-yellow-500/10 p-4 rounded-xl">
                <p className="text-[9px] font-bold text-yellow-600 uppercase mb-2">Gold Amount</p>
                <input type="number" placeholder="0" className="w-full bg-transparent text-3xl font-mono font-bold text-yellow-500 outline-none" value={gold} onChange={(e) => setGold(e.target.value)} required />
              </div>
              <button disabled={loading} className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-black font-black py-4 rounded-xl text-xs uppercase tracking-widest hover:brightness-125 transition-all shadow-lg shadow-orange-600/20 active:scale-95">
                {loading ? 'Securing Data...' : 'Confirm Gold Deposit'}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: DASHBOARD */}
        <div className="lg:col-span-8 space-y-6">
          {/* STATS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#12141c] p-6 rounded-3xl border border-slate-800/50 shadow-xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Unsold Stock</p>
              <h3 className="text-3xl font-black text-white">{goldPending.toLocaleString()}<span className="text-sm text-slate-600 ml-2">G</span></h3>
            </div>
            <div className="bg-[#12141c] p-6 rounded-3xl border border-slate-800/50 shadow-xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pending Value</p>
              <h3 className="text-3xl font-black text-green-500">Rp {(goldPending * parseFloat(globalRate)).toLocaleString()}</h3>
            </div>
          </div>

          {/* LIST */}
          <div className="bg-[#12141c] rounded-3xl border border-slate-800/50 overflow-hidden shadow-2xl">
            <div className="p-4 flex justify-between items-center border-b border-slate-800/50 bg-[#161922]">
              <div className="flex gap-2">
                {['All', 'Horde', 'Alliance'].map(f => (
                  <button key={f} onClick={() => setFilterFaksi(f)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${filterFaksi === f ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-500 hover:bg-slate-800'}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-600 uppercase tracking-tighter border-b border-slate-800/50">
                    <th className="p-5">Farmer Details</th>
                    <th className="p-5 text-right">Gold & Rate</th>
                    <th className="p-5 text-center">Action / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {dataFiltered.map((item) => (
                    <tr key={item.id} className={`group hover:bg-white/[0.02] transition-colors ${item.status === 'Sold' ? 'opacity-30 grayscale' : ''}`}>
                      <td className="p-5">
                        <div className="text-sm font-bold text-slate-200">{item.farmer_name}</div>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${item.faction === 'Horde' ? 'text-red-500' : 'text-blue-500'}`}>
                          {item.faction} • {item.server_name}
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <div className="text-sm font-mono font-bold text-yellow-500">{item.gold_amount.toLocaleString()} G</div>
                        <div className="text-[9px] text-slate-600">Rate @ {item.rate_snapshot}</div>
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col items-center gap-2">
                          <button onClick={() => toggleStatus(item.id, item.status)} className={`w-28 py-2 rounded-full text-[9px] font-black tracking-widest border transition-all ${item.status === 'Sold' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-yellow-500 text-black border-transparent animate-pulse hover:scale-105'}`}>
                            {item.status === 'Sold' ? '● SOLD' : '⏳ PENDING'}
                          </button>
                          {item.status === 'Sold' && (
                            <button onClick={() => kirimNotaWA(item)} className="text-[8px] font-black text-blue-500 hover:text-blue-400 underline tracking-tighter">SHARE RECEIPT 🧾</button>
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
    </main>
  )
}