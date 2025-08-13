import { Address, store } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/templates/ERC721/ERC721";
import {
  ERC721Token,
  ERC721Contract,
  ERC721Transfer,
} from "../../generated/schema";
import { ZERO_BI, ONE_BI } from "../common/constants";
import {
  getOrCreateAccount,
  fetchNFTName,
  fetchNFTSymbol,
  fetchNFTURI,
} from "../common/helpers";
import { getOrCreateTransaction, TransactionType } from "../common/transaction";
export function handleTransfer(event: Transfer): void {
  let transaction = getOrCreateTransaction(event, TransactionType.ERC721);

  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let tokenId = event.params.tokenId;
  let contractAddress = event.address;

  let fromAccount = getOrCreateAccount(fromAddress);
  let toAccount = getOrCreateAccount(toAddress);

  let contract = ERC721Contract.load(contractAddress.toHexString());
  if (!contract) {
    contract = new ERC721Contract(contractAddress.toHexString());
    contract.name = fetchNFTName(contractAddress);
    contract.symbol = fetchNFTSymbol(contractAddress);
    contract.totalSupply = ZERO_BI;
    contract.save();
  }

  let nftTokenId = contractAddress
    .toHexString()
    .concat("-")
    .concat(tokenId.toString());

  if (fromAddress.equals(Address.zero())) {
    let nftToken = ERC721Token.load(nftTokenId);
    if (nftToken) {
      nftToken.uri = fetchNFTURI(contractAddress, tokenId);
      nftToken.save();
    }
  } else if (toAddress.equals(Address.zero())) {
    store.remove("ERC721Token", nftTokenId);

    contract.totalSupply = contract.totalSupply.minus(ONE_BI);
    contract.save();
  } else {
    let nftToken = ERC721Token.load(nftTokenId);
    if (nftToken) {
      nftToken.owner = toAccount.id;
      nftToken.save();
    }
  }

  let transferId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let transfer = new ERC721Transfer(transferId);
  transfer.token = nftTokenId;
  transfer.from = fromAccount.id;
  transfer.to = toAccount.id;
  transfer.timestamp = event.block.timestamp;
  transfer.transaction = transaction.id;
  transfer.save();
}
