"use client";
import { useState } from "react";
import {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  injected,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) },
  ssr: true,
});
function Connection() {
  const { address, chainId } = useAccount();
  const { connect, connectors, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, error: switchError } = useSwitchChain();
  return (
    <div>
      <button
        className="wallet"
        onClick={() =>
          address
            ? chainId === sepolia.id
              ? disconnect()
              : switchChain({ chainId: sepolia.id })
            : connect({ connector: connectors[0] })
        }
      >
        {address
          ? `${address.slice(0, 6)}…${address.slice(-4)} · ${chainId === sepolia.id ? "Sepolia" : "switch to Sepolia"}`
          : "Connect wallet ↗"}
      </button>
      {(error || switchError) && (
        <small role="alert">
          {(error || switchError)!.message.slice(0, 90)}
        </small>
      )}
    </div>
  );
}
export default function Wallet() {
  const [query] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={query}>
        <Connection />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
