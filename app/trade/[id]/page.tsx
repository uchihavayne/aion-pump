"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Settings, Lock, MessageSquare, Users, Trophy } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent, useAccount, usePublicClient, useBalance } from "wagmi"; 
import { parseEther, formatEther, erc20Abi, maxUint256, decodeEventLog } from "viem"; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../../contract"; 
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from "framer-motion";

const generateNickname = (address: string) => {
  if (!address) return "Anon";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

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
  const processedTxHashes = useRef(new Set());

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

  // ============ DEBUG: Log sales data ============
  useEffect(() => {
    if (salesData) {
      console.log("📊 Sales Data:", {
        full: salesData,
        creator: salesData[0],
        virtualMaticReserves: formatEther(salesData[1] as bigint),
        virtualTokenReserves: formatEther(salesData[2] as bigint),
        migrated: salesData[3],
        creationTime: salesData[4]
      });
    }
  }, [salesData]);

  // ============ CORRECT PRICE CALCULATION ============
  // sales returns: [creator, virtualMaticReserves, virtualTokenReserves, migrated, creationTime]
  const virtualMaticReserves = salesData ? parseFloat(formatEther(salesData[1] as bigint)) : 3000;
  const virtualTokenReserves = salesData ? parseFloat(formatEther(salesData[2] as bigint)) : 1_000_000_000;
  
  const currentPrice = virtualTokenReserves > 0 ? virtualMaticReserves / virtualTokenReserves : 0.0000001;
  const marketCap = currentPrice * 1_000_000_000;
  const tokensSold = 1_000_000_000 - virtualTokenReserves;
  const progress = (tokensSold / 1_000_000_000) * 100;
  const realProgress = Math.min(progress, 100);

  const desc = metadata ? metadata[0] : "";
  const twitter = metadata ? metadata[1] : "";
  const telegram = metadata ? metadata[2] : "";
  const web = metadata ? metadata[3] : "";

  const needsApproval = activeTab === "sell" && (!allowance || (amount && parseFloat(amount) > parseFloat(formatEther(allowance as bigint))));

  // ============ FETCH EVENTS - FIXED VERSION ============
  const fetchEventsFromChain = async () => {
    if (!publicClient) {
      console.log("❌ No public client");
      return;
    }

    try {
      const blockNumber = await publicClient.getBlockNumber();
      // Polygon RPC limit: max 100 blocks per request
      const fromBlock = blockNumber > 100n ? blockNumber - 100n : 0n;

      console.log(`🔍 Fetching from block ${fromBlock} to ${blockNumber}`);
      console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
      console.log(`🎫 Token: ${tokenAddress}`);

      // Get raw logs from CONTRACT with smaller range
      let allLogs: any[] = [];
      
      try {
        allLogs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock,
          toBlock: 'latest'
        });
      } catch (e: any) {
        console.log("❌ getLogs failed, trying with event filters...");
        
        // Fallback: Try fetching with specific event topics
        try {
          const BUY_SIG = "0x" + Buffer.from("Buy(address,address,uint256,uint256)").toString('hex').substring(2);
          const logs = await publicClient.getLogs({
            address: CONTRACT_ADDRESS,
            events: [{ name: 'Buy', topics: [BUY_SIG] }] as any,
            fromBlock,
            toBlock: 'latest'
          }).catch(() => []);
          allLogs = logs;
        } catch (e2) {
          console.log("Fallback also failed");
        }
      }

      console.log(`✅ Got ${allLogs.length} total logs from contract`);

      if (allLogs.length === 0) {
        console.log("⚠️ No logs found! Events might not be emitted by contract.");
        console.log("💡 Using fallback: sales mapping data only");
        // Fallback: Just show current sales data
        return;
      }

      const newTrades: any[] = [];
      const holderMap: Record<string, bigint> = {};
      const newChartData: any[] = [];
      let lastPrice = 0.0000001;

      // BUY event signature: Buy(address indexed token, address indexed buyer, uint256 amountMATIC, uint256 amountTokens)
      const BUY_SIG = "0x" + Buffer.from("Buy(address,address,uint256,uint256)").toString('hex').substring(2);
      
      // SELL event signature: Sell(address indexed token, address indexed seller, uint256 amountTokens, uint256 amountMATIC, uint256 feePaid)
      const SELL_SIG = "0x" + Buffer.from("Sell(address,address,uint256,uint256,uint256)").toString('hex').substring(2);

      console.log("Event signatures:");
      console.log("BUY:", BUY_SIG);
      console.log("SELL:", SELL_SIG);

      for (const log of allLogs) {
        if (!log.topics || log.topics.length < 2) continue;

        const eventSig = log.topics[0];
        const tokenTopicRaw = log.topics[1];

        // Extract token address (last 40 hex chars = 20 bytes)
        const tokenFromLog = "0x" + tokenTopicRaw.slice(-40);

        console.log(`\n📋 Log:`, {
          eventSig: eventSig.slice(0, 10) + "...",
          tokenFromLog,
          targetToken: tokenAddress,
          match: tokenFromLog.toLowerCase() === tokenAddress.toLowerCase()
        });

        // Only process logs for this token
        if (tokenFromLog.toLowerCase() !== tokenAddress.toLowerCase()) {
          continue;
        }

        // Skip if already processed
        if (processedTxHashes.current.has(log.transactionHash)) {
          console.log("⏭️ Already processed");
          continue;
        }

        let eventType: 'BUY' | 'SELL' | null = null;

        if (eventSig === BUY_SIG) {
          eventType = 'BUY';
        } else if (eventSig === SELL_SIG) {
          eventType = 'SELL';
        } else {
          console.log("❌ Unknown event signature");
          continue;
        }

        processedTxHashes.current.add(log.transactionHash);

        try {
          // Manually decode log data
          // For Buy: uint256 amountMATIC (32 bytes), uint256 amountTokens (32 bytes)
          // For Sell: uint256 amountTokens (32 bytes), uint256 amountMATIC (32 bytes), uint256 feePaid (32 bytes)

          const data = log.data;

          if (eventType === 'BUY') {
            // Buy event: (address token, address buyer, uint256 amountMATIC, uint256 amountTokens)
            const amountMATIC = BigInt('0x' + data.slice(2, 66));
            const amountTokens = BigInt('0x' + data.slice(66, 130));
            const buyer = '0x' + log.topics[2].slice(-40);

            const maticVal = parseFloat(formatEther(amountMATIC));
            const tokenVal = parseFloat(formatEther(amountTokens));
            const price = tokenVal > 0 ? maticVal / tokenVal : lastPrice;

            newTrades.unshift({
              user: buyer,
              type: 'BUY',
              maticAmount: maticVal.toFixed(4),
              tokenAmount: tokenVal.toFixed(2),
              price: price.toFixed(8),
              blockNumber: log.blockNumber.toString()
            });

            newChartData.push({
              name: log.blockNumber.toString(),
              price,
              fill: '#10b981'
            });

            holderMap[buyer] = (holderMap[buyer] || 0n) + amountTokens;
            lastPrice = price;

            console.log(`🟢 BUY decoded: ${buyer.slice(0, 8)}... bought ${tokenVal.toFixed(2)} for ${maticVal.toFixed(4)}`);
          } 
          else if (eventType === 'SELL') {
            // Sell event: (address token, address seller, uint256 amountTokens, uint256 amountMATIC, uint256 feePaid)
            const amountTokens = BigInt('0x' + data.slice(2, 66));
            const amountMATIC = BigInt('0x' + data.slice(66, 130));
            const seller = '0x' + log.topics[2].slice(-40);

            const maticVal = parseFloat(formatEther(amountMATIC));
            const tokenVal = parseFloat(formatEther(amountTokens));
            const price = tokenVal > 0 ? maticVal / tokenVal : lastPrice;

            newTrades.unshift({
              user: seller,
              type: 'SELL',
              maticAmount: maticVal.toFixed(4),
              tokenAmount: tokenVal.toFixed(2),
              price: price.toFixed(8),
              blockNumber: log.blockNumber.toString()
            });

            newChartData.push({
              name: log.blockNumber.toString(),
              price,
              fill: '#ef4444'
            });

            holderMap[seller] = (holderMap[seller] || 0n) - amountTokens;
            lastPrice = price;

            console.log(`🔴 SELL decoded: ${seller.slice(0, 8)}... sold ${tokenVal.toFixed(2)} for ${maticVal.toFixed(4)}`);
          }
        } catch (e) {
          console.error("❌ Decode error:", e);
        }
      }

      // Process holders
      const holdersList = Object.entries(holderMap)
        .filter(([_, balance]) => balance > 0n)
        .map(([addr, balance]) => ({
          address: addr as `0x${string}`,
          balance,
          percentage: (Number(balance) / 1e18 / 1_000_000_000) * 100
        }))
        .sort((a, b) => Number(b.balance) - Number(a.balance))
        .slice(0, 20);

      console.log(`\n✅ FINAL RESULT:`);
      console.log(`  Trades: ${newTrades.length}`);
      console.log(`  Holders: ${holdersList.length}`);
      console.log(`  Chart points: ${newChartData.length}`);

      setTrades(newTrades.slice(0, 50));
      setChartData(newChartData);
      setHolders(holdersList);
    } catch (error) {
      console.error("❌ CRITICAL ERROR:", error);
    }
  };

  // Initial fetch
  useEffect(() => {
    setIsMounted(true);
    fetchEventsFromChain();

    // Poll every 5 seconds
    const interval = setInterval(fetchEventsFromChain, 5000);
    return () => clearInterval(interval);
  }, [publicClient, tokenAddress]);

  // Watch for new events
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'Buy',
    onLogs: () => {
      console.log("🟢 Buy event detected!");
      setTimeout(fetchEventsFromChain, 1000);
    }
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'Sell',
    onLogs: () => {
      console.log("🔴 Sell event detected!");
      setTimeout(fetchEventsFromChain, 1000);
    }
  });

  // Write contracts
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
        toast.loading("Buying...", { id: 'tx' });
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
        toast.loading("Selling...", { id: 'tx' });
      }
    } catch (e) {
      toast.error("Failed");
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      toast.dismiss('tx');
      toast.dismiss('approve');
      
      if (isApproving) {
        toast.success("✅ Approved!");
        setIsApproving(false);
        refetchAllowance();
      } else {
        toast.success("✅ Done!");
        setAmount("");
      }
      
      refetchSales();
      refetchTokenBalance();
      setTimeout(fetchEventsFromChain, 2000);
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
    return <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center text-[#FDDC11]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] to-[#1a0a2e] text-white font-sans" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
          <span className="font-bold text-sm">Back</span>
        </Link>
        <div className="flex gap-3 items-center">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/5 rounded-lg">
            <Settings size={18} />
          </button>
          <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Token Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#FDDC11] to-purple-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-black">{name?.toString() || "Token"}</h1>
                  <span className="text-sm font-bold text-gray-400">[{symbol?.toString() || "TKN"}]</span>
                </div>
                <p className="text-sm text-gray-400">{desc || "No description"}</p>
              </div>
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/5 border border-white/10 rounded-2xl p-6">
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
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                  <Bar dataKey="price" isAnimationActive={false}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-500">Waiting for trades...</div>
            )}
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setBottomTab("trades")}
                className={`flex-1 px-4 py-3 font-bold text-sm transition-all ${bottomTab === "trades" ? "bg-white/10 text-white" : "text-gray-400"}`}
              >
                📊 Trades ({trades.length})
              </button>
              <button
                onClick={() => setBottomTab("holders")}
                className={`flex-1 px-4 py-3 font-bold text-sm transition-all ${bottomTab === "holders" ? "bg-white/10 text-white" : "text-gray-400"}`}
              >
                👥 Holders ({holders.length})
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              {bottomTab === "trades" ? (
                <div className="space-y-2">
                  {trades.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No trades yet</div>
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
                        <div key={i} className="grid grid-cols-5 text-xs py-2 px-2 rounded-lg border border-white/5 hover:bg-white/5">
                          <div className="font-mono text-gray-400 truncate">{generateNickname(trade.user)}</div>
                          <div className={trade.type === "BUY" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{trade.type}</div>
                          <div>{trade.maticAmount}</div>
                          <div>{trade.tokenAmount}</div>
                          <div className="text-right text-gray-500 text-[9px]">{trade.price}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {holders.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No holders</div>
                  ) : (
                    holders.map((h, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg border border-white/5 hover:bg-white/5">
                        <div className="font-mono text-gray-400 truncate flex-1">{generateNickname(h.address)}</div>
                        <div className="text-white font-bold">{h.percentage.toFixed(2)}%</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-24">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setActiveTab("buy")}
                className={`py-3 rounded-xl font-bold transition-all ${
                  activeTab === "buy" ? "bg-green-500/30 text-green-300 border border-green-500/50" : "bg-white/5 text-gray-400 border border-white/10"
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setActiveTab("sell")}
                className={`py-3 rounded-xl font-bold transition-all ${
                  activeTab === "sell" ? "bg-red-500/30 text-red-300 border border-red-500/50" : "bg-white/5 text-gray-400 border border-white/10"
                }`}
              >
                SELL
              </button>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Amount</span>
                <span>{activeTab === "buy" ? `${maticBalance?.formatted?.slice(0, 5) || "0"} MATIC` : `${(userTokenBalance ? parseFloat(formatEther(userTokenBalance)) : 0).toFixed(2)}`}</span>
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
                  className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold"
                >
                  {p === 100 ? "MAX" : `${p}%`}
                </button>
              ))}
            </div>

            {activeTab === "buy" ? (
              <button
                onClick={() => handleTx("buy")}
                disabled={!isConnected || isPending}
                className="w-full py-4 rounded-xl font-black bg-green-500 hover:bg-green-600 disabled:opacity-50"
              >
                {isPending ? "⏳ Processing..." : "🚀 BUY"}
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={!isConnected || isApproving}
                className="w-full py-4 rounded-xl font-black bg-blue-500 hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Lock size={16} />
                {isApproving ? "⏳ Approving..." : "Approve"}
              </button>
            ) : (
              <button
                onClick={() => handleTx("sell")}
                disabled={!isConnected || isPending}
                className="w-full py-4 rounded-xl font-black bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? "⏳ Processing..." : "🔥 SELL"}
              </button>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">Bonding Curve</span>
                <span className="text-white font-bold">{realProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FDDC11] to-purple-500" style={{ width: `${realProgress}%` }} />
              </div>
            </div>
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Tokens Sold</span>
                <span className="text-white font-bold">{(1_000_000_000 - virtualTokenReserves).toLocaleString()} / 1B</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
