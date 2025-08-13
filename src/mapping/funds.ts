import {
  Checkpointupdate,
  LPTokenLocked,
  BonusClaimed,
} from "../../generated/templates/FundsManager/FundsManager";
import {
  Checkpoint,
  LPTokenLock,
  BonusClaim,
  FundsManager,
  ERC721Token,
  ERC721Contract,
} from "../../generated/schema";
import { ZERO_BD, ONE_BI } from "../common/constants";
import { getOrCreateAccount } from "../common/helpers";
import { getOrCreateTransaction, TransactionType } from "../common/transaction";

export function handleCheckpointUpdate(event: Checkpointupdate): void {
  let transaction = getOrCreateTransaction(event, TransactionType.FUNDS);

  let checkpointId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let checkpoint = new Checkpoint(checkpointId);
  checkpoint.fundsManager = event.address.toHexString();
  checkpoint.project = event.params.erc721; // NFT contract address
  checkpoint.value1 = event.params.newCheckpointNumber.toBigDecimal();
  checkpoint.value2 =
    event.params.checkPointAmountToReceivePacked.toBigDecimal();
  checkpoint.value3 = event.params.totalComission.toBigDecimal();
  checkpoint.timestamp = event.block.timestamp;
  checkpoint.transaction = transaction.id;
  checkpoint.save();
}

export function handleLpTokenLocked(event: LPTokenLocked): void {
  let transaction = getOrCreateTransaction(event, TransactionType.FUNDS);

  let lpProvider = getOrCreateAccount(event.params.lpProvider);

  let lockId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let lock = new LPTokenLock(lockId);
  lock.fundsManager = event.address.toHexString();
  lock.param1 = event.params.lpProvider; // LP provider address
  lock.param2 = event.params.lpToken; // LP token address
  lock.param3 = event.params.erc721; // NFT contract address

  let nftTokenId = event.params.erc721
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());

  let nftToken = ERC721Token.load(nftTokenId);
  if (!nftToken) {
    nftToken = new ERC721Token(nftTokenId);
    nftToken.contract = event.params.erc721.toHexString();
    nftToken.identifier = event.params.tokenId;
    nftToken.owner = lpProvider.id;
    nftToken.approval = lpProvider.id;
    nftToken.uri = "";
    nftToken.price = ZERO_BD;
    nftToken.save();

    let nftContract = ERC721Contract.load(event.params.erc721.toHexString());
    if (nftContract) {
      nftContract.totalSupply = nftContract.totalSupply.plus(ONE_BI);
      nftContract.save();
    }
  }

  lock.nftToken = nftTokenId;
  lock.amount2 = event.params.lpLocked.toBigDecimal();
  lock.timestamp = event.block.timestamp;
  lock.transaction = transaction.id;
  lock.save();

  let fundsManager = FundsManager.load(event.address.toHexString());
  if (fundsManager) {
    fundsManager.totalLockedValue = fundsManager.totalLockedValue.plus(
      lock.amount2
    );
    fundsManager.save();
  }
}

export function handleBonusClaimed(event: BonusClaimed): void {
  let transaction = getOrCreateTransaction(event, TransactionType.FUNDS);

  let claimer = getOrCreateAccount(event.params.user);

  let claimId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let claim = new BonusClaim(claimId);
  claim.fundsManager = event.address.toHexString();
  claim.claimId = event.params.tokenId;
  claim.claimer = claimer.id;
  claim.token = event.params.tokenClaimed; // Token address claimed
  claim.amount1 = event.params.amount.toBigDecimal();
  claim.amount2 = event.params.checkpointFrom.toBigDecimal();
  claim.amount3 = event.params.checkpointTo.toBigDecimal();
  claim.timestamp = event.block.timestamp;
  claim.transaction = transaction.id;
  claim.save();

  let fundsManager = FundsManager.load(event.address.toHexString());
  if (fundsManager) {
    fundsManager.totalBonusClaimed = fundsManager.totalBonusClaimed.plus(
      claim.amount1
    );
    fundsManager.save();
  }
}
