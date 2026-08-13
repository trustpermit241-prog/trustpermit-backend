// Usage: node scripts/findPermit.js <permitId>
// This script connects to the same MongoDB as the backend and searches for
// Application and BlockchainRecord documents matching the provided permitId.

const mongoose = require('mongoose');
require('dotenv').config();

const Application = require('../models/Application');
const BlockchainRecord = require('../models/BlockchainRecord');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/findPermit.js <permitId>');
    process.exit(1);
  }

  const permitId = String(arg).trim();
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trustpermit';

  console.log('Connecting to:', MONGO_URI.split('@')[1] || MONGO_URI.substring(0, 50) + '...');

  await mongoose.connect(MONGO_URI);

  const Types = mongoose.Types;
  const searchIds = [];
  if (Types.ObjectId.isValid(permitId)) {
    searchIds.push(new Types.ObjectId(permitId));
  }
  searchIds.push(permitId);

  console.log('\nSearching Application by _id...');
  try {
    const byId = Types.ObjectId.isValid(permitId) ? await Application.findById(permitId).lean() : null;
    const byString = await Application.findOne({ _id: permitId }).lean();

    console.log('findById result:', byId ? JSON.stringify(byId, null, 2) : 'NOT FOUND');
    console.log('findOne(_id: string) result:', byString ? JSON.stringify(byString, null, 2) : 'NOT FOUND');
  } catch (err) {
    console.error('Error querying Application:', err.message);
  }

  console.log('\nSearching BlockchainRecord by permitId (ObjectId and string) ...');
  try {
    const records = await BlockchainRecord.find({ permitId: { $in: searchIds } }).lean();
    if (!records || records.length === 0) {
      console.log('No blockchain records found for permitId in both forms');
    } else {
      console.log('Blockchain records found:', JSON.stringify(records, null, 2));
    }
  } catch (err) {
    console.error('Error querying BlockchainRecord:', err.message);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main();
