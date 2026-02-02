use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use crate::common::response::ApiErrorResponse;
use axum::http::StatusCode;
use ark_bn254::Fr;
use ark_ff::{PrimeField, BigInteger};
use taceo_poseidon2::bn254::t4 as poseidon2;

#[derive(Deserialize)]
pub struct HashRequest {
    pub inputs: Vec<String>,
}

#[derive(Serialize)]
pub struct HashResponse {
    pub hash: String,
}

/// Convert hex string (0x-prefixed or not) to Fr
fn hex_to_fr(hex: &str) -> Result<Fr, String> {
    let clean = hex.strip_prefix("0x").unwrap_or(hex);
    let bytes = hex::decode(clean).map_err(|e| format!("Invalid hex: {}", e))?;
    // ark-bn254 Fr from Big Endian bytes (modulo order)
    Ok(Fr::from_be_bytes_mod_order(&bytes))
}

fn field_to_hex(f: Fr) -> String {
    let bytes = f.into_bigint().to_bytes_be();
    let hex_str = hex::encode(bytes);
    format!("{:0>64}", hex_str)
}

/// Handler for Poseidon2 hashing (Noir compatible Sponge)
pub async fn hash_poseidon(
    Json(payload): Json<HashRequest>,
) -> Result<Json<HashResponse>, ApiErrorResponse> {
    let inputs = payload.inputs;
    
    // Validate input count for t4 sponge (state size 4)
    // t4 can handle: 2 inputs (leaves 1 capacity + iv) or 3 inputs (leaves iv).
    // Noir implementation:
    // 2 inputs: [a, b, 0, iv] where iv = 2 * 2^64
    // 3 inputs: [a, b, c, iv] where iv = 3 * 2^64
    if inputs.len() != 2 && inputs.len() != 3 {
         return Err(ApiErrorResponse::default()
            .with_code(StatusCode::BAD_REQUEST)
            .with_message("Only 2 or 3 inputs supported for Noir Poseidon compatibility"));
    }

    let a = hex_to_fr(&inputs[0]).map_err(|e| ApiErrorResponse::default().with_message(&e))?;
    let b = hex_to_fr(&inputs[1]).map_err(|e| ApiErrorResponse::default().with_message(&e))?;

    // Noir compatible IV calculation
    let two_pow_64 = Fr::from(18446744073709551616u128);
    let iv_val = inputs.len() as u64; 
    let iv = Fr::from(iv_val) * two_pow_64;

    let result_fr = if inputs.len() == 2 {
        // State: [a, b, 0, iv]
        let mut state = [a, b, Fr::from(0u64), iv];
        poseidon2::permutation_in_place(&mut state);
        state[0]
    } else {
        // len == 3
        let c = hex_to_fr(&inputs[2]).map_err(|e| ApiErrorResponse::default().with_message(&e))?;
        // State: [a, b, c, iv]
        let mut state = [a, b, c, iv];
        poseidon2::permutation_in_place(&mut state);
        state[0]
    };

    Ok(Json(HashResponse { 
        hash: field_to_hex(result_fr) 
    }))
}

pub fn hash_routes() -> Router<AppState> {
    Router::new().route("/poseidon", post(hash_poseidon))
}
