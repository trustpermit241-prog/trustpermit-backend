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

// Automatically use the current Windows user wallet path
// Example: C:\Users\cjgbe\.config\solana\id.json
const walletPath = path.join(
  os.homedir(),
  ".config",
  "solana",
  "id.json"
);

// Check if wallet exists
if (!fs.existsSync(walletPath)) {
  throw new Error(
    `Solana wallet not found at ${walletPath}. Run: solana-keygen new --no-bip39-passphrase`
  );
}

// Load wallet
const secretKey = Uint8Array.from(
  JSON.parse(fs.readFileSync(walletPath, "utf-8"))
);

const wallet = Keypair.fromSecretKey(secretKey);

// Send transaction
const saveHashToBlockchain = async () => {
  try {
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
    throw error;
  }
};

module.exports = saveHashToBlockchain;