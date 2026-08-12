const {
  Connection,
  clusterApiUrl,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const fs = require("fs");
const os = require("os");
const path = require("path");

// Connect to Solana Devnet
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Wallet path
const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");

// ===== TEMPORARY RENDER SAFE MODE =====
let wallet = null;

if (process.env.SOLANA_SECRET_KEY) {
  try {
    const secretKey = Uint8Array.from(JSON.parse(process.env.SOLANA_SECRET_KEY));
    wallet = Keypair.fromSecretKey(secretKey);
    console.log("✅ Solana wallet loaded from environment");
  } catch (err) {
    console.error("❌ Invalid SOLANA_SECRET_KEY:", err.message);
  }
} else if (fs.existsSync(walletPath)) {
  try {
    const secretKey = Uint8Array.from(
      JSON.parse(fs.readFileSync(walletPath, "utf-8"))
    );

    wallet = Keypair.fromSecretKey(secretKey);

    console.log("✅ Solana wallet loaded from local file");
  } catch (err) {
    console.error("❌ Failed to load Solana wallet file:", err.message);
  }
} else {
  console.log("⚠️ Solana wallet not found. Blockchain disabled.");
}

// Send transaction
const saveHashToBlockchain = async (hash) => {
  try {
    console.log("Saving hash to blockchain:", hash);

    if (!wallet) {
      console.log("⚠️ Skipping blockchain transaction");
      return "BLOCKCHAIN_DISABLED";
    }
    // Ensure wallet has enough balance to pay for fees. If not, request a devnet airdrop.
    const balance = await connection.getBalance(wallet.publicKey).catch((e) => {
      console.error("Failed to fetch wallet balance:", e?.message || e);
      return 0;
    });

    console.log(`Wallet balance: ${balance} lamports`);

    const minLamportsForFee = 1000; // small safety threshold

    if (balance < minLamportsForFee) {
      try {
        console.log("Wallet balance low — requesting devnet airdrop of 1 SOL...");
        const airdropSig = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000); // 1 SOL
        await connection.confirmTransaction(airdropSig, "confirmed");
        console.log("Airdrop confirmed:", airdropSig);
      } catch (airErr) {
        console.error("Airdrop failed:", airErr?.message || airErr);
        // continue — if airdrop fails, transaction likely will fail later
      }
    }

    // Create a tiny self-transfer transaction as a proof. Keep lamports small to avoid meaningful transfers.
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 1,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);

    console.log("Blockchain Transaction Signature:", signature);

    return signature;
  } catch (error) {
    console.error("Solana Blockchain Error:", error);
    return "BLOCKCHAIN_ERROR";
  }
};

module.exports = saveHashToBlockchain;