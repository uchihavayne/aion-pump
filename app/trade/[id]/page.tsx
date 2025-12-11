"use client";

import { useState, useEffect, useRef, use } from "react";
import { ArrowLeft, Twitter, Globe, Send, Copy, TrendingUp, MessageSquare, User, ExternalLink, Coins } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient, useBalance } from "wagmi"; 
import { parseEther, formatEther, erc20Abi } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from "framer-motion";

const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

// Formatlama Yardımcıları
const formatTokenAmount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
  if (num >= 1000) return (num / 1000).toFixed(2) + "k";
  return num.toFixed(2);
};

const CustomCandle = (props: any) => {
  const { x, y, width, height, fill } = props;
  return <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={fill} rx={2} />;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function TradePage(props: PageProps) {
  const params = use(props.params);
  const id = params.id;
  const tokenAddress = id as `0x${string}`;
  const publicClient = usePublicClient(); 

  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat">("trades");
  const [amount, setAmount] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  
  // Data States
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [holders, setHolders] = useState<number>(1);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const processedTxHashes = useRef(new Set());

  const { isConnected, address } = useAccount();

  // 1. GERÇEK MATIC BAKİYESİ
  const { data: maticBalance, refetch: refetchMatic } = useBalance({ address: address });

  // 2. TOKEN BAKİYESİ
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`], query: { enabled: !!address }
  });

  // 3. KONTRAT VERİLERİ
  const { data: salesData, refetch: refetchSales } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });
  const { data: metadata } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "tokenMetadata", args: [tokenAddress] });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n);
  const realProgress = Math.min(progress, 100);
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0.000001;
  const marketCap = currentPrice * 1_000_000_000;

  const desc = metadata ? metadata[0] : "";
  const twitter = metadata ? metadata[1] : "";
  const telegram = metadata ? metadata[2] : "";
  const web = metadata ? metadata[3] : "";

  // 4. GEÇMİŞ İŞLEMLERİ ÇEKME
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

      const buyers = new Set(relevantBuys.map((l: any) => l.args.buyer));
      setHolders(buyers.size > 0 ? buyers.size : 1);

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

        newChartData.push({ 
            name: event.blockNumber.toString(), 
            price: executionPrice,
            isUp: event.type === "BUY",
            fill: event.type === "BUY" ? '#10b981' : '#ef4444'
        });
        lastPrice = executionPrice;
      });

      if (newChartData.length > 0) setChartData(newChartData);
      if (newTrades.length > 0) setTradeHistory(newTrades);
      
    } catch (e) { console.error("History Error:", e); }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    const storedComments = localStorage.getItem(`comments_${tokenAddress}`);
    if(storedComments) setComments(JSON.parse(storedComments));
    return () => clearInterval(interval);
  }, [tokenAddress, publicClient]);

  // CANLI DİNLEME
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', onLogs(logs: any) { processLiveLog(logs[0], "BUY"); } });
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', onLogs(logs: any) { processLiveLog(logs[0], "SELL"); } });

  const processLiveLog = (log: any, type: "BUY" | "SELL") => {
    if(log.args.token.toLowerCase() !== tokenAddress.toLowerCase()) return;
    if(processedTxHashes.current.has(log.transactionHash)) return;
    processedTxHashes.current.add(log.transactionHash);

    const maticVal = parseFloat(formatEther(log.args.amountMATIC || 0n));
    const tokenVal = parseFloat(formatEther(log.args.amountTokens || 0n));
    const executionPrice = tokenVal > 0 ? maticVal / tokenVal : (chartData.length > 0 ? chartData[chartData.length-1].price : 0);
    
    setChartData(prev => [...prev, { name: "New", price: executionPrice, isUp: type === "BUY", fill: type === "BUY" ? '#10b981' : '#ef4444' }]);
    
    setTradeHistory(prev => [{ 
        user: type === "BUY" ? log.args.buyer : log.args.seller, 
        type: type, 
        maticAmount: maticVal.toFixed(4), 
        tokenAmount: tokenVal, 
        price: executionPrice.toFixed(8), 
        time: "Just now" 
    }, ...prev]);

    if (type === "BUY") setHolders(prev => prev + 1);

    refetchSales();
    refetchTokenBalance();
    refetchMatic();
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
    if (isConfirmed) { 
        toast.dismiss('tx'); 
        toast.success("Success!"); 
        
        // Optimistic UI Update (Anında Ekrana Bas)
        const val = parseFloat(amount);
        const estPrice = currentPrice > 0 ? currentPrice : 0.000001;
        const estTokens = activeTab === "buy" ? val / estPrice : val;
        const estMatic = activeTab === "buy" ? val : val * estPrice;

        const newTrade = {
            user: address || "You",
            type: activeTab === "buy" ? "BUY" : "SELL",
            maticAmount: estMatic.toFixed(4),
            tokenAmount: estTokens,
            price: estPrice.toFixed(8),
            time: "Just now"
        };
        setTradeHistory(prev => [newTrade, ...prev]);
        setChartData(prev => [...prev, { name: "New", price: estPrice, isUp: activeTab === "buy", fill: activeTab === "buy" ? '#10b981' : '#ef4444' }]);

        setAmount(""); 
        refetchSales();
        refetchTokenBalance();
        refetchMatic();
        setTimeout(fetchHistory, 2000); 
    } 
  }, [isConfirmed]);

  const handleComment = () => {
    if(!commentInput.trim()) return;
    const newC = { user: "You", text: commentInput, time: "Just now" };
    setComments([newC, ...comments]);
    localStorage.setItem(`comments_${tokenAddress}`, JSON.stringify([newC, ...comments]));
    setCommentInput("");
  };

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  return (
    <div style={{ backgroundColor: '#0a0e27', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />
      
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'rgba(10, 14, 39, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', textDecoration: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={18} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Back</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgba(253, 220, 17, 0.1)', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.3s' }} onClick={() => { navigator.clipboard.writeText(tokenAddress); toast.success("Copied!"); }}>
              <span style={{ color: '#FDDC11' }}>CA:</span> {tokenAddress.slice(0,6)}...{tokenAddress.slice(-4)}
              <Copy size={12} />
            </div>
            <div style={{ transform: 'scale(0.9)' }}><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '20px', padding: '24px', borderRadius: '20px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', gridColumn: '1 / -1' }}>
              <img src={getTokenImage(tokenAddress)} alt="token" style={{ width: '80px', height: '80px', borderRadius: '16px', border: '1px solid rgba(253, 220, 17, 0.2)', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0 }}>{name?.toString() || "Token"}</h1>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>[{symbol?.toString() || "TKN"}]</span>
                </div>
                {desc && <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>{desc}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {twitter && <SocialIcon href={twitter} icon={<Twitter size={16} />} />}
                  {telegram && <SocialIcon href={telegram} icon={<Send size={16} />} />}
                  {web && <SocialIcon href={web} icon={<Globe size={16} />} />}
                  <a href={`https://polygonscan.com/address/${tokenAddress}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', textDecoration: 'none' }}><ExternalLink size={12} /> Explore</a>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ borderRadius: '20px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '24px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div><div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Price</div><div style={{ fontSize: '32px', fontWeight: '900', marginTop: '4px' }}>{currentPrice.toFixed(6)} MATIC</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Market Cap</div><div style={{ fontSize: '24px', fontWeight: '700', marginTop: '4px' }}>{marketCap.toLocaleString(undefined, {maximumFractionDigits: 2})} MATIC</div></div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData}>
                    <XAxis dataKey="name" stroke="#666" style={{ fontSize: '12px' }} />
                    <YAxis domain={['auto', 'auto']} stroke="#666" style={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2128', border: '1px solid rgba(253, 220, 17, 0.2)', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="price" shape={<CustomCandle />} isAnimationActive={false}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Waiting for trades...</div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ borderRadius: '20px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', overflow: 'hidden', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button onClick={() => setBottomTab("trades")} style={{ flex: 1, padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: bottomTab === "trades" ? '#fff' : '#94a3b8', backgroundColor: bottomTab === "trades" ? 'rgba(30, 41, 59, 0.6)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <TrendingUp size={16} /> Trades
                </button>
                <button onClick={() => setBottomTab("chat")} style={{ flex: 1, padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: bottomTab === "chat" ? '#fff' : '#94a3b8', backgroundColor: bottomTab === "chat" ? 'rgba(30, 41, 59, 0.6)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <MessageSquare size={16} /> Comments
                </button>
              </div>
              <div style={{ padding: '16px' }}>
                {bottomTab === "trades" ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tradeHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: '14px' }}>No trades yet</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase px-3 pb-2">
                            <div>User</div>
                            <div>Type</div>
                            <div>MATIC</div>
                            <div>Tokens</div>
                            <div className="text-right">Price</div>
                        </div>
                        {tradeHistory.map((trade, i) => (
                            <div key={i} className="grid grid-cols-5 text-xs py-3 px-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5 last:border-0">
                                <div className="font-mono text-gray-400">{trade.user.slice(0,6)}...</div>
                                <div style={{ color: trade.type === "BUY" ? '#10b981' : '#ef4444', fontWeight: '700' }}>{trade.type}</div>
                                <div className="text-white">{trade.maticAmount}</div>
                                <div className="text-white">{formatTokenAmount(trade.tokenAmount)}</div>
                                <div className="text-right text-gray-500">{trade.price}</div>
                            </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comments.map((c, i) => (
                        <div key={i} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(253, 220, 17, 0.1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <User size={12} style={{ color: '#FDDC11' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{c.user}</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{c.time}</span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#d1d5db', margin: 0 }}>{c.text}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleComment()} placeholder="Write a comment..." style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(253, 220, 17, 0.1)', backgroundColor: 'rgba(30, 41, 59, 0.5)', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: 'inherit' }} />
                      <button onClick={handleComment} style={{ padding: '10px 12px', backgroundColor: '#FDDC11', color: '#000', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '100px', height: 'fit-content' }}>
            <div style={{ borderRadius: '20px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <button onClick={() => setActiveTab("buy")} style={{ padding: '16px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', border: activeTab === "buy" ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: activeTab === "buy" ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: activeTab === "buy" ? '#10b981' : '#94a3b8', cursor: 'pointer' }}>Buy</button>
                <button onClick={() => setActiveTab("sell")} style={{ padding: '16px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', border: activeTab === "sell" ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: activeTab === "sell" ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: activeTab === "sell" ? '#ef4444' : '#94a3b8', cursor: 'pointer' }}>Sell</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>Amount</span>
                    <span>Bal: {activeTab === "buy" 
                        ? `${maticBalance?.formatted ? parseFloat(maticBalance.formatted).toFixed(4) : "0.00"} MATIC` 
                        : `${userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)).toFixed(2) : "0.00"} ${symbol}`
                    }</span>
                  </div>
                  <input type="number" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%', fontSize: '36px', fontWeight: '900', backgroundColor: 'transparent', color: '#fff', outline: 'none', border: 'none', fontFamily: 'inherit' }} />
                  <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>{activeTab === "buy" ? "MATIC" : symbol || "TKN"}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {["0.1", "0.5", "1", "5"].map((v) => (
                    <button key={v} onClick={() => setAmount(v)} style={{ padding: '10px', borderRadius: '10px', border: '1px solid rgba(253, 220, 17, 0.1)', backgroundColor: 'rgba(30, 41, 59, 0.5)', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>{v}</button>
                  ))}
                </div>
                <button onClick={handleTx} disabled={isPending || isConfirming || !isConnected} style={{ width: '100%', padding: '16px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', border: 'none', backgroundColor: activeTab === "buy" ? '#10b981' : '#ef4444', color: '#fff', cursor: 'pointer', opacity: (isPending || isConfirming || !isConnected) ? 0.5 : 1 }}>
                  {isPending ? "Processing..." : isConfirming ? "Confirming..." : activeTab === "buy" ? "BUY" : "SELL"}
                </button>
              </div>
            </div>

            <div style={{ borderRadius: '20px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Bonding Curve</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span></span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{realProgress.toFixed(1)}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
             <div style={{
                    height: '100%',
                    width: `${realProgress}%`,
                    background: 'linear-gradient(90deg, #FDDC11 0%, #fef08a 100%)',
                    transition: 'width 0.3s ease',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Market Cap</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{marketCap.toLocaleString(undefined, {maximumFractionDigits: 2})} MATIC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Collateral</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{parseFloat(collateral).toFixed(4)} MATIC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Supply</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>1,000,000,000</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Holders</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{holders}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function SocialIcon({ icon, href }: { icon: any, href: string }) { return <a href={href} target="_blank" className="p-2 bg-[#2d1b4e] hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#FDDC11] transition-colors cursor-pointer border border-white/5">{icon}</a>; }
