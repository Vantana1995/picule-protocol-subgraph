import { ethereum } from "@graphprotocol/graph-ts";
import { Transaction } from "../../generated/schema";
import { ZERO_BI } from "./constants";

export const TRANSACTION_TYPE_DEX = "DEX";
export const TRANSACTION_TYPE_ERC20 = "ERC20";
export const TRANSACTION_TYPE_ERC721 = "ERC721";
export const TRANSACTION_TYPE_MARKETPLACE = "MARKETPLACE";
export const TRANSACTION_TYPE_ICO = "ICO";
export const TRANSACTION_TYPE_TLM = "TLM";
export const TRANSACTION_TYPE_FUNDS = "FUNDS";

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

    let receipt = event.receipt;
    if (receipt !== null) {
      transaction.gasUsed = receipt.gasUsed;
      transaction.gasPrice = event.transaction.gasPrice;
    } else {
      transaction.gasUsed = ZERO_BI;
      transaction.gasPrice = ZERO_BI;
    }

    if (type == TRANSACTION_TYPE_DEX) {
      transaction.mints = [];
      transaction.burns = [];
      transaction.swaps = [];
    }

    if (type == TRANSACTION_TYPE_ERC20) {
      transaction.erc20Mints = [];
      transaction.erc20Burns = [];
    }

    transaction.save();
  }

  return transaction;
}
