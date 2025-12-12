"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Settings, RefreshCw, Lock, Flame, MessageSquare, Users, Trophy, Gift
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient, useBalance } from "wagmi"; 
import { parseEther, formatEther, erc20Abi, maxUint256 } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from "framer-motion";

const getTokenImage = (address: string) => 
  `https://api.dicebear.com/7.x/identicon/svg?seed=${address}&backgroundColor=transparent`;

const generateNickname = (address: string) => {
  if (!address) return "Anon";
  return `User ${address.slice(2, 6).toUpperCase()}`;
};

export default function TradePage({ params }: { params: { id: string } }) {
  const tokenAddress = params.id as `0x${string}`;
  const publicClient = usePublicClient();
  const { isConnected, address } = useAccount();
  
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "chat" | "holders" | "bubbles">("trades");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Data states
  const [trades, setTrades] = useState<any[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const processedTxHashes = useRef(new Set());
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();

  // Contract reads
  const { data: maticBalance } = useBalance({ address });
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address }
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as `0x${string}`, CONTRACT_ADDRESS],
    query: { enabled: !!address }
  });

  const { data: salesData, refetch: refetchSales } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "sales",
    args: [tokenAddress],
    query: { refetchInterval: 2000 }
  });

  const { data: name } = useReadContract({
    address: tokenAddress,
    abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }],
    functionName: "name"
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }],
    functionName: "symbol"
  });

  const { data: metadata } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "tokenMetadata",
    args: [tokenAddress]
  });

  // Calculate price
  const collateral = parseFloat(salesData ? formatEther(salesData[1] as bigint) : "0");
  const tokensSold = parseFloat(salesData ? formatEther(salesData[3] as bigint) : "0");
  
  const currentPrice = tokensSold > 0 ? collateral / tokensSold : 0.0000001;
  const marketCap = currentPrice * 1_000_000_000;
  const progress = (tokensSold / 1_000_000_000) * 100;
  const realProgress = Math.min(progress, 100);

  const desc = metadata ? metadata[0] : "";
  const twitter = metadata ? metadata[1] : "";
  const telegram = metadata ? metadata[2] : "";
  const web = metadata ? metadata[3] : "";

  const needsApproval = activeTab === "sell" && (!allowance || (amount && parseFloat(amount) > parseFloat(formatEther(allowance as bigint))));

  // ============ FETCH EVENTS FUNCTION ============
  const fetchEventsFromChain = async () => {
    if (!publicClient) return;

    try {
      const blockNumber = await publicClient.getBlockNumber();
      const fromBlock = blockNumber > 1000n ? blockNumber - 1000n : 0n;

      // Fetch Buy events
      let buyLogs: any[] = [];
      try {
        buyLogs = await publicClient.getContractEvents({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          eventName: 'Buy',
          args: { token: tokenAddress },
          fromBlock,
          toBlock: 'latest'
        });
      } catch (e) {
        console.log("Buy logs fetch failed");
      }

      // Fetch Sell events
      let sellLogs: any[] = [];
      try {
        sellLogs = await publicClient.getContractEvents({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          eventName: 'Sell',
          args: { token: tokenAddress },
          fromBlock,
          toBlock: 'latest'
        });
      } catch (e) {
        console.log("Sell logs fetch failed");
      }

      const allEvents = [
        ...buyLogs.map(l => ({ ...l, type: "BUY" })),
        ...sellLogs.map(l => ({ ...l, type: "SELL" }))
      ].sort((a, b) => {
        const blockDiff = Number(a.blockNumber) - Number(b.blockNumber);
        return blockDiff !== 0 ? blockDiff : a.logIndex - b.logIndex;
      });

      const newTrades: any[] = [];
      const holderMap: Record<string, { balance: bigint; address: string }> = {};
      const newChartData: any[] = [];
      let lastPrice = 0.0000001;

      for (const event of allEvents) {
        if (processedTxHashes.current.has(event.transactionHash)) continue;
        processedTxHashes.current.add(event.transactionHash);

        try {
          const amountMATIC = event.args?.amountMATIC ? BigInt(event.args.amountMATIC) : 0n;
          const amountTokens = event.args?.amountTokens ? BigInt(event.args.amountTokens) : 0n;
          
          const maticVal = parseFloat(formatEther(amountMATIC));
          const tokenVal = parseFloat(formatEther(amountTokens));
          
          const price = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
          const user = event.type === "BUY" ? event.args?.buyer : event.args?.seller;

          newTrades.unshift({
            user: user || "0x000",
            type: event.type,
            maticAmount: maticVal.toFixed(4),
            tokenAmount: tokenVal.toFixed(2),
            price: price.toFixed(8),
            blockNumber: event.blockNumber.toString()
          });

          newChartData.push({
            name: event.blockNumber.toString(),
            price,
            fill: event.type === 'BUY' ? '#10b981' : '#ef4444'
          });

          // Track holders
          if (event.type === "BUY") {
            if (!holderMap[user]) {
              holderMap[user] = { balance: 0n, address: user };
            }
            holderMap[user].balance += amountTokens;
          } else {
            if (!holderMap[user]) {
              holderMap[user] = { balance: 0n, address: user };
            }
            holderMap[user].balance -= amountTokens;
          }

          lastPrice = price;
        } catch (e) {
          console.error("Event parse error:", e);
        }
      }

      // Process holders
      const holdersList = Object.values(holderMap)
        .filter(h => h.balance > 0n)
        .map(h => ({
          address: h.address,
          balance: h.balance,
          percentage: (Number(h.balance) / 1e18 / 1_000_000_000) * 100
        }))
        .sort((a, b) => Number(b.balance) - Number(a.balance))
        .slice(0, 20);

      setTrades(newTrades.slice(0, 50));
      setChartData(newChartData);
      setHolders(holdersList);

    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // ============ LOAD COMMENTS ============
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`comments_${tokenAddress}`);
        if (saved) setComments(JSON.parse(saved));
      } catch (e) {}
    }
  }, [tokenAddress]);

  // ============ INITIAL FETCH & POLLING ============
  useEffect(() => {
    setIsMounted(true);
    fetchEventsFromChain();

    const interval = setInterval(() => {
      fetchEventsFromChain();
    }, 5000);

    return () => clearInterval(interval);
  }, [publicClient, tokenAddress]);

  // ============ WATCH EVENTS ============
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'Buy',
    onLogs: () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        fetchEventsFromChain();
      }, 500);
    }
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'Sell',
    onLogs: () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        fetchEventsFromChain();
      }, 500);
    }
  });

  // ============ WRITE CONTRACTS ============
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleApprove = () => {
    try {
      setIsApproving(true);
      writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, maxUint256]
      });
      toast.loading("Approving token...", { id: 'approve-tx' });
    } catch (e) {
      toast.error("Approval failed");
      setIsApproving(false);
    }
  };

  const handleTx = (type: "buy" | "sell") => {
    if (!amount) {
      toast.error("Enter amount");
      return;
    }
    if (!isConnected) {
      toast.error("Connect wallet");
      return;
    }

    try {
      const val = parseEther(amount);
      
      if (type === "buy") {
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "buy",
          args: [tokenAddress],
          value: val
        });
        toast.loading("Buying tokens...", { id: 'tx' });
      } else {
        if (needsApproval) {
          toast.error("Approve first!");
          return;
        }
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "sell",
          args: [tokenAddress, val]
        });
        toast.loading("Selling tokens...", { id: 'tx' });
      }
    } catch (e) {
      toast.error("Transaction failed");
    }
  };

  // ============ HANDLE CONFIRMATION ============
  useEffect(() => {
    if (isConfirmed) {
      toast.dismiss('tx');
      toast.dismiss('approve-tx');
      
      if (isApproving) {
        toast.success("✅ Approved! Ready to sell");
        setIsApproving(false);
        refetchAllowance();
      } else {
        toast.success("✅ Transaction confirmed!");
        setAmount("");
      }
      
      refetchSales();
      refetchTokenBalance();
      setTimeout(() => {
        fetchEventsFromChain();
      }, 1000);
    }
  }, [isConfirmed]);

  const handleComment = () => {
    if (!commentInput.trim()) return;
    const newComment = {
      user: generateNickname(address || "0x00"),
      text: commentInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = [newComment, ...comments];
    setComments(updated);
    localStorage.setItem(`comments_${tokenAddress}`, JSON.stringify(updated));
    setCommentInput("");
  };

  const handlePercentage = (percent: number) => {
    if (activeTab === "buy") {
      const bal = maticBalance ? parseFloat(maticBalance.formatted) : 0;
      const amount = (bal * percent) / 100 - 0.01;
      setAmount(Math.max(0, amount).toFixed(4));
    } else {
      const bal = userTokenBalance ? parseFloat(formatEther(userTokenBalance)) : 0;
      setAmount((bal * (percent / 100)).toFixed(4));
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center text-[#FDDC11]">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          Loading trade data...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] to-[#1a0a2e] text-white font-sans" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
          <span className="font-bold text-sm">Back</span>
        </Link>
        <div className="flex gap-3 items-center">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <Settings size={18} />
          </button>
          {showSettings && (
            <div className="absolute top-14 right-4 bg-[#1a1a1a] border border-white/10 rounded-lg p-4 z-50 w-48 shadow-xl">
              <label className="flex justify-between text-xs items-center gap-2">
                <span className="text-gray-400">Slippage</span>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  className="w-16 bg-black border border-white/10 rounded px-2 py-1 text-xs"
                />
                <span className="text-gray-400">%</span>
              </label>
            </div>
          )}
          <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Chart & Trades */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Token Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#FDDC11] to-purple-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-black">{name?.toString() || "Token"}</h1>
                  <span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKN"}]</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{desc || "No description"}</p>
                <div className="flex gap-2">
                  {twitter && <a href={twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">🐦</a>}
                  {telegram && <a href={telegram} target="_blank" className="text-gray-400 hover:text-white transition-colors">✈️</a>}
                  {web && <a href={web} target="_blank" className="text-gray-400 hover:text-white transition-colors">🌐</a>}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex justify-between mb-4">
              <div>
                <div className="text-sm text-gray-400">Price</div>
                <div className="text-3xl font-black text-[#FDDC11]">{currentPrice.toFixed(9)} MATIC</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Market Cap</div>
                <div className="text-2xl font-bold">${(marketCap * 3200).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <YAxis domain={['auto', 'auto']} hide />
                  <XAxis dataKey="name" hide />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="price" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-500">Waiting for trades...</div>
            )}
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="flex border-b border-white/10">
              {[
                { key: "trades", label: `Trades (${trades.length})`, icon: "📊" },
                { key: "holders", label: `Holders (${holders.length})`, icon: "👥" },
                { key: "chat", label: "Comments", icon: "💬" },
                { key: "bubbles", label: "Bubble Map", icon: "🌍" }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setBottomTab(tab.key as any)}
                  className={`flex-1 px-4 py-3 font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    bottomTab === tab.key ? "bg-white/10 text-white border-b-2 border-[#FDDC11]" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              {bottomTab === "trades" && (
                <div className="space-y-2">
                  {trades.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No trades yet. Start trading!</div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase px-2 pb-2 mb-2">
                        <div>User</div>
                        <div>Type</div>
                        <div>MATIC</div>
                        <div>Tokens</div>
                        <div className="text-right">Price</div>
                      </div>
                      {trades.map((trade, i) => (
                        <div key={i} className="grid grid-cols-5 text-xs py-2 px-2 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                          <div className="font-mono text-gray-400 truncate">{trade.user.slice(0, 8)}...</div>
                          <div className={trade.type === "BUY" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{trade.type}</div>
                          <div className="text-white">{trade.maticAmount}</div>
                          <div className="text-white">{trade.tokenAmount}</div>
                          <div className="text-right text-gray-500 font-mono text-[9px]">{trade.price}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bottomTab === "holders" && (
                <div className="space-y-2">
                  {holders.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No holders yet</div>
                  ) : (
                    holders.map((holder, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                        <div className="font-mono text-gray-400 flex-1 truncate">{holder.address.slice(0, 6)}...{holder.address.slice(-4)}</div>
                        <div className="text-right">
                          <div className="text-white font-bold">{holder.percentage.toFixed(2)}%</div>
                          <div className="text-gray-500 text-[9px]">{(Number(holder.balance) / 1e18).toFixed(2)} tk</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {bottomTab === "chat" && (
                <div className="flex flex-col gap-3">
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {comments.length === 0 ? (
                      <div className="text-center text-gray-500 py-4 text-xs">Be first to comment!</div>
                    ) : (
                      comments.map((c, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/5">
                          <div className="flex justify-between mb-1">
                            <span className="text-[#FDDC11] font-bold text-xs">{c.user}</span>
                            <span className="text-gray-500 text-[9px]">{c.time}</span>
                          </div>
                          <p className="text-xs text-gray-300">{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                      placeholder="Write a comment..."
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FDDC11] placeholder-gray-600"
                    />
                    <button onClick={handleComment} className="bg-[#FDDC11] text-black p-2 rounded-lg font-bold text-xs hover:bg-yellow-400 transition-colors">
                      Send
                    </button>
                  </div>
                </div>
              )}

              {bottomTab === "bubbles" && (
                <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                  {holders.length > 0 ? (
                    <div className="relative w-full h-full">
                      <div className="text-center text-gray-500 text-xs mb-2">Top {Math.min(holders.length, 20)} Holders</div>
                      <div className="flex flex-wrap gap-2 justify-center items-center p-4">
                        {holders.slice(0, 20).map((h, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div
                              className="rounded-full flex items-center justify-center border border-[#FDDC11] bg-white/5"
                              style={{
                                width: `${Math.max(30, Math.min(80, h.percentage * 2))}px`,
                                height: `${Math.max(30, Math.min(80, h.percentage * 2))}px`,
                                fontSize: `${Math.max(8, Math.min(12, h.percentage / 2))}px`
                              }}
                              title={`${h.percentage.toFixed(2)}%`}
                            >
                              <span className="text-[#FDDC11] font-bold">{i + 1}</span>
                            </div>
                            <span className="text-[8px] text-gray-500 mt-1">{h.percentage.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    "No data yet"
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT: Trade Panel */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 sticky top-24 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setActiveTab("buy")}
                className={`py-3 rounded-xl font-bold transition-all ${
                  activeTab === "buy"
                    ? "bg-green-500/30 text-green-300 border border-green-500/50 shadow-lg shadow-green-500/20"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                }`}
              >
                🟢 Buy
              </button>
              <button
                onClick={() => setActiveTab("sell")}
                className={`py-3 rounded-xl font-bold transition-all ${
                  activeTab === "sell"
                    ? "bg-red-500/30 text-red-300 border border-red-500/50 shadow-lg shadow-red-500/20"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                }`}
              >
                🔴 Sell
              </button>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Amount</span>
                <span>Bal: {activeTab === "buy" ? `${maticBalance?.formatted?.slice(0, 5) || "0"} MATIC` : `${(userTokenBalance ? parseFloat(formatEther(userTokenBalance)) : 0).toFixed(2)}`}</span>
              </div>
              <input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-3xl font-black text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePercentage(p)}
                  className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors"
                >
                  {p === 100 ? "MAX" : `${p}%`}
                </button>
              ))}
            </div>

            {activeTab === "buy" ? (
              <button
                onClick={() => handleTx("buy")}
                disabled={!isConnected || isPending}
                className="w-full py-4 rounded-xl font-black bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/30"
              >
                {isPending ? "⏳ Processing..." : "🚀 BUY NOW"}
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={!isConnected || isApproving}
                className="w-full py-4 rounded-xl font-black bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                <Lock size={16} />
                {isApproving ? "⏳ Approving..." : "🔓 Approve to Sell"}
              </button>
            ) : (
              <button
                onClick={() => handleTx("sell")}
                disabled={!isConnected || isPending}
                className="w-full py-4 rounded-xl font-black bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/30"
              >
                {isPending ? "⏳ Processing..." : "🔥 SELL NOW"}
              </button>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">Bonding Curve</span>
                <span className="text-white font-bold">{realProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FDDC11] to-purple-500 transition-all duration-500"
                  style={{ width: `${realProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Current Price</span>
                <span className="text-[#FDDC11] font-bold">{currentPrice.toFixed(9)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Tokens Sold</span>
                <span className="text-white font-bold">{(tokensSold / 1_000_000).toFixed(0)}M / 1B</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Collateral</span>
                <span className="text-white font-bold">{collateral.toFixed(2)} MATIC</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
