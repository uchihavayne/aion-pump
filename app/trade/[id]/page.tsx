"use client";

import { useState, use, useEffect } from "react";
// Icons
import { ArrowLeft, Twitter, Globe, Send, Copy, Coins, TrendingUp, MessageSquare, User, Activity, ChevronRight, ExternalLink, TrendingDown, Bell, Settings, MoreHorizontal } from "lucide-react";
// RainbowKit
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
// Wagmi
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount } from "wagmi"; 
import { parseEther, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
// Charts
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';

const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

// Initial Chart Data
const INITIAL_DATA = [
  { time: '10:00', open: 10, high: 12, low: 9, close: 11 },
  { time: '10:05', open: 11, high: 13, low: 10, close: 12 },
  { time: '10:10', open: 12, high: 14, low: 11, close: 13 },
  { time: '10:15', open: 13, high: 15, low: 12, close: 14 },
  { time: '10:20', open: 14, high: 16, low: 13, close: 15 },
];

// Candlestick Component
const Candlestick = (props: any) => {
  const { x, y, width, height, payload: { open, close }, yAxis } = props;
  if (!yAxis || !yAxis.scale) return null;
  
  const isGrowing = close > open;
  const color = isGrowing ? '#34C759' : '#FF3B30';
  const scale = yAxis.scale;
  const openY = scale(open);
  const closeY = scale(close);
  const bodyHeight = Math.abs(openY - closeY);
  const bodyY = Math.min(openY, closeY);

  return (
    <g stroke={color} fill={color} strokeWidth="1.5">
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} />
      <rect x={x + width * 0.1} y={bodyY} width={width * 0.8} height={Math.max(bodyHeight, 1)} fill={color} />
    </g>
  );
};

export default function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tokenAddress = id as `0x${string}`;

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat">("trades");
  const [amount, setAmount] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  
  // Live Data
  const [chartData, setChartData] = useState(INITIAL_DATA);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");

  // Contract
  const { isConnected, address } = useAccount();
  const { data: salesData, refetch } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 800000000000000000000000000n);
  const realProgress = progress > 100 ? 100 : progress;
  const currentPrice = chartData[chartData.length - 1].close;

  // --- LIVE EVENT LISTENERS ---
  
  // 1. BUY EVENT
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', 
    onLogs(logs: any) { 
       const log = logs[0];
       handleLiveUpdate("BUY", log.args.user || "0x...", log.args.amount || amount || "0.1");
    } 
  });

  // 2. SELL EVENT
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', 
    onLogs(logs: any) { 
       const log = logs[0];
       handleLiveUpdate("SELL", log.args.user || "0x...", log.args.amount || amount || "0.1");
    } 
  });

  // Common Update Function
  const handleLiveUpdate = (type: "BUY" | "SELL", user: string, amountStr: string) => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // 1. Update Chart
      setChartData(prev => {
          const last = prev[prev.length - 1];
          const impact = Math.max(parseFloat(amountStr || "0") * 10, 2); 
          const direction = type === "BUY" ? 1 : -1;
          const newClose = last.close + (direction * impact);
          
          const newCandle = {
              time: now,
              open: last.close,
              high: Math.max(last.close, newClose) + 1,
              low: Math.min(last.close, newClose) - 1,
              close: newClose
          };
          
          return [...prev.slice(-19), newCandle];
      });

      // 2. Update Trade History
      setTradeHistory(prev => [{
          user: user,
          type: type,
          amount: amountStr ? parseFloat(amountStr).toFixed(4) : "0.00",
          time: now,
          hash: Math.random().toString(36).substring(7)
      }, ...prev]);

      refetch(); // Refresh contract data
  };

  // --- TRANSACTION ---
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleTx = () => {
    if (!amount) { toast.error("Enter amount"); return; }
    try {
        writeContract({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: activeTab === "buy" ? "buy" : "sell",
            args: activeTab === "buy" ? [tokenAddress] : [tokenAddress, parseEther(amount)],
            value: activeTab === "buy" ? parseEther(amount) : undefined,
        });
        toast.loading("Confirming...", { id: 'tx' });
    } catch(e) { toast.error("Failed"); toast.dismiss('tx'); }
  };

  useEffect(() => { 
      if (isConfirmed) { 
          toast.dismiss('tx');
          toast.success("Transaction Success!");
          handleLiveUpdate(activeTab === "buy" ? "BUY" : "SELL", address || "You", amount);
          setAmount("");
      }
  }, [isConfirmed]);

  // Comment Handling
  const handleComment = () => {
      if(!commentInput) return;
      setComments(prev => [{ user: "You", text: commentInput, time: "Just now" }, ...prev]);
      setCommentInput("");
  };

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return <div className="min-h-screen bg-gradient-to-br from-[#0a0319] to-[#1a0b2e]"/>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0319] to-[#1a0b2e] text-white font-sans antialiased">
      <Toaster position="top-right" toastOptions={{ 
        style: { 
          background: 'rgba(24, 26, 32, 0.95)', 
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        } 
      }} />
      
      {/* HEADER - Modern with brand colors */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#0a0319]/95 to-[#1a0b2e]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-[#FDDC11] transition-colors shadow-lg">
                    <ArrowLeft size={18} className="text-white group-hover:text-[#FDDC11] transition-colors" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">Back to Board</span>
                    <span className="text-xs text-gray-400">Explore more tokens</span>
                </div>
            </Link>
            
            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#2d1b4e] to-[#3e2465] rounded-2xl border border-white/10 shadow-lg">
                    <div className="w-2 h-2 bg-[#34C759] rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-gray-300 font-mono">
                        {tokenAddress.slice(0,6)}...{tokenAddress.slice(-4)}
                    </span>
                    <button 
                        onClick={() => {navigator.clipboard.writeText(tokenAddress); toast.success("Address copied!")}}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Copy size={12} className="text-gray-400 hover:text-[#FDDC11]" />
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <button className="w-10 h-10 bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-2xl flex items-center justify-center border border-white/10 hover:border-[#FDDC11] transition-colors">
                        <Bell size={18} className="text-white" />
                    </button>
                    <button className="w-10 h-10 bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-2xl flex items-center justify-center border border-white/10 hover:border-[#FDDC11] transition-colors">
                        <Settings size={18} className="text-white" />
                    </button>
                    <div className="scale-90">
                        <ConnectButton 
                            showBalance={false} 
                            accountStatus="avatar" 
                            chainStatus="none"
                            label="Connect"
                        />
                    </div>
                </div>
            </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- LEFT COLUMN (Info, Chart, Trades, Comments) --- */}
        <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* TOKEN INFO - Modern Card */}
            <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 bg-gradient-to-br from-[#FDDC11] to-orange-500 rounded-[28px] overflow-hidden shadow-2xl border-2 border-white/20">
                            <img src={getTokenImage(tokenAddress)} className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-[#FDDC11] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
                            <Activity size={16} className="text-black" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                            <h1 className="text-3xl font-semibold text-white">
                                {name?.toString() || "Loading..."}
                            </h1>
                            <span className="px-4 py-1.5 bg-[#FDDC11]/20 rounded-full text-sm font-medium text-[#FDDC11] border border-[#FDDC11]/30">
                                {symbol?.toString() || "TKR"}
                            </span>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#34C759]/20 rounded-full border border-[#34C759]/30">
                                <div className="w-2 h-2 bg-[#34C759] rounded-full animate-pulse"></div>
                                <span className="text-sm font-medium text-[#34C759]">Live</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                <SocialIcon icon={<Twitter size={18} />} />
                                <SocialIcon icon={<Send size={18} />} />
                                <SocialIcon icon={<Globe size={18} />} />
                            </div>
                            <div className="h-6 w-px bg-white/10"></div>
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 rounded-2xl text-sm font-medium text-white transition-colors border border-white/10 hover:border-[#FDDC11] hover:text-[#FDDC11]">
                                <ExternalLink size={16} />
                                View Explorer
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CHART - Brand Color Style */}
            <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <div className="text-sm text-gray-400 mb-1">Current Price</div>
                        <div className="flex items-baseline gap-4">
                            <div className="text-4xl font-semibold text-white">${currentPrice.toFixed(4)}</div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#34C759]/20 rounded-full border border-[#34C759]/30">
                                <TrendingUp size={14} className="text-[#34C759]" />
                                <span className="text-sm font-medium text-[#34C759]">+2.4%</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <StatItem label="Market Cap" value={`$${(parseFloat(collateral) * 3200).toLocaleString()}`} color="text-white" />
                        <StatItem label="24H Volume" value={`$${(parseFloat(collateral) * 850).toLocaleString()}`} color="text-gray-300" />
                        <StatItem label="Liquidity" value={`${parseFloat(collateral).toFixed(2)} MATIC`} color="text-[#FDDC11]" />
                    </div>
                </div>
                <div className="w-full h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <XAxis 
                                dataKey="time" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickMargin={12}
                            />
                            <YAxis 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickMargin={12}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(24, 26, 32, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    backdropFilter: 'blur(20px)',
                                    padding: '12px 16px',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                                }}
                                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                            />
                            <Bar 
                                dataKey="close" 
                                shape={<Candlestick />}
                                radius={[6, 6, 0, 0]}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={entry.close > entry.open ? '#34C759' : '#FF3B30'}
                                        opacity={0.9}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* TABS (TRADES & CHAT) - Brand Colors */}
            <div className="flex flex-col gap-6">
                <div className="flex gap-1 bg-gradient-to-r from-[#2d1b4e] to-[#3e2465] p-1.5 rounded-2xl border border-white/10 w-fit">
                    <TabButton 
                        active={bottomTab === "trades"} 
                        onClick={() => setBottomTab("trades")} 
                        label="Recent Trades" 
                        icon={<TrendingUp size={18}/>} 
                        count={tradeHistory.length}
                    />
                    <TabButton 
                        active={bottomTab === "chat"} 
                        onClick={() => setBottomTab("chat")} 
                        label="Live Chat" 
                        icon={<MessageSquare size={18}/>} 
                        count={comments.length}
                    />
                </div>

                <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-6">
                        {bottomTab === "trades" ? (
                            <div className="space-y-1">
                                <div className="grid grid-cols-4 text-xs font-medium text-gray-400 uppercase px-4 pb-4 border-b border-white/10">
                                    <div>User</div>
                                    <div>Type</div>
                                    <div>Amount</div>
                                    <div className="text-right">Time</div>
                                </div>
                                <div className="max-h-[320px] overflow-y-auto">
                                    {tradeHistory.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                                                <Activity size={24} className="text-gray-500" />
                                            </div>
                                            <div className="text-sm text-gray-500">No trades yet. Be the first!</div>
                                        </div>
                                    ) : (
                                        tradeHistory.map((trade, i) => (
                                            <div 
                                                key={i} 
                                                className="grid grid-cols-4 text-sm py-4 px-4 hover:bg-white/5 rounded-2xl transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                                                        <User size={16} className="text-white" />
                                                    </div>
                                                    <div className="font-medium text-gray-300">
                                                        {trade.user.slice(0,8)}...
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${trade.type === "BUY" ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30' : 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30'}`}>
                                                        {trade.type}
                                                    </span>
                                                </div>
                                                <div className="font-semibold text-white">{trade.amount} MATIC</div>
                                                <div className="text-right text-gray-400 text-sm">{trade.time}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
                                    {comments.length === 0 && (
                                        <div className="text-center py-16">
                                            <MessageSquare size={48} className="mx-auto mb-4 text-gray-600" />
                                            <div className="text-sm text-gray-500">Start the conversation</div>
                                        </div>
                                    )}
                                    {comments.map((c, i) => (
                                        <div key={i} className="flex gap-4 p-4 hover:bg-white/5 rounded-2xl transition-colors">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FDDC11] to-orange-500 flex items-center justify-center">
                                                <User size={20} className="text-black" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex gap-2 items-center mb-2">
                                                    <span className="text-sm font-semibold text-white">{c.user}</span>
                                                    <span className="text-xs text-gray-500">•</span>
                                                    <span className="text-xs text-gray-500">{c.time}</span>
                                                    {c.user === "You" && (
                                                        <span className="px-2 py-0.5 bg-[#FDDC11]/20 text-[#FDDC11] text-xs font-medium rounded-full">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-300">{c.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            value={commentInput}
                                            onChange={(e) => setCommentInput(e.target.value)}
                                            placeholder="Type your message..." 
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-[#FDDC11] transition-colors placeholder:text-gray-500"
                                            onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleComment}
                                        disabled={!commentInput.trim()}
                                        className="px-6 py-3.5 bg-gradient-to-r from-[#FDDC11] to-orange-500 text-black rounded-2xl font-medium hover:from-[#ffe55c] hover:to-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-[#FDDC11] disabled:hover:to-orange-500 flex items-center gap-2 shadow-lg"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* --- RIGHT COLUMN (TRADE PANEL) - Modern Design --- */}
        <div className="lg:col-span-4 space-y-6">
            
            {/* TRADE CARD - Modern Design */}
            <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-3xl border border-white/10 shadow-2xl sticky top-24 overflow-hidden">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-semibold text-white">
                            Trade Token
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <div className="w-2 h-2 bg-[#34C759] rounded-full animate-pulse"></div>
                            Real-time
                        </div>
                    </div>

                    {/* TAB BUTTONS - Segmented Control */}
                    <div className="flex bg-white/5 p-1.5 rounded-2xl mb-8 border border-white/10">
                        <button 
                            onClick={() => setActiveTab("buy")} 
                            className={`flex-1 py-4 rounded-xl text-base font-medium transition-all duration-200 ${
                                activeTab === "buy" 
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg" 
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            Buy
                        </button>
                        <button 
                            onClick={() => setActiveTab("sell")} 
                            className={`flex-1 py-4 rounded-xl text-base font-medium transition-all duration-200 ${
                                activeTab === "sell" 
                                ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg" 
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            Sell
                        </button>
                    </div>

                    {/* INPUT SECTION */}
                    <div className="space-y-6">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex justify-between text-sm font-medium text-gray-400 mb-4">
                                <span>Amount to {activeTab}</span>
                                <span>Balance: <span className="text-white">0.00 {activeTab === "buy" ? "MATIC" : symbol}</span></span>
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <input 
                                    type="number" 
                                    placeholder="0.0" 
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-transparent text-5xl font-semibold text-white outline-none placeholder:text-gray-600"
                                />
                                <div className="flex items-center gap-2 px-5 py-3 bg-white/10 rounded-2xl border border-white/10">
                                    <Coins size={20} className="text-[#FDDC11]" />
                                    <span className="font-semibold text-white">{activeTab === "buy" ? "MATIC" : symbol}</span>
                                </div>
                            </div>
                            <div className="text-sm text-gray-400">
                                ≈ ${amount ? (parseFloat(amount) * currentPrice).toFixed(2) : "0.00"}
                            </div>
                        </div>

                        {/* QUICK AMOUNT BUTTONS */}
                        <div className="grid grid-cols-4 gap-3">
                            {["Reset", "1", "5", "10"].map((v, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setAmount(i === 0 ? "" : v)}
                                    className="py-3.5 bg-white/5 border border-white/10 hover:border-[#FDDC11] hover:text-[#FDDC11] rounded-2xl text-sm font-medium text-gray-300 hover:text-white transition-all duration-200 active:scale-95"
                                >
                                    {i === 0 ? v : `${v} MATIC`}
                                </button>
                            ))}
                        </div>

                        {/* MAIN ACTION BUTTON */}
                        <button 
                            onClick={handleTx}
                            disabled={isPending || !isConnected || !amount}
                            className={`w-full py-5 rounded-2xl text-base font-semibold transition-all duration-200 active:scale-[0.98] ${
                                activeTab === "buy"
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg"
                                : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg"
                            } disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed`}
                        >
                            {isPending ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Processing...
                                </div>
                            ) : !isConnected ? (
                                "Connect Wallet to Trade"
                            ) : (
                                `${activeTab === "buy" ? "BUY" : "SELL"} ${symbol || "TOKEN"}`
                            )}
                        </button>
                    </div>

                    {/* BONDING CURVE */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-sm font-medium text-white">Bonding Curve</div>
                            <div className="text-lg font-semibold text-[#FDDC11]">{realProgress.toFixed(1)}%</div>
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-[#FDDC11] via-orange-500 to-purple-600 rounded-full transition-all duration-1000"
                                style={{ width: `${realProgress}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* STATS CARDS */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-2xl p-5 border border-white/10 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#34C759]/20 flex items-center justify-center border border-[#34C759]/30">
                            <TrendingUp size={20} className="text-[#34C759]" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-400">Market Cap</div>
                            <div className="text-lg font-semibold text-white">
                                ${(parseFloat(collateral) * 3200).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-2xl p-5 border border-white/10 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#FDDC11]/20 flex items-center justify-center border border-[#FDDC11]/30">
                            <Coins size={20} className="text-[#FDDC11]" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-400">Collateral</div>
                            <div className="text-lg font-semibold text-white">
                                {parseFloat(collateral).toFixed(2)} MATIC
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MORE STATS */}
            <div className="bg-gradient-to-br from-[#2d1b4e] to-[#3e2465] rounded-2xl p-5 border border-white/10 shadow-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Token Statistics</h3>
                <div className="space-y-3">
                    <InfoRow label="Total Supply" value="1,000,000,000" />
                    <InfoRow label="Tokens Sold" value={tokensSold.toString()} />
                    <InfoRow label="24H Trades" value={tradeHistory.length.toString()} />
                    <InfoRow label="Active Traders" value={(new Set(tradeHistory.map(t => t.user))).size.toString()} />
                </div>
            </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>© 2024 TradeBoard. All rights reserved.</div>
            <div className="flex items-center gap-6">
              <button className="hover:text-[#FDDC11] transition-colors">Privacy</button>
              <button className="hover:text-[#FDDC11] transition-colors">Terms</button>
              <button className="hover:text-[#FDDC11] transition-colors">Help</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- SUB COMPONENTS ---

function SocialIcon({ icon }: { icon: any }) {
    return (
        <button className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 hover:border-[#FDDC11] hover:text-[#FDDC11] transition-colors text-gray-400">
            {icon}
        </button>
    );
}

function StatItem({ label, value, color }: any) {
    return (
        <div>
            <div className="text-xs text-gray-400">{label}</div>
            <div className={`text-lg font-semibold ${color}`}>{value}</div>
        </div>
    );
}

function TabButton({ active, onClick, label, icon, count }: any) {
    return (
        <button 
            onClick={onClick}
            className={`px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                active 
                ? "bg-gradient-to-r from-[#FDDC11]/20 to-orange-500/20 text-white border border-[#FDDC11]/30" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {icon}
            {label}
            {count > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${active ? 'bg-[#FDDC11] text-black' : 'bg-white/10 text-gray-400'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function InfoRow({ label, value }: any) {
    return (
        <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-400">{label}</span>
            <span className="text-sm font-medium text-white">{value}</span>
        </div>
    );
}