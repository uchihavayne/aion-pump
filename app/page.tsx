"use client";

import { useState, useEffect } from "react";
// Gerekli ikonlar
import { Rocket, X, Search, Plus, TrendingUp, Activity, Users, Coins, Twitter, Send, Globe } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useWatchContractEvent } from "wagmi"; 
import { parseEther, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import toast, { Toaster } from 'react-hot-toast';

// --- GÖRSELDEKİNE BENZER GENERATIVE AVATAR ---
const getTokenImage = (address: string) => 
  `https://api.dyneui.com/avatar/abstract?seed=${address}&size=400&background=000000&color=FDDC11&pattern=circuit&variance=0.7`;

// Test token adreslerini tanımla (bunlar deploy'da görünmesin)
const TEST_TOKEN_ADDRESSES = [
  "0x1234567890123456789012345678901234567890", // Örnek test adresleri
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
];

// Token'ın test token olup olmadığını kontrol et
const isTestToken = (address: string) => {
  const addr = address.toLowerCase();
  // Test token pattern'lerini kontrol et
  return (
    addr.startsWith('0x0000') ||
    addr.startsWith('0x1111') ||
    addr.startsWith('0x2222') ||
    addr.startsWith('0x3333') ||
    addr.endsWith('0000') ||
    TEST_TOKEN_ADDRESSES.includes(addr) ||
    // Ayrıca çok düşük collateral'ı olan token'lar da test olabilir
    addr.includes('test') ||
    addr.includes('demo')
  );
};

// TOKEN KARTI (Senin tasarım diline uyumlu)
function DarkTokenCard({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const [hovering, setHovering] = useState(false);
  
  // Kontrat verilerini çek
  const { data: salesData } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddress] });
  const { data: name } = useReadContract({ address: tokenAddress, abi: [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "name" });
  const { data: symbol } = useReadContract({ address: tokenAddress, abi: [{ name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }], functionName: "symbol" });

  const collateral = salesData ? formatEther(salesData[1] as bigint) : "0";
  const tokensSold = salesData ? (salesData[3] as bigint) : 0n;
  const progress = Number((tokensSold * 100n) / 800000000000000000000000000n);
  const realProgress = progress > 100 ? 100 : progress;
  const tokenImage = getTokenImage(tokenAddress);
  
  // Rastgele değişim verisi (demo amaçlı)
  const change24h = (Math.random() * 30 - 10).toFixed(1);
  const isPositive = parseFloat(change24h) >= 0;

  // Test token ise farklı bir kart göster
  if (isTestToken(tokenAddress)) {
    return null; // veya test kartını gizle
  }

  return (
    <Link href={`/trade/${tokenAddress}`}>
      <motion.div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'relative',
          cursor: 'pointer',
          height: '100%',
          borderRadius: '16px',
          border: hovering ? '1px solid rgba(253, 220, 17, 0.4)' : '1px solid rgba(253, 220, 17, 0.1)',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))', // Daha koyu, modern
          backdropFilter: 'blur(10px)',
          padding: '20px',
          transition: 'all 0.3s ease',
          transform: hovering ? 'translateY(-5px)' : 'translateY(0)',
          boxShadow: hovering ? '0 10px 30px -10px rgba(253, 220, 17, 0.15)' : 'none'
        }}
      >
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <img 
            src={tokenImage} 
            alt="token" 
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              border: '1px solid rgba(253, 220, 17, 0.2)',
              objectFit: 'cover'
            }}
          />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '4px', lineHeight: '1.2' }}>
              {name?.toString() || "Loading..."}
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(253, 220, 17, 0.1)',
                color: '#FDDC11',
                border: '1px solid rgba(253, 220, 17, 0.2)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {symbol?.toString() || "TKR"}
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: isPositive ? '#4ade80' : '#f87171'
              }}>
                {isPositive ? '↗' : '↘'} {change24h}%
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#94a3b8' }}>
            <span style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bonding Curve</span>
            <span style={{ fontWeight: 'bold', color: '#FDDC11' }}>{realProgress.toFixed(1)}%</span>
          </div>
          <div style={{
            height: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${realProgress}%` }}
              transition={{ duration: 1 }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #FDDC11, #fbbf24)',
                boxShadow: '0 0 10px rgba(253, 220, 17, 0.5)'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Coins size={14} className="text-[#FDDC11]" />
              <span>{parseFloat(collateral).toFixed(2)} MATIC</span>
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={14} className="text-purple-400" />
              <span>{(Math.random() * 200 + 20).toFixed(0)}</span>
           </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trending");
  const [formData, setFormData] = useState({ name: "", ticker: "", desc: "", twitter: "", telegram: "", website: "" });
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allTokens } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getAllTokens" });
  const [orderedTokens, setOrderedTokens] = useState<string[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<string[]>([]);
  
  useEffect(() => { 
    if (allTokens) { 
      const tokens = [...allTokens].reverse() as string[];
      // Test token'ları filtrele
      const realTokens = tokens.filter(token => !isTestToken(token));
      setOrderedTokens(realTokens.slice(0, 12));
    } 
  }, [allTokens]);

  // Token'ları filtrele
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTokens(orderedTokens);
    } else {
      const filtered = orderedTokens.filter(token => 
        token.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTokens(filtered);
    }
  }, [searchQuery, orderedTokens]);

  // Event Listeners
  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    eventName: 'Buy', 
    onLogs(logs: any) { 
      if (logs[0]?.args?.token && !isTestToken(logs[0].args.token)) {
        updateOrder(logs[0].args.token); 
      }
    } 
  });

  useWatchContractEvent({ 
    address: CONTRACT_ADDRESS, 
    abi: CONTRACT_ABI, 
    eventName: 'TokenCreated', 
    onLogs(logs: any) { 
      if (logs[0]?.args?.token && !isTestToken(logs[0].args.token)) {
        setOrderedTokens(prev => [logs[0].args.token, ...prev]); 
        toast.success("New Token Launched!");
      }
    }
  });

  const updateOrder = (token: string) => {
    setOrderedTokens(prev => [token, ...prev.filter(t => t.toLowerCase() !== token.toLowerCase())]);
  };

  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleCreate = async () => {
    if (!formData.name || !formData.ticker) { 
      toast.error("Name & Ticker required"); 
      return; 
    }
    try {
      writeContract({ 
        address: CONTRACT_ADDRESS, 
        abi: CONTRACT_ABI, 
        functionName: "createToken", 
        args: [formData.name, formData.ticker], 
        value: parseEther("0.0001") 
      });
      toast.loading("Confirm in wallet...", { id: 'tx' });
    } catch (e) { 
      toast.error("Failed to create token"); 
      toast.dismiss('tx'); 
    }
  };

  useEffect(() => { 
    if (isConfirmed) {
      toast.dismiss('tx');
      toast.success("Token Created Successfully!");
      if (orderedTokens[0]) {
        localStorage.setItem(`meta_${orderedTokens[0].toLowerCase()}`, JSON.stringify(formData));
      }
      setTimeout(() => { 
        setIsModalOpen(false); 
        setFormData({ name: "", ticker: "", desc: "", twitter: "", telegram: "", website: "" }); 
      }, 1000); 
    }
  }, [isConfirmed]);

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return <div style={{ minHeight: '100vh', backgroundColor: '#0a0e27', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FDDC11' }}>Loading AION...</div>;

  return (
    <div style={{
      backgroundColor: '#0a0e27',
      color: '#fff',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)'
    }}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />

      {/* Arka Plan Efektleri */}
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'rgba(10, 14, 39, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #FDDC11, #fbbf24)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900', fontSize: '18px' }}>A</div>
            <span style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>AION</span>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
             <button 
               onClick={() => setIsModalOpen(true)}
               style={{ background: 'rgba(253, 220, 17, 0.1)', color: '#FDDC11', border: '1px solid rgba(253, 220, 17, 0.2)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
             >
               <Rocket size={16} /> LAUNCH
             </button>
             <div style={{ transform: 'scale(0.95)' }}><ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" /></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
        
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '16px', lineHeight: '1.1' }}>
            Next Gen <span style={{ color: '#FDDC11' }}>Bonding Curve</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>
            Fair launch, instant liquidity, and automated market making. 
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px auto' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '14px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search tokens by address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 48px',
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
           {[
             { label: 'Live Tokens', val: filteredTokens.length, icon: <Coins size={20} className="text-[#FDDC11]" /> },
             { label: '24H Volume', val: '$2.4M', icon: <Activity size={20} className="text-purple-400" /> },
             { label: 'Active Traders', val: '1.8K', icon: <Users size={20} className="text-blue-400" /> },
             { label: 'Avg ROI', val: '240%', icon: <TrendingUp size={20} className="text-green-400" /> }
           ].map((s, i) => (
             <div key={i} style={{ background: 'rgba(30, 41, 59, 0.3)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{s.label}</span>
                   {s.icon}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700' }}>{s.val}</div>
             </div>
           ))}
        </div>

        {/* Feed Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
           {['Trending', 'New', 'Gainers', 'Volume'].map(t => (
             <button 
               key={t} 
               onClick={() => setActiveTab(t.toLowerCase())}
               style={{ 
                 padding: '8px 16px', 
                 borderRadius: '20px', 
                 fontSize: '13px', 
                 fontWeight: '600', 
                 border: activeTab === t.toLowerCase() ? '1px solid #FDDC11' : '1px solid rgba(255, 255, 255, 0.1)',
                 background: activeTab === t.toLowerCase() ? '#FDDC11' : 'transparent',
                 color: activeTab === t.toLowerCase() ? '#000' : '#94a3b8',
                 cursor: 'pointer',
                 transition: 'all 0.2s'
               }}
             >
               {t}
             </button>
           ))}
        </div>

        {/* Token Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filteredTokens.length === 0 ? (
            <div style={{ 
              gridColumn: '1 / -1', 
              textAlign: 'center', 
              padding: '60px 20px',
              background: 'rgba(30, 41, 59, 0.2)',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.1)'
            }}>
              <Coins size={48} style={{ marginBottom: '16px', color: '#64748b', margin: '0 auto' }} />
              <h3 style={{ color: '#fff', marginBottom: '8px' }}>No tokens found</h3>
              <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
                {searchQuery ? 'Try a different search term' : 'Be the first to launch a token!'}
              </p>
              <button 
                onClick={() => setIsModalOpen(true)}
                style={{ 
                  background: 'rgba(253, 220, 17, 0.1)', 
                  color: '#FDDC11', 
                  border: '1px solid rgba(253, 220, 17, 0.2)', 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  fontWeight: '600', 
                  fontSize: '14px', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Rocket size={16} /> Launch First Token
              </button>
            </div>
          ) : (
            filteredTokens.map((addr, i) => <DarkTokenCard key={addr} tokenAddress={addr as `0x${string}`} />)
          )}
        </div>
      </main>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          {/* Backdrop */}
          <div
            onClick={() => setIsModalOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(8px)'
            }}
          />
          
          {/* Modal Content */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderRadius: '20px',
              border: '1px solid rgba(253, 220, 17, 0.3)',
              boxShadow: '0 0 50px rgba(253, 220, 17, 0.15)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(to right, rgba(253, 220, 17, 0.05), transparent)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <Rocket size={20} className="text-[#FDDC11]" />
                 <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Launch Token</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               
               {/* Name & Ticker */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                     <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Name</label>
                     <input type="text" placeholder="Bitcoin" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                  </div>
                  <div>
                     <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Ticker</label>
                     <input type="text" placeholder="BTC" maxLength={10} value={formData.ticker} onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '12px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                  </div>
               </div>

               {/* Description */}
               <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Description</label>
                  <textarea placeholder="Tell us about your token..." value={formData.desc} onChange={(e) => setFormData({...formData, desc: e.target.value})} style={{ width: '100%', padding: '12px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', height: '80px', resize: 'none' }} />
               </div>

               {/* Socials */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                     <Twitter size={14} style={{ position: 'absolute', left: '10px', top: '14px', color: '#64748b' }} />
                     <input type="text" placeholder="Twitter" value={formData.twitter} onChange={(e) => setFormData({...formData, twitter: e.target.value})} style={{ width: '100%', padding: '12px 12px 12px 32px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                     <Send size={14} style={{ position: 'absolute', left: '10px', top: '14px', color: '#64748b' }} />
                     <input type="text" placeholder="Telegram" value={formData.telegram} onChange={(e) => setFormData({...formData, telegram: e.target.value})} style={{ width: '100%', padding: '12px 12px 12px 32px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                     <Globe size={14} style={{ position: 'absolute', left: '10px', top: '14px', color: '#64748b' }} />
                     <input type="text" placeholder="Web" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} style={{ width: '100%', padding: '12px 12px 12px 32px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                  </div>
               </div>

               {/* Button */}
               <button 
                 onClick={handleCreate}
                 disabled={isPending || isConfirming}
                 style={{
                   width: '100%',
                   padding: '14px',
                   backgroundColor: '#FDDC11',
                   color: '#000',
                   border: 'none',
                   borderRadius: '10px',
                   fontWeight: '800',
                   fontSize: '14px',
                   cursor: 'pointer',
                   marginTop: '8px',
                   boxShadow: '0 4px 15px rgba(253, 220, 17, 0.3)',
                   transition: 'transform 0.1s',
                   opacity: (isPending || isConfirming) ? 0.7 : 1
                 }}
                 onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                 onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
               >
                 {isPending ? "CONFIRMING..." : isConfirming ? "DEPLOYING..." : "CREATE & LAUNCH"}
               </button>
               
               <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                  Cost: ~0.0001 MATIC • Instant Trading
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
