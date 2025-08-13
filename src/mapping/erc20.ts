import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/templates/ERC20/ERC20";
import { ERC20Token, ERC20Burn, ERC20Mint } from "../../generated/schema";
import { ONE_BI } from "../common/constants";
import { getOrCreateAccount, convertTokenToDecimal } from "../common/helpers";
import { getOrCreateTransaction, TRANSACTION_TYPE_ERC20 } from "../common/transaction";

export function handleTransfer(event: Transfer): void {
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_ERC20);

  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let amount = event.params.value;
  let contractAddress = event.address;

  let fromAccount = getOrCreateAccount(fromAddress);
  let toAccount = getOrCreateAccount(toAddress);

  let token = ERC20Token.load(contractAddress.toHexString());
  if (!token) {
    return;
  }

  let decimals = token.decimals;
  let amountDecimal = convertTokenToDecimal(amount, decimals);
  let transactionId = event.transaction.hash.toHexString();

  if (fromAddress.equals(Address.zero())) {
    let mintId = transactionId
      .concat("-")
      .concat(transaction.erc20Mints.length.toString());
    let mint = new ERC20Mint(mintId);
    mint.transaction = transaction.id;
    mint.token = token.id;
    mint.to = toAccount.id;
    mint.amount = amountDecimal;
    mint.timestamp = event.block.timestamp;
    mint.save();

    let erc20Mints = transaction.erc20Mints;
    erc20Mints.push(mint.id);
    transaction.erc20Mints = erc20Mints;
    transaction.save();

    token.totalSupply = token.totalSupply.plus(amountDecimal);
    token.totalTransfers = token.totalTransfers.plus(ONE_BI.toBigDecimal());
    token.save();
  } else if (toAddress.equals(Address.zero())) {
    let burnId = transactionId
      .concat("-")
      .concat(transaction.erc20Burns.length.toString());
    let burn = new ERC20Burn(burnId);
    burn.transaction = transaction.id;
    burn.token = token.id;
    burn.from = fromAccount.id;
    burn.amount = amountDecimal;
    burn.timestamp = event.block.timestamp;
    burn.save();

    let erc20Burns = transaction.erc20Burns;
    erc20Burns.push(burn.id);
    transaction.erc20Burns = erc20Burns;
    transaction.save();

    token.totalSupply = token.totalSupply.minus(amountDecimal);
    token.totalTransfers = token.totalTransfers.plus(ONE_BI.toBigDecimal());
    token.save();
  } else {
    token.totalTransfers = token.totalTransfers.plus(ONE_BI.toBigDecimal());
    token.save();
  }

  updateTokenHolders(token, fromAddress, toAddress);
}

function updateTokenHolders(
  token: ERC20Token,
  from: Address,
  to: Address
): void {
  if (!from.equals(Address.zero()) && !to.equals(Address.zero())) {
    return;
  }

  if (from.equals(Address.zero())) {
    token.totalHolders = token.totalHolders.plus(ONE_BI);
  }

  token.save();
}
