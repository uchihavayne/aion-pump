"use client";

import { useState, use, useEffect, useRef } from "react";
import { ArrowLeft, Twitter, Globe, Send, Copy, TrendingUp, MessageSquare, User, ExternalLink } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient } from "wagmi"; 
import { parseEther, formatEther, erc20Abi } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Grid } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from "framer-motion";

const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

export default function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tokenAddress = id as `0x${string}`;
  const publicClient = usePublicClient(); 

  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat">("trades");
  const [amount, setAmount] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const processedTxHashes = useRef(new Set());

  const { isConnected, address } = useAccount();

  const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`], query: { enabled: !!address }
  });

  const { data: salesData, refetch: refetchSales } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;

  const desc = metadata ? metadata[0] : "";
  const twitter = metadata ? metadata[1] : "";
  const telegram = metadata ? metadata[2] : "";
  const web = metadata ? metadata[3] : "";

  const fetchHistory = async () => {
    if (!publicClient) return;
    try {
      const [buyLogs, sellLogs] = await Promise.all([
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', args: { token: tokenAddress }, fromBlock: 'earliest' }),
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', args: { token: tokenAddress }, fromBlock: 'earliest' })
      ]);

      const allEvents = [...buyLogs.map(l => ({ ...l, type: "BUY" })), ...sellLogs.map(l => ({ ...l, type: "SELL" }))]
        .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || a.logIndex - b.logIndex);

      const newChartData: any[] = [];
      const newTrades: any[] = [];
      let lastPrice = 0.0000001;

      allEvents.forEach((event: any) => {
        if (processedTxHashes.current.has(event.transactionHash)) return;
        processedTxHashes.current.add(event.transactionHash);

        const maticVal = parseFloat(formatEther(event.args.amountMATIC));
        const tokenVal = parseFloat(formatEther(event.args.amountTokens));
        let executionPrice = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
        
        newTrades.unshift({
          user: event.args.buyer || event.args.seller,
          type: event.type,
          amount: maticVal.toFixed(4),
          price: executionPrice.toFixed(8),
          time: `Blk ${event.blockNumber}`
        });

        newChartData.push({ name: event.blockNumber.toString(), price: executionPrice });
        lastPrice = executionPrice;
      });

      if (newChartData.length > 0) setChartData(newChartData);
      if (newTrades.length > 0) setTradeHistory(newTrades);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchHistory();
    const storedComments = localStorage.getItem(`comments_${tokenAddress}`);
    if(storedComments) setComments(JSON.parse(storedComments));
  }, [tokenAddress, publicClient]);

  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', onLogs(logs: any) { processLiveLog(logs[0], "BUY"); } });
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', onLogs(logs: any) { processLiveLog(logs[0], "SELL"); } });

  const processLiveLog = (log: any, type: "BUY" | "SELL") => {
    if(log.args.token.toLowerCase() !== tokenAddress.toLowerCase()) return;
    if(processedTxHashes.current.has(log.transactionHash)) return;
    processedTxHashes.current.add(log.transactionHash);

    const maticVal = parseFloat(formatEther(log.args.amountMATIC));
    const tokenVal = parseFloat(formatEther(log.args.amountTokens));
    const executionPrice = tokenVal > 0 ? maticVal / tokenVal : 0;
    
    setChartData(prev => [...prev, { name: "New", price: executionPrice }]);
    setTradeHistory(prev => [{ user: type === "BUY" ? log.args.buyer : log.args.seller, type: type, amount: maticVal.toFixed(4), price: executionPrice.toFixed(8), time: "Just now" }, ...prev]);
    refetchBalance(); 
    refetchSales();
  };

  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleTx = () => {
    if (!amount) { toast.error("Enter amount"); return; }
    try {
      const val = parseEther(amount);
      if (activeTab === "buy") {
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "buy", args: [tokenAddress], value: val });
      } else {
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sell", args: [tokenAddress, val] });
      }
      toast.loading("Confirming...", { id: 'tx' });
    } catch(e) { toast.error("Failed"); toast.dismiss('tx'); }
  };

  useEffect(() => { 
    if (isConfirmed) { toast.dismiss('tx'); toast.success("Trade successful!"); setAmount(""); refetchBalance(); } 
  }, [isConfirmed]);

  const handleComment = () => {
    if(!commentInput.trim()) return;
    const newC = { user: "You", text: commentInput, time: "Just now" };
    const updated = [newC, ...comments];
    setComments(updated);
    localStorage.setItem(`comments_${tokenAddress}`, JSON.stringify(updated));
    setCommentInput("");
  };

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #333' } }} />
      
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-black/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Back</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs text-gray-400 font-mono">
              <span className="text-[#FDDC11]">CA:</span> {tokenAddress.slice(0,6)}...{tokenAddress.slice(-4)}
              <Copy size={12} className="cursor-pointer hover:text-white" onClick={() => {navigator.clipboard.writeText(tokenAddress); toast.success("Copied!")}}/>
            </div>
            <div className="scale-90"><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4">
            <img src={getTokenImage(tokenAddress)} alt="token" className="w-20 h-20 rounded-xl border border-white/20 object-cover" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-black">{name?.toString() || "Token"}</h1>
                <span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKN"}]</span>
              </div>
              {desc && <p className="text-sm text-gray-400 mb-3">{desc}</p>}
              <div className="flex items-center gap-2">
                {twitter && <a href={twitter} target="_blank" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"><Twitter size={14} /></a>}
                {telegram && <a href={telegram} target="_blank" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"><Send size={14} /></a>}
                {web && <a href={web} target="_blank" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"><Globe size={14} /></a>}
                <a href={`https://polygonscan.com/address/${tokenAddress}`} target="_blank" className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"><ExternalLink size={12}/> Explore</a>
              </div>
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-xs text-gray-500 font-medium">Price</div>
                <div className="text-3xl font-black mt-1">{currentPrice.toFixed(6)} MATIC</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">Market Cap</div>
                <div className="text-2xl font-bold mt-1">${(parseFloat(collateral) * 3200).toLocaleString()}</div>
              </div>
            </div>
            
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FDDC11" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#FDDC11" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#666" style={{ fontSize: '12px' }} />
                  <YAxis domain={['auto', 'auto']} stroke="#666" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="price" stroke="#FDDC11" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Waiting for trades...
              </div>
            )}
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md overflow-hidden">
            <div className="flex border-b border-white/10">
              <button onClick={() => setBottomTab("trades")} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${bottomTab === "trades" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
                <TrendingUp className="inline mr-2" size={16} /> Trades
              </button>
              <button onClick={() => setBottomTab("chat")} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${bottomTab === "chat" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
                <MessageSquare className="inline mr-2" size={16} /> Comments
              </button>
            </div>
            
            <div className="p-4">
              {bottomTab === "trades" ? (
                <div className="space-y-2">
                  {tradeHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">No trades yet</div>
                  ) : (
                    tradeHistory.map((trade, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 text-xs">
                        <div className="font-mono text-gray-400">{trade.user.slice(0,6)}...</div>
                        <div className={trade.type === "BUY" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{trade.type}</div>
                        <div className="text-white">{trade.amount} MATIC</div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {comments.map((c, i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <User size={12} className="text-[#FDDC11]" />
                          <span className="text-xs font-bold">{c.user}</span>
                          <span className="text-[10px] text-gray-500">{c.time}</span>
                        </div>
                        <p className="text-xs text-gray-300">{c.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <input 
                      type="text" 
                      value={commentInput} 
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                      placeholder="Write a comment..." 
                      className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-gray-600 text-xs focus:border-[#FDDC11] focus:outline-none"
                    />
                    <button onClick={handleComment} className="p-2.5 bg-[#FDDC11] text-black rounded-lg hover:bg-[#ffe55c] transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Trade Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          {/* Trade Card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md p-6 sticky top-24">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button 
                onClick={() => setActiveTab("buy")}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "buy" ? "bg-green-500/20 border border-green-500/50 text-green-400" : "bg-white/10 border border-white/10 text-gray-400"}`}
              >
                Buy
              </button>
              <button 
                onClick={() => setActiveTab("sell")}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "sell" ? "bg-red-500/20 border border-red-500/50 text-red-400" : "bg-white/10 border border-white/10 text-gray-400"}`}
              >
                Sell
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                <div className="flex justify-between mb-2 text-xs text-gray-400">
                  <span>Amount</span>
                  <span>Bal: {activeTab === "buy" ? "0.00 MATIC" : `${userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)).toFixed(2) : "0.00"} ${symbol}`}</span>
                </div>
                <input 
                  type="number" 
                  placeholder="0.0" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-4xl font-black bg-transparent text-white outline-none placeholder-white/50"
                />
                <div className="text-right mt-2 text-xs text-gray-400">
                  {activeTab === "buy" ? "MATIC" : symbol || "TKN"}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {["0.1", "0.5", "1", "5"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>

              <button
                onClick={handleTx}
                disabled={isPending || isConfirming || !isConnected}
                className={`w-full py-3.5 rounded-xl font-black text-sm transition-all ${
                  activeTab === "buy"
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isPending ? "Processing..." : activeTab === "buy" ? "BUY" : "SELL"}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md p-6 space-y-4">
            <div>
              <div className="text-xs text-gray-500 font-medium mb-2">Bonding Curve</div>
              <div className="flex justify-between mb-1.5 text-xs">
                <span></span>
                <span className="text-white font-bold">{realProgress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[#FDDC11] to-purple-500"
                  animate={{ width: `${realProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-white/10 pt-4">
              <div className="flex justify-between"><span className="text-gray-400">Market Cap</span><span className="text-white font-semibold">${(parseFloat(collateral) * 3200).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Collateral</span><span className="text-white font-semibold">{parseFloat(collateral).toFixed(4)} MATIC</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total Supply</span><span className="text-white font-semibold">1,000,000,000</span></div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
