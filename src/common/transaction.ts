// common/transaction.ts
import { ethereum } from "@graphprotocol/graph-ts";
import { Transaction } from "../../generated/schema";
import { ZERO_BI } from "./constants";

export class TransactionType {
  static DEX = "DEX";
  static ERC20 = "ERC20";
  static ERC721 = "ERC721";
  static MARKETPLACE = "MARKETPLACE";
  static ICO = "ICO";
  static TLM = "TLM";
  static FUNDS = "FUNDS";
}

export function getOrCreateTransaction(
  event: ethereum.Event,
  type: string
): Transaction {
  let transactionId = event.transaction.hash.toHexString();
  let transaction = Transaction.load(transactionId);

  if (!transaction) {
    transaction = new Transaction(transactionId);
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.type = type;

    if (event.receipt) {
      transaction.gasUsed = event.receipt.gasUsed;
      transaction.gasPrice = event.transaction.gasPrice;
    } else {
      transaction.gasUsed = ZERO_BI;
      transaction.gasPrice = ZERO_BI;
    }

    if (type == TransactionType.DEX) {
      transaction.mints = [];
      transaction.burns = [];
      transaction.swaps = [];
    }

    if (type == TransactionType.ERC20) {
      transaction.erc20Mints = [];
      transaction.erc20Burns = [];
    }

    transaction.save();
  }

  return transaction;
}
