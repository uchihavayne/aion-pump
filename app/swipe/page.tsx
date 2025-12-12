"use client";

import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { X, Zap, ArrowLeft, Heart, Info } from "lucide-react";
import Link from "next/link";
import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { parseEther, formatEther, erc20Abi } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast, { Toaster } from "react-hot-toast";

const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

export default function SwipePage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { address } = useAccount();
  const { writeContract } = useWriteContract();

  // Load Tokens
  const { data: allTokens } = useReadContract({
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getAllTokens",
  });

  useEffect(() => {
    if (allTokens) {
      // Reverse to show newest first
      setTokens([...(allTokens as string[])].reverse());
    }
  }, [allTokens]);

  const currentToken = tokens[currentIndex];

  // Quick Buy Logic (Swipe Right)
  const handleSwipeRight = () => {
    if (!currentToken) return;
    try {
        writeContract({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "buy",
            args: [currentToken], value: parseEther("1") // 1 MATIC Buy
        });
        toast.success("Buying 1 MATIC! 🚀");
    } catch (e) { toast.error("Buy failed"); }
    setTimeout(() => setCurrentIndex(prev => prev + 1), 200);
  };

  const handleSwipeLeft = () => {
    setCurrentIndex(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white flex flex-col items-center justify-center overflow-hidden relative">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/" className="p-3 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20 transition-colors">
            <ArrowLeft size={24} />
        </Link>
      </div>
      <div className="absolute top-4 right-4 z-50 scale-75 origin-top-right">
          <ConnectButton showBalance={false} />
      </div>

      <div className="text-center mb-6 z-10">
          <h1 className="text-3xl font-black italic tracking-tighter text-[#FDDC11]">TOKEN SWIPER</h1>
          <p className="text-xs text-gray-400">Right: Buy 1 MATIC • Left: Skip</p>
      </div>

      {/* Cards Area */}
      <div className="relative w-full max-w-sm h-[500px] flex items-center justify-center">
        <AnimatePresence>
          {currentToken ? (
            <Card 
                key={currentToken} 
                tokenAddress={currentToken} 
                onSwipeRight={handleSwipeRight} 
                onSwipeLeft={handleSwipeLeft} 
            />
          ) : (
            <div className="text-center text-gray-500">
                <p>No more tokens to swipe!</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-[#FDDC11] text-black rounded-xl font-bold">Refresh</button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons (Mobile Friendly) */}
      <div className="flex gap-8 mt-8 z-10">
          <button onClick={handleSwipeLeft} className="w-16 h-16 rounded-full bg-[#1a0e2e] border-2 border-red-500 text-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:scale-110 transition-transform">
              <X size={32} strokeWidth={3} />
          </button>
          <Link href={`/trade/${currentToken}`} className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 mt-2">
              <Info size={20} />
          </Link>
          <button onClick={handleSwipeRight} className="w-16 h-16 rounded-full bg-[#1a0e2e] border-2 border-green-500 text-green-500 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-110 transition-transform">
              <Zap size={32} strokeWidth={3} fill="currentColor" />
          </button>
      </div>
    </div>
  );
}

// Single Card Component
function Card({ tokenAddress, onSwipeRight, onSwipeLeft }: any) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
    
    // Fetch Token Data
    const publicClient = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "name" });
    const symbolClient = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" });
    
    const handleDragEnd = (event: any, info: any) => {
        if (info.offset.x > 100) onSwipeRight();
        else if (info.offset.x < -100) onSwipeLeft();
    };

    return (
        <motion.div
            style={{ x, rotate, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            className="absolute top-0 w-[90%] h-full bg-[#1a0e2e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ x: x.get() < 0 ? -200 : 200, opacity: 0, transition: { duration: 0.2 } }}
        >
            <div className="h-[70%] bg-black relative">
                <img src={getTokenImage(tokenAddress)} className="w-full h-full object-cover pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a0e2e] to-transparent opacity-90" />
                <div className="absolute bottom-4 left-4">
                    <h2 className="text-3xl font-black text-white">{publicClient.data?.toString()}</h2>
                    <p className="text-xl font-bold text-[#FDDC11]">{symbolClient.data?.toString()}</p>
                </div>
            </div>
            <div className="h-[30%] p-6 flex flex-col justify-between">
                <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>Quick Buy Price</span>
                    <span className="text-white font-bold">1 MATIC</span>
                </div>
                <div className="text-xs text-gray-500 text-center">
                    Swipe Right to APE IN 🦍 • Swipe Left to SKIP
                </div>
            </div>
            
            {/* Overlay Indicators */}
            <motion.div style={{ opacity: useTransform(x, [0, 100], [0, 1]) }} className="absolute top-8 left-8 border-4 border-green-500 text-green-500 text-2xl font-black px-4 py-2 rounded transform -rotate-12 bg-black/50">APE IN</motion.div>
            <motion.div style={{ opacity: useTransform(x, [0, -100], [0, 1]) }} className="absolute top-8 right-8 border-4 border-red-500 text-red-500 text-2xl font-black px-4 py-2 rounded transform rotate-12 bg-black/50">NOPE</motion.div>
        </motion.div>
    )
}
