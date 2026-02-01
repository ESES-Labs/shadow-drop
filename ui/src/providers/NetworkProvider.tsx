import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";

export type NetworkType = "localnet" | "devnet";

// Get Helius API key from environment
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;

interface NetworkConfig {
    name: string;
    endpoint: string;
    explorerUrl: string;
    isHelius: boolean;
}

export const NETWORK_CONFIGS: Record<NetworkType, NetworkConfig> = {
    localnet: {
        name: "Localnet",
        endpoint: "http://localhost:8899",
        explorerUrl: "https://explorer.solana.com/?cluster=custom&customUrl=http://localhost:8899",
        isHelius: false,
    },
    devnet: {
        name: "Devnet",
        endpoint: HELIUS_API_KEY
            ? `https://devnet.helius-rpc.com?api-key=${HELIUS_API_KEY}`
            : clusterApiUrl("devnet"),
        explorerUrl: "https://explorer.solana.com/?cluster=devnet",
        isHelius: !!HELIUS_API_KEY,
    },
};

interface NetworkContextType {
    network: NetworkType;
    config: NetworkConfig;
    setNetwork: (network: NetworkType) => void;
    getExplorerUrl: (type: "tx" | "address", value: string) => string;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

interface Props {
    children: ReactNode;
}

export function NetworkProvider({ children }: Props) {
    // Default to localnet in development, devnet in production
    const [network, setNetworkState] = useState<NetworkType>(() => {
        // Check localStorage first
        const saved = localStorage.getItem("shadow-drop-network");
        if (saved === "localnet" || saved === "devnet") {
            return saved;
        }
        // Default based on environment
        return window.location.hostname === "localhost" ? "localnet" : "devnet";
    });

    const setNetwork = useCallback((newNetwork: NetworkType) => {
        setNetworkState(newNetwork);
        localStorage.setItem("shadow-drop-network", newNetwork);
        // Reload to apply new network connection
        window.location.reload();
    }, []);

    const config = NETWORK_CONFIGS[network];

    const getExplorerUrl = useCallback((type: "tx" | "address", value: string) => {
        const base = network === "localnet"
            ? `https://explorer.solana.com/${type}/${value}?cluster=custom&customUrl=http://localhost:8899`
            : `https://explorer.solana.com/${type}/${value}?cluster=devnet`;
        return base;
    }, [network]);

    return (
        <NetworkContext.Provider value={{ network, config, setNetwork, getExplorerUrl }}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
}
