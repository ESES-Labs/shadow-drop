import { PublicKey } from "@solana/web3.js";
import { buildMerkleTree, toHex } from "./merkle";

// Program ID
export const PROGRAM_ID = new PublicKey("7wjDqUQUpnudD25MELXBiayNiMrStXaKAdrLMwzccu7v");

// Sunspot Verifier Program ID (deployed on devnet)
export const ZK_VERIFIER_PROGRAM_ID = new PublicKey("5C5x84vdrZi1h89u4g7VBsKyrBk5AQ1RjnrFFd5KvWuj");

/**
 * Derive Campaign PDA address
 */
export function deriveCampaignPDA(authority: PublicKey, campaignId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("campaign"),
            authority.toBuffer(),
            Buffer.from(campaignId),
        ],
        PROGRAM_ID
    );
}

/**
 * Derive Vault PDA address
 */
export function deriveVaultPDA(authority: PublicKey, campaignId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("vault"),
            authority.toBuffer(),
            Buffer.from(campaignId),
        ],
        PROGRAM_ID
    );
}

/**
 * Derive Claim Record PDA address
 */
export function deriveClaimRecordPDA(campaign: PublicKey, claimer: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("claim"),
            campaign.toBuffer(),
            claimer.toBuffer(),
        ],
        PROGRAM_ID
    );
}

/**
 * Derive Nullifier Record PDA address (for ZK claims)
 */
export function deriveNullifierRecordPDA(campaign: PublicKey, nullifier: Uint8Array): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("nullifier"),
            campaign.toBuffer(),
            nullifier,
        ],
        PROGRAM_ID
    );
}

/**
 * Generate a unique campaign ID (short, URL-friendly)
 */
export function generateCampaignId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
}

/**
 * Generate a proper merkle root from recipient list using Poseidon hashing (async)
 */
export async function generateMerkleRoot(recipients: { wallet: string; amount: bigint }[]): Promise<Uint8Array> {
    // Build merkle tree (secrets handled inside)
    const { root } = await buildMerkleTree(recipients);

    return root;
}

/**
 * Re-export toHex for convenience
 */
export { toHex };
