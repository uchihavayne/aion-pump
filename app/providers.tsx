"use client";

import * as React from "react";
import { RainbowKitProvider, getDefaultWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { trustWallet, ledgerWallet } from "@rainbow-me/rainbowkit/wallets";
import { polygon } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const { wallets } = getDefaultWallets();

const config = getDefaultConfig({
  appName: "AION Pump",
  projectId: "YOUR_PROJECT_ID", // WalletConnect'ten ID alabilirsin veya boş bırak
  chains: [polygon],
  transports: {
    [polygon.id]: http(),
  },
  wallets: [
    ...wallets,
    {
      groupName: "Other",
      wallets: [trustWallet, ledgerWallet],
    },
  ],
  ssr: true, // Server Side Rendering hatasını çözen ayar budur
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {mounted && children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
