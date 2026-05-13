const hashPermit = require("../utils/hashPermit");
const saveHashToBlockchain = require("../services/solanaService");

const testBlockchain = async (req, res) => {
  try {

    const permit = {
      permitNo: "BP-001",
      owner: "Juan Dela Cruz",
      business: "ABC Store"
    };

    // Generate hash
    const hash = hashPermit(permit);

    // Save to blockchain
    const transaction = await saveHashToBlockchain();

    res.json({
      success: true,
      hash,
      transaction,
    });

  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  testBlockchain,
};