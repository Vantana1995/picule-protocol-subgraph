import { BigInt } from "@graphprotocol/graph-ts";
import { ProjectCreated } from "../../generated/TokenLaunchManager/TokenLaunchManager";
import {
  Project,
  ERC20Token,
  ERC721Contract,
  FundsManager,
  Transaction,
} from "../../generated/schema";
import {
  ERC20 as ERC20Template,
  ERC721 as ERC721Template,
  FundsManager as FundsManagerTemplate,
} from "../../generated/templates";
import { ZERO_BD, ZERO_BI } from "../common/constants";
import {
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenDecimals,
  fetchTokenTotalSupply,
  fetchNFTName,
  fetchNFTSymbol,
  getOrCreateAccount,
} from "../common/helpers";

import {
  getOrCreateTransaction,
  TRANSACTION_TYPE_TLM,
} from "../common/transaction";

export function handleProjectCreate(event: ProjectCreated): void {
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_TLM);

  let creator = getOrCreateAccount(event.params.creator);

  let token = new ERC20Token(event.params.token.toHexString());
  token.name = fetchTokenName(event.params.token);
  token.symbol = fetchTokenSymbol(event.params.token);
  token.decimals = fetchTokenDecimals(event.params.token) || BigInt.fromI32(18);
  token.totalSupply = fetchTokenTotalSupply(event.params.token).toBigDecimal();
  token.derivedUSD = ZERO_BD;
  token.derivedMON = ZERO_BD;
  token.totalTransfers = ZERO_BD;
  token.totalHolders = ZERO_BI;
  token.save();

  let nft = new ERC721Contract(event.params.nft.toHexString());
  nft.name = fetchNFTName(event.params.nft);
  nft.symbol = fetchNFTSymbol(event.params.nft);
  nft.totalSupply = ZERO_BI;
  nft.save();

  let fundsManager = new FundsManager(event.params.fundsManager.toHexString());
  fundsManager.totalLockedValue = ZERO_BD;
  fundsManager.totalLockedValueUSD = ZERO_BD;
  fundsManager.totalBonusClaimed = ZERO_BD;
  fundsManager.totalBonusClaimedUSD = ZERO_BD;
  fundsManager.save();

  let project = new Project(event.params.icoId.toString());
  project.icoId = event.params.icoId;
  project.creator = creator.id;
  project.token = token.id;
  project.nft = nft.id;
  project.fundsManager = fundsManager.id;
  project.createdAt = event.block.timestamp;
  project.transaction = transaction.id;

  project.save();

  ERC20Template.create(event.params.token);
  ERC721Template.create(event.params.nft);
  FundsManagerTemplate.create(event.params.fundsManager);
}
