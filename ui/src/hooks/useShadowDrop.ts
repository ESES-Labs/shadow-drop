import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import idl from "../idl.json";
import { useNetwork } from "../providers/NetworkProvider";

// Network-specific Program IDs from environment variables
const PROGRAM_IDS = {
    localnet: import.meta.env.VITE_PROGRAM_ID_LOCALNET || "7wjDqUQUpnudD25MELXBiayNiMrStXaKAdrLMwzccu7v",
    devnet: import.meta.env.VITE_PROGRAM_ID_DEVNET || "YOUR_DEVNET_PROGRAM_ID",
    mainnet: import.meta.env.VITE_PROGRAM_ID_MAINNET || "YOUR_MAINNET_PROGRAM_ID",
};

export function useShadowDrop() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { network } = useNetwork();

    // Get program ID based on current network
    const programIdString = PROGRAM_IDS[network] || PROGRAM_IDS.localnet;
    const PROGRAM_ID = useMemo(() => new PublicKey(programIdString), [programIdString]);

    const program = useMemo(() => {
        if (!wallet.publicKey) return null;

        const provider = new AnchorProvider(
            connection,
            wallet as any,
            { commitment: "confirmed" }
        );

        return new Program(idl as any, provider);
    }, [connection, wallet]);

    return {
        program,
        programId: PROGRAM_ID,
        connected: wallet.connected,
        publicKey: wallet.publicKey,
        connection,
        network
    };
}

// Helper to convert bytes to Pubkey (for merkle root)
export function bytesToPubkey(bytes: Uint8Array): PublicKey {
    return new PublicKey(bytes);
}

// Helper to create merkle root from hex string
export function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

