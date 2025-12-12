"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Wallet, Star, TrendingUp, Coins, Copy } from "lucide-react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import Link from "next/link";
import { formatEther, erc20Abi } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast, { Toaster } from 'react-hot-toast';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"held" | "favorites">("held");
  const [heldTokens, setHeldTokens] = useState<any[]>([]);
  const [favTokens, setFavTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const publicClient = usePublicClient();
  const { data: allTokens } = useReadContract({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    functionName: "getAllTokens" 
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!allTokens || !address || !publicClient) return;
      setLoading(true);

      const held: any[] = [];
      const favs: any[] = [];
      const localFavs = JSON.parse(localStorage.getItem("favorites") || "[]");

      for (const tokenAddr of (allTokens as string[])) {
        try {
          const balance = await publicClient.readContract({ 
            address: tokenAddr as `0x${string}`, 
            abi: erc20Abi, 
            functionName: "balanceOf", 
            args: [address] 
          });
          
          if (balance > 0n || localFavs.includes(tokenAddr)) {
            const [name, symbol, salesData] = await Promise.all([
              publicClient.readContract({ 
                address: tokenAddr as `0x${string}`, 
                abi: erc20Abi, 
                functionName: "name" 
              }),
              publicClient.readContract({ 
                address: tokenAddr as `0x${string}`, 
                abi: erc20Abi, 
                functionName: "symbol" 
              }),
              publicClient.readContract({ 
                address: CONTRACT_ADDRESS, 
                abi: CONTRACT_ABI, 
                functionName: "sales", 
                args: [tokenAddr as `0x${string}`] 
              })
            ]);

            const tokenData = {
              address: tokenAddr,
              name,
              symbol,
              balance: formatEther(balance as bigint),
              isFav: localFavs.includes(tokenAddr),
              collateral: salesData ? formatEther((salesData as any)[1]) : "0"
            };

            if (balance > 0n) held.push(tokenData);
            if (localFavs.includes(tokenAddr)) favs.push(tokenData);
          }
        } catch (e) {
          console.error("Error fetching token:", e);
        }
      }
      setHeldTokens(held);
      setFavTokens(favs);
      setLoading(false);
    };

    if (isConnected) fetchData();
  }, [allTokens, address, isConnected, publicClient]);

  if (!isMounted) {
    return <div className="min-h-screen bg-[#0a0e27]" />;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] to-[#1a0a2e] text-white font-sans" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
        <Toaster position="top-right" />
        
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
              <span className="font-bold text-sm">Back</span>
            </Link>
            <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
          </div>
        </header>

        <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-6 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FDDC11] to-purple-600 flex items-center justify-center mx-auto mb-6" style={{ boxShadow: '0 0 30px rgba(253, 220, 17, 0.3)' }}>
              <Wallet size={40} className="text-black" />
            </div>
            <h1 className="text-4xl font-black mb-2">Connect Wallet</h1>
            <p className="text-gray-400 mb-8">Start trading tokens on Polygon</p>
            <div style={{ transform: 'scale(1.1)' }}>
              <ConnectButton />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const totalValue = heldTokens.reduce((sum, t) => sum + parseFloat(t.collateral) * 3200, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] to-[#1a0a2e] text-white font-sans" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="font-bold text-sm">Back to Board</span>
          </Link>
          <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-8 mb-8 backdrop-blur-md">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#FDDC11] to-purple-600 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 30px rgba(253, 220, 17, 0.3)' }}>
                <Wallet size={50} className="text-black" />
              </div>
              <div>
                <h1 className="text-4xl font-black mb-2">My Portfolio</h1>
                <p className="text-gray-400 mb-4">Track your holdings and watchlist</p>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 w-fit">
                  <span className="text-sm font-mono text-[#FDDC11]">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  <Copy 
                    size={14} 
                    className="text-gray-400 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(address || '');
                      toast.success("Copied!");
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/10">
            <div>
              <div className="text-xs text-gray-400 font-semibold mb-2 uppercase">Portfolio Value</div>
              <div className="text-3xl font-black text-[#FDDC11]">${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-semibold mb-2 uppercase">Holdings</div>
              <div className="text-3xl font-black">{heldTokens.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-semibold mb-2 uppercase">Watchlist</div>
              <div className="text-3xl font-black">{favTokens.length}</div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-4 mb-8 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab("held")}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all ${
              activeTab === "held" 
                ? "text-[#FDDC11] border-b-2 border-[#FDDC11]" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Coins size={16} />
            Holdings ({heldTokens.length})
          </button>
          <button 
            onClick={() => setActiveTab("favorites")}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all ${
              activeTab === "favorites" 
                ? "text-[#FDDC11] border-b-2 border-[#FDDC11]" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Star size={16} />
            Watchlist ({favTokens.length})
          </button>
        </motion.div>

        {/* Token Grid */}
        {loading ? (
          <div className="text-center py-20">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
              <div className="text-gray-400">Loading your data...</div>
            </motion.div>
          </div>
        ) : (activeTab === "held" ? heldTokens : favTokens).length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
            <Star size={48} className="mx-auto mb-4 text-gray-500 opacity-50" />
            <p className="text-gray-400">
              {activeTab === "held" ? "You don't hold any tokens yet" : "Your watchlist is empty"}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeTab === "held" ? heldTokens : favTokens).map((token: any, idx) => (
              <Link href={`/trade/${token.address}`} key={token.address}>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -8 }}
                  className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 cursor-pointer transition-all hover:border-[#FDDC11]/50 backdrop-blur-md h-full flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FDDC11] to-purple-600 flex items-center justify-center font-bold text-black text-lg">
                        {token.symbol[0]}
                      </div>
                      <div>
                        <div className="font-bold text-lg">{token.name}</div>
                        <div className="text-xs text-[#FDDC11] font-bold">{token.symbol}</div>
                      </div>
                    </div>
                    {token.isFav && <Star size={18} className="text-[#FDDC11] fill-[#FDDC11]" />}
                  </div>

                  {/* Balance */}
                  <div className="flex-1 mb-6">
                    <div className="text-xs text-gray-400 font-semibold mb-2 uppercase">Balance</div>
                    <div className="text-2xl font-black">
                      {parseFloat(token.balance) > 0.01 ? parseFloat(token.balance).toFixed(2) : parseFloat(token.balance).toFixed(6)}
                    </div>
                  </div>

                  {/* Footer Stats */}
                  <div className="flex justify-between pt-6 border-t border-white/10">
                    <div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Market Cap</div>
                      <div className="text-sm font-bold text-green-400">
                        ${(parseFloat(token.collateral) * 3200).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Your Share</div>
                      <div className="text-sm font-bold text-[#FDDC11]">
                        {((parseFloat(token.balance) / 1_000_000_000) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
