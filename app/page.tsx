"use client";

import { useState, useEffect, useRef } from "react";
import { Rocket, X, Coins, Twitter, Send, Globe, TrendingUp, Users, Activity, Crown, Flame, Upload, Search, Star, User as UserIcon, Zap, Play, Swords } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { motion } from "framer-motion";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, usePublicClient } from "wagmi"; 
import { parseEther, formatEther, erc20Abi } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import toast, { Toaster } from 'react-hot-toast';

// Gizlenen tokenlar
const HIDDEN_TOKENS: string[] = [].map((t: string) => t.toLowerCase());

// Sağlam Resim Kaynağı
const getTokenImage = (address: string) => 
  `https://api.dicebear.com/7.x/identicon/svg?seed=${address}&backgroundColor=transparent`;

// Medya Oynatıcı (Hata Korumalı)
const MediaRenderer = ({ src, className }: { src: string, className: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    
    if (!mounted) return <div className={`${className} bg-gray-800 animate-pulse`} />;

    // Güvenli render
    const isVideo = src && (src.includes(".mp4") || src.includes(".webm"));
    if (isVideo) return <video src={src} className={className} autoPlay muted loop playsInline />;
    
    return (
        <img 
            src={src || getTokenImage("default")} 
            className={className} 
            alt="token" 
            onError={(e) => { (e.target as HTMLImageElement).src = getTokenImage("default"); }} 
        />
    );
};

// --- VERSUS BATTLE ---
function VersusBattle({ token1, token2 }: { token1: string, token2: string }) {
    if (!token1 || !token2) return null;
    return (
        <div className="mb-12 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-red-600 rounded-full p-3 border-4 border-[#0a0e27] shadow-[0_0_30px_red]">
                <Swords size={32} color="white" className="animate-pulse"/>
            </div>
            <div className="flex flex-col md:flex-row gap-4 md:gap-0 bg-[#1a0e2e] border border-white/10 rounded-3xl overflow-hidden relative">
                <Link href={`/trade/${token1}`} className="flex-1 p-6 relative group cursor-pointer hover:bg-white/5 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent opacity-50" />
                    <div className="relative z-10 flex items-center gap-4">
                        <img src={getTokenImage(token1)} className="w-20 h-20 rounded-xl border-2 border-blue-500 shadow-[0_0_20px_blue]" />
                        <div><div className="text-blue-400 font-bold text-xs mb-1">CHALLENGER 1</div><div className="text-2xl font-black text-white">{token1.slice(0,6)}...</div></div>
                    </div>
                </Link>
                <div className="w-full h-1 md:w-1 md:h-auto bg-black relative z-10"></div>
                <Link href={`/trade/${token2}`} className="flex-1 p-6 relative group cursor-pointer hover:bg-white/5 transition-colors text-right">
                    <div className="absolute inset-0 bg-gradient-to-l from-red-600/20 to-transparent opacity-50" />
                    <div className="relative z-10 flex items-center justify-end gap-4">
                        <div><div className="text-red-400 font-bold text-xs mb-1">CHALLENGER 2</div><div className="text-2xl font-black text-white">{token2.slice(0,6)}...</div></div>
                        <img src={getTokenImage(token2)} className="w-20 h-20 rounded-xl border-2 border-red-500 shadow-[0_0_20px_red]" />
                    </div>
                </Link>
            </div>
        </div>
    )
}

// --- TOKEN KARTI ---
function DarkTokenCard({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const [hovering, setHovering] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const { writeContract } = useWriteContract();
  
  // Data Fetching - HATALI: Hook'lar conditional olmamalı
  const { data: salesData } = useReadContract({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    functionName: "sales", 
    args: [tokenAddress] 
  });
  
  const { data: name } = useReadContract({ 
    address: tokenAddress, 
    abi: [{ 
      name: "name", 
      type: "function", 
      inputs: [], 
      outputs: [{ type: "string" }], 
      stateMutability: "view" 
    }], 
    functionName: "name" 
  });
  
  const { data: symbol } = useReadContract({ 
    address: tokenAddress, 
    abi: [{ 
      name: "symbol", 
      type: "function", 
      inputs: [], 
      outputs: [{ type: "string" }], 
      stateMutability: "view" 
    }], 
    functionName: "symbol" 
  });
  
  const { data: metadata } = useReadContract({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    functionName: "tokenMetadata", 
    args: [tokenAddress] 
  });

  // Güvenli Veri İşleme (BigInt Hatalarını Önler)
  const collateralStr = salesData && salesData[1] ? formatEther(salesData[1] as bigint) : "0";
  const tokensSoldStr = salesData && salesData[3] ? formatEther(salesData[3] as bigint) : "0";
  const progress = (parseFloat(tokensSoldStr) / 1_000_000_000) * 100;
  const realProgress = Math.min(progress, 100);
  
  const image = metadata && metadata[4] ? metadata[4] : "";
  const tokenImage = getTokenImage(tokenAddress);

  useEffect(() => {
    // Sadece tarayıcıda çalışır
    if (typeof window !== 'undefined') {
        const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
        setIsFav(favs.includes(tokenAddress));
    }
  }, [tokenAddress]);

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    let newFavs;
    if (favs.includes(tokenAddress)) { 
      newFavs = favs.filter((t: string) => t !== tokenAddress); 
      toast.success("Removed from watchlist"); 
    } else { 
      newFavs = [...favs, tokenAddress]; 
      toast.success("Added to watchlist"); 
    }
    localStorage.setItem("favorites", JSON.stringify(newFavs));
    setIsFav(!isFav);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      try {
          writeContract({ 
            address: CONTRACT_ADDRESS, 
            abi: CONTRACT_ABI, 
            functionName: "buy", 
            args: [tokenAddress], 
            value: parseEther("1") 
          });
          toast.loading("Quick buying 1 MATIC...", { duration: 4000 });
      } catch(err) { 
        toast.error("Quick buy failed"); 
      }
  };

  return (
    <Link href={`/trade/${tokenAddress}`}>
      <motion.div
        onMouseEnter={() => setHovering(true)} 
        onMouseLeave={() => setHovering(false)}
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="relative cursor-pointer h-full rounded-2xl p-6 transition-all duration-300 transform"
        style={{
            border: hovering ? '1px solid rgba(253, 220, 17, 0.5)' : '1px solid rgba(253, 220, 17, 0.15)',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))',
            backdropFilter: 'blur(20px)',
            transform: hovering ? 'translateY(-5px)' : 'translateY(0)',
            boxShadow: hovering ? '0 10px 30px -10px rgba(253, 220, 17, 0.2)' : 'none'
        }}
      >
        <button 
          onClick={toggleFav} 
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors border border-white/10"
          type="button"
        >
          <Star size={16} className={isFav ? "text-[#FDDC11] fill-[#FDDC11]" : "text-gray-400"} />
        </button>
        <div className="flex gap-4 mb-5 items-start">
          <div className="relative shrink-0">
            <MediaRenderer src={tokenImage} className="w-[60px] h-[60px] rounded-2xl border border-[#FDDC11]/20 object-cover" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="text-lg font-bold text-white mb-1 leading-tight">
              {name?.toString() || "Loading..."}
            </h3>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-bold bg-[#FDDC11]/15 text-[#FDDC11] border border-[#FDDC11]/30 px-2 py-1 rounded-md">
                {symbol?.toString() || "TKN"}
              </span>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <div className="flex justify-between mb-2 text-xs">
            <span className="text-gray-400 font-semibold uppercase tracking-wide">Bonding Curve</span>
            <span className="text-[#FDDC11] font-bold">{realProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${realProgress}%` }} 
              transition={{ duration: 1.2 }} 
              className="h-full bg-gradient-to-r from-[#FDDC11] to-purple-600 shadow-[0_0_20px_rgba(253,220,17,0.6)]" 
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 font-semibold">
          <div className="flex items-center gap-1">
            <Coins size={14} className="text-[#FDDC11]" />
            <span>{parseFloat(collateralStr).toFixed(2)} MATIC</span>
          </div>
        </div>
        <button 
          onClick={handleQuickBuy} 
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-lg active:scale-95 group"
          type="button"
        >
          <Zap size={10} className="fill-current" /> BUY 1 MATIC
        </button>
      </motion.div>
    </Link>
  );
}

function LiveTicker() {
  const [events, setEvents] = useState<any[]>([]);
  
  // useWatchContractEvent her zaman çağrılmalı, conditional değil
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    eventName: 'Buy', 
    onLogs(logs: any) { 
      if (logs && logs[0]?.args) {
        const newEvent = { 
          type: 'BUY', 
          token: logs[0].args.token, 
          amount: parseFloat(formatEther(logs[0].args.amountMATIC as bigint)).toFixed(2), 
          buyer: logs[0].args.buyer 
        }; 
        setEvents(prev => [newEvent, ...prev].slice(0, 5)); 
      }
    }
  });
  
  return (
    <div className="w-full bg-[#FDDC11]/10 border-b border-[#FDDC11]/20 overflow-hidden py-2">
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {events.length === 0 ? (
          <span className="text-sm text-[#FDDC11] font-mono flex items-center gap-2">
            🚀 Live trades will appear here...
          </span>
        ) : (
          events.map((e, i) => (
            <span key={i} className="text-sm text-[#FDDC11] font-mono flex items-center gap-2">
              🟢 {e.buyer?.slice(0,4)}... bought {e.amount} MATIC
            </span>
          ))
        )}
      </div>
      <style jsx>{`
        .animate-marquee { 
          animation: marquee 20s linear infinite; 
        }
        @keyframes marquee { 
          0% { transform: translateX(100%); } 
          100% { transform: translateX(-100%); } 
        }
      `}</style>
    </div>
  );
}

// --- ANA SAYFA ---
export default function HomePage() {
  // CRITICAL FIX: IS MOUNTED CHECK
  const [isMounted, setIsMounted] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({ 
    name: "", 
    ticker: "", 
    desc: "", 
    twitter: "", 
    telegram: "", 
    website: "", 
    image: "" 
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook'lar conditional olmamalı, her zaman çağrılmalı
  const { data: allTokens } = useReadContract({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    functionName: "getAllTokens" 
  });
  
  const [orderedTokens, setOrderedTokens] = useState<string[]>([]);
  
  useEffect(() => { 
    setIsMounted(true); // Component yüklendiğinde true yap
    if (allTokens && Array.isArray(allTokens)) { 
      const tokens = (allTokens as string[]).filter(t => !HIDDEN_TOKENS.includes(t.toLowerCase())).reverse();
      setOrderedTokens(tokens);
    } 
  }, [allTokens]);

  const filteredTokens = orderedTokens.filter(tokenAddr => 
    tokenAddr.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // useWatchContractEvent her zaman çağrılmalı
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    eventName: 'TokenCreated', 
    onLogs(logs: any) { 
      if (logs && logs[0]?.args?.token) { 
        setOrderedTokens(prev => [logs[0].args.token, ...prev]); 
        toast.success("🚀 New token launched!"); 
      } 
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { 
      setPreviewUrl(URL.createObjectURL(file)); 
    }
  };

  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleCreate = async () => {
    if (!formData.name || !formData.ticker) { 
      toast.error("Name & Ticker required"); 
      return; 
    }
    try {
      writeContract({ 
        address: CONTRACT_ADDRESS, 
        abi: CONTRACT_ABI, 
        functionName: "createToken", 
        args: [
          formData.name, 
          formData.ticker, 
          formData.desc || "", 
          formData.twitter || "", 
          formData.telegram || "", 
          formData.website || "", 
          formData.image || ""
        ], 
        value: parseEther("0.1") 
      });
      toast.loading("Confirm in wallet...", { id: 'tx' });
    } catch (e) { 
      toast.error("Transaction failed"); 
      toast.dismiss('tx'); 
    }
  };

  useEffect(() => { 
    if (isConfirmed) {
      toast.dismiss('tx'); 
      toast.success("Token created!");
      setTimeout(() => { 
        setIsModalOpen(false); 
        setFormData({ 
          name: "", 
          ticker: "", 
          desc: "", 
          twitter: "", 
          telegram: "", 
          website: "", 
          image: "" 
        }); 
        setPreviewUrl(null); 
      }, 1000); 
    }
  }, [isConfirmed]);

  // EĞER SAYFA YÜKLENMEDİYSE HİÇBİR ŞEY GÖSTERME (ÇÖKMEYİ ENGELLER)
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center text-[#FDDC11] font-bold text-xl animate-pulse">
        Loading AION...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white font-sans relative overflow-hidden">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />
      
      {/* Background Floats */}
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#FDDC11]/10 blur-[100px] z-0 animate-pulse" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[100px] z-0 animate-pulse" />

      <header className="sticky top-0 z-40 bg-[#0a0e27]/90 backdrop-blur-xl border-b border-[#FDDC11]/10">
        <div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FDDC11] to-purple-600 rounded-xl flex items-center justify-center text-black font-black text-xl shadow-[0_0_20px_rgba(253,220,17,0.3)]">
              A
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#FDDC11] to-purple-500 bg-clip-text text-transparent">
                AION
              </div>
              <div className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                Meme Launchpad
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Link 
              href="/swipe" 
              className="hidden md:flex p-2.5 bg-[#FDDC11]/10 text-[#FDDC11] rounded-xl font-bold items-center gap-2 hover:bg-[#FDDC11]/20 transition-all border border-[#FDDC11]/20"
            >
              <Flame size={18}/> Tinder Mode
            </Link>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-gradient-to-r from-[#FDDC11] to-purple-600 text-black border-none px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all hover:scale-105 shadow-[0_0_20px_rgba(253,220,17,0.3)] flex items-center gap-2"
            >
              <Rocket size={18} /> LAUNCH
            </button>
            <div className="scale-90 origin-right">
              <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
            </div>
            <Link 
              href="/profile" 
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 group"
            >
              <UserIcon size={20} className="text-gray-400 group-hover:text-[#FDDC11] transition-colors" />
            </Link>
          </div>
        </div>
        <LiveTicker />
      </header>

      <main className="max-w-7xl mx-auto px-5 py-10 relative z-10">
        {orderedTokens.length > 1 && (
          <VersusBattle token1={orderedTokens[0]} token2={orderedTokens[1]} />
        )}

        <div className="mb-10 relative max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search tokens by address..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-[#0f1225] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white outline-none focus:border-[#FDDC11] transition-colors shadow-xl" 
          />
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide justify-center">
          {['Trending', 'New', 'Gainers', 'Volume'].map(t => (
            <button 
              key={t} 
              onClick={() => setActiveTab(t.toLowerCase())} 
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === t.toLowerCase() 
                  ? 'bg-gradient-to-r from-[#FDDC11] to-purple-600 text-black shadow-lg scale-105' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTokens.length > 0 ? (
            filteredTokens.map((addr) => (
              <DarkTokenCard key={addr} tokenAddress={addr as `0x${string}`} />
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-gray-500 text-xl font-bold">
              No tokens found yet. Be the first to launch! 🚀
            </div>
          )}
        </div>
      </main>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsModalOpen(false)} 
            className="absolute inset-0 bg-black/80 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="relative w-full max-w-md bg-[#0a0e27] rounded-3xl border border-[#FDDC11]/20 shadow-[0_0_50px_rgba(253,220,17,0.15)] overflow-hidden"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-[#FDDC11]/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FDDC11]/20 rounded-lg">
                  <Rocket size={24} className="text-[#FDDC11]" />
                </div>
                <span className="font-black text-xl tracking-tight">Launch Token</span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                    Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="Bitcoin" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-[#FDDC11] transition-colors font-bold" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                    Ticker
                  </label>
                  <input 
                    type="text" 
                    placeholder="BTC" 
                    maxLength={10} 
                    value={formData.ticker} 
                    onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})} 
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-[#FDDC11] transition-colors font-bold" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                  Description
                </label>
                <textarea 
                  placeholder="Tell us about your token..." 
                  value={formData.desc} 
                  onChange={(e) => setFormData({...formData, desc: e.target.value})} 
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none h-24 resize-none focus:border-[#FDDC11] transition-colors text-sm" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                  Image / Video URL
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full p-6 bg-white/5 border-2 border-dashed border-white/10 rounded-xl cursor-pointer text-center hover:border-[#FDDC11] hover:bg-[#FDDC11]/5 transition-all flex flex-col items-center gap-2 group"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*,video/*" 
                    className="hidden" 
                  />
                  {previewUrl ? (
                    <MediaRenderer src={previewUrl} className="w-24 h-24 object-cover rounded-xl shadow-lg" />
                  ) : (
                    <>
                      <div className="p-3 bg-white/5 rounded-full group-hover:bg-[#FDDC11]/20 transition-colors">
                        <Upload size={24} className="text-gray-400 group-hover:text-[#FDDC11]" />
                      </div>
                      <span className="text-xs text-gray-500 font-bold group-hover:text-[#FDDC11]">
                        Click to upload
                      </span>
                    </>
                  )}
                </div>
                <input 
                  type="text" 
                  placeholder="Or paste URL here..." 
                  value={formData.image} 
                  onChange={(e) => { 
                    setFormData({...formData, image: e.target.value}); 
                    setPreviewUrl(e.target.value); 
                  }} 
                  className="w-full mt-3 p-3 bg-white/5 border-none rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-[#FDDC11]" 
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="text" 
                  placeholder="Twitter" 
                  value={formData.twitter} 
                  onChange={(e) => setFormData({...formData, twitter: e.target.value})} 
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#FDDC11]" 
                />
                <input 
                  type="text" 
                  placeholder="Telegram" 
                  value={formData.telegram} 
                  onChange={(e) => setFormData({...formData, telegram: e.target.value})} 
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#FDDC11]" 
                />
                <input 
                  type="text" 
                  placeholder="Web" 
                  value={formData.website} 
                  onChange={(e) => setFormData({...formData, website: e.target.value})} 
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#FDDC11]" 
                />
              </div>
              <button 
                onClick={handleCreate} 
                disabled={isPending || isConfirming} 
                className="w-full p-4 bg-gradient-to-r from-[#FDDC11] to-orange-500 text-black rounded-xl font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:scale-100"
              >
                {isPending ? "CONFIRMING..." : isConfirming ? "DEPLOYING..." : "CREATE & LAUNCH (0.1 MATIC)"}
              </button>
              <div className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Cost: 0.1 MATIC • Instant Trading
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
