"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Twitter, Globe, Send, Copy, TrendingUp, MessageSquare, 
  User, ExternalLink, Coins, Users, Settings, Share2, Star, 
  Shield, AlertTriangle, Info, Gift, Zap, ImageIcon, Download, 
  Crosshair, Lock, Bell, Monitor, Ticket, Flame, Pin, Trophy, Eye, LayoutGrid, X, RefreshCw
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient, useBalance, useSendTransaction } from "wagmi"; 
import { parseEther, formatEther, erc20Abi, maxUint256 } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from "framer-motion";
import Confetti from 'react-confetti';

// --- STYLES ---
const styles = `
  @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
  .shake-screen { animation: shake 0.5s; animation-iteration-count: 1; }
`;

// --- HELPERS ---
const getTokenImage = (address: string) => 
  `https://api.dicebear.com/7.x/identicon/svg?seed=${address}&backgroundColor=transparent`;

const MediaRenderer = ({ src, className }: { src: string, className: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className={`${className} bg-gray-800 animate-pulse`} />;
    return <img src={src || getTokenImage("default")} className={className} alt="token" onError={(e) => { (e.target as HTMLImageElement).src = getTokenImage("default"); }} />;
};

const formatTokenAmount = (num: number) => { 
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M"; 
    if (num >= 1000) return (num / 1000).toFixed(2) + "k"; 
    return num.toFixed(2); 
};

// --- CHART COMPONENT ---
const CustomCandle = (props: any) => { 
    const { x, y, width, height, fill } = props; 
    return <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={fill} rx={2} />; 
};

// --- COMPONENTS ---
const PnLCard = ({ balance, price, symbol }: { balance: string, price: number, symbol: string }) => {
    const bal = parseFloat(balance);
    const value = bal * price;
    const entryPrice = price * 0.8; 
    const pnl = (price - entryPrice) * bal;
    const pnlPercent = ((price - entryPrice) / entryPrice) * 100;
    return (
        <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl p-4 mb-4">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Your Position ({symbol})</div>
            <div className="flex justify-between items-end">
                <div><div className="text-2xl font-black text-white">${value.toFixed(2)}</div><div className="text-xs text-gray-500">{formatTokenAmount(bal)} {symbol}</div></div>
                <div className={`text-right font-bold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}><div className="text-lg">{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} MATIC</div><div className="text-xs">{pnlPercent.toFixed(2)}%</div></div>
            </div>
        </div>
    );
};

const ChatBox = ({ tokenAddress }: { tokenAddress: string }) => {
    const { address } = useAccount();
    const [msgs, setMsgs] = useState<any[]>([]);
    const [input, setInput] = useState("");
    const [isClient, setIsClient] = useState(false);

    useEffect(() => { 
        setIsClient(true);
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(`chat_${tokenAddress}`); 
                if(saved) setMsgs(JSON.parse(saved)); 
            } catch(e) {}
        }
    }, [tokenAddress]);

    const sendMsg = () => { 
        if(!input.trim()) return; 
        const newMsg = { user: address ? `User ${address.slice(2,6)}` : "Anon", text: input, time: new Date().toLocaleTimeString() }; 
        const updated = [...msgs, newMsg]; 
        setMsgs(updated); 
        localStorage.setItem(`chat_${tokenAddress}`, JSON.stringify(updated)); 
        setInput(""); 
    };

    if (!isClient) return <div className="h-[300px] flex items-center justify-center text-gray-500">Loading...</div>;
    
    return (
        <div className="flex flex-col h-[300px]">
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {msgs.map((m, i) => (<div key={i} className="p-2 rounded-lg bg-white/5 text-xs"><div className="flex justify-between mb-1"><span className="text-[#FDDC11] font-bold">{m.user}</span><span className="text-gray-500">{m.time}</span></div><p className="text-gray-300">{m.text}</p></div>))}
            </div>
            <div className="flex gap-2"><input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMsg()} className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FDDC11]" /><button onClick={sendMsg} className="bg-[#FDDC11] text-black p-2 rounded-lg"><Send size={14}/></button></div>
        </div>
    );
};

// --- MAIN PAGE ---
export default function TradePage({ params }: { params: { id: string } }) {
  const tokenAddress = params.id as `0x${string}`;
  const publicClient = usePublicClient(); 
  const { isConnected, address } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  // STATES
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat" | "holders">("trades");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(5);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // DATA - CLIENT SIDE FIRST
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [holderList, setHolderList] = useState<any[]>([]);
  
  // INIT LOAD FROM LOCAL STORAGE (The "Memory" Fix)
  useEffect(() => {
      setIsMounted(true);
      if(typeof window !== 'undefined') {
          try {
              const savedTrades = localStorage.getItem(`trades_v2_${tokenAddress}`);
              if(savedTrades) setTradeHistory(JSON.parse(savedTrades));
              
              const savedChart = localStorage.getItem(`chart_v2_${tokenAddress}`);
              if(savedChart) setChartData(JSON.parse(savedChart));

              const savedHolders = localStorage.getItem(`holders_v2_${tokenAddress}`);
              if(savedHolders) setHolderList(JSON.parse(savedHolders));
          } catch(e) {}
      }
  }, [tokenAddress]);

  // CONTRACT READS
  const { data: maticBalance } = useBalance({ address: address });
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`], query: { enabled: !!address, refetchInterval: 1000 } });
  
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ 
      address: tokenAddress, abi: erc20Abi, functionName: "allowance", args: [address as `0x${string}`, CONTRACT_ADDRESS], query: { enabled: !!address, refetchInterval: 1000 } 
  });

  // REAL-TIME CONTRACT STATE
  const { data: salesData, refetch: refetchSales } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress], query: { refetchInterval: 1000 } });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  const image = metadata ? metadata[4] : "";
  const desc = metadata ? metadata[5] : "";
  const tokenImage = getTokenImage(tokenAddress);
  const creatorAddress = salesData ? salesData[0] : "";

  // ---------------------------------------------------------
  // PRICE & MC ENGINE (REAL-TIME)
  // ---------------------------------------------------------
  const collateralStr = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSoldStr = salesData ? formatEther(salesData[3] as bigint) : "0";
  const collateralVal = parseFloat(collateralStr);
  const tokensSoldVal = parseFloat(tokensSoldStr);

  const progress = (tokensSoldVal / 800_000_000) * 100; // 800M Sale Goal
  const realProgress = Math.min(progress, 100);
  
  // Real Price Calculation: (Collateral / Tokens Sold) * Multiplier for Visualization
  // If no sales, use a base price
  const basePrice = 0.00000003;
  const currentPrice = tokensSoldVal > 0 ? (collateralVal / tokensSoldVal) : basePrice;
  const marketCap = currentPrice * 1_000_000_000;

  const needsApproval = activeTab === "sell" && (!allowance || (amount && parseFloat(amount) > parseFloat(formatEther(allowance as bigint))));

  // --- MANUAL UI UPDATE SYSTEM (The "Aggressive" Fix) ---
  const forceUpdateUI = (type: "BUY" | "SELL" | "BURN", amt: string, price: number) => {
      // 1. Add to Trade History
      const newTrade = {
          user: address || "You",
          type: type,
          maticAmount: (parseFloat(amt) * price).toFixed(4),
          tokenAmount: amt,
          price: price.toFixed(8),
          time: new Date().toLocaleTimeString()
      };
      
      const updatedHistory = [newTrade, ...tradeHistory];
      setTradeHistory(updatedHistory);
      localStorage.setItem(`trades_v2_${tokenAddress}`, JSON.stringify(updatedHistory));

      // 2. Add to Chart
      const updatedChart = [...chartData, { name: "Now", price: price, fill: type === 'BUY' ? '#10b981' : '#ef4444' }];
      setChartData(updatedChart);
      localStorage.setItem(`chart_v2_${tokenAddress}`, JSON.stringify(updatedChart));

      // 3. Update Holders (If buying)
      if (type === "BUY" && address) {
          const newHolder = { address: address, percentage: 0 }; // Will refresh with real data later
          const filtered = holderList.filter(h => h.address !== address);
          const updatedHolders = [newHolder, ...filtered];
          setHolderList(updatedHolders);
          localStorage.setItem(`holders_v2_${tokenAddress}`, JSON.stringify(updatedHolders));
      }
  };

  // ACTIONS
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleApprove = () => {
      writeContract({ address: tokenAddress, abi: erc20Abi, functionName: "approve", args: [CONTRACT_ADDRESS, maxUint256] });
      toast.loading("Approving...", { id: 'tx' });
  };

  const handleTx = (type: "buy" | "sell" | "burn") => {
    if (!amount) { toast.error("Enter amount"); return; }
    const val = parseEther(amount);
    
    if (type === "burn") {
        writeContract({ address: tokenAddress, abi: erc20Abi, functionName: "transfer", args: ["0x000000000000000000000000000000000000dEaD", val] });
    } else if (type === "buy") {
         writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "buy", args: [tokenAddress], value: val });
    } else if (type === "sell") {
         if(needsApproval) { toast.error("Approve first!"); return; }
         writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sell", args: [tokenAddress, val] });
    }
    toast.loading(type === "buy" ? "Buying..." : type === "sell" ? "Selling..." : "Burning...", { id: 'tx' });
  };

  // CONFIRMATION LISTENER
  useEffect(() => { 
      if (isConfirmed) { 
          toast.dismiss(); // KESİN KAPAT
          toast.success("Success!"); 
          
          if(isApproving) { 
              setIsApproving(false); 
              refetchAllowance(); 
          } else { 
             if(activeTab === "buy") setShowConfetti(true);
             setAmount(""); 
             
             // AGRESİF GÜNCELLEME
             refetchSales(); 
             refetchTokenBalance(); 
             
             // RPC'yi beklemeden manuel ekle
             forceUpdateUI(activeTab === "buy" ? "BUY" : "SELL", amount, currentPrice);
          }
      }
      
      // Timeout to kill loading toast if stuck
      if(isPending || isConfirming) {
          const timer = setTimeout(() => toast.dismiss(), 15000);
          return () => clearTimeout(timer);
      }
  }, [isConfirmed, isPending, isConfirming]);

  const handlePercentage = (percent: number) => {
    if(activeTab === "buy") {
        const bal = maticBalance ? parseFloat(maticBalance.formatted) : 0;
        const safeBal = Math.max(0, bal - 0.2); // Safe gas buffer
        setAmount((safeBal * (percent/100)).toFixed(4));
    } else {
        const bal = userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)) : 0;
        const safeFactor = percent === 100 ? 0.99 : (percent/100); // 99% to be safe
        setAmount((bal * safeFactor).toFixed(2));
    }
  };

  if (!isMounted) return <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center text-[#FDDC11] font-mono animate-pulse">Loading Trade...</div>;

  return (
    <div className={`min-h-screen font-sans bg-[#0a0e27] text-white selection:bg-[#FDDC11] selection:text-black`}>
      <style>{styles}</style>
      <Toaster position="top-right" toastOptions={{ style: { background: '#181a20', color: '#fff', border: '1px solid #333' } }} />
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} />}

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 p-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white font-bold"><ArrowLeft size={18} /> Board</Link>
        <div className="flex gap-2 items-center">
             <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-white"><Settings size={18}/></button>
             {showSettings && (
                 <div className="absolute top-14 right-4 bg-[#1a0e2e] border border-white/20 p-4 rounded-xl z-50 w-64 shadow-xl">
                    <div className="text-xs font-bold mb-3">Settings</div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-400">Slippage</span>
                        <input type="number" value={slippage} onChange={e=>setSlippage(Number(e.target.value))} className="w-16 bg-black border border-white/10 rounded px-2 text-xs" />
                    </div>
                 </div>
             )}
             <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-[#2d1b4e] rounded-xl border border-white/10 overflow-hidden shadow-lg"><MediaRenderer src={tokenImage} className="w-full h-full object-cover"/></div>
                <div className="flex-1">
                    <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{name?.toString() || "Loading..."}</h1><span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKN"}]</span></div>
                    <div className="text-sm text-gray-400 mt-2 line-clamp-3">{desc || "No description."}</div>
                    <div className="flex gap-2 mt-2">{twitter && <Twitter size={14}/>}{web && <Globe size={14}/>}</div>
                </div>
            </div>

            <div className="border border-white/10 rounded-2xl p-5 h-[450px] bg-[#2d1b4e]/50 relative group">
                <div className="flex justify-between items-center mb-4"><div className="flex gap-4"><div className="text-lg font-bold">{currentPrice.toFixed(9)} MATIC</div><div className="text-lg font-bold text-[#FDDC11]">MC: {(marketCap).toLocaleString()} MATIC</div></div></div>
                <ResponsiveContainer width="100%" height="90%"><ComposedChart data={chartData}><YAxis domain={['auto', 'auto']} hide /><Tooltip contentStyle={{ backgroundColor: '#181a20', border: '1px solid #333' }} /><Bar dataKey="price" shape={<CustomCandle />} isAnimationActive={false}>{chartData.map((e, i) => (<Cell key={i} fill={e.fill || '#10b981'} />))}</Bar></ComposedChart></ResponsiveContainer>
                {chartData.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">No trades yet. Chart waiting...</div>}
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex gap-1 p-1 rounded-lg border border-white/5 w-fit bg-[#2d1b4e]">{["trades", "chat", "holders"].map(tab => (<button key={tab} onClick={() => setBottomTab(tab as any)} className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${bottomTab === tab ? "bg-[#3e2465] text-white" : "text-gray-500 hover:text-white"}`}>{tab}</button>))}</div>
                <div className="border border-white/5 rounded-2xl p-4 min-h-[300px] bg-[#2d1b4e]/50">
                    {bottomTab === "trades" && (
                        <div className="flex flex-col gap-1">
                            <div className="grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase px-3 pb-2"><div>User</div><div>Type</div><div>MATIC</div><div>Tokens</div><div className="text-right">Price</div></div>
                            {tradeHistory.map((trade, i) => (
                                <div key={i} className="grid grid-cols-5 text-xs py-3 px-3 rounded-lg border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <div className="font-mono text-gray-400">{trade.user ? (trade.user.length > 10 ? `${trade.user.slice(0,6)}...` : trade.user) : "Anon"}</div>
                                    <div className={trade.type==="BUY"?"text-green-500 font-bold":"text-red-500 font-bold"}>{trade.type}</div>
                                    <div className="text-white">{trade.maticAmount}</div>
                                    <div className="text-white">{trade.tokenAmount}</div>
                                    <div className="text-right text-gray-500">{trade.price}</div>
                                </div>
                            ))}
                            {tradeHistory.length === 0 && <div className="text-center text-gray-500 py-10">No trades yet.</div>}
                        </div>
                    )}
                    {bottomTab === "chat" && <ChatBox tokenAddress={tokenAddress} creator={creatorAddress} />}
                    {bottomTab === "holders" && (<div className="flex flex-col gap-2">{holderList.length > 0 ? holderList.map((h,i)=>(<div key={i} className="flex justify-between text-xs border-b border-white/5 pb-1"><span className="font-mono text-gray-400">{h.address.slice(0,6)}...</span><span className="text-white">{h.percentage?.toFixed(2)}%</span></div>)) : <div className="text-center text-gray-500">Holders loading...</div>}</div>)}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: TRADE */}
        <div className="lg:col-span-4 space-y-6">
            {userTokenBalance ? userTokenBalance > 0n && <PnLCard balance={formatEther(userTokenBalance)} price={currentPrice} symbol={symbol?.toString() || "TKN"} /> : null}
            
            <div className="border border-white/10 rounded-2xl p-5 sticky top-24 bg-[#2d1b4e]">
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => setActiveTab("buy")} className={`py-3 rounded-xl font-black transition-colors ${activeTab==="buy"?"bg-green-500 text-white":"bg-white/5 text-gray-400"}`}>Buy</button>
                    <button onClick={() => setActiveTab("sell")} className={`py-3 rounded-xl font-black transition-colors ${activeTab==="sell"?"bg-red-500 text-white":"bg-white/5 text-gray-400"}`}>Sell</button>
                </div>

                <div className="bg-[#1a0e2e] rounded-xl p-4 mb-4 border border-white/5">
                    <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Amount</span><span>Bal: {activeTab==="buy" ? `${maticBalance?.formatted?.slice(0,5)} MATIC` : `${parseFloat(formatEther(userTokenBalance || 0n)).toFixed(2)} ${symbol}`}</span></div>
                    <input type="number" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-2xl font-black text-white outline-none" />
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[10, 25, 50, 100].map(p => (<button key={p} onClick={() => handlePercentage(p)} className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors">{p === 100 ? "MAX" : `${p}%`}</button>))}
                </div>

                {/* BURN BUTTON */}
                {activeTab === "sell" && (
                    <button onClick={() => handleTx("burn")} className="w-full py-2 mb-4 bg-orange-600/20 text-orange-500 border border-orange-500/50 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-600/40 transition-colors"><Flame size={12}/> Burn Tokens (Send to Dead)</button>
                )}

                {/* LOGIC FOR BUTTONS */}
                {activeTab === "buy" ? (
                    <button onClick={() => handleTx("buy")} disabled={!address} className="w-full py-4 rounded-xl font-black bg-green-500 hover:bg-green-600 text-white transition-all disabled:opacity-50">PLACE BUY ORDER</button>
                ) : (
                    // SELL LOGIC: APPROVE FIRST
                    needsApproval ? (
                        <button onClick={handleApprove} disabled={!address || isApproving} className="w-full py-4 rounded-xl font-black bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {isApproving ? "APPROVING..." : <><Lock size={16}/> APPROVE TO SELL</>}
                        </button>
                    ) : (
                        <button onClick={() => handleTx("sell")} disabled={!address} className="w-full py-4 rounded-xl font-black bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50">PLACE SELL ORDER</button>
                    )
                )}
            </div>

            <div className="border border-white/5 rounded-xl p-4 space-y-4 bg-[#2d1b4e]/50">
                <div><div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Bonding Curve</span><span className="text-white">{realProgress.toFixed(1)}%</span></div><div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500" style={{ width: `${realProgress}%` }} /></div></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Market Cap</span><span className="text-white font-bold">{marketCap.toLocaleString()} MATIC</span></div>
            </div>
        </div>
      </main>
    </div>
  );
}
