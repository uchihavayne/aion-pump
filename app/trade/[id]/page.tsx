"use client";

import { useState, use, useEffect, useRef } from "react";
import { ArrowLeft, Twitter, Globe, Send, Copy, TrendingUp, MessageSquare, User, ExternalLink } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient } from "wagmi"; 
import { parseEther, formatEther, erc20Abi } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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
  
  // DATA STATE
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const processedTxHashes = useRef(new Set()); // Çift işlem kontrolü

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

  // --- GEÇMİŞİ ÇEKME MANTIĞI (DÜZELTİLDİ) ---
  const fetchHistory = async () => {
    if (!publicClient) return;
    try {
      // Önce geçmişi temizle ki çift yazmasın
      processedTxHashes.current = new Set(); 

      const [buyLogs, sellLogs] = await Promise.all([
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', args: { token: tokenAddress }, fromBlock: 'earliest' }),
        publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', args: { token: tokenAddress }, fromBlock: 'earliest' })
      ]);

      // Eventleri birleştir ve ESKİDEN YENİYE doğru sırala (Grafik için)
      const allEvents = [...buyLogs.map(l => ({ ...l, type: "BUY" })), ...sellLogs.map(l => ({ ...l, type: "SELL" }))]
        .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || a.logIndex - b.logIndex);

      const newChartData: any[] = [];
      const newTrades: any[] = [];
      let lastPrice = 0.0000001; // Başlangıç fiyatı

      allEvents.forEach((event: any) => {
        if (processedTxHashes.current.has(event.transactionHash)) return;
        processedTxHashes.current.add(event.transactionHash);

        const maticVal = parseFloat(formatEther(event.args.amountMATIC || 0n));
        const tokenVal = parseFloat(formatEther(event.args.amountTokens || 0n));
        
        // Fiyat Hesaplama
        let executionPrice = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
        
        // Trade Listesi (En yeni en üstte olacak şekilde unshift)
        newTrades.unshift({
          user: event.args.buyer || event.args.seller,
          type: event.type,
          amount: maticVal.toFixed(4),
          price: executionPrice.toFixed(8),
          time: `Blk ${event.blockNumber}`
        });

        // Grafik Verisi (Eskiden yeniye push)
        newChartData.push({ name: event.blockNumber.toString(), price: executionPrice });
        lastPrice = executionPrice;
      });

      if (newChartData.length > 0) setChartData(newChartData);
      if (newTrades.length > 0) setTradeHistory(newTrades);
      
    } catch (e) { console.error("History Error:", e); }
  };

  useEffect(() => {
    fetchHistory();
    const storedComments = localStorage.getItem(`comments_${tokenAddress}`);
    if(storedComments) setComments(JSON.parse(storedComments));
  }, [tokenAddress, publicClient]);

  // --- CANLI EVENT DİNLEME (DÜZELTİLDİ) ---
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', onLogs(logs: any) { processLiveLog(logs[0], "BUY"); } });
  useWatchContractEvent({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', onLogs(logs: any) { processLiveLog(logs[0], "SELL"); } });

  const processLiveLog = (log: any, type: "BUY" | "SELL") => {
    if(log.args.token.toLowerCase() !== tokenAddress.toLowerCase()) return;
    if(processedTxHashes.current.has(log.transactionHash)) return;
    processedTxHashes.current.add(log.transactionHash);

    const maticVal = parseFloat(formatEther(log.args.amountMATIC || 0n));
    const tokenVal = parseFloat(formatEther(log.args.amountTokens || 0n));
    
    // Anlık fiyat hesapla, yoksa son fiyatı al
    const currentChartPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
    const executionPrice = tokenVal > 0 ? maticVal / tokenVal : currentChartPrice;
    
    // Grafiğe yeni nokta ekle
    setChartData(prev => [...prev, { name: "New", price: executionPrice }]);
    
    // Trade listesinin en tepesine ekle
    setTradeHistory(prev => [{ 
        user: type === "BUY" ? log.args.buyer : log.args.seller, 
        type: type, 
        amount: maticVal.toFixed(4), 
        price: executionPrice.toFixed(8), 
        time: "Just now" 
    }, ...prev]);

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
        // Sell işleminde token miktarını gönderiyoruz
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
                  {twitter && <a href={twitter} target="_blank" rel="noopener noreferrer" style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(253, 220, 17, 0.1)', color: '#94a3b8', textDecoration: 'none', display: 'flex' }}><Twitter size={16} /></a>}
                  {telegram && <a href={telegram} target="_blank" rel="noopener noreferrer" style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(253, 220, 17, 0.1)', color: '#94a3b8', textDecoration: 'none', display: 'flex' }}><Send size={16} /></a>}
                  {web && <a href={web} target="_blank" rel="noopener noreferrer" style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(253, 220, 17, 0.1)', color: '#94a3b8', textDecoration: 'none', display: 'flex' }}><Globe size={16} /></a>}
                  <a href={`https://polygonscan.com/address/${tokenAddress}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', textDecoration: 'none' }}><ExternalLink size={12} /> Explore</a>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ borderRadius: '20px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '24px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div><div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Price</div><div style={{ fontSize: '32px', fontWeight: '900', marginTop: '4px' }}>{currentPrice.toFixed(6)} MATIC</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Market Cap</div><div style={{ fontSize: '24px', fontWeight: '700', marginTop: '4px' }}>${(parseFloat(collateral) * 3200).toLocaleString()}</div></div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FDDC11" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#FDDC11" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#666" style={{ fontSize: '12px' }} />
                    <YAxis domain={['auto', 'auto']} stroke="#666" style={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2128', border: '1px solid rgba(253, 220, 17, 0.2)', borderRadius: '8px', color: '#fff' }} />
                    <Line type="monotone" dataKey="price" stroke="#FDDC11" dot={false} isAnimationActive={false} strokeWidth={2} />
                  </LineChart>
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
                      tradeHistory.map((trade, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(253, 220, 17, 0.1)', fontSize: '12px' }}>
                          <div style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{trade.user.slice(0,6)}...</div>
                          <div style={{ color: trade.type === "BUY" ? '#10b981' : '#ef4444', fontWeight: '700' }}>{trade.type}</div>
                          <div style={{ color: '#fff' }}>{trade.amount} MATIC</div>
                        </div>
                      ))
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
                    <span>Bal: {activeTab === "buy" ? "0.00 MATIC" : `${userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)).toFixed(2) : "0.00"} ${symbol}`}</span>
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
                  <span style={{ color: '#fff', fontWeight: '700' }}>${(parseFloat(collateral) * 3200).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Collateral</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>{parseFloat(collateral).toFixed(4)} MATIC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Supply</span>
                  <span style={{ color: '#fff', fontWeight: '700' }}>1,000,000,000</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
