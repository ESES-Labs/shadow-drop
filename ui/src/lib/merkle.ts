/**
 * Merkle tree implementation for frontend
 * Uses a Poseidon-like hash for ZK compatibility
 */

const TREE_DEPTH = 8;

/**
 * Simple hash function matching backend
 * In production, use @lightprotocol/hasher.js for proper Poseidon
 */
function poseidonHash2(a: Uint8Array, b: Uint8Array): Uint8Array {
    // Simple hash combining both inputs
    const combined = new Uint8Array(a.length + b.length + 9);
    const prefix = new TextEncoder().encode("poseidon2");
    combined.set(prefix, 0);
    combined.set(a, prefix.length);
    combined.set(b, prefix.length + a.length);
    
    return simpleHash(combined);
}

function poseidonHash3(a: Uint8Array, b: Uint8Array, c: Uint8Array): Uint8Array {
    const combined = new Uint8Array(a.length + b.length + c.length + 9);
    const prefix = new TextEncoder().encode("poseidon3");
    combined.set(prefix, 0);
    combined.set(a, prefix.length);
    combined.set(b, prefix.length + a.length);
    combined.set(c, prefix.length + a.length + b.length);
    
    return simpleHash(combined);
}

/**
 * Simple 32-byte hash using Web Crypto API (SHA-256-like)
 * For demo purposes - in production use proper Poseidon
 */
function simpleHash(data: Uint8Array): Uint8Array {
    // Use a simple deterministic hash
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    let h3 = 0xdeadbeef;
    let h4 = 0xcafebabe;
    
    for (let i = 0; i < data.length; i++) {
        h1 ^= data[i];
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= data[i];
        h2 = Math.imul(h2, 0x811c9dc5);
        h3 ^= data[i];
        h3 = Math.imul(h3, 0x1b873593);
        h4 ^= data[i];
        h4 = Math.imul(h4, 0xcc9e2d51);
    }
    
    // Create 32-byte result
    const result = new Uint8Array(32);
    const view = new DataView(result.buffer);
    view.setUint32(0, h1 >>> 0, true);
    view.setUint32(4, h2 >>> 0, true);
    view.setUint32(8, h3 >>> 0, true);
    view.setUint32(12, h4 >>> 0, true);
    view.setUint32(16, (h1 ^ h2) >>> 0, true);
    view.setUint32(20, (h2 ^ h3) >>> 0, true);
    view.setUint32(24, (h3 ^ h4) >>> 0, true);
    view.setUint32(28, (h4 ^ h1) >>> 0, true);
    
    return result;
}

export interface Recipient {
    wallet: string;
    amount: number;
    secret?: Uint8Array;
}

export interface MerkleProof {
    leafIndex: number;
    siblings: Uint8Array[];
    leaf: Uint8Array;
}

/**
 * Compute leaf hash: hash(recipient, amount, secret)
 */
export function computeLeafHash(wallet: string, amount: number, secret: Uint8Array): Uint8Array {
    const walletBytes = new TextEncoder().encode(wallet);
    const amountLamports = BigInt(Math.floor(amount * 1_000_000_000));
    const amountBytes = new Uint8Array(8);
    const amountView = new DataView(amountBytes.buffer);
    amountView.setBigUint64(0, amountLamports, true);
    
    return poseidonHash3(walletBytes, amountBytes, secret);
}

/**
 * Compute nullifier: hash(secret, leaf_index)
 */
export function computeNullifier(secret: Uint8Array, leafIndex: number): Uint8Array {
    const indexBytes = new Uint8Array(8);
    const view = new DataView(indexBytes.buffer);
    view.setBigUint64(0, BigInt(leafIndex), true);
    
    return poseidonHash2(secret, indexBytes);
}

/**
 * Generate a random 32-byte secret
 */
export function generateSecret(): Uint8Array {
    const secret = new Uint8Array(32);
    crypto.getRandomValues(secret);
    return secret;
}

/**
 * Build merkle tree and return root
 */
export function buildMerkleTree(recipients: Recipient[]): {
    root: Uint8Array;
    leaves: Uint8Array[];
    tree: Uint8Array[][];
} {
    // Assign secrets if not provided
    const recipientsWithSecrets = recipients.map(r => ({
        ...r,
        secret: r.secret || generateSecret()
    }));
    
    // Compute leaves
    const leaves = recipientsWithSecrets.map(r => 
        computeLeafHash(r.wallet, r.amount, r.secret!)
    );
    
    // Pad to power of 2
    const paddedSize = 1 << TREE_DEPTH;
    while (leaves.length < paddedSize) {
        leaves.push(new Uint8Array(32));
    }
    
    // Build tree bottom-up
    const tree: Uint8Array[][] = [leaves];
    let currentLevel = leaves;
    
    for (let i = 0; i < TREE_DEPTH; i++) {
        const nextLevel: Uint8Array[] = [];
        for (let j = 0; j < currentLevel.length; j += 2) {
            const parent = poseidonHash2(currentLevel[j], currentLevel[j + 1]);
            nextLevel.push(parent);
        }
        tree.push(nextLevel);
        currentLevel = nextLevel;
    }
    
    return {
        root: currentLevel[0],
        leaves: tree[0],
        tree
    };
}

/**
 * Get merkle proof for a leaf
 */
export function getMerkleProof(tree: Uint8Array[][], leafIndex: number): MerkleProof {
    const siblings: Uint8Array[] = [];
    let idx = leafIndex;
    
    for (let i = 0; i < TREE_DEPTH; i++) {
        const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
        siblings.push(tree[i][siblingIdx]);
        idx = Math.floor(idx / 2);
    }
    
    return {
        leafIndex,
        siblings,
        leaf: tree[0][leafIndex]
    };
}

/**
 * Verify a merkle proof
 */
export function verifyMerkleProof(
    root: Uint8Array,
    leaf: Uint8Array,
    leafIndex: number,
    siblings: Uint8Array[]
): boolean {
    let current = leaf;
    let idx = leafIndex;
    
    for (let i = 0; i < siblings.length; i++) {
        const isRight = idx % 2 === 1;
        if (isRight) {
            current = poseidonHash2(siblings[i], current);
        } else {
            current = poseidonHash2(current, siblings[i]);
        }
        idx = Math.floor(idx / 2);
    }
    
    // Compare roots
    for (let i = 0; i < 32; i++) {
        if (current[i] !== root[i]) return false;
    }
    return true;
}

/**
 * Convert Uint8Array to hex string
 */
export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
