"use client";

import { useState, useEffect, useRef, use } from "react";
import { 
  ArrowLeft, Twitter, Globe, Send, Copy, TrendingUp, MessageSquare, 
  User, ExternalLink, Coins, Users, Settings, Share2, Star, 
  Shield, AlertTriangle, Info, Gift, Zap, ImageIcon, Download, 
  Crosshair, Lock, Bell, Monitor, Ticket, Flame, Pin, Trophy, Eye, LayoutGrid, X
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient, useBalance, useSendTransaction } from "wagmi"; 
import { parseEther, formatEther, erc20Abi } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from "framer-motion";
import Confetti from 'react-confetti';

// --- STYLES ---
const styles = `
  @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
  .shake-screen { animation: shake 0.5s; animation-iteration-count: 1; }
  .matrix-mode { background-color: #000 !important; color: #00ff41 !important; font-family: 'Courier New', Courier, monospace; }
  .matrix-mode * { border-color: #00ff41 !important; }
  .matrix-mode .text-white { color: #00ff41 !important; }
  .matrix-mode .bg-white\\/5 { background-color: rgba(0, 255, 65, 0.1) !important; }
`;

// --- HELPERS ---
const getTokenImage = (address: string) => 
  `https://api.dicebear.com/7.x/identicon/svg?seed=${address}&backgroundColor=transparent`;

const MediaRenderer = ({ src, className }: { src: string, className: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className={`${className} bg-gray-800 animate-pulse`} />;

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

const generateNickname = (address: string) => {
    if (!address) return "Anon";
    const ADJECTIVES = ["Crazy", "Degen", "Based", "Diamond", "Savage", "Lucky"];
    const ANIMALS = ["Bull", "Bear", "Ape", "Whale", "Dolphin", "Chad"];
    const seed1 = parseInt(address.slice(2, 4), 16) % ADJECTIVES.length;
    const seed2 = parseInt(address.slice(4, 6), 16) % ANIMALS.length;
    return `${ADJECTIVES[seed1]} ${ANIMALS[seed2]}`;
};

const getAvatarUrl = (address: string) => `https://api.dicebear.com/7.x/pixel-art/svg?seed=${address}`;
const formatTokenAmount = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(2) + "M"; if (num >= 1000) return (num / 1000).toFixed(2) + "k"; return num.toFixed(2); };
const playSound = (type: 'buy' | 'sell' | 'tip' | 'alert') => { 
    if (typeof window === 'undefined') return;
    try { const audio = new Audio(type === 'buy' ? '/buy.mp3' : type === 'sell' ? '/sell.mp3' : type === 'tip' ? '/tip.mp3' : '/alert.mp3'); audio.volume = 0.5; audio.play().catch(() => {}); } catch (e) {} 
};
const CustomCandle = (props: any) => { const { x, y, width, height, fill } = props; return <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={fill} rx={2} />; };

// --- COMPONENTS ---

const PnLCard = ({ balance, price, symbol }: { balance: string, price: number, symbol: string }) => {
    const bal = parseFloat(balance);
    const value = bal * price;
    const entryPrice = price * 0.8; 
    const pnl = (price - entryPrice) * bal;
    const pnlPercent = ((price - entryPrice) / entryPrice) * 100;

    return (
        <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl p-4 mb-4 relative overflow-hidden group shadow-lg">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity"><TrendingUp size={64} /></div>
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Your Position ({symbol})</div>
            <div className="flex justify-between items-end">
                <div><div className="text-2xl font-black text-white">${value.toFixed(2)}</div><div className="text-xs text-gray-500">{formatTokenAmount(bal)} {symbol}</div></div>
                <div className={`text-right font-bold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}><div className="text-lg">{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} MATIC</div><div className="text-xs">{pnlPercent.toFixed(2)}%</div></div>
            </div>
            <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=I'm up ${pnlPercent.toFixed(0)}% on $${symbol}! 🚀 Check it out on AION Pump!`, '_blank')} className="mt-3 w-full py-1.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded flex items-center justify-center gap-2 hover:bg-blue-500/30 transition-colors"><Share2 size={12}/> Flex on Twitter</button>
        </div>
    );
};

const ChatBox = ({ tokenAddress, creator }: { tokenAddress: string, creator: string }) => {
    const { address } = useAccount();
    const [msgs, setMsgs] = useState<any[]>([]);
    const [input, setInput] = useState("");
    const [pinned, setPinned] = useState<any>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => { 
        setIsClient(true);
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`chat_${tokenAddress}`); 
            if(saved) setMsgs(JSON.parse(saved)); 
            const savedPin = localStorage.getItem(`pin_${tokenAddress}`); 
            if(savedPin) setPinned(JSON.parse(savedPin)); 
        }
    }, [tokenAddress]);

    const sendMsg = () => { 
        if(!input.trim()) return; 
        const newMsg = { user: generateNickname(address || "0x00"), address: address, text: input, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isDev: address?.toLowerCase() === creator?.toLowerCase() }; 
        const updated = [...msgs, newMsg]; 
        setMsgs(updated); 
        localStorage.setItem(`chat_${tokenAddress}`, JSON.stringify(updated)); 
        setInput(""); 
    };
    
    const handlePin = (msg: any) => { 
        if (address?.toLowerCase() !== creator?.toLowerCase()) return; 
        setPinned(msg); 
        localStorage.setItem(`pin_${tokenAddress}`, JSON.stringify(msg)); 
        toast.success("Message Pinned!"); 
    };

    if (!isClient) return <div className="h-[350px] flex items-center justify-center text-gray-600">Loading chat...</div>;

    return (
        <div className="flex flex-col h-[350px] relative">
            {pinned && (<div className="absolute top-0 left-0 right-0 bg-[#FDDC11]/90 text-black p-2 text-xs font-bold z-10 flex justify-between items-center backdrop-blur-md border-b border-black/10 rounded-t-lg"><div className="flex gap-2 items-center"><Pin size={12} fill="black"/> <span className="truncate">{pinned.user}: {pinned.text}</span></div>{address?.toLowerCase() === creator?.toLowerCase() && <button onClick={() => {setPinned(null); localStorage.removeItem(`pin_${tokenAddress}`)}}><X size={12}/></button>}</div>)}
            <div className={`flex-1 overflow-y-auto space-y-3 mb-3 pr-2 scrollbar-thin scrollbar-thumb-white/10 ${pinned ? 'pt-10' : ''}`}>
                {msgs.length === 0 && <div className="text-center text-gray-500 text-xs mt-10">No messages yet. Start the hype! 🔥</div>}
                {msgs.map((m, i) => (<div key={i} className={`p-2 rounded-lg border text-xs group relative ${m.isDev ? "bg-purple-900/30 border-purple-500/50" : "bg-white/5 border-white/5"}`}><div className="flex justify-between items-center mb-1"><div className="flex items-center gap-2"><img src={getAvatarUrl(m.address || "0x00")} className="w-4 h-4 rounded bg-black" alt="avatar" /><span className={`${m.isDev ? "text-purple-400" : "text-[#FDDC11]"} font-bold`}>{m.user} {m.isDev && "(DEV)"}</span></div><span className="text-[9px] text-gray-500">{m.time}</span></div><p className="text-gray-300 break-words pl-6">{m.text}</p>{address?.toLowerCase() === creator?.toLowerCase() && (<button onClick={() => handlePin(m)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity"><Pin size={10}/></button>)}</div>))}
            </div>
            <div className="flex gap-2"><input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMsg()} placeholder="Type something..." className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FDDC11] transition-colors" /><button onClick={sendMsg} className="bg-[#FDDC11] text-black p-2 rounded-lg hover:bg-[#ffe55c] transition-colors"><Send size={14}/></button></div>
        </div>
    );
};

const BubbleMap = ({ holders }: { holders: any[] }) => {
    return (
        <div className="h-[300px] w-full relative overflow-hidden bg-black/20 rounded-xl border border-white/5">
             <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 pointer-events-none">Top 20 Holders Visualization</div>
             {holders.slice(0, 20).map((h, i) => {
                 const seed = parseInt(h.address.slice(2, 6), 16);
                 const size = Math.max(20, Math.min(80, h.percentage * 4));
                 const top = (seed % 70) + 10;
                 const left = ((seed * 13) % 70) + 10;
                 return (<motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute rounded-full flex items-center justify-center border border-white/10 shadow-xl backdrop-blur-sm cursor-pointer hover:z-10 hover:border-[#FDDC11] transition-colors" style={{ width: size, height: size, top: `${top}%`, left: `${left}%`, background: i === 0 ? 'rgba(253, 220, 17, 0.2)' : 'rgba(255,255,255,0.05)' }} title={`${h.address} (${h.percentage.toFixed(2)}%)`}><span className="text-[8px] text-white opacity-50 truncate w-full text-center px-1 font-mono">{h.address.slice(2,5)}</span></motion.div>)
             })}
        </div>
    )
}

const MemeGenerator = ({ tokenImage, symbol }: { tokenImage: string, symbol: string }) => {
    const [topText, setTopText] = useState("");
    const [bottomText, setBottomText] = useState("");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext("2d");
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = tokenImage;
        img.onload = () => {
            if(!ctx) return;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height); ctx.font = "bold 40px Impact"; ctx.fillStyle = "white"; ctx.strokeStyle = "black"; ctx.lineWidth = 2; ctx.textAlign = "center";
            ctx.fillText(topText.toUpperCase(), canvas.width/2, 50); ctx.strokeText(topText.toUpperCase(), canvas.width/2, 50);
            ctx.fillText(bottomText.toUpperCase(), canvas.width/2, canvas.height - 20); ctx.strokeText(bottomText.toUpperCase(), canvas.width/2, canvas.height - 20);
        };
    }, [topText, bottomText, tokenImage]);
    const downloadMeme = () => { const link = document.createElement('a'); link.download = `${symbol}-meme.png`; link.href = canvasRef.current?.toDataURL() || ""; link.click(); toast.success("Meme Downloaded! 🎨"); };
    return (
        <div className="flex flex-col gap-4 p-4 bg-black/20 rounded-xl">
            <canvas ref={canvasRef} width={400} height={400} className="w-full rounded-lg border border-white/10" /><div className="flex gap-2"><input type="text" placeholder="Top Text" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none text-white" value={topText} onChange={e=>setTopText(e.target.value)} /><input type="text" placeholder="Bottom Text" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none text-white" value={bottomText} onChange={e=>setBottomText(e.target.value)} /></div><button onClick={downloadMeme} className="w-full bg-[#FDDC11] text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-[#ffe55c] transition-colors"><Download size={16}/> Download Meme</button>
        </div>
    );
};

// --- MAIN PAGE ---
export default function TradePage({ params }: { params: { id: string } }) {
  const tokenAddress = params.id as `0x${string}`;
  const publicClient = usePublicClient(); 
  const { isConnected, address } = useAccount();

  // HYDRATION FIX
  const [isMounted, setIsMounted] = useState(false);

  // STATES
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat" | "holders" | "bubbles" | "meme">("trades");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMatrixMode, setIsMatrixMode] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);
  const [sniperMode, setSniperMode] = useState(false);
  const [mevProtect, setMevProtect] = useState(false);
  const [priceAlert, setPriceAlert] = useState("");

  // DATA
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [holderList, setHolderList] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const processedTxHashes = useRef(new Set());

  // CONTRACT READS
  const { data: maticBalance, refetch: refetchMatic } = useBalance({ address: address });
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`], query: { enabled: !!address } });
  const { data: salesData, refetch: refetchSales } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  // CALCS
  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const creatorAddress = salesData ? salesData[0] : "";
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);
  const migrationProgress = Math.min((parseFloat(collateral) / 3000) * 100, 100);
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0.000001;
  const marketCap = currentPrice * 1_000_000_000;
  
  // FIX: Define Variables to prevent ReferenceError
  const image = metadata ? metadata[4] : "";
  const desc = metadata ? metadata[5] : "No description available.";
  const twitter = metadata ? metadata[6] : "";
  const telegram = metadata ? metadata[7] : "";
  const web = metadata ? metadata[8] : "";
  
  const tokenImage = getTokenImage(tokenAddress, image);
  const riskScore = holderList.length < 5 ? 20 : holderList.length < 20 ? 50 : 90;

  // ACTIONS
  const { writeContract: burnContract } = useWriteContract();
  const handleBurn = () => { try { const val = parseEther(amount); burnContract({ address: tokenAddress, abi: erc20Abi, functionName: "transfer", args: ["0x000000000000000000000000000000000000dEaD", val] }); toast.success("Burning Tokens! 🔥"); } catch(e) { toast.error("Burn failed"); } };
  const { sendTransaction } = useSendTransaction();
  const handleTip = async () => { if(!creatorAddress) return; try { await sendTransaction({ to: creatorAddress, value: parseEther("1") }); toast.success("Tip sent! 💸"); playSound('tip'); } catch(e) { toast.error("Tip failed"); } };
  const copyReferral = () => { const url = `${window.location.origin}/trade/${tokenAddress}?ref=${address}`; navigator.clipboard.writeText(url); toast.success("Referral Link Copied! 🔗"); };

  const fetchHistory = async () => {
    if (!publicClient) return;
    try {
      // FIX: RPC Limit Workaround (Avoid 'earliest')
      const blockNumber = await publicClient.getBlockNumber();
      const fromBlock = blockNumber - 3000n; // Last ~2 hours

      const [buyLogs, sellLogs] = await Promise.all([
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', fromBlock: fromBlock }),
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', fromBlock: fromBlock })
      ]);
      const relevantBuys = buyLogs.filter((l: any) => l.args.token.toLowerCase() === tokenAddress.toLowerCase());
      const relevantSells = sellLogs.filter((l: any) => l.args.token.toLowerCase() === tokenAddress.toLowerCase());
      const allEvents = [...relevantBuys.map(l => ({ ...l, type: "BUY" })), ...relevantSells.map(l => ({ ...l, type: "SELL" }))].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || a.logIndex - b.logIndex);

      const balances: Record<string, bigint> = {};
      relevantBuys.forEach((l:any) => { balances[l.args.buyer] = (balances[l.args.buyer] || 0n) + (l.args.amountTokens || 0n); });
      relevantSells.forEach((l:any) => { balances[l.args.seller] = (balances[l.args.seller] || 0n) - (l.args.amountTokens || 0n); });
      const sortedHolders = Object.entries(balances).filter(([_, bal]) => bal > 10n).sort(([, a], [, b]) => (b > a ? 1 : -1)).map(([addr, bal]) => ({ address: addr, balance: bal, percentage: (Number(bal) * 100) / 1_000_000_000 / 10**18 }));
      setHolderList(sortedHolders);
      
      const top5 = sortedHolders.slice(0, 5);
      const others = sortedHolders.slice(5).reduce((acc, curr) => acc + curr.percentage, 0);
      const pData = top5.map((h, i) => ({ name: `${h.address.slice(0,4)}`, value: h.percentage, fill: ['#FDDC11', '#fbbf24', '#f59e0b', '#d97706', '#b45309'][i] }));
      if (others > 0) pData.push({ name: 'Others', value: others, fill: '#374151' });
      setPieData(pData);

      const newChartData: any[] = [];
      const newTrades: any[] = [];
      let lastPrice = 0.0000001;

      allEvents.forEach((event: any) => {
        if (processedTxHashes.current.has(event.transactionHash)) return;
        processedTxHashes.current.add(event.transactionHash);
        const maticVal = parseFloat(formatEther(event.args.amountMATIC || 0n));
        const tokenVal = parseFloat(formatEther(event.args.amountTokens || 0n));
        let executionPrice = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
        newTrades.unshift({ user: event.args.buyer || event.args.seller, type: event.type, maticAmount: maticVal.toFixed(4), tokenAmount: tokenVal, price: executionPrice.toFixed(8), time: `Blk ${event.blockNumber}` });
        newChartData.push({ name: event.blockNumber.toString(), price: executionPrice, isUp: event.type === "BUY", fill: event.type === "BUY" ? '#10b981' : '#ef4444' });
        lastPrice = executionPrice;
      });

      if (newChartData.length > 0) setChartData(newChartData);
      if (newTrades.length > 0) setTradeHistory(newTrades);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { setIsMounted(true); fetchHistory(); const interval = setInterval(fetchHistory, 5000); return () => clearInterval(interval); }, [tokenAddress, publicClient]);

  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', onLogs(logs: any) { processLiveLog(logs[0], "BUY"); } });
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', onLogs(logs: any) { processLiveLog(logs[0], "SELL"); } });

  const processLiveLog = (log: any, type: "BUY" | "SELL") => {
    if(log.args.token.toLowerCase() !== tokenAddress.toLowerCase()) return;
    if(processedTxHashes.current.has(log.transactionHash)) return;
    processedTxHashes.current.add(log.transactionHash);
    const maticVal = parseFloat(formatEther(log.args.amountMATIC || 0n));
    const tokenVal = parseFloat(formatEther(log.args.amountTokens || 0n));
    const executionPrice = tokenVal > 0 ? maticVal / tokenVal : (chartData.length > 0 ? chartData[chartData.length-1].price : 0);
    if (maticVal > 100) { toast((t) => (<div className="flex items-center gap-2"><span className="text-2xl">🐋</span><div><b>WHALE ALERT!</b><br/>Someone moved {maticVal.toFixed(0)} MATIC!</div></div>), { duration: 5000, style: { background: '#3b0764', color: '#fff', border: '1px solid #FDDC11' }}); playSound('alert'); } else { playSound(type === "BUY" ? 'buy' : 'sell'); }
    if(type === "BUY") { setIsShaking(true); setTimeout(() => setIsShaking(false), 1000); }
    setChartData(prev => [...prev, { name: "New", price: executionPrice, isUp: type === "BUY", fill: type === "BUY" ? '#10b981' : '#ef4444' }]);
    setTradeHistory(prev => [{ user: type === "BUY" ? log.args.buyer : log.args.seller, type: type, maticAmount: maticVal.toFixed(4), tokenAmount: tokenVal, price: executionPrice.toFixed(8), time: "Just now" }, ...prev]);
    refetchSales(); refetchTokenBalance(); refetchMatic();
  };

  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleTx = () => { if (!amount) { toast.error("Enter amount"); return; } try { const val = parseEther(amount); if (activeTab === "buy") writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "buy", args: [tokenAddress], value: val }); else writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sell", args: [tokenAddress, val] }); toast.loading("Confirming...", { id: 'tx' }); } catch(e) { toast.error("Failed"); toast.dismiss('tx'); } };

  useEffect(() => { if (isConfirmed) { toast.dismiss('tx'); toast.success("Success!"); if(activeTab === "buy") { setShowConfetti(true); setIsShaking(true); setTimeout(() => {setShowConfetti(false); setIsShaking(false)}, 5000); playSound('buy'); } else { playSound('sell'); } setAmount(""); refetchSales(); refetchTokenBalance(); refetchMatic(); setTimeout(fetchHistory, 2000); } }, [isConfirmed]);

  const handlePercentage = (percent: number) => { if(activeTab === "buy") { const bal = maticBalance ? parseFloat(maticBalance.formatted) : 0; const max = bal - 0.02; if(max > 0) setAmount((max * (percent/100)).toFixed(4)); } else { const bal = userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)) : 0; setAmount((bal * (percent/100)).toFixed(2)); } };

  if (!isMounted) return null;

  return (
    <div className={`min-h-screen font-sans selection:bg-[#FDDC11] selection:text-black ${isShaking ? "shake-screen" : ""} ${isMatrixMode ? "matrix-mode" : "bg-[#0a0e27] text-white"}`}>
      
      <style>{styles}</style>

      <Toaster position="top-right" toastOptions={{ style: { background: '#181a20', color: '#fff', border: '1px solid #333' } }} />
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={300} />}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 p-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white font-bold"><ArrowLeft size={18} /> Board</Link>
        <div className="flex gap-2 items-center">
             <button onClick={() => setIsTvMode(!isTvMode)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#FDDC11]" title="TV Mode"><Monitor size={18}/></button>
             <button onClick={() => setIsMatrixMode(!isMatrixMode)} className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 ${isMatrixMode ? "text-green-500" : "text-gray-400"}`} title="Matrix Mode"><LayoutGrid size={18}/></button>
             <button onClick={copyReferral} className="flex items-center gap-1 bg-blue-500/20 text-blue-500 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-blue-500/30 transition-colors"><Ticket size={14}/> Invite</button>
             <button onClick={handleTip} className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-yellow-500/30 transition-colors"><Gift size={14}/> Tip Dev</button>
             <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </header>

      {/* TV MODE OVERLAY */}
      {isTvMode ? (
         <div className="fixed inset-0 z-50 bg-black p-4 flex flex-col">
            <button onClick={() => setIsTvMode(false)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full z-50 text-white hover:bg-white/20"><X/></button>
            <div className="h-[70%] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}><XAxis dataKey="name" hide/><YAxis domain={['auto', 'auto']} orientation="right" tick={{fill:'#FDDC11'}}/><Bar dataKey="price" shape={<CustomCandle />} isAnimationActive={false}>{chartData.map((e, i) => (<Cell key={i} fill={e.fill} />))}</Bar></ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="h-[30%] w-full overflow-hidden flex gap-4 mt-4">
                <div className="text-6xl font-black text-white self-center">{currentPrice.toFixed(8)} MATIC</div>
                <div className="flex-1 overflow-y-auto font-mono text-sm">
                    {tradeHistory.slice(0,10).map((t,i) => <div key={i} className={`flex justify-between border-b border-white/5 py-1 ${t.type==='BUY'?'text-green-500':'text-red-500'}`}><span>{t.type}</span><span>{t.maticAmount} MATIC</span></div>)}
                </div>
            </div>
         </div>
      ) : (
      <main className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SOL KOLON */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            {/* TOKEN INFO */}
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-[#2d1b4e] rounded-xl border border-white/10 overflow-hidden shadow-lg"><img src={getTokenImage(tokenAddress, image)} className="w-full h-full object-cover"/></div>
                <div className="flex-1">
                    <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{name?.toString() || "Loading..."}</h1><span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKN"}]</span></div>
                    {desc && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{desc}</p>}
                    <div className="flex gap-2 mt-2">
                        {twitter && <a href={twitter} target="_blank" className="p-2 bg-[#2d1b4e] rounded hover:text-[#FDDC11] transition-colors"><Twitter size={14}/></a>}
                        {telegram && <a href={telegram} target="_blank" className="p-2 bg-[#2d1b4e] rounded hover:text-[#FDDC11] transition-colors"><Send size={14}/></a>}
                        {web && <a href={web} target="_blank" className="p-2 bg-[#2d1b4e] rounded hover:text-[#FDDC11] transition-colors"><Globe size={14}/></a>}
                    </div>
                </div>
            </div>

            {/* CHART */}
            <div className={`border rounded-2xl p-5 h-[450px] shadow-xl ${isMatrixMode ? "bg-black border-green-500" : "bg-[#2d1b4e]/50 border-white/5"}`}>
                <div className="flex justify-between items-center mb-4"><div className="flex gap-4"><div className="text-lg font-bold">{currentPrice.toFixed(6)} MATIC</div><div className="text-lg font-bold text-[#FDDC11]">MC: {(marketCap).toLocaleString()} MATIC</div></div></div>
                <ResponsiveContainer width="100%" height="90%">
                    <ComposedChart data={chartData}>
                        <YAxis domain={['auto', 'auto']} hide />
                        <Tooltip contentStyle={{ backgroundColor: '#181a20', border: '1px solid #333' }} />
                        <Bar dataKey="price" shape={<CustomCandle />} isAnimationActive={false}>
                            {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={isMatrixMode ? "#22c55e" : entry.fill} />))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* TABS & LISTS */}
            <div className="flex flex-col gap-4">
                <div className={`flex gap-1 p-1 rounded-lg border w-fit ${isMatrixMode ? "bg-black border-green-500" : "bg-[#2d1b4e] border-white/5"}`}>
                    {["trades", "holders", "bubbles", "chat", "meme"].map(tab => (
                        <button key={tab} onClick={() => setBottomTab(tab as any)} className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${bottomTab === tab ? "bg-[#3e2465] text-white" : "text-gray-500 hover:text-white"}`}>{tab}</button>
                    ))}
                </div>
                <div className={`border rounded-2xl p-4 min-h-[300px] ${isMatrixMode ? "bg-black border-green-500" : "bg-[#2d1b4e]/50 border-white/5"}`}>
                    {bottomTab === "trades" && (
                        <div className="flex flex-col gap-1">
                            <div className="grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase px-3 pb-2"><div>User</div><div>Type</div><div>MATIC</div><div>Tokens</div><div className="text-right">Price</div></div>
                            {tradeHistory.map((trade, i) => (
                                <div key={i} className={`grid grid-cols-5 text-xs py-3 px-3 rounded-lg border-b border-white/5 ${trade.user.toLowerCase() === creatorAddress?.toLowerCase() ? 'bg-purple-900/30 border-purple-500/50 animate-pulse' : 'hover:bg-white/5'}`}>
                                    <div className="font-mono text-gray-400 flex items-center gap-1">{generateNickname(trade.user)} {trade.user.toLowerCase() === creatorAddress?.toLowerCase() && <span className="bg-purple-500 text-white text-[8px] px-1 rounded">DEV</span>}</div>
                                    <div className={trade.type==="BUY"?"text-green-500 font-bold":"text-red-500 font-bold"}>{trade.type}</div>
                                    <div className="text-white">{trade.maticAmount}</div>
                                    <div className="text-white">{formatTokenAmount(trade.tokenAmount)}</div>
                                    <div className="text-right text-gray-500">{trade.price}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {bottomTab === "holders" && (
                        <div className="flex gap-6">
                            <div className="w-1/3 h-[200px]"><ResponsiveContainer><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">{pieData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Pie></PieChart></ResponsiveContainer></div>
                            <div className="w-2/3 flex flex-col gap-2">{holderList.map((h,i)=>(<div key={i} className="flex justify-between text-xs border-b border-white/5 pb-1"><span className="font-mono text-gray-400">{generateNickname(h.address)} {h.address.toLowerCase() === creatorAddress?.toLowerCase() && "(DEV)"}</span><span className="text-white">{h.percentage.toFixed(2)}%</span></div>))}</div>
                        </div>
                    )}
                    {bottomTab === "bubbles" && <BubbleMap holders={holderList} />}
                    {bottomTab === "chat" && <ChatBox tokenAddress={tokenAddress} creator={creatorAddress} />}
                    {bottomTab === "meme" && <MemeGenerator tokenImage={tokenImage} symbol={symbol?.toString() || "TKN"} />}
                </div>
            </div>
        </div>

        {/* SAĞ KOLON: TRADE */}
        <div className="lg:col-span-4 space-y-6">
            {/* PnL CARD */}
            {userTokenBalance && userTokenBalance > 0n && <PnLCard balance={formatEther(userTokenBalance)} price={currentPrice} symbol={symbol?.toString() || "TKN"} />}

            <div className={`border rounded-2xl p-5 sticky top-24 ${isMatrixMode ? "bg-black border-green-500" : "bg-[#2d1b4e] border-white/10"}`}>
                <div className="flex justify-between items-center mb-4">
                     <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-white transition-colors"><Settings size={16}/></button>
                     {showSettings && (
                        <div className="absolute top-12 right-5 bg-[#1a0e2e] border border-white/20 p-3 rounded-lg z-50 shadow-xl w-48 animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-xs font-bold text-white mb-2">Pro Settings</div>
                            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-400 flex items-center gap-1"><Crosshair size={10}/> Sniper Mode</span><input type="checkbox" checked={sniperMode} onChange={e=>setSniperMode(e.target.checked)} className="accent-[#FDDC11]"/></div>
                            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-400 flex items-center gap-1"><Lock size={10}/> MEV Protect</span><input type="checkbox" checked={mevProtect} onChange={e=>setMevProtect(e.target.checked)} className="accent-[#FDDC11]"/></div>
                            <div className="text-xs text-gray-400 mb-1">Price Alert</div>
                            <input type="text" placeholder="Target Price..." className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#FDDC11]" value={priceAlert} onChange={e=>setPriceAlert(e.target.value)} />
                        </div>
                     )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => setActiveTab("buy")} className={`py-3 rounded-xl font-black transition-colors ${activeTab==="buy"?"bg-green-500 text-white":"bg-white/5 text-gray-400"}`}>Buy</button>
                    <button onClick={() => setActiveTab("sell")} className={`py-3 rounded-xl font-black transition-colors ${activeTab==="sell"?"bg-red-500 text-white":"bg-white/5 text-gray-400"}`}>Sell</button>
                </div>

                <div className="bg-[#1a0e2e] rounded-xl p-4 mb-4 border border-white/5">
                    <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Amount</span><span>Bal: {activeTab==="buy" ? `${maticBalance?.formatted?.slice(0,5)} MATIC` : `${parseFloat(formatEther(userTokenBalance as bigint)).toFixed(2)} ${symbol}`}</span></div>
                    <input type="number" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-2xl font-black text-white outline-none" />
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[10, 25, 50, 100].map(p => (
                        <button key={p} onClick={() => handlePercentage(p)} className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors">{p === 100 ? "MAX" : `${p}%`}</button>
                    ))}
                </div>

                {/* BURN BUTTON (ONLY ON SELL TAB) */}
                {activeTab === "sell" && (
                    <button onClick={handleBurn} className="w-full py-2 mb-4 bg-orange-600/20 text-orange-500 border border-orange-500/50 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-600/40 transition-colors"><Flame size={12}/> Burn Tokens</button>
                )}

                <div className="flex justify-between items-center px-1 mb-4">
                    <div className="flex items-center gap-2">
                         <Shield size={14} className={riskScore > 70 ? "text-green-500" : "text-red-500"} />
                         <span className={`text-xs font-bold ${riskScore > 70 ? "text-green-500" : "text-red-500"}`}>Risk: {riskScore > 70 ? "LOW" : "HIGH"} ({riskScore}%)</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-500">Slip:</span>
                        <select value={slippage} onChange={e=>setSlippage(Number(e.target.value))} className="bg-transparent text-[#FDDC11] text-xs font-bold outline-none cursor-pointer"><option value={1}>1%</option><option value={5}>5%</option><option value={10}>10%</option></select>
                    </div>
                </div>

                <button onClick={handleTx} disabled={isPending || isConfirming} className={`w-full py-4 rounded-xl font-black ${activeTab==="buy"?"bg-green-500 hover:bg-green-600":"bg-red-500 hover:bg-red-600"} text-white transition-all disabled:opacity-50`}>
                    {isPending ? "Processing..." : activeTab === "buy" ? "PLACE BUY ORDER" : "PLACE SELL ORDER"}
                </button>
            </div>

            <div className={`border rounded-xl p-4 space-y-4 ${isMatrixMode ? "bg-black border-green-500" : "bg-[#2d1b4e]/50 border-white/5"}`}>
                <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Bonding Curve</span><span className="text-white">{realProgress.toFixed(1)}%</span></div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500" style={{ width: `${realProgress}%` }} /></div>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Dex Graduation</span><span className="text-green-400">{migrationProgress.toFixed(1)}%</span></div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-500" style={{ width: `${migrationProgress}%` }} /></div>
                </div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Holders</span><span className="text-white font-bold">{holderList.length}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Market Cap</span><span className="text-white font-bold">{marketCap.toLocaleString()} MATIC</span></div>
            </div>
        </div>
      </main>
      )}
    </div>
  );
}
