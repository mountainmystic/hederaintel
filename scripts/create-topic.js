// scripts/create-topic.js
// Creates the HederaIntel platform HCS topic on mainnet
// Run: node scripts/create-topic.js

import {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = Client.forMainnet();
client.setOperator(
  AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
);

console.log("Creating HederaIntel platform topic on mainnet...");

const tx = await new TopicCreateTransaction()
  .setTopicMemo("HederaIntel — Compliance & Audit Trail")
  .execute(client);

const receipt = await tx.getReceipt(client);
const topicId = receipt.topicId.toString();

console.log("\n✅ Topic created successfully!");
console.log(`   Topic ID: ${topicId}`);
console.log("\nAdd this to your Railway environment variables:");
console.log(`   HCS_COMPLIANCE_TOPIC_ID=${topicId}`);
console.log("\nAnd add this to your .env file for local dev.");

client.close();
