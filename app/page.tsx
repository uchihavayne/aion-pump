"use client";

import { useState, useEffect } from "react";
import { Rocket, X, Coins, Twitter, Send, Globe, TrendingUp, Users, Activity } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { motion } from "framer-motion";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent } from "wagmi"; 
import { parseEther, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import toast, { Toaster } from 'react-hot-toast';

const HIDDEN_TOKENS: string[] = [];
const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

function TokenCard({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const { data: salesData } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);

  return (
    <Link href={`/trade/${tokenAddress}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className="group relative p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md hover:border-[#FDDC11]/30 transition-all duration-300 cursor-pointer"
      >
        <div className="flex items-start gap-4 mb-4">
          <img 
            src={getTokenImage(tokenAddress)} 
            alt="token" 
            className="w-14 h-14 rounded-xl border border-white/20 object-cover"
          />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">{name?.toString() || "Token"}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-[#FDDC11] bg-[#FDDC11]/10 px-2 py-0.5 rounded-md border border-[#FDDC11]/20">
                {symbol?.toString() || "TKN"}
              </span>
              <span className="text-xs text-gray-400">Live</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="text-gray-400 font-medium">Progress</span>
              <span className="text-white font-semibold">{realProgress.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#FDDC11] to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${realProgress}%` }}
                transition={{ duration: 1.5 }}
              />
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <div>
              <div className="text-gray-400">Pool Value</div>
              <div className="text-white font-semibold">{parseFloat(collateral).toFixed(2)} MATIC</div>
            </div>
            <div className="text-right">
              <div className="text-gray-400">Holders</div>
              <div className="text-white font-semibold">{Math.floor(Math.random() * 500) + 50}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trending");
  const [formData, setFormData] = useState({ name: "", ticker: "", desc: "", twitter: "", telegram: "", website: "" });

  const { data: allTokens } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getAllTokens" });
  const [orderedTokens, setOrderedTokens] = useState<string[]>([]);
  
  useEffect(() => { 
    if (allTokens) { 
      const tokens = (allTokens as string[])
        .filter(t => !HIDDEN_TOKENS.includes(t.toLowerCase()))
        .reverse();
      setOrderedTokens(tokens);
    } 
  }, [allTokens]);

  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'TokenCreated', onLogs(logs: any) { 
    if (logs[0]?.args?.token) { 
      setOrderedTokens(prev => [logs[0].args.token, ...prev]); 
      toast.success("🚀 New token launched!"); 
    } 
  }});

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
        args: [formData.name, formData.ticker, formData.desc || "", formData.twitter || "", formData.telegram || "", formData.website || ""], 
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
        setFormData({ name: "", ticker: "", desc: "", twitter: "", telegram: "", website: "" }); 
      }, 1000); 
    }
  }, [isConfirmed]);

  useEffect(() => { setIsMounted(true); }, []);
  
  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #333' } }} />

      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -right-1/2 w-96 h-96 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(253, 220, 17, 0.3), transparent)',
            filter: 'blur(60px)'
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-black/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FDDC11] flex items-center justify-center font-black text-black text-sm">A</div>
            <div>
              <div className="text-lg font-black tracking-tight text-white">AION</div>
              <div className="text-[10px] text-gray-500 font-medium">Bonding Curves</div>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-3">
            <motion.button 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-[#FDDC11] hover:bg-[#ffe55c] text-black font-bold text-xs rounded-lg transition-all active:scale-95"
            >
              <Rocket className="inline mr-1.5" size={14} /> LAUNCH
            </motion.button>
            <div className="scale-90"><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16 relative z-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <h1 className="text-6xl sm:text-7xl font-black mb-4 text-white">
            Decentralized Token <span className="bg-gradient-to-r from-[#FDDC11] to-purple-400 bg-clip-text text-transparent">Launch</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Fair launch, instant liquidity. Create and trade tokens on bonding curves.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {[
            { label: 'Total Tokens', val: orderedTokens.length.toString(), icon: '🚀' },
            { label: '24h Volume', val: '$0', icon: '📊' },
            { label: 'Active Traders', val: '0', icon: '👥' },
            { label: 'Avg. ROI', val: '0%', icon: '📈' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -2 }}
              className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-xs text-gray-500 font-medium mb-1">{stat.label}</div>
              <div className="text-xl font-bold">{stat.val}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {['Trending', 'New', 'Gainers', 'Volume'].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t.toLowerCase())}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                activeTab === t.toLowerCase()
                  ? 'bg-[#FDDC11] text-black border-[#FDDC11]'
                  : 'border-white/10 text-gray-400 hover:border-white/20'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Grid */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orderedTokens.length > 0 ? (
            orderedTokens.map((addr) => <TokenCard key={addr} tokenAddress={addr as `0x${string}`} />)
          ) : (
            <div className="col-span-full text-center py-20 text-gray-500">
              No tokens yet. Be the first to launch! 🚀
            </div>
          )}
        </motion.div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-2xl border border-white/20 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Rocket size={20} className="text-[#FDDC11]" />
                <h2 className="text-xl font-black">Launch Token</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">Name</label>
                <input
                  type="text"
                  placeholder="Token Name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:border-[#FDDC11] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">Ticker</label>
                <input
                  type="text"
                  placeholder="SYMBOL"
                  maxLength={10}
                  value={formData.ticker}
                  onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:border-[#FDDC11] focus:outline-none transition-colors uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">Description</label>
                <textarea
                  placeholder="Tell us about your token..."
                  value={formData.desc}
                  onChange={(e) => setFormData({...formData, desc: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:border-[#FDDC11] focus:outline-none transition-colors h-24 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="Twitter" value={formData.twitter} onChange={(e) => setFormData({...formData, twitter: e.target.value})} className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 text-xs focus:border-[#FDDC11] focus:outline-none transition-colors" />
                <input type="text" placeholder="Telegram" value={formData.telegram} onChange={(e) => setFormData({...formData, telegram: e.target.value})} className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 text-xs focus:border-[#FDDC11] focus:outline-none transition-colors" />
                <input type="text" placeholder="Website" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 text-xs focus:border-[#FDDC11] focus:outline-none transition-colors" />
              </div>

              <button
                onClick={handleCreate}
                disabled={isPending || isConfirming}
                className="w-full py-3 bg-[#FDDC11] hover:bg-[#ffe55c] text-black font-black text-sm rounded-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isPending ? 'Confirming...' : isConfirming ? 'Deploying...' : 'CREATE & LAUNCH (0.1 MATIC)'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
