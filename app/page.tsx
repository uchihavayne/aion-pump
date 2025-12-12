"use client";

import { useState, useEffect, useRef } from "react";
import { Rocket, X, Coins, Twitter, Send, Globe, TrendingUp, Users, Activity, Crown, Flame, Upload, Search, Star, User as UserIcon, Zap, Play } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { motion } from "framer-motion";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, usePublicClient } from "wagmi"; 
import { parseEther, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import toast, { Toaster } from 'react-hot-toast';

const HIDDEN_TOKENS: string[] = [].map((t: string) => t.toLowerCase());

const getTokenImage = (address: string, customImage?: string) => 
  customImage || `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

// MEDYA RENDER (Video/Resim Ayırıcı)
const MediaRenderer = ({ src, className }: { src: string, className: string }) => {
    const isVideo = src.includes(".mp4") || src.includes(".webm");
    if (isVideo) {
        return <video src={src} className={className} autoPlay muted loop playsInline />;
    }
    return <img src={src} className={className} alt="token" />;
};

function DarkTokenCard({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const [hovering, setHovering] = useState(false);
  const [holders, setHolders] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const publicClient = usePublicClient();

  // WRITE CONTRACT FOR QUICK BUY
  const { writeContract } = useWriteContract();

  const { data: salesData } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);
  const image = metadata ? metadata[4] : "";
  const tokenImage = getTokenImage(tokenAddress, image);

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    setIsFav(favs.includes(tokenAddress));
    const getHolders = async () => {
      if(!publicClient) return;
      try {
        const logs = await publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', args: { token: tokenAddress }, fromBlock: 'earliest' });
        const uniqueBuyers = new Set(logs.map((l: any) => l.args.buyer));
        setHolders(uniqueBuyers.size > 0 ? uniqueBuyers.size : 1);
      } catch(e) {}
    };
    getHolders();
  }, [tokenAddress, publicClient]);

  const toggleFav = (e: any) => {
    e.preventDefault(); e.stopPropagation();
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    let newFavs;
    if (favs.includes(tokenAddress)) { newFavs = favs.filter((t: string) => t !== tokenAddress); toast.success("Removed from watchlist"); } 
    else { newFavs = [...favs, tokenAddress]; toast.success("Added to watchlist"); }
    localStorage.setItem("favorites", JSON.stringify(newFavs));
    setIsFav(!isFav);
  };

  // --- QUICK BUY FUNCTION ---
  const handleQuickBuy = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      try {
          writeContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: "buy",
              args: [tokenAddress],
              value: parseEther("1") // 1 MATIC FIX
          });
          toast.loading("Quick buying 1 MATIC...", { duration: 4000 });
      } catch(err) { toast.error("Quick buy failed"); }
  };

  return (
    <Link href={`/trade/${tokenAddress}`}>
      <motion.div
        onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ position: 'relative', cursor: 'pointer', height: '100%', borderRadius: '20px', border: hovering ? '1px solid rgba(253, 220, 17, 0.5)' : '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '24px', transition: 'all 0.3s ease', transform: hovering ? 'translateY(-8px)' : 'translateY(0)', boxShadow: hovering ? '0 20px 50px -10px rgba(253, 220, 17, 0.2)' : 'none' }}
      >
        <div onClick={toggleFav} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors border border-white/10"><Star size={16} className={isFav ? "text-[#FDDC11] fill-[#FDDC11]" : "text-gray-400"} /></div>

        <div className="flex gap-4 mb-5 items-start">
          <div className="relative shrink-0">
             <MediaRenderer src={tokenImage} className="w-[60px] h-[60px] rounded-2xl border border-[#FDDC11]/20 object-cover" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '6px', lineHeight: '1.2' }}>{name?.toString() || "Loading..."}</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(253, 220, 17, 0.15)', color: '#FDDC11', border: '1px solid rgba(253, 220, 17, 0.3)', padding: '4px 8px', borderRadius: '6px' }}>{symbol?.toString() || "TKN"}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}><span style={{ color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bonding Curve</span><span style={{ color: '#FDDC11', fontWeight: '700' }}>{realProgress.toFixed(1)}%</span></div>
          <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${realProgress}%` }} transition={{ duration: 1.2 }} style={{ height: '100%', background: 'linear-gradient(90deg, #FDDC11 0%, #9333ea 100%)', boxShadow: '0 0 20px rgba(253, 220, 17, 0.6)' }} /></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}><Coins size={14} style={{ color: '#FDDC11' }} /><span>{parseFloat(collateral).toFixed(2)} MATIC</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}><Users size={14} style={{ color: '#9333ea' }} /><span>Holders: {holders}</span></div>
        </div>

        {/* QUICK BUY BUTTON */}
        <button 
            onClick={handleQuickBuy}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-lg active:scale-95 group"
        >
            <Zap size={10} className="fill-current" /> BUY 1 MATIC
        </button>

      </motion.div>
    </Link>
  );
}

// --- KING OF THE HILL ---
function KingOfTheHill({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const { data: salesData } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);
  const image = metadata ? metadata[4] : "";
  const tokenImage = getTokenImage(tokenAddress, image);

  if (!name) return null;

  return (
    <Link href={`/trade/${tokenAddress}`}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.02 }} className="relative overflow-hidden rounded-3xl p-1 mb-12 cursor-pointer group" style={{ background: 'linear-gradient(45deg, #FDDC11, #ff0000, #9333ea, #FDDC11)', backgroundSize: '400% 400%', animation: 'gradientBorder 3s ease infinite' }}>
        <style>{`@keyframes gradientBorder { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>
        <div className="bg-[#0a0e27] rounded-[22px] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Crown size={120} /></div>
          <div className="flex flex-col md:flex-row gap-8 items-center">
             <div className="relative">
                <MediaRenderer src={tokenImage} className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-[#FDDC11] shadow-[0_0_30px_rgba(253,220,17,0.4)] object-cover" />
                <div className="absolute -top-4 -left-4 bg-[#FDDC11] text-black font-black px-4 py-1 rounded-full flex items-center gap-2 shadow-lg transform -rotate-6 border-2 border-white"><Crown size={16} fill="black" /> KING OF THE HILL</div>
             </div>
             <div className="flex-1 text-center md:text-left z-10">
                <h2 className="text-4xl font-black text-white mb-2 leading-tight">{name?.toString()} <span className="text-[#FDDC11] text-2xl">[{symbol?.toString()}]</span></h2>
                <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                   <span className="px-3 py-1 bg-white/10 rounded-lg text-sm font-bold text-green-400 flex items-center gap-2"><Flame size={14} className="fill-green-400"/> Bonding Curve: {realProgress.toFixed(2)}%</span>
                   <span className="px-3 py-1 bg-white/10 rounded-lg text-sm font-bold text-blue-400 flex items-center gap-2"><Activity size={14}/> Top Volume</span>
                </div>
                <div className="h-4 bg-white/10 rounded-full overflow-hidden border border-white/5 w-full max-w-md"><motion.div initial={{ width: 0 }} animate={{ width: `${realProgress}%` }} transition={{ duration: 1.5 }} className="h-full bg-gradient-to-r from-[#FDDC11] to-red-500 shadow-[0_0_20px_#FDDC11]" /></div>
                <p className="text-gray-400 text-sm mt-2">Closest to graduation! Buy now before it hits DEX.</p>
             </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// --- LIVE TICKER ---
function LiveTicker() {
  const [events, setEvents] = useState<any[]>([]);
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', onLogs(logs: any) {
      const newEvent = { type: 'BUY', token: logs[0].args.token, amount: parseFloat(formatEther(logs[0].args.amountMATIC)).toFixed(2), buyer: logs[0].args.buyer };
      setEvents(prev => [newEvent, ...prev].slice(0, 5));
    }
  });
  return (
    <div className="w-full bg-[#FDDC11]/10 border-b border-[#FDDC11]/20 overflow-hidden py-2">
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {events.length === 0 ? (<span className="text-sm text-[#FDDC11] font-mono flex items-center gap-2">🚀 Live trades will appear here...</span>) : (events.map((e, i) => (<span key={i} className="text-sm text-[#FDDC11] font-mono flex items-center gap-2">🟢 {e.buyer.slice(0,4)}... bought {e.amount} MATIC</span>)))}
        <span className="text-sm text-gray-500 font-mono">⚡ LIVE ACTIVITY</span>
        <span className="text-sm text-green-400 font-mono">🟢 0x1a... bought 50 MATIC</span>
      </div>
      <style>{`.animate-marquee { animation: marquee 20s linear infinite; } @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({ name: "", ticker: "", desc: "", twitter: "", telegram: "", website: "", image: "" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allTokens } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getAllTokens" });
  const [orderedTokens, setOrderedTokens] = useState<string[]>([]);
  
  useEffect(() => { 
    if (allTokens) { 
      const tokens = (allTokens as string[]).filter(t => !HIDDEN_TOKENS.includes(t.toLowerCase())).reverse();
      setOrderedTokens(tokens);
    } 
  }, [allTokens]);

  const filteredTokens = orderedTokens.filter(tokenAddr => tokenAddr.toLowerCase().includes(searchQuery.toLowerCase()));

  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'TokenCreated', onLogs(logs: any) { 
    if (logs[0]?.args?.token) { setOrderedTokens(prev => [logs[0].args.token, ...prev]); toast.success("🚀 New token launched!"); } 
  }});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPreviewUrl(URL.createObjectURL(file)); }
  };

  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleCreate = async () => {
    if (!formData.name || !formData.ticker) { toast.error("Name & Ticker required"); return; }
    try {
      writeContract({ 
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "createToken", 
        args: [formData.name, formData.ticker, formData.desc || "", formData.twitter || "", formData.telegram || "", formData.website || "", formData.image || ""], 
        value: parseEther("0.1") 
      });
      toast.loading("Confirm in wallet...", { id: 'tx' });
    } catch (e) { toast.error("Transaction failed"); toast.dismiss('tx'); }
  };

  useEffect(() => { 
    if (isConfirmed) {
      toast.dismiss('tx'); toast.success("Token created!");
      setTimeout(() => { setIsModalOpen(false); setFormData({ name: "", ticker: "", desc: "", twitter: "", telegram: "", website: "", image: "" }); setPreviewUrl(null); }, 1000); 
    }
  }, [isConfirmed]);

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return <div style={{ minHeight: '100vh', backgroundColor: '#0a0e27', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FDDC11', fontFamily: 'sans-serif' }}>Loading AION...</div>;

  return (
    <div style={{ backgroundColor: '#0a0e27', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.12) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.12) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'rgba(10, 14, 39, 0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(253, 220, 17, 0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900', fontSize: '20px', boxShadow: '0 0 20px rgba(253, 220, 17, 0.3)' }}>A</div>
            <div><div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', background: 'linear-gradient(90deg, #FDDC11, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AION</div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Bonding Curves</div></div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => setIsModalOpen(true)} style={{ background: 'linear-gradient(135deg, #FDDC11, #9333ea)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 0 20px rgba(253, 220, 17, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 30px rgba(253, 220, 17, 0.5)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 0 20px rgba(253, 220, 17, 0.3)'}><Rocket size={16} /> LAUNCH</button>
            <div style={{ transform: 'scale(0.9)' }}><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div>
            <Link href="/profile" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 group"><UserIcon size={20} className="text-gray-400 group-hover:text-[#FDDC11] transition-colors" /></Link>
          </div>
        </div>
        <LiveTicker />
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
        {/* KING OF THE HILL SECTION */}
        {orderedTokens.length > 0 && (
          <div className="mb-12">
             <div className="flex items-center gap-2 mb-4"><Crown className="text-[#FDDC11]" size={24} /><h2 className="text-2xl font-black text-white">KING OF THE HILL</h2></div>
             <KingOfTheHill tokenAddress={orderedTokens[0] as `0x${string}`} />
          </div>
        )}

        {/* SEARCH BAR */}
        <div className="mb-8 relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search token address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#0f1225] border border-white/10 rounded-full py-3 pl-12 pr-6 text-white outline-none focus:border-[#FDDC11] transition-colors" />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '8px' }}>{['Trending', 'New', 'Gainers', 'Volume'].map(t => (<button key={t} onClick={() => setActiveTab(t.toLowerCase())} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: activeTab === t.toLowerCase() ? '2px solid #FDDC11' : '1px solid rgba(255, 255, 255, 0.1)', background: activeTab === t.toLowerCase() ? 'linear-gradient(135deg, #FDDC11, #9333ea)' : 'transparent', color: activeTab === t.toLowerCase() ? '#000' : '#94a3b8', cursor: 'pointer', transition: 'all 0.3s', whiteSpace: 'nowrap', boxShadow: activeTab === t.toLowerCase() ? '0 0 20px rgba(253, 220, 17, 0.3)' : 'none' }}>{t}</button>))}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {filteredTokens.length > 0 ? (filteredTokens.map((addr) => <DarkTokenCard key={addr} tokenAddress={addr as `0x${string}`} />)) : (<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}><div style={{ fontSize: '18px', fontWeight: '600' }}>No tokens found.</div></div>)}
        </div>
      </main>

      {/* Modal - Same logic, simplified display for brevity */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)' }} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative', width: '100%', maxWidth: '420px', backgroundColor: 'rgba(10, 14, 39, 0.95)', borderRadius: '24px', border: '1px solid rgba(253, 220, 17, 0.2)', boxShadow: '0 0 80px rgba(253, 220, 17, 0.2)', overflow: 'hidden', backdropFilter: 'blur(20px)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, rgba(253, 220, 17, 0.1), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Rocket size={22} style={{ color: '#FDDC11' }} /><span style={{ fontWeight: '800', fontSize: '18px' }}>Launch Token</span></div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label className="text-[11px] font-bold text-gray-500 uppercase">Name</label><input type="text" placeholder="Bitcoin" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-[#FDDC11]" /></div>
                <div><label className="text-[11px] font-bold text-gray-500 uppercase">Ticker</label><input type="text" placeholder="BTC" maxLength={10} value={formData.ticker} onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-[#FDDC11]" /></div>
              </div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase">Description</label><textarea placeholder="Tell us about your token..." value={formData.desc} onChange={(e) => setFormData({...formData, desc: e.target.value})} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white outline-none h-24 resize-none focus:border-[#FDDC11]" /></div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">Image / Video URL</label>
                <div onClick={() => fileInputRef.current?.click()} className="w-full p-5 bg-white/5 border border-dashed border-white/20 rounded-lg cursor-pointer text-center hover:border-[#FDDC11] transition-colors flex flex-col items-center gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
                  {previewUrl ? <MediaRenderer src={previewUrl} className="w-20 h-20 object-cover rounded-lg" /> : <><Upload size={24} className="text-gray-500" /><span className="text-xs text-gray-500">Click to upload</span></>}
                </div>
                <input type="text" placeholder="Or paste URL..." value={formData.image} onChange={(e) => { setFormData({...formData, image: e.target.value}); setPreviewUrl(e.target.value); }} className="w-full mt-2 p-2 bg-white/5 border-none rounded-lg text-xs text-white outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="Twitter" value={formData.twitter} onChange={(e) => setFormData({...formData, twitter: e.target.value})} className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
                <input type="text" placeholder="Telegram" value={formData.telegram} onChange={(e) => setFormData({...formData, telegram: e.target.value})} className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
                <input type="text" placeholder="Web" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
              </div>
              <button onClick={handleCreate} disabled={isPending || isConfirming} className="w-full p-4 bg-[#FDDC11] text-black rounded-xl font-extrabold text-sm hover:bg-[#ffe55c] transition-colors disabled:opacity-70">{isPending ? "CONFIRMING..." : isConfirming ? "DEPLOYING..." : "CREATE & LAUNCH (0.1 MATIC)"}</button>
              <div className="text-center text-xs text-gray-500 font-bold">Cost: 0.1 MATIC • Instant Trading</div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
