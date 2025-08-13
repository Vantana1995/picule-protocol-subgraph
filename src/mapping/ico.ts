import { RequestCreated, Contributed } from "../../generated/ICO/ICO";
import {
  ICORequest,
  Contribution,
  Account,
  Project,
  ICOContributor,
} from "../../generated/schema";
import { ZERO_BD, ZERO_BI, ONE_BI } from "../common/constants";
import { getOrCreateAccount } from "../common/helpers";
import {
  getOrCreateTransaction,
  TRANSACTION_TYPE_ICO,
} from "../common/transaction";

export function handleRequestCreate(event: RequestCreated): void {
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_ICO);

  let requestId = event.params.numOfRequest;
  let creator: Account;

  let project = Project.load(requestId.toString());
  if (project) {
    creator = Account.load(project.creator)!;
  } else {
    let creatorAddress = event.transaction.from;
    let loadedCreator = Account.load(creatorAddress.toHexString());
    if (loadedCreator) {
      creator = loadedCreator;
    } else {
      creator = new Account(creatorAddress.toHexString());
      creator.usdSwapped = ZERO_BD;
      creator.save();
    }
  }

  let icoRequest = new ICORequest(event.params.numOfRequest.toString());
  icoRequest.numOfRequest = event.params.numOfRequest;
  icoRequest.creator = creator.id;
  icoRequest.createdAt = event.block.timestamp;
  icoRequest.transaction = transaction.id;
  icoRequest.totalContributions = ZERO_BD;
  icoRequest.totalContributors = ZERO_BI;
  icoRequest.active = true;
  icoRequest.save();
}

export function handleContribute(event: Contributed): void {
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_ICO);

  let icoRequest = ICORequest.load(event.params.numOfProject.toString());
  if (!icoRequest) {
    return;
  }

  let contributor = getOrCreateAccount(event.params.contributor);

  let contributionId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let contribution = new Contribution(contributionId);
  contribution.icoRequest = icoRequest.id;
  contribution.numOfProject = event.params.numOfProject;
  contribution.contributor = contributor.id;
  contribution.amount = event.params.amount.toBigDecimal();
  contribution.timestamp = event.block.timestamp;
  contribution.transaction = transaction.id;
  contribution.save();

  icoRequest.totalContributions = icoRequest.totalContributions.plus(
    contribution.amount
  );

  let contributorKey = icoRequest.id.concat("-").concat(contributor.id);
  let icoContributor = ICOContributor.load(contributorKey);

  if (!icoContributor) {
    icoContributor = new ICOContributor(contributorKey);
    icoContributor.icoRequest = icoRequest.id;
    icoContributor.contributor = contributor.id;
    icoContributor.firstContributionAt = event.block.timestamp;
    icoContributor.save();

    icoRequest.totalContributors = icoRequest.totalContributors.plus(ONE_BI);
  }

  icoRequest.save();

  let project = Project.load(icoRequest.id);
  if (project) {
    project.icoRequest = icoRequest.id;
    project.save();
  }
}
