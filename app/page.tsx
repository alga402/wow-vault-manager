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
  const [filterFaksi, setFilterFaksi] = useState('All')

  const PASSWORD_ADMIN = "01236" // Ubah sesuai selera

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
        rate_snapshot: parseFloat(itemRate),
        deduction: 0, // Awalnya selalu 0
        status: 'Pending'
      }])

    if (!error) {
      setFarmer(''); setGold(''); setServerName(''); 
      ambilData();
      alert("Setoran Berhasil Dicatat!");
    }
    setLoading(false)
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!isAdmin) return;
    
    let newStatus = '';
    let finalDeduction = 0;

    if (currentStatus === 'Pending') {
      const inputPotongan = prompt("Masukkan potongan/biaya admin (IDR) untuk pencairan ini:", "0");
      if (inputPotongan === null) return;
      finalDeduction = parseFloat(inputPotongan) || 0;
      newStatus = 'Sold';
    } else {
      if (!confirm("Kembalikan ke Pending? Potongan akan direset.")) return;
      newStatus = 'Pending';
      finalDeduction = 0;
    }

    const { error } = await supabase.from('gold_logs').update({ 
      status: newStatus, 
      deduction: finalDeduction 
    }).eq('id', id);

    if (!error) ambilData();
  }

  const kirimGajiPersonal = (item: any) => {
    const kotor = item.gold_amount * item.rate_snapshot;
    const bersih = kotor - (item.deduction || 0);
    const pesan = `*SLIP GAJI FARMER - WOW VAULT*\n` +
                  `--------------------------\n` +
                  `👤 Nama: ${item.farmer_name}\n` +
                  `💰 Gold: ${item.gold_amount.toLocaleString()} G\n` +
                  `📈 Rate: Rp ${item.rate_snapshot}\n` +
                  `💵 Kotor: Rp ${kotor.toLocaleString('id-ID')}\n` +
                  `❌ Potongan: Rp ${item.deduction.toLocaleString('id-ID')}\n` +
                  `--------------------------\n` +
                  `💰 *NET GAJI: Rp ${bersih.toLocaleString('id-ID')}*\n` +
                  `Status: *LUNAS* ✅`;

    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank');
  };

  const dataFiltered = filterFaksi === 'All' ? daftarSetoran : daftarSetoran.filter(i => i.faction === filterFaksi);
  const goldPending = dataFiltered.filter(i => i.status === 'Pending').reduce((t, i) => t + i.gold_amount, 0);
  const totalRupiahPending = dataFiltered.filter(i => i.status === 'Pending').reduce((t, i) => t + (i.gold_amount * i.rate_snapshot), 0);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-[#0b0d12] text-gray-200 gap-6">
      
      {/* HEADER */}
      <div className="w-full max-w-6xl flex justify-between items-center border-b border-gray-800 pb-4">
        <h1 className="text-xl font-black text-yellow-500 italic">WOW VAULT MANAGER</h1>
        {!isAdmin && <button onClick={loginAdmin} className="text-[10px] text-gray-600 font-bold">ADMIN LOGIN</button>}
        {isAdmin && <span className="text-[10px] text-red-500 font-bold border border-red-900 px-2 rounded">ADMIN MODE</span>}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl">
        
        {/* FORM FARMER */}
        <div className="bg-[#161920] p-6 rounded-2xl border border-gray-800 w-full lg:w-80 h-fit">
          <form onSubmit={kirimData} className="flex flex-col gap-4">
            <input type="text" placeholder="Farmer Name" className="p-3 rounded-lg bg-[#0b0d12] border border-gray-800 text-sm" value={farmer} onChange={(e) => setFarmer(e.target.value)} required />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Server" className="p-3 rounded-lg bg-[#0b0d12] border border-gray-800 text-sm" value={serverName} onChange={(e) => setServerName(e.target.value)} required />
              <select className={`p-3 rounded-lg bg-[#0b0d12] border border-gray-800 text-xs font-bold ${faction === 'Horde' ? 'text-red-500' : 'text-blue-500'}`} value={faction} onChange={(e) => setFaction(e.target.value)}>
                <option value="Horde">🔴 HORDE</option>
                <option value="Alliance">🔵 ALLIANCE</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Amount" className="p-3 rounded-lg bg-[#0b0d12] border border-gray-800 text-yellow-500 font-bold" value={gold} onChange={(e) => setGold(e.target.value)} required />
              <input type="number" step="0.01" className="p-3 rounded-lg bg-[#0b0d12] border border-gray-800 text-green-500 font-bold" value={itemRate} onChange={(e) => setItemRate(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="bg-yellow-600 text-gray-950 p-4 rounded-xl font-black uppercase text-xs">Confirm Deposit</button>
          </form>
        </div>

        {/* DASHBOARD */}
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161920] p-4 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Ready to Sell ({filterFaksi})</p>
              <h2 className="text-2xl font-black text-white">{goldPending.toLocaleString()} G</h2>
            </div>
            <div className="bg-[#161920] p-4 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Pending Value</p>
              <h2 className="text-2xl font-black text-green-500">Rp {totalRupiahPending.toLocaleString('id-ID')}</h2>
            </div>
          </div>

          <div className="bg-[#161920] rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-3 flex gap-2 border-b border-gray-800">
              {['All', 'Horde', 'Alliance'].map(f => (
                <button key={f} onClick={() => setFilterFaksi(f)} className={`px-4 py-1 text-[10px] font-black rounded ${filterFaksi === f ? 'bg-gray-800 text-yellow-500' : 'text-gray-600'}`}>{f}</button>
              ))}
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0b0d12] text-gray-600 uppercase text-[9px] font-black">
                  <th className="p-4">Farmer</th>
                  <th className="p-4 text-right">Gold</th>
                  <th className="p-4 text-center">Status & Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {dataFiltered.map((item) => (
                  <tr key={item.id} className={item.status === 'Sold' ? 'opacity-40' : ''}>
                    <td className="p-4">
                      <div className="font-bold">{item.farmer_name}</div>
                      <div className={`text-[8px] font-black ${item.faction === 'Horde' ? 'text-red-600' : 'text-blue-600'}`}>{item.faction} • {item.server_name}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-yellow-500">{item.gold_amount.toLocaleString()} G</div>
                      <div className="text-[8px] text-gray-600">Rp {item.rate_snapshot}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <button onClick={() => toggleStatus(item.id, item.status)} className={`px-3 py-1 rounded-full text-[8px] font-black border ${item.status === 'Sold' ? 'bg-green-950 text-green-500 border-green-800' : 'bg-yellow-950 text-yellow-500 border-yellow-800 animate-pulse'}`}>
                          {item.status === 'Sold' ? '● SOLD' : '⏳ PENDING'}
                        </button>
                        {item.status === 'Sold' && (
                          <button onClick={() => kirimGajiPersonal(item)} className="text-[7px] text-blue-500 underline font-black">GET RECEIPT 🧾</button>
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
    </main>
  )
}