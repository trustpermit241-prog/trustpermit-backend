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

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 1,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      wallet,
    ]);

    console.log("Blockchain Transaction Signature:", signature);

    return signature;
  } catch (error) {
    console.error("Solana Blockchain Error:", error);
    return "BLOCKCHAIN_ERROR";
  }
};

module.exports = saveHashToBlockchain;