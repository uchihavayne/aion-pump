"use client";

import { useState, useEffect, useRef, use } from "react";
import { 
  ArrowLeft, Twitter, Globe, Send, Copy, TrendingUp, MessageSquare, 
  User, ExternalLink, Coins, Users, Settings, Share2, Star, 
  Shield, AlertTriangle, Info, Gift, Zap, ImageIcon, Download, 
  Crosshair, Lock, Bell
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

// --- SES EFEKTLERİ ---
const playSound = (type: 'buy' | 'sell' | 'tip') => {
  try {
    const audio = new Audio(type === 'buy' ? '/buy.mp3' : type === 'sell' ? '/sell.mp3' : '/tip.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
};

// --- HELPER COMPONENTS ---
const getTokenImage = (address: string, customImage?: string) => 
  customImage || `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

const formatTokenAmount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
  if (num >= 1000) return (num / 1000).toFixed(2) + "k";
  return num.toFixed(2);
};

// MEME GENERATOR COMPONENT
const MemeGenerator = ({ tokenImage, symbol }: { tokenImage: string, symbol: string }) => {
    const [topText, setTopText] = useState("");
    const [bottomText, setBottomText] = useState("");
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = tokenImage;
        img.onload = () => {
            if(!ctx) return;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.font = "bold 40px Impact";
            ctx.fillStyle = "white";
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.textAlign = "center";
            
            ctx.fillText(topText.toUpperCase(), canvas.width/2, 50);
            ctx.strokeText(topText.toUpperCase(), canvas.width/2, 50);
            
            ctx.fillText(bottomText.toUpperCase(), canvas.width/2, canvas.height - 20);
            ctx.strokeText(bottomText.toUpperCase(), canvas.width/2, canvas.height - 20);
        };
    }, [topText, bottomText, tokenImage]);

    const downloadMeme = () => {
        const link = document.createElement('a');
        link.download = `${symbol}-meme.png`;
        link.href = canvasRef.current?.toDataURL() || "";
        link.click();
        toast.success("Meme Downloaded! 🎨");
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-black/20 rounded-xl">
            <canvas ref={canvasRef} width={400} height={400} className="w-full rounded-lg border border-white/10" />
            <div className="flex gap-2">
                <input type="text" placeholder="Top Text" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none" value={topText} onChange={e=>setTopText(e.target.value)} />
                <input type="text" placeholder="Bottom Text" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none" value={bottomText} onChange={e=>setBottomText(e.target.value)} />
            </div>
            <button onClick={downloadMeme} className="w-full bg-[#FDDC11] text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-[#ffe55c] transition-colors"><Download size={16}/> Download Meme</button>
        </div>
    );
};

// CHAT COMPONENT (Local Storage)
const ChatBox = ({ tokenAddress }: { tokenAddress: string }) => {
    const [msgs, setMsgs] = useState<any[]>([]);
    const [input, setInput] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem(`chat_${tokenAddress}`);
        if(saved) setMsgs(JSON.parse(saved));
    }, [tokenAddress]);

    const sendMsg = () => {
        if(!input.trim()) return;
        const newMsg = { user: "You", text: input, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
        const updated = [...msgs, newMsg];
        setMsgs(updated);
        localStorage.setItem(`chat_${tokenAddress}`, JSON.stringify(updated));
        setInput("");
    };

    return (
        <div className="flex flex-col h-[300px]">
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {msgs.length === 0 && <div className="text-center text-gray-500 text-xs mt-10">No messages yet. Start the hype! 🔥</div>}
                {msgs.map((m, i) => (
                    <div key={i} className="bg-white/5 p-2 rounded-lg border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[#FDDC11] text-xs font-bold">{m.user}</span>
                            <span className="text-[9px] text-gray-500">{m.time}</span>
                        </div>
                        <p className="text-xs text-gray-300 break-words">{m.text}</p>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMsg()} placeholder="Type something..." className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FDDC11]" />
                <button onClick={sendMsg} className="bg-[#FDDC11] text-black p-2 rounded-lg hover:bg-[#ffe55c]"><Send size={14}/></button>
            </div>
        </div>
    );
};

// MAIN PAGE COMPONENT
type PageProps = { params: Promise<{ id: string }>; };

export default function TradePage(props: PageProps) {
  const params = use(props.params);
  const id = params.id;
  const tokenAddress = id as `0x${string}`;
  const publicClient = usePublicClient(); 
  const { isConnected, address } = useAccount();

  // STATES
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "holders" | "chat" | "meme">("trades");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // PRO SETTINGS STATES
  const [sniperMode, setSniperMode] = useState(false);
  const [mevProtect, setMevProtect] = useState(false);
  const [priceAlert, setPriceAlert] = useState("");

  // DATA STATES
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [holderList, setHolderList] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const processedTxHashes = useRef(new Set());

  // CONTRACT READS
  const { data: maticBalance, refetch: refetchMatic } = useBalance({ address: address });
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] });
  const { data: salesData, refetch: refetchSales } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const creatorAddress = salesData ? salesData[0] : "";
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);
  const migrationProgress = Math.min((parseFloat(collateral) / 3000) * 100, 100);
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0.000001;
  const marketCap = currentPrice * 1_000_000_000;

  const image = metadata ? metadata[4] : "";
  const tokenImage = getTokenImage(tokenAddress, image);

  // TIPPING FUNCTION
  const { sendTransaction } = useSendTransaction();
  const handleTip = async () => {
      if(!creatorAddress) return;
      try {
          await sendTransaction({ to: creatorAddress, value: parseEther("1") });
          toast.success("Tip sent to Creator! 💸");
          playSound('tip');
      } catch(e) { toast.error("Tip failed"); }
  };

  // HISTORY FETCHING
  const fetchHistory = async () => {
    if (!publicClient) return;
    try {
      const [buyLogs, sellLogs] = await Promise.all([
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', fromBlock: 'earliest' }),
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', fromBlock: 'earliest' })
      ]);

      const relevantBuys = buyLogs.filter((l: any) => l.args.token.toLowerCase() === tokenAddress.toLowerCase());
      const relevantSells = sellLogs.filter((l: any) => l.args.token.toLowerCase() === tokenAddress.toLowerCase());

      const allEvents = [...relevantBuys.map(l => ({ ...l, type: "BUY" })), ...relevantSells.map(l => ({ ...l, type: "SELL" }))]
        .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || a.logIndex - b.logIndex);

      // Holders Calculation
      const balances: Record<string, bigint> = {};
      relevantBuys.forEach((l:any) => { balances[l.args.buyer] = (balances[l.args.buyer] || 0n) + (l.args.amountTokens || 0n); });
      relevantSells.forEach((l:any) => { balances[l.args.seller] = (balances[l.args.seller] || 0n) - (l.args.amountTokens || 0n); });
      
      const sortedHolders = Object.entries(balances)
        .filter(([_, bal]) => bal > 10n)
        .sort(([, a], [, b]) => (b > a ? 1 : -1))
        .map(([addr, bal]) => ({ address: addr, balance: bal, percentage: (Number(bal) * 100) / 1_000_000_000 / 10**18 }));
      setHolderList(sortedHolders);

      // Pie Chart
      const top5 = sortedHolders.slice(0, 5);
      const others = sortedHolders.slice(5).reduce((acc, curr) => acc + curr.percentage, 0);
      const pData = top5.map((h, i) => ({ name: `${h.address.slice(0,4)}`, value: h.percentage, fill: ['#FDDC11', '#fbbf24', '#f59e0b', '#d97706', '#b45309'][i] }));
      if (others > 0) pData.push({ name: 'Others', value: others, fill: '#374151' });
      setPieData(pData);

      // Chart & Trades
      const newChartData: any[] = [];
      const newTrades: any[] = [];
      let lastPrice = 0.0000001;

      allEvents.forEach((event: any) => {
        if (processedTxHashes.current.has(event.transactionHash)) return;
        processedTxHashes.current.add(event.transactionHash);

        const maticVal = parseFloat(formatEther(event.args.amountMATIC || 0n));
        const tokenVal = parseFloat(formatEther(event.args.amountTokens || 0n));
        let executionPrice = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
        
        newTrades.unshift({
          user: event.args.buyer || event.args.seller,
          type: event.type,
          maticAmount: maticVal.toFixed(4),
          tokenAmount: tokenVal,
          price: executionPrice.toFixed(8),
          time: `Blk ${event.blockNumber}`
        });
        newChartData.push({ name: event.blockNumber.toString(), price: executionPrice, isUp: event.type === "BUY", fill: event.type === "BUY" ? '#10b981' : '#ef4444' });
        lastPrice = executionPrice;
      });

      if (newChartData.length > 0) setChartData(newChartData);
      if (newTrades.length > 0) setTradeHistory(newTrades);
      
    } catch (e) { console.error("History Error:", e); }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [tokenAddress, publicClient]);

  // LIVE EVENTS
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', onLogs(logs: any) { processLiveLog(logs[0], "BUY"); } });
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', onLogs(logs: any) { processLiveLog(logs[0], "SELL"); } });

  const processLiveLog = (log: any, type: "BUY" | "SELL") => {
    if(log.args.token.toLowerCase() !== tokenAddress.toLowerCase()) return;
    if(processedTxHashes.current.has(log.transactionHash)) return;
    processedTxHashes.current.add(log.transactionHash);

    const maticVal = parseFloat(formatEther(log.args.amountMATIC || 0n));
    const tokenVal = parseFloat(formatEther(log.args.amountTokens || 0n));
    const executionPrice = tokenVal > 0 ? maticVal / tokenVal : (chartData.length > 0 ? chartData[chartData.length-1].price : 0);
    
    playSound(type === "BUY" ? 'buy' : 'sell');
    setChartData(prev => [...prev, { name: "New", price: executionPrice, isUp: type === "BUY", fill: type === "BUY" ? '#10b981' : '#ef4444' }]);
    setTradeHistory(prev => [{ user: type === "BUY" ? log.args.buyer : log.args.seller, type: type, maticAmount: maticVal.toFixed(4), tokenAmount: tokenVal, price: executionPrice.toFixed(8), time: "Just now" }, ...prev]);
    
    refetchSales(); refetchTokenBalance(); refetchMatic();
  };

  // TX HANDLING
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleTx = () => {
    if (!amount) { toast.error("Enter amount"); return; }
    try {
      const val = parseEther(amount);
      if (activeTab === "buy") writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "buy", args: [tokenAddress], value: val });
      else writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sell", args: [tokenAddress, val] });
      toast.loading("Confirming...", { id: 'tx' });
    } catch(e) { toast.error("Failed"); toast.dismiss('tx'); }
  };

  useEffect(() => { 
    if (isConfirmed) { 
        toast.dismiss('tx'); toast.success("Success!"); 
        const val = parseFloat(amount);
        const estPrice = currentPrice > 0 ? currentPrice : 0.000001;
        const estTokens = activeTab === "buy" ? val / estPrice : val;
        const estMatic = activeTab === "buy" ? val : val * estPrice;
        const newTrade = { user: address || "You", type: activeTab === "buy" ? "BUY" : "SELL", maticAmount: estMatic.toFixed(4), tokenAmount: BigInt(Math.floor(estTokens * 10**18)), price: estPrice.toFixed(8), time: "Just now" };
        
        setTradeHistory(prev => [newTrade, ...prev]);
        setChartData(prev => [...prev, { name: "New", price: estPrice, isUp: activeTab === "buy", fill: activeTab === "buy" ? '#10b981' : '#ef4444' }]);
        if(activeTab === "buy") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000); playSound('buy'); } else { playSound('sell'); }
        
        setAmount(""); refetchSales(); refetchTokenBalance(); refetchMatic(); setTimeout(fetchHistory, 2000);
    } 
  }, [isConfirmed]);

  const handlePercentage = (percent: number) => {
    if(activeTab === "buy") {
        const bal = maticBalance ? parseFloat(maticBalance.formatted) : 0;
        const max = bal - 0.02; 
        if(max > 0) setAmount((max * (percent/100)).toFixed(4));
    } else {
        const bal = userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)) : 0;
        setAmount((bal * (percent/100)).toFixed(2));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white font-sans selection:bg-[#FDDC11] selection:text-black">
      <Toaster position="top-right" toastOptions={{ style: { background: '#181a20', color: '#fff', border: '1px solid #333' } }} />
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={200} />}
      
      <header className="sticky top-0 z-40 bg-[#1a0e2e]/90 backdrop-blur-md border-b border-white/5 p-3 flex justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white"><ArrowLeft size={18} /> Board</Link>
        <div className="flex gap-2">
            <button onClick={handleTip} className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold hover:bg-yellow-500/30"><Gift size={12}/> Tip Creator</button>
            <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SOL KOLON */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-[#2d1b4e] rounded-xl border border-white/10 overflow-hidden shadow-lg"><img src={getTokenImage(tokenAddress, image)} className="w-full h-full object-cover"/></div>
                <div className="flex-1">
                    <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-white">{name?.toString() || "Loading..."}</h1><span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKN"}]</span></div>
                    {desc && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{desc}</p>}
                    <div className="flex gap-2 mt-2">
                        {twitter && <a href={twitter} target="_blank" className="p-2 bg-[#2d1b4e] rounded hover:text-[#FDDC11]"><Twitter size={14}/></a>}
                        {telegram && <a href={telegram} target="_blank" className="p-2 bg-[#2d1b4e] rounded hover:text-[#FDDC11]"><Send size={14}/></a>}
                        {web && <a href={web} target="_blank" className="p-2 bg-[#2d1b4e] rounded hover:text-[#FDDC11]"><Globe size={14}/></a>}
                    </div>
                </div>
            </div>

            <div className="bg-[#2d1b4e]/50 border border-white/5 rounded-2xl p-5 h-[450px] shadow-xl">
                <div className="flex justify-between items-center mb-4"><div className="flex gap-4"><div className="text-lg font-bold text-white">{currentPrice.toFixed(6)} MATIC</div><div className="text-lg font-bold text-[#FDDC11]">MC: {(marketCap).toLocaleString()} MATIC</div></div></div>
                <ResponsiveContainer width="100%" height="90%">
                    <ComposedChart data={chartData}>
                        <YAxis domain={['auto', 'auto']} hide />
                        <Tooltip contentStyle={{ backgroundColor: '#181a20', border: '1px solid #333' }} />
                        <Bar dataKey="price" shape={<CustomCandle />} isAnimationActive={false}>
                            {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex gap-1 bg-[#2d1b4e] p-1 rounded-lg border border-white/5 w-fit">
                    {["trades", "holders", "chat", "meme"].map(tab => (
                        <button key={tab} onClick={() => setBottomTab(tab as any)} className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${bottomTab === tab ? "bg-[#3e2465] text-white" : "text-gray-500 hover:text-white"}`}>{tab}</button>
                    ))}
                </div>
                <div className="bg-[#2d1b4e]/50 border border-white/5 rounded-2xl p-4 min-h-[300px]">
                    {bottomTab === "trades" && (
                        <div className="flex flex-col gap-1">
                            <div className="grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase px-3 pb-2"><div>User</div><div>Type</div><div>MATIC</div><div>Tokens</div><div className="text-right">Price</div></div>
                            {tradeHistory.map((trade, i) => (
                                <div key={i} className={`grid grid-cols-5 text-xs py-3 px-3 rounded-lg border-b border-white/5 ${trade.user.toLowerCase() === creatorAddress?.toLowerCase() ? 'bg-purple-900/30 border-purple-500/50 animate-pulse' : 'hover:bg-white/5'}`}>
                                    <div className="font-mono text-gray-400 flex items-center gap-1">{trade.user.slice(0,6)}... {trade.user.toLowerCase() === creatorAddress?.toLowerCase() && <span className="bg-purple-500 text-white text-[8px] px-1 rounded">DEV</span>}</div>
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
                            <div className="w-2/3 flex flex-col gap-2">{holderList.map((h,i)=>(<div key={i} className="flex justify-between text-xs border-b border-white/5 pb-1"><span className="font-mono text-gray-400">{h.address.slice(0,6)}... {h.address.toLowerCase() === creatorAddress?.toLowerCase() && "(DEV)"}</span><span className="text-white">{h.percentage.toFixed(2)}%</span></div>))}</div>
                        </div>
                    )}
                    {bottomTab === "chat" && <ChatBox tokenAddress={tokenAddress} />}
                    {bottomTab === "meme" && <MemeGenerator tokenImage={tokenImage} symbol={symbol?.toString() || "TKN"} />}
                </div>
            </div>
        </div>

        {/* SAĞ KOLON */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#2d1b4e] border border-white/10 rounded-2xl p-5 sticky top-24">
                <div className="flex justify-between items-center mb-4">
                     <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-white"><Settings size={16}/></button>
                     {showSettings && (
                        <div className="absolute top-12 right-5 bg-[#1a0e2e] border border-white/20 p-3 rounded-lg z-50 shadow-xl w-48">
                            <div className="text-xs font-bold text-white mb-2">Pro Settings</div>
                            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-400 flex items-center gap-1"><Crosshair size={10}/> Sniper Mode</span><input type="checkbox" checked={sniperMode} onChange={e=>setSniperMode(e.target.checked)}/></div>
                            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-400 flex items-center gap-1"><Lock size={10}/> MEV Protect</span><input type="checkbox" checked={mevProtect} onChange={e=>setMevProtect(e.target.checked)}/></div>
                            <div className="text-xs text-gray-400 mb-1">Price Alert</div>
                            <input type="text" placeholder="Target Price..." className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white" value={priceAlert} onChange={e=>setPriceAlert(e.target.value)} />
                        </div>
                     )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => setActiveTab("buy")} className={`py-3 rounded-xl font-black ${activeTab==="buy"?"bg-green-500 text-white":"bg-white/5 text-gray-400"}`}>Buy</button>
                    <button onClick={() => setActiveTab("sell")} className={`py-3 rounded-xl font-black ${activeTab==="sell"?"bg-red-500 text-white":"bg-white/5 text-gray-400"}`}>Sell</button>
                </div>

                <div className="bg-[#1a0e2e] rounded-xl p-4 mb-4 border border-white/5">
                    <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Amount</span><span>Bal: {activeTab==="buy" ? `${maticBalance?.formatted?.slice(0,5)} MATIC` : `${parseFloat(formatEther(userTokenBalance as bigint)).toFixed(2)} ${symbol}`}</span></div>
                    <input type="number" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-2xl font-black text-white outline-none" />
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[10, 25, 50, 100].map(p => (
                        <button key={p} onClick={() => handlePercentage(p)} className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold">{p === 100 ? "MAX" : `${p}%`}</button>
                    ))}
                </div>

                <div className="flex justify-end gap-2 items-center mb-4">
                    <span className="text-xs text-gray-500">Slippage:</span>
                    <select value={slippage} onChange={e=>setSlippage(Number(e.target.value))} className="bg-transparent text-[#FDDC11] text-xs font-bold outline-none"><option value={1}>1%</option><option value={5}>5%</option><option value={10}>10%</option></select>
                </div>

                <button onClick={handleTx} disabled={isPending || isConfirming} className={`w-full py-4 rounded-xl font-black ${activeTab==="buy"?"bg-green-500 hover:bg-green-600":"bg-red-500 hover:bg-red-600"} text-white transition-all`}>
                    {isPending ? "Processing..." : activeTab === "buy" ? "PLACE BUY ORDER" : "PLACE SELL ORDER"}
                </button>
            </div>

            <div className="bg-[#2d1b4e]/50 border border-white/5 rounded-xl p-4 space-y-4">
                <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Bonding Curve</span><span className="text-white">{realProgress.toFixed(1)}%</span></div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500" style={{ width: `${realProgress}%` }} /></div>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Dex Graduation</span><span className="text-green-400">{migrationProgress.toFixed(1)}%</span></div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-500" style={{ width: `${migrationProgress}%` }} /></div>
                </div>
                <InfoRow label="Market Cap" value={`${marketCap.toLocaleString()} MATIC`} />
                <InfoRow label="Holders" value={holderList.length} />
            </div>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: any) { return (<div className="flex justify-between items-center text-xs"><span className="text-gray-500">{label}</span><span className="text-gray-200 font-bold">{value}</span></div>); }
