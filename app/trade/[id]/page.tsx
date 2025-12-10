"use client";

import { useState, use, useEffect, useRef } from "react";
import { ArrowLeft, Twitter, Globe, Send, Copy, Coins, TrendingUp, MessageSquare, User, Activity, ExternalLink } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
// Wagmi & Viem & Utils
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient } from "wagmi"; 
import { parseEther, formatEther, erc20Abi } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
// Charts
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';

const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

// --- GRAFİK İÇİN ÖZEL MUM (CANDLE) ŞEKLİ ---
const CustomCandle = (props: any) => {
  const { x, y, width, height, fill } = props;
  // Mumun fitili (ince çizgi) - basitlik için burada bar'ın kendisini kullanıyoruz ama
  // daha gelişmiş görünüm için ortaya çizgi çekilebilir.
  return <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={fill} rx={2} />;
};

export default function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tokenAddress = id as `0x${string}`;
  const publicClient = usePublicClient(); 

  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat">("trades");
  const [amount, setAmount] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [meta, setMeta] = useState<any>({});
  
  // ÖNEMLİ: Grafik ve Trade verileri
  const [chartData, setChartData] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const processedTxHashes = useRef(new Set()); // Çift eklemeyi önlemek için

  const { isConnected, address } = useAccount();

  // 1. KULLANICININ TOKEN BAKİYESİ
  const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address }
  });

  // 2. TOKEN GENEL BİLGİLERİ
  const { data: salesData, refetch: refetchSales } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 1000000000000000000000000000n); // 1 Milyar Supply'a göre
  const realProgress = progress > 100 ? 100 : progress;
  
  // Şu anki fiyatı grafiğin son verisinden alıyoruz
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;

  // --- 3. GEÇMİŞ VERİLERİ VE GRAFİĞİ OLUŞTURMA ---
  const fetchHistory = async () => {
    if (!publicClient) return;
    
    try {
        // Blokzincirinden Buy ve Sell olaylarını çek
        const [buyLogs, sellLogs] = await Promise.all([
            publicClient.getContractEvents({ 
                address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', 
                args: { token: tokenAddress }, fromBlock: 'earliest' 
            }),
            publicClient.getContractEvents({ 
                address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', 
                args: { token: tokenAddress }, fromBlock: 'earliest' 
            })
        ]);

        // Verileri birleştir ve formatla
        const allEvents = [
            ...buyLogs.map(l => ({ ...l, type: "BUY" })),
            ...sellLogs.map(l => ({ ...l, type: "SELL" }))
        ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || a.logIndex - b.logIndex);

        const newChartData: any[] = [];
        const newTrades: any[] = [];
        
        let lastPrice = 0.0000001; // Başlangıç fiyatı (çok düşük)

        allEvents.forEach((event: any) => {
            // Çift işlem kontrolü
            if (processedTxHashes.current.has(event.transactionHash)) return;
            processedTxHashes.current.add(event.transactionHash);

            const maticVal = parseFloat(formatEther(event.args.amountMATIC));
            const tokenVal = parseFloat(formatEther(event.args.amountTokens));
            
            // Fiyat Hesaplama: MATIC / TOKEN
            // (Örn: 1 MATIC verip 1000 Token aldıysan fiyat 0.001'dir)
            let executionPrice = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
            
            // Trade Listesi İçin Veri
            newTrades.unshift({
                user: event.args.buyer || event.args.seller,
                type: event.type,
                amount: maticVal.toFixed(4), // MATIC cinsinden hacim
                tokenAmount: tokenVal.toFixed(2),
                price: executionPrice.toFixed(8),
                time: `Blk ${event.blockNumber}`, // Blok numarası (saat yerine)
                hash: event.transactionHash
            });

            // Grafik İçin Veri (Tick Chart Mantığı)
            // Her işlem bir bar oluşturur.
            // BUY: Yeşil, Fiyatı yukarı taşır (Görsel olarak)
            // SELL: Kırmızı, Fiyatı aşağı taşır
            newChartData.push({
                name: event.blockNumber.toString(),
                price: executionPrice,
                prevPrice: lastPrice, // Mumun nereden başladığını bilmek için
                isUp: event.type === "BUY",
                volume: maticVal
            });

            lastPrice = executionPrice;
        });

        if (newChartData.length > 0) setChartData(newChartData);
        if (newTrades.length > 0) setTradeHistory(newTrades);

    } catch (e) {
        console.error("History fetch error:", e);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Metadata ve yorumları yükle
    const stored = localStorage.getItem(`meta_${tokenAddress.toLowerCase()}`);
    if (stored) setMeta(JSON.parse(stored));
    const storedComments = localStorage.getItem(`comments_${tokenAddress}`);
    if(storedComments) setComments(JSON.parse(storedComments));
  }, [tokenAddress, publicClient]);

  // --- 4. CANLI GÜNCELLEME ---
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Buy', 
    onLogs(logs: any) { processLiveLog(logs[0], "BUY"); } 
  });
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, eventName: 'Sell', 
    onLogs(logs: any) { processLiveLog(logs[0], "SELL"); } 
  });

  const processLiveLog = (log: any, type: "BUY" | "SELL") => {
      if(log.args.token.toLowerCase() !== tokenAddress.toLowerCase()) return;
      if(processedTxHashes.current.has(log.transactionHash)) return;
      processedTxHashes.current.add(log.transactionHash);

      const maticVal = parseFloat(formatEther(log.args.amountMATIC));
      const tokenVal = parseFloat(formatEther(log.args.amountTokens));
      const executionPrice = tokenVal > 0 ? maticVal / tokenVal : 0;
      
      const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;

      // Grafiği güncelle
      setChartData(prev => [...prev, {
          name: "New",
          price: executionPrice,
          prevPrice: lastPrice,
          isUp: type === "BUY",
          volume: maticVal
      }]);

      // Listeyi güncelle
      setTradeHistory(prev => [{
          user: type === "BUY" ? log.args.buyer : log.args.seller,
          type: type,
          amount: maticVal.toFixed(4),
          tokenAmount: tokenVal.toFixed(2),
          price: executionPrice.toFixed(8),
          time: "Just now",
          hash: log.transactionHash
      }, ...prev]);

      refetchBalance();
      refetchSales();
  };

  // --- İŞLEM FONKSİYONLARI ---
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleTx = () => {
    if (!amount) { toast.error("Enter amount"); return; }
    try {
        if (activeTab === "buy") {
            writeContract({
                address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "buy",
                args: [tokenAddress],
                value: parseEther(amount), // Buy: MATIC gönderiyoruz
            });
        } else {
            // Sell: Token gönderiyoruz (Wei cinsinden)
            // Amount input'a girilen miktar TOKEN adedidir.
            writeContract({
                address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sell",
                args: [tokenAddress, parseEther(amount)], 
            });
        }
        toast.loading("Confirming...", { id: 'tx' });
    } catch(e) { toast.error("Failed"); toast.dismiss('tx'); }
  };

  useEffect(() => { 
      if (isConfirmed) { 
          toast.dismiss('tx'); 
          toast.success("Success!"); 
          setAmount(""); 
          refetchBalance(); 
      } 
  }, [isConfirmed]);

  const handleComment = () => {
      if(!commentInput) return;
      const newC = { user: "You", text: commentInput, time: "Just now" };
      setComments([newC, ...comments]);
      localStorage.setItem(`comments_${tokenAddress}`, JSON.stringify([newC, ...comments]));
      setCommentInput("");
  };

  if (!isMounted) { setIsMounted(true); return <div className="min-h-screen bg-[#1a0b2e]"/>; }

  // Kullanıcı Bakiyesi (Sell ekranı için)
  const balanceDisplay = activeTab === "buy" 
    ? "0.00 MATIC" // (Opsiyonel: useBalance ile gerçek MATIC bakiyesi çekilebilir)
    : `${userTokenBalance ? parseFloat(formatEther(userTokenBalance as bigint)).toFixed(2) : "0.00"} ${symbol || "TKR"}`;

  return (
    <div className="min-h-screen bg-[#1a0b2e] text-white font-sans selection:bg-[#FDDC11] selection:text-black">
      <Toaster position="top-right" toastOptions={{ style: { background: '#181a20', color: '#fff', border: '1px solid #333' } }} />
      
      {/* HEADER (Aynı kalıyor) */}
      <header className="sticky top-0 z-40 bg-[#1a0b2e]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /><span className="text-sm font-bold">Board</span></Link>
            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#2d1b4e] rounded-lg border border-white/5 text-xs text-gray-300 font-mono"><span className="text-[#FDDC11]">CA:</span> {tokenAddress.slice(0,6)}...{tokenAddress.slice(-4)}<Copy size={12} className="cursor-pointer hover:text-white" onClick={() => {navigator.clipboard.writeText(tokenAddress); toast.success("Copied")}}/></div>
                <div className="scale-90"><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div>
            </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* --- SOL KOLON (Grafik, Info, Trades) --- */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* TOKEN BİLGİSİ */}
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-[#2d1b4e] rounded-xl border border-white/10 overflow-hidden shadow-lg"><img src={getTokenImage(tokenAddress)} className="w-full h-full object-cover"/></div>
                <div className="flex-1">
                    <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-white">{name?.toString() || "Loading..."}</h1><span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKR"}]</span></div>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex gap-2">
                            {meta.twitter && <a href={meta.twitter} target="_blank" className="p-2 bg-[#2d1b4e] hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#FDDC11] transition-colors border border-white/5"><Twitter size={14}/></a>}
                            {meta.telegram && <a href={meta.telegram} target="_blank" className="p-2 bg-[#2d1b4e] hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#FDDC11] transition-colors border border-white/5"><Send size={14}/></a>}
                            {meta.website && <a href={meta.website} target="_blank" className="p-2 bg-[#2d1b4e] hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#FDDC11] transition-colors border border-white/5"><Globe size={14}/></a>}
                        </div>
                        <a href={`https://polygonscan.com/address/${tokenAddress}`} target="_blank" className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"><ExternalLink size={12}/> Explorer</a>
                    </div>
                </div>
            </div>

            {/* --- GRAFİK ALANI (GÜNCELLENDİ) --- */}
            <div className="bg-[#2d1b4e]/50 border border-white/5 rounded-2xl p-5 h-[450px] relative shadow-xl backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-4">
                        <StatItem label="Price" value={`${currentPrice.toFixed(6)} MATIC`} color="text-white" />
                        <StatItem label="Market Cap" value={`$${(parseFloat(collateral) * 3200).toLocaleString()}`} color="text-[#FDDC11]" />
                    </div>
                </div>
                <div className="w-full h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <YAxis domain={['auto', 'auto']} hide />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#181a20', border: '1px solid #333' }} 
                                labelStyle={{ display: 'none' }}
                                formatter={(value: any) => [value.toFixed(8), "Price"]}
                            />
                            {/* MUM ÇUBUKLARI */}
                            <Bar dataKey="price" shape={<CustomCandle />} isAnimationActive={false}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.isUp ? '#22c55e' : '#ef4444'} />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                    {chartData.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Waiting for first trade...</div>}
                </div>
            </div>

            {/* TABS (Trades & Chat) */}
            <div className="flex flex-col gap-4">
                <div className="flex gap-1 bg-[#2d1b4e] p-1 rounded-lg border border-white/5 w-fit">
                    <TabButton active={bottomTab === "trades"} onClick={() => setBottomTab("trades")} label="Recent Trades" icon={<TrendingUp size={14}/>} />
                    <TabButton active={bottomTab === "chat"} onClick={() => setBottomTab("chat")} label="Comments" icon={<MessageSquare size={14}/>} />
                </div>

                <div className="bg-[#2d1b4e]/50 border border-white/5 rounded-2xl p-4 min-h-[300px]">
                    {bottomTab === "trades" ? (
                        <div className="space-y-1">
                            {tradeHistory.length === 0 ? <div className="text-center py-10 text-gray-500 text-sm">No trades yet.</div> : (
                                <div className="flex flex-col gap-1">
                                    <div className="grid grid-cols-4 text-[10px] font-bold text-gray-500 uppercase px-3 pb-2">
                                        <div>User</div><div>Type</div><div>Value</div><div className="text-right">Price</div>
                                    </div>
                                    {tradeHistory.map((trade, i) => (
                                        <div key={i} className="grid grid-cols-4 text-xs py-3 px-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5 last:border-0">
                                            <div className="font-mono text-gray-400">{trade.user.slice(0,6)}...</div>
                                            <div className={trade.type === "BUY" ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{trade.type}</div>
                                            <div className="text-white font-medium">{trade.amount} MATIC</div>
                                            <div className="text-right text-gray-500">{trade.price}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Chat kısmı aynı
                        <div className="flex flex-col h-full"><div className="flex-1 space-y-3 mb-4 max-h-[200px] overflow-y-auto">{comments.map((c, i) => (<div key={i} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5"><div className="w-8 h-8 rounded-full bg-[#FDDC11] flex items-center justify-center text-black font-bold"><User size={14}/></div><div><div className="flex gap-2 items-baseline"><span className="text-xs font-bold text-white">{c.user}</span><span className="text-[10px] text-gray-500">{c.time}</span></div><p className="text-sm text-gray-300 mt-1">{c.text}</p></div></div>))}</div><div className="flex gap-2"><input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Write a comment..." className="flex-1 bg-[#1a0b2e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FDDC11] outline-none" /><button onClick={handleComment} className="p-3 bg-[#FDDC11] text-black rounded-xl hover:bg-[#ffe55c] transition-colors"><Send size={18}/></button></div></div>
                    )}
                </div>
            </div>
        </div>

        {/* --- SAĞ KOLON (ALIM SATIM) --- */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#2d1b4e] border border-white/10 rounded-2xl p-5 shadow-2xl sticky top-24">
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => { setActiveTab("buy"); setAmount(""); }} className={`py-3 rounded-xl text-sm font-black uppercase transition-all shadow-lg ${activeTab === "buy" ? "bg-[#22c55e] text-white ring-2 ring-white/50" : "bg-[#15803d] text-white/70"}`}>Buy</button>
                    <button onClick={() => { setActiveTab("sell"); setAmount(""); }} className={`py-3 rounded-xl text-sm font-black uppercase transition-all shadow-lg ${activeTab === "sell" ? "bg-[#ef4444] text-white ring-2 ring-white/50" : "bg-[#b91c1c] text-white/70"}`}>Sell</button>
                </div>
                
                <div className="space-y-4">
                    <div className="rounded-xl p-6 transition-colors duration-300 border border-white/10" style={{ backgroundColor: '#2d1b4e' }}>
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                            <span style={{ color: '#ffffff' }}>Amount</span>
                            <span style={{ color: '#ffffff' }}>Bal: {balanceDisplay}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                placeholder="0.0" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)} 
                                style={{ color: '#ffffff' }} 
                                className="w-full bg-transparent text-4xl font-black outline-none placeholder:text-white/50" 
                            />
                            <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white">
                                {activeTab === "buy" ? "MATIC" : symbol}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        {["Reset", "1", "5", "10"].map((v,i) => (
                            <button key={i} onClick={() => setAmount(i===0 ? "" : v)} style={{ color: '#ffffff', backgroundColor: '#1a0b2e' }} className="flex-1 py-2 border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/10 transition-colors">
                                {i===0 ? v : v + (activeTab === "buy" ? " MATIC" : ` ${symbol}`)}
                            </button>
                        ))}
                    </div>
                    
                    <button onClick={handleTx} disabled={isPending || !isConnected} className={`w-full py-4 mt-2 rounded-xl text-sm font-black uppercase tracking-wide shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === "buy" ? "bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-green-500/20" : "bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-red-500/20"}`}>
                        {isPending ? "Processing..." : activeTab === "buy" ? "PLACE BUY ORDER" : "PLACE SELL ORDER"}
                    </button>
                </div>
                
                <div className="mt-8 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-end mb-2"><div className="text-[10px] font-bold text-gray-400 uppercase">Bonding Curve</div><div className="text-sm font-black text-[#FDDC11]">{realProgress.toFixed(1)}%</div></div>
                    <div className="h-2 w-full bg-[#1a0b2e] rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-[#FDDC11] to-purple-500 transition-all duration-500" style={{ width: `${realProgress}%` }} /></div>
                </div>
            </div>
            
            <div className="bg-[#2d1b4e]/50 border border-white/5 rounded-xl p-4 space-y-3">
                <InfoRow label="Market Cap" value={`$${(parseFloat(collateral) * 3200).toLocaleString()}`} /><InfoRow label="Collateral" value={`${parseFloat(collateral).toFixed(4)} MATIC`} /><InfoRow label="Total Supply" value="1,000,000,000" />
            </div>
        </div>
      </main>
    </div>
  );
}

// Alt bileşenler
function StatItem({ label, value, color }: any) { return (<div><div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div><div className={`text-lg font-bold ${color}`}>{value}</div></div>); }
function TabButton({ active, onClick, label, icon }: any) { return (<button onClick={onClick} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${active ? "bg-[#3e2465] text-white shadow-sm" : "text-gray-500 hover:text-white"}`}>{icon} {label}</button>); }
function InfoRow({ label, value }: any) { return (<div className="flex justify-between items-center text-xs"><span className="text-gray-500">{label}</span><span className="text-gray-200 font-bold">{value}</span></div>); }
