"use client";

import * as React from "react";
import { RainbowKitProvider, getDefaultWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { trustWallet, ledgerWallet } from "@rainbow-me/rainbowkit/wallets";
import { polygon } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";

// QueryClient'i bir kere oluşturun
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// WalletConnect Project ID - environment variable'dan al
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "default-project-id";

const { wallets } = getDefaultWallets({
  appName: "AION Pump",
  projectId: projectId,
});

const config = getDefaultConfig({
  appName: "AION Pump",
  projectId: projectId,
  chains: [polygon],
  wallets: [
    ...wallets,
    {
      groupName: "Other",
      wallets: [trustWallet, ledgerWallet],
    },
  ],
  transports: {
    [polygon.id]: http(),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Eğer henüz mount olmadıysa boş div göster
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-[#FDDC11] text-xl font-bold">Loading AION...</div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
