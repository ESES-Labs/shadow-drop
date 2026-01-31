//! Merkle tree implementation with Poseidon hashing
//! 
//! This module provides a proper merkle tree for ZK proofs.
//! Uses a simplified Poseidon-like hash for demo (replace with light-poseidon for production).

use std::collections::HashMap;

/// Tree depth (supports 2^8 = 256 recipients)
pub const TREE_DEPTH: usize = 8;

/// Maximum number of leaves
pub const MAX_LEAVES: usize = 1 << TREE_DEPTH;

/// A 32-byte hash value
pub type Hash = [u8; 32];

/// Merkle tree structure
#[derive(Debug, Clone)]
pub struct MerkleTree {
    /// All nodes in the tree (bottom-up, left-to-right per level)
    nodes: Vec<Hash>,
    /// Number of leaves
    leaf_count: usize,
    /// Leaf index by recipient wallet
    leaf_indices: HashMap<String, usize>,
}

/// Merkle proof for a single leaf
#[derive(Debug, Clone)]
pub struct MerkleProof {
    pub leaf_index: usize,
    pub siblings: Vec<Hash>,
    pub leaf: Hash,
}

impl MerkleTree {
    /// Build a merkle tree from recipient list
    pub fn from_recipients(recipients: &[(String, f64, [u8; 32])]) -> Self {
        let leaf_count = recipients.len();
        assert!(leaf_count <= MAX_LEAVES, "Too many recipients");
        
        // Compute leaves: hash(recipient, amount, secret)
        let mut leaves: Vec<Hash> = recipients
            .iter()
            .map(|(wallet, amount, secret)| {
                compute_leaf_hash(wallet, *amount, secret)
            })
            .collect();
        
        // Pad to power of 2
        let padded_size = (1 << TREE_DEPTH) as usize;
        while leaves.len() < padded_size {
            leaves.push([0u8; 32]); // Empty leaf
        }
        
        // Build leaf index map
        let mut leaf_indices = HashMap::new();
        for (i, (wallet, _, _)) in recipients.iter().enumerate() {
            leaf_indices.insert(wallet.clone(), i);
        }
        
        // Build tree bottom-up
        let mut nodes = leaves.clone();
        let mut current_level = leaves;
        
        for _ in 0..TREE_DEPTH {
            let mut next_level = Vec::new();
            for chunk in current_level.chunks(2) {
                let parent = hash_pair(&chunk[0], &chunk[1]);
                next_level.push(parent);
                nodes.push(parent);
            }
            current_level = next_level;
        }
        
        Self {
            nodes,
            leaf_count,
            leaf_indices,
        }
    }
    
    /// Get the merkle root
    pub fn root(&self) -> Hash {
        *self.nodes.last().unwrap_or(&[0u8; 32])
    }
    
    /// Get proof for a wallet
    pub fn get_proof(&self, wallet: &str) -> Option<MerkleProof> {
        let leaf_index = *self.leaf_indices.get(wallet)?;
        let leaf = self.nodes[leaf_index];
        
        let mut siblings = Vec::new();
        let mut idx = leaf_index;
        let mut level_start = 0;
        let mut level_size = 1 << TREE_DEPTH;
        
        for _ in 0..TREE_DEPTH {
            let sibling_idx = if idx % 2 == 0 { idx + 1 } else { idx - 1 };
            siblings.push(self.nodes[level_start + sibling_idx]);
            
            level_start += level_size;
            level_size /= 2;
            idx /= 2;
        }
        
        Some(MerkleProof {
            leaf_index,
            siblings,
            leaf,
        })
    }
    
    /// Get leaf index for a wallet
    pub fn get_leaf_index(&self, wallet: &str) -> Option<usize> {
        self.leaf_indices.get(wallet).copied()
    }
}

/// Compute leaf hash: hash(recipient, amount, secret)
pub fn compute_leaf_hash(wallet: &str, amount: f64, secret: &[u8; 32]) -> Hash {
    // Convert wallet to bytes
    let wallet_bytes = wallet.as_bytes();
    
    // Convert amount to bytes (as lamports)
    let amount_lamports = (amount * 1_000_000_000.0) as u64;
    let amount_bytes = amount_lamports.to_le_bytes();
    
    // Compute hash: Poseidon-like simplified hash
    // In production, use light-poseidon crate
    poseidon_hash_3(wallet_bytes, &amount_bytes, secret)
}

/// Compute nullifier: hash(secret, leaf_index)
pub fn compute_nullifier(secret: &[u8; 32], leaf_index: usize) -> Hash {
    let index_bytes = (leaf_index as u64).to_le_bytes();
    poseidon_hash_2(secret, &index_bytes)
}

/// Hash two nodes together
fn hash_pair(left: &Hash, right: &Hash) -> Hash {
    poseidon_hash_2(left, right)
}

/// Simplified Poseidon-like hash for 2 inputs
/// In production, replace with light-poseidon
fn poseidon_hash_2(a: &[u8], b: &[u8]) -> Hash {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash as StdHash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    b"poseidon2".hash(&mut hasher);
    a.hash(&mut hasher);
    b.hash(&mut hasher);
    
    let h1 = hasher.finish();
    
    let mut hasher2 = DefaultHasher::new();
    h1.hash(&mut hasher2);
    let h2 = hasher2.finish();
    
    let mut hasher3 = DefaultHasher::new();
    h2.hash(&mut hasher3);
    let h3 = hasher3.finish();
    
    let mut hasher4 = DefaultHasher::new();
    h3.hash(&mut hasher4);
    let h4 = hasher4.finish();
    
    let mut result = [0u8; 32];
    result[0..8].copy_from_slice(&h1.to_le_bytes());
    result[8..16].copy_from_slice(&h2.to_le_bytes());
    result[16..24].copy_from_slice(&h3.to_le_bytes());
    result[24..32].copy_from_slice(&h4.to_le_bytes());
    result
}

/// Simplified Poseidon-like hash for 3 inputs
fn poseidon_hash_3(a: &[u8], b: &[u8], c: &[u8]) -> Hash {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash as StdHash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    b"poseidon3".hash(&mut hasher);
    a.hash(&mut hasher);
    b.hash(&mut hasher);
    c.hash(&mut hasher);
    
    let h1 = hasher.finish();
    
    let mut hasher2 = DefaultHasher::new();
    h1.hash(&mut hasher2);
    let h2 = hasher2.finish();
    
    let mut hasher3 = DefaultHasher::new();
    h2.hash(&mut hasher3);
    let h3 = hasher3.finish();
    
    let mut hasher4 = DefaultHasher::new();
    h3.hash(&mut hasher4);
    let h4 = hasher4.finish();
    
    let mut result = [0u8; 32];
    result[0..8].copy_from_slice(&h1.to_le_bytes());
    result[8..16].copy_from_slice(&h2.to_le_bytes());
    result[16..24].copy_from_slice(&h3.to_le_bytes());
    result[24..32].copy_from_slice(&h4.to_le_bytes());
    result
}

/// Generate a random secret for a recipient
pub fn generate_secret() -> [u8; 32] {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    
    let mut secret = [0u8; 32];
    for (i, chunk) in secret.chunks_mut(8).enumerate() {
        let val = now.wrapping_add(i as u128).to_le_bytes();
        chunk.copy_from_slice(&val[0..8]);
    }
    secret
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_merkle_tree_basic() {
        let secret1 = generate_secret();
        let secret2 = generate_secret();
        
        let recipients = vec![
            ("wallet1".to_string(), 1.0, secret1),
            ("wallet2".to_string(), 2.0, secret2),
        ];
        
        let tree = MerkleTree::from_recipients(&recipients);
        
        // Root should be non-zero
        let root = tree.root();
        assert_ne!(root, [0u8; 32]);
        
        // Should get proof for wallet1
        let proof = tree.get_proof("wallet1");
        assert!(proof.is_some());
        
        let proof = proof.unwrap();
        assert_eq!(proof.leaf_index, 0);
        assert_eq!(proof.siblings.len(), TREE_DEPTH);
    }
    
    #[test]
    fn test_nullifier_uniqueness() {
        let secret = generate_secret();
        
        let null1 = compute_nullifier(&secret, 0);
        let null2 = compute_nullifier(&secret, 1);
        
        assert_ne!(null1, null2);
    }
}
