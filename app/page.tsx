'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Data States
  const [logs, setLogs] = useState<any[]>([])
  const [gtAccounts, setGtAccounts] = useState<any[]>([]) // State untuk Masa Aktif GT
  const [currentRate, setCurrentRate] = useState('0')
  const [dbDailyCode, setDbDailyCode] = useState('123')
  const [currentTime, setCurrentTime] = useState(new Date())

  const PASSWORD_ADMIN = "12345"

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null) })
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    fetchData()
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    // 1. Ambil Logs Gold
    const { data: l } = await supabase.from('gold_logs').select('*').order('created_at', { ascending: false }).limit(10)
    if (l) setLogs(l)
    
    // 2. Ambil Settings (Rate & Code)
    const { data: s } = await supabase.from('global_settings').select('*').eq('id', 'current_rate').single()
    if (s) { 
      setDbDailyCode(s.daily_code || '123')
      setCurrentRate(s.rate_value || '0')
    }

    // 3. Ambil Data Akun GT (Masa Aktif)
    // Asumsi: Kamu punya tabel bernama 'gt_accounts' dengan kolom: name, expiry_date
    const { data: gt } = await supabase.from('gt_accounts').select('*').order('expiry_date', { ascending: true })
    if (gt) setGtAccounts(gt)
  }

  // Fungsi hitung sisa hari
  const getDaysLeft = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-800 p-2 md:p-6 pb-24 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg">V</div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">GT Vault Manager</h1>
              <p className="text-[10px] font-bold text-blue-600">{user?.email || 'OFFLINE'}</p>
            </div>
          </div>
          <div className="bg-green-50 px-6 py-3 rounded-2xl border border-green-100 text-center">
              <p className="text-[8px] font-black text-green-600 uppercase italic mb-1">Live_Gold_Rate</p>
              <p className="text-xl font-black text-green-700 font-mono">IDR {currentRate}</p>
          </div>
        </header>

        {/* --- MONITORING MASA AKTIF AKUN GT --- */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase ml-2 flex items-center gap-2">
            <span className="h-2 w-2 bg-blue-500 rounded-full"></span> Subscription Monitoring
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gtAccounts.length > 0 ? gtAccounts.map((acc) => {
              const daysLeft = getDaysLeft(acc.expiry_date)
              const isExpired = daysLeft <= 0
              const isWarning = daysLeft <= 7

              return (
                <div key={acc.id} className={`p-5 rounded-2xl border transition-all ${isExpired ? 'bg-red-50 border-red-200' : isWarning ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-sm uppercase truncate pr-2">{acc.name}</h3>
                    <span className={`text-[8px] px-2 py-1 rounded-md font-black ${isExpired ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase italic">Ends At:</p>
                      <p className="text-xs font-mono font-bold text-gray-700">{new Date(acc.expiry_date).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-black font-mono leading-none ${isExpired ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-blue-600'}`}>
                        {daysLeft}
                      </p>
                      <p className="text-[8px] font-black text-gray-400 uppercase">Days Left</p>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="col-span-3 bg-gray-50 border border-dashed border-gray-300 p-8 rounded-2xl text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase italic">No Accounts Tracked. Add via Admin Panel.</p>
              </div>
            )}
          </div>
        </section>

        {/* LOGS & INPUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm self-start">
             <h2 className="text-[10px] font-black text-gray-800 mb-6 uppercase border-l-4 border-blue-600 pl-3">Input Daily Gold</h2>
             <form onSubmit={async (e) => {
                e.preventDefault(); setLoading(true)
                const g = (e.target as any).gold.value; const s = (e.target as any).server.value
                await supabase.from('gold_logs').insert([{ farmer_name: user.email?.split('@')[0], gold_amount: parseInt(g), server_name: s, status: 'Pending', user_id: user.id }])
                fetchData(); (e.target as any).reset(); setLoading(false)
             }} className="space-y-4">
               <input name="server" type="text" placeholder="Server Name" className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/10" required />
               <input name="gold" type="number" placeholder="Gold Amount" className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/10" required />
               <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 uppercase italic">
                 {loading ? 'Transmitting...' : 'Submit Gold'}
               </button>
             </form>
          </div>

          <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Recent Logs</h3>
                <button onClick={() => fetchData()} className="text-[10px] font-black text-blue-600">REFRESH ↻</button>
             </div>
             <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-50 uppercase text-[9px] font-black">
                    <th className="p-4">Farmer</th>
                    <th className="p-4">Server</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 italic">
                  {logs.map(i => (
                    <tr key={i.id} className="hover:bg-blue-50/30 transition-all font-bold text-gray-700">
                      <td className="p-4">{i.farmer_name}</td>
                      <td className="p-4 text-gray-500 font-mono text-[10px]">{i.server_name}</td>
                      <td className="p-4 text-right text-blue-600 font-mono">{i.gold_amount.toLocaleString()} G</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* ADMIN PANEL & UPDATE MASA AKTIF */}
      <div className="fixed bottom-6 right-6 z-50">
         <button onClick={() => { const p = prompt("Password Admin:"); if(p===PASSWORD_ADMIN) setIsAdmin(!isAdmin); }} className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-xl text-[10px] font-black tracking-widest uppercase hover:scale-105 transition-all">
           {isAdmin ? '🛡️ Close Admin' : '🛡️ Admin Login'}
         </button>
         
         {isAdmin && (
           <div className="absolute bottom-16 right-0 bg-white border border-gray-200 p-6 rounded-3xl shadow-2xl w-80 space-y-5 animate-in slide-in-from-bottom-5">
              <p className="text-[11px] font-black text-blue-600 italic uppercase">Admin Master Console</p>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase italic">Manage GT Subscriptions</label>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const name = (e.target as any).acc_name.value;
                  const date = (e.target as any).acc_date.value;
                  await supabase.from('gt_accounts').insert([{ name, expiry_date: date }]);
                  fetchData(); (e.target as any).reset();
                }} className="space-y-2">
                  <input name="acc_name" type="text" placeholder="Account Name (ex: GT-01)" className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-[10px] font-bold outline-none" required />
                  <input name="acc_date" type="date" className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-[10px] font-bold outline-none" required />
                  <button type="submit" className="w-full bg-blue-600 text-white text-[9px] py-2 rounded-lg font-black uppercase">Add / Update Account</button>
                </form>
              </div>

              <div className="border-t pt-4 space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase italic">Global Rate</label>
                <input type="number" className="w-full bg-gray-50 border border-gray-200 p-2 rounded-lg text-sm font-black" value={currentRate} onChange={async (e)=>{
                  const r = e.target.value; setCurrentRate(r);
                  await supabase.from('global_settings').update({ rate_value: r }).eq('id', 'current_rate');
                }} />
              </div>
           </div>
         )}
      </div>
    </main>
  )
}