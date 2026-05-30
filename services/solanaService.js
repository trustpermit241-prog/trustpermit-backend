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
const walletPath = path.join(
  os.homedir(),
  ".config",
  "solana",
  "id.json"
);

// ===== TEMPORARY RENDER SAFE MODE =====
let wallet = null;

if (fs.existsSync(walletPath)) {
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(walletPath, "utf-8"))
  );

  wallet = Keypair.fromSecretKey(secretKey);

  console.log("✅ Solana wallet loaded");
} else {
  console.log("⚠️ Solana wallet not found. Blockchain disabled.");
}

// Send transaction
const saveHashToBlockchain = async () => {
  try {
    // Prevent crash if wallet missing
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

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );

    console.log("Blockchain Transaction Signature:", signature);

    return signature;
  } catch (error) {
    console.error("Solana Blockchain Error:", error);
    return "BLOCKCHAIN_ERROR";
  }
};

module.exports = saveHashToBlockchain;