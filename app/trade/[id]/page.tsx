"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Settings, RefreshCw, Share2, Lock, Flame, Shield
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

// ========== FIX: EVENT FETCHING ==========
const fetchEvents = async (publicClient: any, tokenAddr: string) => {
  if (!publicClient) return { trades: [], holders: [], chartData: [] };
  
  try {
    const blockNumber = await publicClient.getBlockNumber();
    const fromBlock = blockNumber > 990n ? blockNumber - 990n : 0n;

    const [buyLogs, sellLogs] = await Promise.all([
      publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'Buy',
        fromBlock,
        toBlock: 'latest'
      }).catch(() => []),
      publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'Sell',
        fromBlock,
        toBlock: 'latest'
      }).catch(() => [])
    ]);

    // FIX: Proper token address comparison
    const targetToken = tokenAddr.toLowerCase();
    const buyEvents = buyLogs.filter((log: any) => 
      log.args?.token?.toLowerCase() === targetToken
    );
    const sellEvents = sellLogs.filter((log: any) => 
      log.args?.token?.toLowerCase() === targetToken
    );

    const allEvents = [
      ...buyEvents.map(l => ({ ...l, type: "BUY" })),
      ...sellEvents.map(l => ({ ...l, type: "SELL" }))
    ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || a.logIndex - b.logIndex);

    // FIX: Proper price calculation with decimals
    const trades: any[] = [];
    const holderMap: Record<string, bigint> = {};
    const chartDataArr: any[] = [];
    let lastPrice = 0.0000001;

    for (const event of allEvents) {
      try {
        const maticAmount = event.args?.amountMATIC ? BigInt(event.args.amountMATIC) : 0n;
        const tokenAmount = event.args?.amountTokens ? BigInt(event.args.amountTokens) : 0n;
        
        const maticVal = parseFloat(formatEther(maticAmount));
        const tokenVal = parseFloat(formatEther(tokenAmount));
        
        // FIX: Price calculation
        const price = tokenVal > 0 ? maticVal / tokenVal : lastPrice;
        
        const user = event.type === "BUY" ? event.args?.buyer : event.args?.seller;
        
        trades.unshift({
          user: user || "0x000",
          type: event.type,
          maticAmount: maticVal.toFixed(4),
          tokenAmount: tokenVal.toFixed(2),
          price: price.toFixed(8),
          hash: event.transactionHash
        });

        // FIX: Chart data with proper type
        chartDataArr.push({
          name: event.blockNumber.toString(),
          price: price,
          fill: event.type === 'BUY' ? '#10b981' : '#ef4444'
        });

        // FIX: Holder tracking
        if (event.type === "BUY") {
          holderMap[user] = (holderMap[user] || 0n) + tokenAmount;
        } else {
          holderMap[user] = (holderMap[user] || 0n) - tokenAmount;
        }

        lastPrice = price;
      } catch (e) {
        console.error("Event parsing error:", e);
      }
    }

    // FIX: Filter and sort holders
    const holders = Object.entries(holderMap)
      .map(([addr, bal]) => ({
        address: addr,
        balance: bal,
        percentage: (Number(bal) / 1e18) / 1_000_000_000 * 100
      }))
      .filter(h => h.balance > 0n)
      .sort((a, b) => Number(b.balance) - Number(a.balance));

    return {
      trades: trades.slice(0, 50),
      holders: holders.slice(0, 20),
      chartData: chartDataArr
    };
  } catch (error) {
    console.error("Fetch events error:", error);
    return { trades: [], holders: [], chartData: [] };
  }
};

// ========== MAIN COMPONENT ==========
export default function TradePage({ params }: { params: { id: string } }) {
  const tokenAddress = params.id as `0x${string}`;
  const publicClient = usePublicClient();
  const { isConnected, address } = useAccount();
  
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [bottomTab, setBottomTab] = useState<"trades" | "holders">("trades");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Data states
  const [trades, setTrades] = useState<any[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const dataFetchRef = useRef<NodeJS.Timeout>();

  // Contract reads
  const { data: maticBalance } = useBalance({ address });
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address, refetchInterval: 2000 }
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
    query: { refetchInterval: 3000 }
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

  // FIX: Calculate price correctly
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
  const image = metadata ? metadata[4] : "";

  const needsApproval = activeTab === "sell" && (!allowance || (amount && parseFloat(amount) > parseFloat(formatEther(allowance as bigint))));

  // Watch events for real-time updates
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'Buy',
    onLogs: () => {
      if (Date.now() - lastFetchTime > 1000) {
        fetchDataEngine();
      }
    }
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'Sell',
    onLogs: () => {
      if (Date.now() - lastFetchTime > 1000) {
        fetchDataEngine();
      }
    }
  });

  const fetchDataEngine = async () => {
    const data = await fetchEvents(publicClient, tokenAddress);
    setTrades(data.trades);
    setHolders(data.holders);
    setChartData(data.chartData);
    setLastFetchTime(Date.now());
  };

  useEffect(() => {
    setIsMounted(true);
    fetchDataEngine();
    dataFetchRef.current = setInterval(fetchDataEngine, 6000);
    return () => clearInterval(dataFetchRef.current);
  }, [publicClient, tokenAddress]);

  // Write contract functions
  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: undefined });

  const handleApprove = () => {
    try {
      setIsApproving(true);
      writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, maxUint256]
      });
      toast.loading("Approving...", { id: 'approve' });
    } catch (e) {
      toast.error("Failed");
      setIsApproving(false);
    }
  };

  const handleTx = (type: "buy" | "sell") => {
    if (!amount) {
      toast.error("Enter amount");
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
      }
      toast.loading(type === "buy" ? "Buying..." : "Selling...", { id: 'tx' });
    } catch (e) {
      toast.error("Failed");
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      toast.dismiss('tx');
      toast.dismiss('approve');
      toast.success("Success!");
      setAmount("");
      refetchSales();
      refetchTokenBalance();
      refetchAllowance();
      setTimeout(fetchDataEngine, 1500);
    }
  }, [isConfirmed]);

  const handlePercentage = (percent: number) => {
    if (activeTab === "buy") {
      const bal = maticBalance ? parseFloat(maticBalance.formatted) : 0;
      setAmount(((bal * percent) / 100 - 0.01).toFixed(4));
    } else {
      const bal = userTokenBalance ? parseFloat(formatEther(userTokenBalance)) : 0;
      setAmount((bal * (percent / 100)).toFixed(4));
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center text-[#FDDC11]">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white font-sans">
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
      
      <Toaster position="top-right" />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
          <span className="font-bold text-sm">Back</span>
        </Link>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/5 rounded-lg"
          >
            <Settings size={18} />
          </button>
          {showSettings && (
            <div className="absolute top-16 right-4 bg-[#1a1a1a] border border-white/10 rounded-lg p-4 z-50 w-48">
              <label className="flex justify-between text-xs mb-2">
                <span>Slippage</span>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  className="w-12 bg-black border border-white/10 rounded px-2 text-xs"
                />
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#FDDC11] to-purple-600 flex-shrink-0" />
              <div className="flex-1">
                <h1 className="text-3xl font-black">{name?.toString() || "Token"}</h1>
                <p className="text-sm text-gray-400 mt-1">{desc || "No description"}</p>
                <div className="flex gap-2 mt-3">
                  {twitter && <a href={twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">🐦</a>}
                  {telegram && <a href={telegram} target="_blank" className="text-gray-400 hover:text-white">✈️</a>}
                  {web && <a href={web} target="_blank" className="text-gray-400 hover:text-white">🌐</a>}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 h-80"
          >
            <div className="flex justify-between mb-4">
              <div>
                <div className="text-sm text-gray-400">Price</div>
                <div className="text-3xl font-black text-[#FDDC11]">
                  {currentPrice.toFixed(9)} MATIC
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Market Cap</div>
                <div className="text-2xl font-bold">
                  {marketCap.toLocaleString('en-US', { maximumFractionDigits: 0 })} MATIC
                </div>
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="85%">
                <ComposedChart data={chartData}>
                  <YAxis domain={['auto', 'auto']} hide />
                  <XAxis dataKey="name" hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="price" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Waiting for trades...
              </div>
            )}
          </motion.div>

          {/* Tabs */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setBottomTab("trades")}
                className={`flex-1 px-6 py-3 font-bold text-sm transition-colors ${
                  bottomTab === "trades"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Trades ({trades.length})
              </button>
              <button
                onClick={() => setBottomTab("holders")}
                className={`flex-1 px-6 py-3 font-bold text-sm transition-colors ${
                  bottomTab === "holders"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Holders ({holders.length})
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              {bottomTab === "trades" ? (
                <div className="space-y-2">
                  {trades.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No trades yet</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase px-2 pb-2">
                        <div>User</div>
                        <div>Type</div>
                        <div>MATIC</div>
                        <div>Tokens</div>
                        <div className="text-right">Price</div>
                      </div>
                      {trades.map((trade, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-5 text-xs py-2 px-2 rounded-lg border border-white/5 hover:bg-white/5"
                        >
                          <div className="font-mono text-gray-400 truncate">
                            {trade.user.slice(0, 6)}...
                          </div>
                          <div
                            className={
                              trade.type === "BUY"
                                ? "text-green-400 font-bold"
                                : "text-red-400 font-bold"
                            }
                          >
                            {trade.type}
                          </div>
                          <div>{trade.maticAmount}</div>
                          <div>{trade.tokenAmount}</div>
                          <div className="text-right text-gray-500 font-mono">
                            {trade.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {holders.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No holders yet</div>
                  ) : (
                    holders.map((holder, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-xs p-2 rounded-lg border border-white/5 hover:bg-white/5"
                      >
                        <div className="font-mono text-gray-400 flex-1">
                          {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                        </div>
                        <div className="text-white font-bold">
                          {holder.percentage.toFixed(2)}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Trade Panel */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-24"
          >
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setActiveTab("buy")}
                className={`py-3 rounded-xl font-bold transition-all ${
                  activeTab === "buy"
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setActiveTab("sell")}
                className={`py-3 rounded-xl font-bold transition-all ${
                  activeTab === "sell"
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                Sell
              </button>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Amount</span>
                <span>
                  Bal: {activeTab === "buy"
                    ? `${maticBalance?.formatted?.slice(0, 5) || "0"} MATIC`
                    : `${(userTokenBalance ? parseFloat(formatEther(userTokenBalance)) : 0).toFixed(2)} ${symbol}`
                  }
                </span>
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
                className="w-full py-4 rounded-xl font-black bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-all"
              >
                {isPending ? "Processing..." : "BUY NOW"}
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={!isConnected || isApproving}
                className="w-full py-4 rounded-xl font-black bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Lock size={16} />
                {isApproving ? "Approving..." : "Approve to Sell"}
              </button>
            ) : (
              <button
                onClick={() => handleTx("sell")}
                disabled={!isConnected || isPending}
                className="w-full py-4 rounded-xl font-black bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-all"
              >
                {isPending ? "Processing..." : "SELL NOW"}
              </button>
            )}
          </motion.div>

          {/* Stats */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
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
                <span className="text-gray-400">Price</span>
                <span className="text-white font-bold">{currentPrice.toFixed(9)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Tokens Sold</span>
                <span className="text-white font-bold">
                  {(tokensSold / 1_000_000).toFixed(0)}M / 1B
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
