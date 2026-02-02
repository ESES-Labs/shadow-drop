import { PublicKey } from "@solana/web3.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TREE_DEPTH = 8;

/**
 * Async Poseidon hash via Backend API
 * Ensures 100% compatibility with Circuit
 */
async function poseidonHash(inputs: bigint[]): Promise<bigint> {
    // Convert BigInts to hex strings
    // serialize BigInt to hex
    const hexInputs = inputs.map(i => {
        let hex = i.toString(16);
        if (hex.length % 2 !== 0) hex = "0" + hex;
        return hex; // Backend handles clean/0x prefix
    });

    const response = await fetch(`${API_URL}/api/v1/hash/poseidon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: hexInputs })
    });

    if (!response.ok) {
        console.error("Hashing failed:", await response.text());
        throw new Error("Poseidon Hash Failed");
    }

    const data = await response.json();
    // data.hash is hex string
    return BigInt("0x" + data.hash);
}

export interface Recipient {
    wallet: string;
    amount: bigint;
    secret?: Uint8Array;
}

export function generateSecret(): Uint8Array {
    const secret = new Uint8Array(32);
    crypto.getRandomValues(secret);
    secret[31] &= 0x1f; // Mask to fit field (~253 bits)
    return secret;
}

export async function computeLeafHash(wallet: string, amount: bigint, secret: Uint8Array): Promise<Uint8Array> {
    const walletPubkey = new PublicKey(wallet);
    const walletBn = BigInt("0x" + walletPubkey.toBuffer().toString("hex"));
    // Send full wallet address (Backend/Noir will handle Field Modulo reduction)
    // const walletMasked = walletBn & ((1n << 253n) - 1n); 

    const amountLamports = amount;
    const secretBn = BigInt("0x" + Buffer.from(secret).toString("hex"));

    const hash = await poseidonHash([walletBn, amountLamports, secretBn]);
    return bigIntToBytes(hash);
}

export async function computeNullifier(secret: Uint8Array, leafIndex: number): Promise<Uint8Array> {
    const secretBn = BigInt("0x" + Buffer.from(secret).toString("hex"));
    const indexBn = BigInt(leafIndex);
    const hash = await poseidonHash([secretBn, indexBn]);
    return bigIntToBytes(hash);
}

export async function buildMerkleTree(recipients: Recipient[]): Promise<{
    root: Uint8Array;
    leaves: Uint8Array[];
    // We don't return full tree usually, just root and computed leaves
}> {
    // 1. Assign secrets
    const recipientsWithSecrets = recipients.map(r => ({
        ...r,
        secret: r.secret || generateSecret()
    }));

    // 2. Compute Leaves Async
    // Using Promise.all for parallelism
    const leavesBn: bigint[] = await Promise.all(recipientsWithSecrets.map(async r => {
        const leafBytes = await computeLeafHash(r.wallet, r.amount, r.secret!);
        return BigInt("0x" + Buffer.from(leafBytes).toString("hex"));
    }));

    // 3. Pad tree with zeros
    const paddedSize = 1 << TREE_DEPTH;
    while (leavesBn.length < paddedSize) {
        leavesBn.push(0n);
    }

    // 4. Build Tree
    let currentLevel = leavesBn;
    // We don't need to store full tree for frontend usually, just root implies we build it

    for (let i = 0; i < TREE_DEPTH; i++) {
        const nextLevel: bigint[] = [];
        // Process pairs
        // Can be parallelized per level
        // For simplicity, sequential pairs, but parallel fetch?
        // This might flood backend. 
        // 128 + 64 + ... requests.

        // Let's do batching manually: Promise.all for the level
        const levelPromises: Promise<bigint>[] = [];
        for (let j = 0; j < currentLevel.length; j += 2) {
            levelPromises.push(poseidonHash([currentLevel[j], currentLevel[j + 1]]));
        }
        nextLevel.push(...await Promise.all(levelPromises));
        currentLevel = nextLevel;
    }

    const rootBn = currentLevel[0];

    // We also need to return "leaves" (Uint8Array[])
    const leavesBytes = leavesBn.map(bn => bigIntToBytes(bn));

    return {
        root: bigIntToBytes(rootBn),
        leaves: leavesBytes
    };
}

// Helper
function bigIntToBytes(bn: bigint): Uint8Array {
    let hex = bn.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    const len = 32;
    const needed = len * 2;
    hex = hex.padStart(needed, "0");

    // Uint8Array from hex
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32 && i * 2 < hex.length; i++) {
        // Parse from end or start? Big Endian usually.
        // fromHex standard:
        const byteVal = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        bytes[i] = byteVal;
    }
    return bytes;
}

export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// Unused synchronous dummy functions removed
