"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Wallet, Star, TrendingUp, Coins, Copy, LogOut, Trophy, Shield, Award, Zap, Edit2, Check, X, Users, BarChart3, UserCheck } from "lucide-react";
import { useAccount, useReadContract, usePublicClient, useDisconnect, useReadContracts } from "wagmi";
import Link from "next/link";
import { formatEther, erc20Abi, zeroAddress } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast, { Toaster } from 'react-hot-toast';

// Token verisi tipi
interface TokenData {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  isFav: boolean;
  collateral: string;
  tokenReserves: string;
}

// Top holder tipi
interface TopHolder {
  address: string;
  percentage: number;
}

// Trader tipi
interface Trader {
  address: string;
  nickname: string;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  // MEVCUT STATES
  const [activeTab, setActiveTab] = useState<"held" | "favorites">("held");
  const [heldTokens, setHeldTokens] = useState<TokenData[]>([]);
  const [favTokens, setFavTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);

  // YENİ EKLENEN STATES (LEVEL, XP, NICKNAME)
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [rankTitle, setRankTitle] = useState("Novice Trader");
  const [nickname, setNickname] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState("");
  
  // YENİ: Traders, Holders ve Bonding Curve verileri
  const [tradersCount, setTradersCount] = useState(0);
  const [uniqueTraders, setUniqueTraders] = useState<Trader[]>([]);
  const [holdersStats, setHoldersStats] = useState({
    total: 0,
    topHolders: [] as TopHolder[]
  });
  const [bondingCurveStats, setBondingCurveStats] = useState({
    totalLiquidity: 0,
    totalTokens: 0,
    activeCurves: 0
  });
  
  const publicClient = usePublicClient();
  
  // Kontrattan tüm tokenları al
  const { data: allTokens } = useReadContract({ 
    address: CONTRACT_ADDRESS as `0x${string}`, 
    abi: CONTRACT_ABI, 
    functionName: "getAllTokens" 
  });

  // YENİ: Token metadata'larını toplu olarak al
  const tokenAddresses = allTokens as string[] || [];
  const { data: tokensMetadata } = useReadContracts({
    contracts: tokenAddresses.map(tokenAddr => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: "tokenMetadata",
      args: [tokenAddr as `0x${string}`]
    }))
  });

  // YENİ: Kontrat verilerini çek - useCallback ile memoize et
  const fetchContractData = useCallback(async () => {
    if (!publicClient || !address || !allTokens || !Array.isArray(allTokens)) return;

    try {
      console.log("🔍 Fetching contract data...");
      
      // 1. Tüm işlemleri (trades) al
      const tradersSet = new Set<string>();
      
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 2000n ? currentBlock - 1000n : 0n;
        
        // Buy event'larını al
        const buyLogs = await publicClient.getContractEvents({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          eventName: 'Buy',
          fromBlock,
          toBlock: 'latest'
        });
        
        // Sell event'larını al
        const sellLogs = await publicClient.getContractEvents({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          eventName: 'Sell',
          fromBlock,
          toBlock: 'latest'
        });
        
        // Traders'ı topla
        [...buyLogs, ...sellLogs].forEach(log => {
          const args = log.args as any;
          if (args?.buyer) tradersSet.add(args.buyer);
          if (args?.seller) tradersSet.add(args.seller);
        });
        
        setTradersCount(tradersSet.size);
        
        // Unique traders listesi (ilk 10)
        const uniqueTradersList: Trader[] = Array.from(tradersSet).slice(0, 10).map(addr => ({
          address: addr,
          nickname: `${addr.slice(0, 6)}...${addr.slice(-4)}`
        }));
        setUniqueTraders(uniqueTradersList);
        
      } catch (e) {
        console.log("⚠️ Events fetch error:", e);
      }

      // 2. Holders istatistiklerini hesapla
      let totalHolders = 0;
      
      for (const tokenAddr of allTokens) {
        try {
          const totalSupply = await publicClient.readContract({
            address: tokenAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: "totalSupply"
          });
          
          if (totalSupply > 0n) {
            totalHolders++;
          }
        } catch (e) {
          console.log(`⚠️ Token ${tokenAddr} holders fetch error:`, e);
        }
      }
      
      // Top holders (örnek olarak ilk 5)
      const topHolders: TopHolder[] = [
        { address: "0x123...abc", percentage: 15.2 },
        { address: "0x456...def", percentage: 12.8 },
        { address: "0x789...ghi", percentage: 9.5 },
        { address: "0xabc...jkl", percentage: 7.3 },
        { address: "0xdef...mno", percentage: 5.1 }
      ];
      
      setHoldersStats({
        total: totalHolders,
        topHolders
      });

      // 3. Bonding Curve istatistiklerini hesapla
      let totalLiquidity = 0;
      let totalTokens = 0;
      let activeCurves = 0;
      
      for (const tokenAddr of allTokens) {
        try {
          const salesData = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: "sales",
            args: [tokenAddr as `0x${string}`]
          }) as any;
          
          if (salesData && salesData[1]) {
            const maticReserves = parseFloat(formatEther(salesData[1] as bigint));
            const tokenReserves = salesData[2] ? parseFloat(formatEther(salesData[2] as bigint)) : 0;
            
            if (maticReserves > 0) {
              totalLiquidity += maticReserves;
              totalTokens += tokenReserves;
              activeCurves++;
            }
          }
        } catch (e) {
          console.log(`⚠️ Bonding curve data error for ${tokenAddr}:`, e);
        }
      }
      
      setBondingCurveStats({
        totalLiquidity,
        totalTokens,
        activeCurves
      });

    } catch (error) {
      console.error("❌ Contract data fetch error:", error);
    }
  }, [publicClient, address, allTokens]);

  useEffect(() => {
    // 1. ADIM: KAYITLI İSMİ ÇEK
    if (address) {
        const savedName = localStorage.getItem(`nickname_${address}`);
        if (savedName) setNickname(savedName);
    }

    const fetchData = async () => {
      if (!allTokens || !address || !publicClient || !Array.isArray(allTokens)) return;
      setLoading(true);

      const held: TokenData[] = [];
      const favs: TokenData[] = [];
      const localFavs: string[] = JSON.parse(localStorage.getItem("favorites") || "[]");

      for (const tokenAddr of allTokens) {
        try {
          const balance = await publicClient.readContract({ 
            address: tokenAddr as `0x${string}`, 
            abi: erc20Abi, 
            functionName: "balanceOf", 
            args: [address as `0x${string}`] 
          });
          
          if (balance > 0n || localFavs.includes(tokenAddr)) {
            const [name, symbol, salesData] = await Promise.all([
              publicClient.readContract({ 
                address: tokenAddr as `0x${string}`, 
                abi: erc20Abi, 
                functionName: "name" 
              }),
              publicClient.readContract({ 
                address: tokenAddr as `0x${string}`, 
                abi: erc20Abi, 
                functionName: "symbol" 
              }),
              publicClient.readContract({ 
                address: CONTRACT_ADDRESS as `0x${string}`, 
                abi: CONTRACT_ABI, 
                functionName: "sales", 
                args: [tokenAddr as `0x${string}`] 
              })
            ]) as [string, string, any];

            const tokenData: TokenData = {
              address: tokenAddr,
              name,
              symbol,
              balance: formatEther(balance as bigint),
              isFav: localFavs.includes(tokenAddr),
              collateral: salesData ? formatEther(salesData[1] as bigint) : "0",
              tokenReserves: salesData && salesData[2] ? formatEther(salesData[2] as bigint) : "0"
            };

            if (balance > 0n) held.push(tokenData);
            if (localFavs.includes(tokenAddr)) favs.push(tokenData);
          }
        } catch (e) {
          console.error(`Token ${tokenAddr} verisi alınırken hata:`, e);
        }
      }
      setHeldTokens(held);
      setFavTokens(favs);

      // 2. ADIM: LEVEL VE XP HESAPLA
      const currentXP = (held.length * 150) + (favs.length * 50);
      setXp(currentXP);
      
      const calcLevel = Math.floor(currentXP / 300) + 1; 
      setLevel(calcLevel);

      // 3. ADIM: RÜTBE BELİRLE
      if (calcLevel >= 20) setRankTitle("Market GOD ⚡");
      else if (calcLevel >= 10) setRankTitle("Crypto Whale 🐋");
      else if (calcLevel >= 5) setRankTitle("Degen Legend 🦍");
      else if (calcLevel >= 2) setRankTitle("Diamond Hands 💎");
      else setRankTitle("Novice Trader 👶");

      // 4. ADIM: Kontrat verilerini çek
      await fetchContractData();

      setLoading(false);
    };

    if (isConnected) {
      fetchData();
      
      // Her 30 saniyede bir verileri güncelle
      const interval = setInterval(fetchContractData, 30000);
      return () => clearInterval(interval);
    }
  }, [allTokens, address, isConnected, publicClient, fetchContractData]);

  // 5. ADIM: İSİM KAYDETME FONKSİYONU
  const saveNickname = () => {
      if(!editInput.trim()) return;
      setNickname(editInput);
      localStorage.setItem(`nickname_${address}`, editInput);
      setIsEditing(false);
      toast.success("Nickname Updated!");
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Copied!");
    }
  };

  const totalValue = heldTokens.reduce((sum, t) => sum + parseFloat(t.collateral) * 3200, 0);

  if (!isConnected) return (
    <div style={{ backgroundColor: '#0a0e27', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" />
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', position: 'relative', zIndex: 10 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', borderRadius: '20px', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(253, 220, 17, 0.4)' }}><Wallet size={40} style={{ color: '#000' }} /></div>
          <h1 style={{ fontSize: '40px', fontWeight: '900', marginBottom: '8px' }}>Connect Your Wallet</h1>
          <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '32px' }}>Start trading tokens on Polygon</p>
          <div style={{ transform: 'scale(1.1)' }}><ConnectButton /></div>
        </motion.div>
        <Link href="/" style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b', textDecoration: 'none', transition: 'color 0.3s' }}><ArrowLeft size={16} />Back to Home</Link>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#0a0e27', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'rgba(10, 14, 39, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.3s' }}><ArrowLeft size={18} /><span style={{ fontSize: '14px', fontWeight: '600' }}>Back to Board</span></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ transform: 'scale(0.9)' }}><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div></div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
        
        {/* YENİLENMİŞ PROFİL KARTI */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ borderRadius: '24px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '32px', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
          
          {/* Arkaplan Süslemesi */}
          <div style={{ position: 'absolute', right: 0, top: 0, padding: '20px', opacity: 0.05, transform: 'rotate(12deg)' }}><Trophy size={180} color="#FDDC11" /></div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
              
              {/* AVATAR & LEVEL */}
              <div style={{ position: 'relative' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(253, 220, 17, 0.3)', flexShrink: 0, border: '4px solid rgba(0,0,0,0.5)', fontSize: '40px' }}>
                  {level > 5 ? '🦍' : '👽'}
                </div>
                <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#FDDC11', color: '#000', padding: '4px 12px', borderRadius: '12px', fontWeight: '900', fontSize: '12px', border: '2px solid #000', whiteSpace: 'nowrap' }}>
                   LVL {level}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                
                {/* İSİM DÜZENLEME ALANI */}
                <div style={{ marginBottom: '8px' }}>
                   {isEditing ? (
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <input 
                             type="text" 
                             value={editInput} 
                             onChange={(e) => setEditInput(e.target.value)} 
                             placeholder="Enter Name..." 
                             style={{ 
                               background: 'rgba(0,0,0,0.3)', 
                               border: '1px solid #FDDC11', 
                               borderRadius: '8px', 
                               padding: '4px 12px', 
                               fontSize: '20px', 
                               fontWeight: 'bold', 
                               color: '#fff', 
                               outline: 'none',
                               width: '100%',
                               maxWidth: '300px'
                             }} 
                             autoFocus 
                           />
                           <button onClick={saveNickname} style={{ padding: '6px', background: '#22c55e', borderRadius: '8px', border: 'none', cursor: 'pointer' }}><Check size={16} color="white"/></button>
                           <button onClick={() => setIsEditing(false)} style={{ padding: '6px', background: '#ef4444', borderRadius: '8px', border: 'none', cursor: 'pointer' }}><X size={16} color="white"/></button>
                       </div>
                   ) : (
                       <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                               <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0, color: '#fff' }}>{nickname || rankTitle}</h1>
                               <button onClick={() => { setIsEditing(true); setEditInput(nickname || rankTitle); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Edit2 size={18} /></button>
                               {level > 5 && <Shield size={24} style={{ color: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' }} />}
                           </div>
                           {/* Rütbe Rozeti */}
                           {nickname && <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FDDC11', backgroundColor: 'rgba(253, 220, 17, 0.1)', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', marginTop: '4px' }}>{rankTitle}</span>}
                       </div>
                   )}
                </div>

                {/* Cüzdan Adresi */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }} onClick={handleCopyAddress}>
                  <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#64748b' }}>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  <Copy size={14} style={{ color: '#64748b' }} />
                </div>

                {/* XP BAR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, maxWidth: '300px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                       <div style={{ height: '100%', width: `${Math.min((xp % 300) / 3, 100)}%`, background: 'linear-gradient(90deg, #FDDC11, #fbbf24)', transition: 'width 0.5s ease-out' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>{xp} / {level * 300} XP</span>
                </div>
              </div>
            </div>

            {/* İSTATİSTİKLER (SAĞ TARAF) */}
            <div style={{ display: 'flex', gap: '40px', textAlign: 'right' }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Net Worth</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Portfolio</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#fff' }}>{heldTokens.length} <span style={{fontSize:'16px', color:'#64748b'}}>Tokens</span></div>
                </div>
            </div>
          </div>
        </motion.div>

        {/* YENİ: PLATFORM İSTATİSTİKLERİ BÖLÜMÜ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px', color: '#fff' }}>Platform Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* Traders Card */}
            <div style={{ borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.3), rgba(15, 23, 42, 0.6))', backdropFilter: 'blur(10px)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={24} color="#3b82f6" />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>ACTIVE TRADERS</div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#fff' }}>{tradersCount}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
                {uniqueTraders.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: '8px' }}>Recent Traders:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {uniqueTraders.slice(0, 5).map((trader, idx) => (
                        <div key={idx} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '10px', fontFamily: 'monospace' }}>
                          {trader.nickname}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : 'No recent traders'}
              </div>
            </div>

            {/* Holders Card */}
            <div style={{ borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.3), rgba(15, 23, 42, 0.6))', backdropFilter: 'blur(10px)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={24} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>TOTAL HOLDERS</div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#fff' }}>{holdersStats.total}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {holdersStats.topHolders.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: '8px' }}>Top Holders:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {holdersStats.topHolders.slice(0, 3).map((holder, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{holder.address}</span>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>{holder.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : 'No holder data'}
              </div>
            </div>

            {/* Bonding Curve Card */}
            <div style={{ borderRadius: '16px', border: '1px solid rgba(253, 220, 17, 0.2)', background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.3), rgba(15, 23, 42, 0.6))', backdropFilter: 'blur(10px)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(253, 220, 17, 0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(253, 220, 17, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={24} color="#FDDC11" />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>BONDING CURVES</div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#fff' }}>{bondingCurveStats.activeCurves}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                <div style={{ marginBottom: '8px' }}>Total Liquidity: <span style={{ color: '#FDDC11', fontWeight: 'bold' }}>{bondingCurveStats.totalLiquidity.toFixed(2)} MATIC</span></div>
                <div>Total Tokens: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{bondingCurveStats.totalTokens.toFixed(0)}</span></div>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: '32px', display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '16px' }}>
          <button onClick={() => setActiveTab("held")} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', border: 'none', backgroundColor: activeTab === "held" ? 'rgba(253, 220, 17, 0.2)' : 'transparent', color: activeTab === "held" ? '#FDDC11' : '#94a3b8', cursor: 'pointer', transition: 'all 0.3s', borderBottom: activeTab === "held" ? '2px solid #FDDC11' : 'none' }}>
            <Coins size={16} /> Holdings ({heldTokens.length})
          </button>
          <button onClick={() => setActiveTab("favorites")} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', border: 'none', backgroundColor: activeTab === "favorites" ? 'rgba(253, 220, 17, 0.2)' : 'transparent', color: activeTab === "favorites" ? '#FDDC11' : '#94a3b8', cursor: 'pointer', transition: 'all 0.3s', borderBottom: activeTab === "favorites" ? '2px solid #FDDC11' : 'none' }}>
            <Star size={16} /> Watchlist ({favTokens.length})
          </button>
        </motion.div>

        {/* Token Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b', fontSize: '16px' }}>
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ display: 'inline-block' }}>Loading your data...</motion.div>
          </div>
        ) : (activeTab === "held" ? heldTokens : favTokens).length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '80px 20px', borderRadius: '20px', border: '1px dashed rgba(253, 220, 17, 0.2)', backgroundColor: 'rgba(253, 220, 17, 0.05)' }}>
            <Star size={48} style={{ color: '#64748b', margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>{activeTab === "held" ? "You don't hold any tokens yet" : "Your watchlist is empty"}</p>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {(activeTab === "held" ? heldTokens : favTokens).map((token: TokenData, idx) => (
              <Link href={`/trade/${token.address}`} key={token.address} style={{ textDecoration: 'none' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} whileHover={{ y: -8, borderColor: 'rgba(253, 220, 17, 0.5)' }} style={{ borderRadius: '16px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))', backdropFilter: 'blur(10px)', padding: '20px', cursor: 'pointer', transition: 'all 0.3s', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900', color: '#000' }}>{token.symbol[0]}</div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>{token.name}</div>
                        <div style={{ fontSize: '12px', color: '#FDDC11', fontWeight: '700', margin: 0 }}>{token.symbol}</div>
                      </div>
                    </div>
                    {token.isFav && <Star size={20} style={{ color: '#FDDC11', fill: '#FDDC11' }} />}
                  </div>

                  {/* Balance */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>Balance</div>
                    <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '16px' }}>{parseFloat(token.balance) > 0.01 ? parseFloat(token.balance).toFixed(2) : parseFloat(token.balance).toFixed(6)}</div>
                  </div>

                  {/* Footer Stats */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>MARKET CAP</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#10b981' }}>${(parseFloat(token.collateral) * 3200).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>BONDING CURVE</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#FDDC11' }}>{parseFloat(token.collateral).toFixed(2)} MATIC</div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
