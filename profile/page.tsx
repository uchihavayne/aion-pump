"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Wallet, Star, TrendingUp, Coins } from "lucide-react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import Link from "next/link";
import { formatEther, erc20Abi } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"held" | "favorites">("held");
  const [heldTokens, setHeldTokens] = useState<any[]>([]);
  const [favTokens, setFavTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const publicClient = usePublicClient();
  const { data: allTokens } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getAllTokens" });

  useEffect(() => {
    const fetchData = async () => {
      if (!allTokens || !address || !publicClient) return;
      setLoading(true);

      const held: any[] = [];
      const favs: any[] = [];
      const localFavs = JSON.parse(localStorage.getItem("favorites") || "[]");

      for (const tokenAddr of (allTokens as string[])) {
        try {
          const balance = await publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [address] });
          
          if (balance > 0n || localFavs.includes(tokenAddr)) {
            const [name, symbol, salesData] = await Promise.all([
              publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: erc20Abi, functionName: "name" }),
              publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: erc20Abi, functionName: "symbol" }),
              publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddr as `0x${string}`] })
            ]);

            const tokenData = {
              address: tokenAddr,
              name,
              symbol,
              balance: formatEther(balance),
              isFav: localFavs.includes(tokenAddr),
              collateral: salesData ? formatEther(salesData[1] as bigint) : "0"
            };

            if (balance > 0n) held.push(tokenData);
            if (localFavs.includes(tokenAddr)) favs.push(tokenData);
          }
        } catch (e) {}
      }
      setHeldTokens(held);
      setFavTokens(favs);
      setLoading(false);
    };

    if (isConnected) fetchData();
  }, [allTokens, address, isConnected, publicClient]);

  if (!isConnected) return <div className="min-h-screen bg-[#0a0e27] text-white flex flex-col items-center justify-center gap-6"><h1 className="text-3xl font-black text-[#FDDC11]">Connect Wallet</h1><ConnectButton /><Link href="/" className="text-sm text-gray-500 hover:text-white mt-4 flex items-center gap-2"><ArrowLeft size={16}/> Back to Home</Link></div>;

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white font-sans">
      <header className="sticky top-0 z-40 bg-[#0a0e27]/90 backdrop-blur-md border-b border-white/5 p-4"><div className="max-w-5xl mx-auto flex justify-between items-center"><Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white"><ArrowLeft size={20} /><span className="font-bold">Back to Board</span></Link><ConnectButton showBalance={false} accountStatus="avatar" /></div></header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8"><div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FDDC11] to-[#9333ea] flex items-center justify-center shadow-[0_0_30px_rgba(253,220,17,0.3)]"><Wallet size={32} className="text-black" /></div><div><h1 className="text-3xl font-black">My Portfolio</h1><p className="text-gray-400">Track holdings & favorites</p></div></div>
        <div className="flex gap-4 mb-8 border-b border-white/10 pb-4"><button onClick={() => setActiveTab("held")} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${activeTab === "held" ? "bg-[#FDDC11] text-black" : "bg-white/5 text-gray-400"}`}><Coins size={16} /> Held ({heldTokens.length})</button><button onClick={() => setActiveTab("favorites")} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${activeTab === "favorites" ? "bg-[#FDDC11] text-black" : "bg-white/5 text-gray-400"}`}><Star size={16} /> Watchlist ({favTokens.length})</button></div>
        {loading ? <div className="text-center py-20 text-gray-500 animate-pulse">Loading data...</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{(activeTab === "held" ? heldTokens : favTokens).map((token: any) => (<Link href={`/trade/${token.address}`} key={token.address}><motion.div whileHover={{ y: -4 }} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-[#FDDC11]/50 cursor-pointer"><div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center font-bold">{token.symbol[0]}</div><div><div className="font-bold">{token.name}</div><div className="text-xs text-[#FDDC11]">{token.symbol}</div></div></div>{token.isFav && <Star size={16} className="fill-[#FDDC11] text-[#FDDC11]" />}</div><div className="flex justify-between items-end border-t border-white/5 pt-4"><div><div className="text-xs text-gray-500">BALANCE</div><div className="text-xl font-bold">{parseFloat(token.balance).toFixed(2)}</div></div><div className="text-right"><div className="text-xs text-gray-500">MCAP</div><div className="text-sm font-bold text-green-400">{(parseFloat(token.collateral) * 3200).toLocaleString()} $</div></div></div></motion.div></Link>))}</div>}
      </main>
    </div>
  );
}
