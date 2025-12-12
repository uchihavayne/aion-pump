"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Wallet, Star, TrendingUp, Coins, Copy, LogOut } from "lucide-react";
import { useAccount, useReadContract, usePublicClient, useDisconnect } from "wagmi";
import Link from "next/link";
import { formatEther, erc20Abi } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast, { Toaster } from 'react-hot-toast';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [activeTab, setActiveTab] = useState<"held" | "favorites">("held");
  const [heldTokens, setHeldTokens] = useState<any[]>([]);
  const [favTokens, setFavTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const publicClient = usePublicClient();
  const { data: allTokens } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getAllTokens" });

  useEffect(() => {
    const fetchData = async () => {
      if (!allTokens || !address || !publicClient) return;
      setLoading(true);

      const held: any[] = [];
      const favs: any[] = [];
      const localFavs = JSON.parse(localStorage.getItem("favorites") || "[]");

      for (const tokenAddr of (allTokens as string[])) {
        try {
          const balance = await publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [address] });
          
          if (balance > 0n || localFavs.includes(tokenAddr)) {
            const [name, symbol, salesData] = await Promise.all([
              publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: erc20Abi, functionName: "name" }),
              publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: erc20Abi, functionName: "symbol" }),
              publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "sales", args: [tokenAddr as `0x${string}`] })
            ]);

            const tokenData = {
              address: tokenAddr,
              name,
              symbol,
              balance: formatEther(balance),
              isFav: localFavs.includes(tokenAddr),
              collateral: salesData ? formatEther(salesData[1] as bigint) : "0"
            };

            if (balance > 0n) held.push(tokenData);
            if (localFavs.includes(tokenAddr)) favs.push(tokenData);
          }
        } catch (e) {}
      }
      setHeldTokens(held);
      setFavTokens(favs);
      setLoading(false);
    };

    if (isConnected) fetchData();
  }, [allTokens, address, isConnected, publicClient]);

  if (!isConnected) return (
    <div style={{ backgroundColor: '#0a0e27', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" />
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', position: 'relative', zIndex: 10 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', borderRadius: '20px', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(253, 220, 17, 0.4)' }}>
            <Wallet size={40} style={{ color: '#000' }} />
          </div>
          <h1 style={{ fontSize: '40px', fontWeight: '900', marginBottom: '8px' }}>Connect Your Wallet</h1>
          <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '32px' }}>Start trading tokens on Polygon</p>
          <div style={{ transform: 'scale(1.1)' }}>
            <ConnectButton />
          </div>
        </motion.div>
        
        <Link href="/" style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b', textDecoration: 'none', transition: 'color 0.3s' }}>
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </div>
    </div>
  );

  const totalValue = heldTokens.reduce((sum, t) => sum + parseFloat(t.collateral) * 3200, 0);

  return (
    <div style={{ backgroundColor: '#0a0e27', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0e27 60%)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1F2128', color: '#fff', border: '1px solid #333' } }} />
      
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(253,220,17,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'rgba(10, 14, 39, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.3s' }}>
            <ArrowLeft size={18} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Back to Board</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ transform: 'scale(0.9)' }}>
              <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
        
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ borderRadius: '24px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.7))', backdropFilter: 'blur(20px)', padding: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '20px', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(253, 220, 17, 0.3)', flexShrink: 0 }}>
                <Wallet size={50} style={{ color: '#000' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 8px 0' }}>My Portfolio</h1>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 12px 0' }}>Track your holdings and watchlist</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(253, 220, 17, 0.1)', borderRadius: '8px', border: '1px solid rgba(253, 220, 17, 0.2)', width: 'fit-content', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(address || ''); toast.success("Copied!"); }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#FDDC11', fontWeight: '700' }}>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  <Copy size={12} style={{ color: '#FDDC11' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '32px', paddingTop: '32px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Total Portfolio Value</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#FDDC11' }}>${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Tokens Held</div>
              <div style={{ fontSize: '28px', fontWeight: '900' }}>{heldTokens.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Watchlist</div>
              <div style={{ fontSize: '28px', fontWeight: '900' }}>{favTokens.length}</div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: '32px', display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '16px' }}>
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
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ display: 'inline-block' }}>
              Loading your data...
            </motion.div>
          </div>
        ) : (activeTab === "held" ? heldTokens : favTokens).length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '80px 20px', borderRadius: '20px', border: '1px dashed rgba(253, 220, 17, 0.2)', backgroundColor: 'rgba(253, 220, 17, 0.05)' }}>
            <Star size={48} style={{ color: '#64748b', margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
              {activeTab === "held" ? "You don't hold any tokens yet" : "Your watchlist is empty"}
            </p>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {(activeTab === "held" ? heldTokens : favTokens).map((token: any, idx) => (
              <Link href={`/trade/${token.address}`} key={token.address} style={{ textDecoration: 'none' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} whileHover={{ y: -8, borderColor: 'rgba(253, 220, 17, 0.5)' }} style={{ borderRadius: '16px', border: '1px solid rgba(253, 220, 17, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))', backdropFilter: 'blur(10px)', padding: '20px', cursor: 'pointer', transition: 'all 0.3s', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #FDDC11, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900', color: '#000' }}>
                        {token.symbol[0]}
                      </div>
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
                    <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '16px' }}>
                      {parseFloat(token.balance) > 0.01 ? parseFloat(token.balance).toFixed(2) : parseFloat(token.balance).toFixed(6)}
                    </div>
                  </div>

                  {/* Footer Stats */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>MARKET CAP</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#10b981' }}>
                        ${(parseFloat(token.collateral) * 3200).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>YOUR SHARE</div>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#FDDC11' }}>
                        {((parseFloat(token.balance) / 1000000000) * 100).toFixed(2)}%
                      </div>
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
