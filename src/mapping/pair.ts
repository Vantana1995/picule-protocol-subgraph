import { BigDecimal, BigInt, store, Address } from "@graphprotocol/graph-ts";
import {
  Bundle,
  Pair,
  Token,
  PiculeFactory,
  Burn as BurnEvent,
  Mint as MintEvent,
  LiquidityPosition,
  LiquidityPositionSnapshot,
} from "../../generated/schema";
import {
  Swap,
  Sync,
  Mint,
  Burn,
  Transfer,
} from "../../generated/templates/Pair/Pair";
import { FACTORY_ADDRESS } from "../common/chain";
import {
  ALMOST_ZERO_BD,
  ONE_BI,
  ZERO_BD,
  ADDRESS_ZERO,
  BI_18,
} from "../common/constants";
import { convertTokenToDecimal, getOrCreateAccount } from "../common/helpers";
import {
  updatePairDayData,
  updatePairHourData,
  updatePiculeDayData,
  updateTokenDayData,
  updateTokenHourData,
} from "../common/hourDayUpdates";

import {
  findMonPerToken,
  getMonPriceInUSD,
  getTrackedLiquidityUSD,
  getTrackedVolumeUSD,
} from "../common/pricing";
import { updateTokenMinuteData } from "../common/minuteUpdates";
import { getOrCreateTransaction, TRANSACTION_TYPE_DEX} from "../common/transaction";

function isCompleteMint(mintId: string): boolean {
  return MintEvent.load(mintId)!.sender !== null;
}
export function handleTransfer(event: Transfer): void {
  // ignore initial transfers for first adds
  if (
    event.params.to.toHexString() == ADDRESS_ZERO &&
    event.params.value.equals(BigInt.fromI32(1000))
  ) {
    return;
  }

  let factory = PiculeFactory.load(FACTORY_ADDRESS.toHexString())!;
  let transactionHash = event.transaction.hash.toHexString();

  // user stats
  let from = event.params.from;
  getOrCreateAccount(from);
  let to = event.params.to;
  getOrCreateAccount(to);

  // get pair and load contract
  let pair = Pair.load(event.address.toHexString())!;

  // liquidity token amount being transfered
  let value = convertTokenToDecimal(event.params.value, BI_18);

  if (from.toHexString() != ADDRESS_ZERO && to.toHexString() != ADDRESS_ZERO) {
    updateLiquidityPosition(from, pair, value.neg(), event);

    updateLiquidityPosition(to, pair, value, event);
  }

  // get or create transaction
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_DEX);

  // mints
  let mints = transaction.mints;
  // part of the erc-20 standard (which is also the pool), whenever you mint new tokens, the from address is 0x0..0
  // the pool is also the erc-20 that gets minted and transferred around
  if (from.toHexString() == ADDRESS_ZERO) {
    // update total supply
    pair.totalSupply = pair.totalSupply.plus(value);
    pair.save();

    // create new mint if no mints so far or if last one is done already
    // transfers and mints come in pairs, but there could be a case where that doesn't happen and it might break
    // this is to make sure all the mints are under the same transaction
    if (mints.length === 0 || isCompleteMint(mints[mints.length - 1])) {
      let mint = new MintEvent(
        event.transaction.hash
          .toHexString()
          .concat("-")
          .concat(BigInt.fromI32(mints.length).toString())
      );
      mint.transaction = transaction.id;
      mint.pair = pair.id;
      mint.to = to;
      mint.liquidity = value;
      mint.timestamp = transaction.timestamp;
      mint.transaction = transaction.id;
      mint.save();

      // update mints in transaction
      transaction.mints = mints.concat([mint.id]);
      updateLiquidityPosition(to, pair, value, event);

      // save entities
      transaction.save();
      factory.save();
    }
  }

  // case where direct send first on MON withdrawals
  // for every burn event, there is a transfer first from the LP to the pool (erc-20)
  // when you LP, you get an ERC-20 token which is the accounting token of the LP position
  // the thing that's actually getting transfered is the LP account token
  if (event.params.to.toHexString() == pair.id) {
    let burns = transaction.burns;
    let burn = new BurnEvent(
      event.transaction.hash
        .toHexString()
        .concat("-")
        .concat(BigInt.fromI32(burns.length).toString())
    );
    burn.transaction = transaction.id;
    burn.pair = pair.id;
    burn.liquidity = value;
    burn.timestamp = transaction.timestamp;
    burn.to = event.params.to;
    burn.sender = event.params.from;
    burn.needsComplete = true;
    burn.transaction = transaction.id;
    burn.save();

    // TODO: Consider using .concat() for handling array updates to protect
    // against unintended side effects for other code paths.
    burns.push(burn.id);
    transaction.burns = burns;
    transaction.save();
  }

  // burn
  // there's two transfers for the LP token,
  // first its going to move from the LP back to the pool, and then it will go from the pool to the zero address
  if (
    event.params.to.toHexString() == ADDRESS_ZERO &&
    event.params.from.toHexString() == pair.id
  ) {
    pair.totalSupply = pair.totalSupply.minus(value);
    pair.save();

    // this is a new instance of a logical burn
    let burns = transaction.burns;
    let burn: BurnEvent;
    // this block creates the burn or gets the reference to it if it already exists
    if (burns.length > 0) {
      let currentBurn = BurnEvent.load(burns[burns.length - 1])!;
      if (currentBurn.needsComplete) {
        burn = currentBurn as BurnEvent;
        updateLiquidityPosition(from, pair, value.neg(), event);
      } else {
        burn = new BurnEvent(
          event.transaction.hash
            .toHexString()
            .concat("-")
            .concat(BigInt.fromI32(burns.length).toString())
        );
        burn.transaction = transaction.id;
        burn.needsComplete = false;
        burn.pair = pair.id;
        burn.liquidity = value;
        burn.transaction = transaction.id;
        burn.timestamp = transaction.timestamp;
      }
    } else {
      burn = new BurnEvent(
        event.transaction.hash
          .toHexString()
          .concat("-")
          .concat(BigInt.fromI32(burns.length).toString())
      );
      burn.transaction = transaction.id;
      burn.needsComplete = false;
      burn.pair = pair.id;
      burn.liquidity = value;
      burn.transaction = transaction.id;
      burn.timestamp = transaction.timestamp;
    }

    // if this logical burn included a fee mint, account for this
    // what is a fee mint?
    // how are fees collected on v2?
    // when you're an LP in v2, you're earning fees in terms of LP tokens, so when you go to burn your position, burn and collect fees at the same time
    // protocol is sending the LP something and we think it's a mint when it's not and it's really fees
    if (mints.length !== 0 && !isCompleteMint(mints[mints.length - 1])) {
      let mint = MintEvent.load(mints[mints.length - 1])!;
      burn.feeTo = mint.to;
      burn.feeLiquidity = mint.liquidity;
      // remove the logical mint
      store.remove("Mint", mints[mints.length - 1]);
      // update the transaction

      // TODO: Consider using .slice().pop() to protect against unintended
      // side effects for other code paths.
      mints.pop();
      transaction.mints = mints;
      transaction.save();
    }
    // when you collect fees or burn liquidity what are the events that get triggered
    // not sure why this replaced the last one instead of updating
    burn.save();
    // if accessing last one, replace it
    if (burn.needsComplete) {
      // TODO: Consider using .slice(0, -1).concat() to protect against
      // unintended side effects for other code paths.
      burns[burns.length - 1] = burn.id;
    }
    // else add new one
    else {
      // TODO: Consider using .concat() for handling array updates to protect
      // against unintended side effects for other code paths.
      burns.push(burn.id);
    }

    transaction.burns = burns;
    transaction.save();
  }

  transaction.save();
}
export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHexString());
  if (!pair) {
    return;
  }
  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);
  if (!token0 || !token1) {
    return;
  }
  let picule = PiculeFactory.load(FACTORY_ADDRESS.toHexString());
  if (!picule) {
    return;
  }

  // reset factory liquidity by subtracting only tracked liquidity
  picule.totalLiquidityMON = picule.totalLiquidityMON.minus(
    pair.trackedReserveMON as BigDecimal
  );

  // reset token total liquidity amounts
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

  if (pair.reserve1.notEqual(ZERO_BD))
    pair.token0Price = pair.reserve0.div(pair.reserve1);
  else pair.token0Price = ZERO_BD;
  if (pair.reserve0.notEqual(ZERO_BD))
    pair.token1Price = pair.reserve1.div(pair.reserve0);
  else pair.token1Price = ZERO_BD;

  pair.save();

  // update MON price now that reserves could have changed
  let bundle = Bundle.load("1");
  if (!bundle) {
    bundle = new Bundle("1");
  }
  bundle.monPrice = getMonPriceInUSD();
  bundle.save();

  token0.derivedMON = findMonPerToken(token0 as Token);
  token1.derivedMON = findMonPerToken(token1 as Token);
  token0.save();
  token1.save();

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityMON: BigDecimal;
  if (bundle.monPrice.notEqual(ZERO_BD)) {
    trackedLiquidityMON = getTrackedLiquidityUSD(
      pair.reserve0,
      token0 as Token,
      pair.reserve1,
      token1 as Token
    ).div(bundle.monPrice);
  } else {
    trackedLiquidityMON = ZERO_BD;
  }

  // use derived amounts within pair
  pair.trackedReserveMON = trackedLiquidityMON;
  pair.reserveMON = pair.reserve0
    .times(token0.derivedMON as BigDecimal)
    .plus(pair.reserve1.times(token1.derivedMON as BigDecimal));
  pair.reserveUSD = pair.reserveMON.times(bundle.monPrice);

  // use tracked amounts globally
  picule.totalLiquidityMON = picule.totalLiquidityMON.plus(trackedLiquidityMON);
  picule.totalLiquidityUSD = picule.totalLiquidityMON.times(bundle.monPrice);

  // now correctly set liquidity amounts for each token
  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1);
  let token0HourData = updateTokenHourData(token0 as Token, event);
  let token1HourData = updateTokenHourData(token1 as Token, event);
  let token0MinuteData = updateTokenMinuteData(token0 as Token, event);
  let token1MinuteData = updateTokenMinuteData(token1 as Token, event);

  token0HourData.volume = token0.tradeVolume;
  token0HourData.volumeUSD = token0.tradeVolumeUSD;
  token0HourData.untrackedVolumeUSD = token0.untrackedVolumeUSD;

  token0MinuteData.volume = token0.tradeVolume;
  token0MinuteData.volumeUSD = token0.tradeVolumeUSD;
  token0MinuteData.untrackedVolumeUSD = token0.untrackedVolumeUSD;

  token1HourData.volume = token1.tradeVolume;
  token1HourData.volumeUSD = token1.tradeVolumeUSD;
  token1HourData.untrackedVolumeUSD = token1.untrackedVolumeUSD;

  token1MinuteData.volume = token1.tradeVolume;
  token1MinuteData.volumeUSD = token1.tradeVolumeUSD;
  token1MinuteData.untrackedVolumeUSD = token1.untrackedVolumeUSD;

  token0HourData.save();
  token1HourData.save();
  token0MinuteData.save();
  token1MinuteData.save();
  // save entities
  pair.save();
  picule.save();
  token0.save();
  token1.save();
}
export function handleSwap(event: Swap): void {
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_DEX);
  let pair = Pair.load(event.address.toHexString());
  if (!pair) {
    return;
  }
  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);
  if (!token0 || !token1) {
    return;
  }
  let amount0In = convertTokenToDecimal(
    event.params.amount0In,
    token0.decimals
  );
  let amount1In = convertTokenToDecimal(
    event.params.amount1In,
    token1.decimals
  );
  let amount0Out = convertTokenToDecimal(
    event.params.amount0Out,
    token0.decimals
  );
  let amount1Out = convertTokenToDecimal(
    event.params.amount1Out,
    token1.decimals
  );

  // totals for volume updates
  let amount0Total = amount0Out.plus(amount0In);
  let amount1Total = amount1Out.plus(amount1In);

  // MON/USD prices
  let bundle = Bundle.load("1");
  if (!bundle) {
    return;
  }

  bundle.monPrice = getMonPriceInUSD();
  bundle.save();

  // get total amounts of derived USD and MON for tracking
  let derivedAmountMON = token1.derivedMON
    .times(amount1Total)
    .plus(token0.derivedMON.times(amount0Total));

  // Only divide by 2 if both derivedMON values are non-zero
  if (
    !token1.derivedMON.times(amount1Total).le(ALMOST_ZERO_BD) &&
    !token0.derivedMON.times(amount0Total).le(ALMOST_ZERO_BD)
  ) {
    derivedAmountMON = derivedAmountMON.div(BigDecimal.fromString("2"));
  }

  let derivedAmountUSD = derivedAmountMON.times(bundle.monPrice);

  // only accounts for volume through white listed tokens
  let trackedAmountUSD = getTrackedVolumeUSD(
    amount0Total,
    token0 as Token,
    amount1Total,
    token1 as Token,
    pair as Pair
  );

  let trackedAmountMON: BigDecimal;
  if (bundle.monPrice.equals(ZERO_BD)) {
    trackedAmountMON = ZERO_BD;
  } else {
    trackedAmountMON = trackedAmountUSD.div(bundle.monPrice);
  }

  // update token0 global volume and token liquidity stats
  token0.tradeVolume = token0.tradeVolume.plus(amount0In.plus(amount0Out));
  token0.tradeVolumeUSD = token0.tradeVolumeUSD.plus(trackedAmountUSD);
  token0.untrackedVolumeUSD = token0.untrackedVolumeUSD.plus(derivedAmountUSD);

  // update token1 global volume and token liquidity stats
  token1.tradeVolume = token1.tradeVolume.plus(amount1In.plus(amount1Out));
  token1.tradeVolumeUSD = token1.tradeVolumeUSD.plus(trackedAmountUSD);
  token1.untrackedVolumeUSD = token1.untrackedVolumeUSD.plus(derivedAmountUSD);

  // update txn counts
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // update pair volume data, use tracked amount if we have it as its probably more accurate
  pair.volumeUSD = pair.volumeUSD.plus(trackedAmountUSD);
  pair.volumeToken0 = pair.volumeToken0.plus(amount0Total);
  pair.volumeToken1 = pair.volumeToken1.plus(amount1Total);
  pair.untrackedVolumeUSD = pair.untrackedVolumeUSD.plus(derivedAmountUSD);
  pair.txCount = pair.txCount.plus(ONE_BI);
  pair.save();

  // update global values, only used tracked amounts for volume
  let picule = PiculeFactory.load(FACTORY_ADDRESS.toHexString());
  if (!picule) {
    return;
  }
  picule.totalVolumeUSD = picule.totalVolumeUSD.plus(trackedAmountUSD);
  picule.totalVolumeMON = picule.totalVolumeMON.plus(trackedAmountMON);
  picule.untrackedVolumeUSD = picule.untrackedVolumeUSD.plus(derivedAmountUSD);
  picule.txCount = picule.txCount.plus(ONE_BI);

  // save entities
  pair.save();
  token0.save();
  token1.save();
  picule.save();

  // update day entities
  let pairDayData = updatePairDayData(pair, event);
  let pairHourData = updatePairHourData(pair, event);
  let piculeDayData = updatePiculeDayData(event);
  let token0DayData = updateTokenDayData(token0 as Token, event);
  let token1DayData = updateTokenDayData(token1 as Token, event);

  // swap specific updating
  piculeDayData.dailyVolumeUSD =
    piculeDayData.dailyVolumeUSD.plus(trackedAmountUSD);
  piculeDayData.dailyVolumeMON =
    piculeDayData.dailyVolumeMON.plus(trackedAmountMON);
  piculeDayData.dailyVolumeUntracked =
    piculeDayData.dailyVolumeUntracked.plus(derivedAmountUSD);
  piculeDayData.save();

  // swap specific updating for pair
  pairDayData.dailyVolumeToken0 =
    pairDayData.dailyVolumeToken0.plus(amount0Total);
  pairDayData.dailyVolumeToken1 =
    pairDayData.dailyVolumeToken1.plus(amount1Total);
  pairDayData.dailyVolumeUSD =
    pairDayData.dailyVolumeUSD.plus(trackedAmountUSD);
  pairDayData.save();

  // update hourly pair data
  pairHourData.hourlyVolumeToken0 =
    pairHourData.hourlyVolumeToken0.plus(amount0Total);
  pairHourData.hourlyVolumeToken1 =
    pairHourData.hourlyVolumeToken1.plus(amount1Total);
  pairHourData.hourlyVolumeUSD =
    pairHourData.hourlyVolumeUSD.plus(trackedAmountUSD);
  pairHourData.save();

  // swap specific updating for token0
  token0DayData.dailyVolumeToken =
    token0DayData.dailyVolumeToken.plus(amount0Total);
  token0DayData.dailyVolumeMON = token0DayData.dailyVolumeMON.plus(
    amount0Total.times(token0.derivedMON as BigDecimal)
  );
  token0DayData.dailyVolumeUSD = token0DayData.dailyVolumeUSD.plus(
    amount0Total.times(token0.derivedMON as BigDecimal).times(bundle.monPrice)
  );
  token0DayData.save();

  // swap specific updating
  token1DayData.dailyVolumeToken =
    token1DayData.dailyVolumeToken.plus(amount1Total);
  token1DayData.dailyVolumeMON = token1DayData.dailyVolumeMON.plus(
    amount1Total.times(token1.derivedMON as BigDecimal)
  );
  token1DayData.dailyVolumeUSD = token1DayData.dailyVolumeUSD.plus(
    amount1Total.times(token1.derivedMON as BigDecimal).times(bundle.monPrice)
  );
  token1DayData.save();

  let token0HourData = updateTokenHourData(token0 as Token, event);
  let token1HourData = updateTokenHourData(token1 as Token, event);
  let token0MinuteData = updateTokenMinuteData(token0 as Token, event);
  let token1MinuteData = updateTokenMinuteData(token1 as Token, event);

  token0HourData.volume = token0.tradeVolume;
  token0HourData.volumeUSD = token0.tradeVolumeUSD;
  token0HourData.untrackedVolumeUSD = token0.untrackedVolumeUSD;

  token0MinuteData.volume = token0.tradeVolume;
  token0MinuteData.volumeUSD = token0.tradeVolumeUSD;
  token0MinuteData.untrackedVolumeUSD = token0.untrackedVolumeUSD;

  token1HourData.volume = token1.tradeVolume;
  token1HourData.volumeUSD = token1.tradeVolumeUSD;
  token1HourData.untrackedVolumeUSD = token1.untrackedVolumeUSD;

  token1MinuteData.volume = token1.tradeVolume;
  token1MinuteData.volumeUSD = token1.tradeVolumeUSD;
  token1MinuteData.untrackedVolumeUSD = token1.untrackedVolumeUSD;

  token0HourData.save();
  token1HourData.save();
  token0MinuteData.save();
  token1MinuteData.save();
}

export function handleMint(event: Mint): void {
  // loaded from a previous handler creating this transaction
  // transfer event is emitted first and mint event is emitted afterwards, good to confirm with a protocol eng
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_DEX);

  let mints = transaction.mints;
  let mint = MintEvent.load(mints[mints.length - 1]);

  if (mint === null) {
    return;
  }

  let pair = Pair.load(event.address.toHex())!;
  let picule = PiculeFactory.load(FACTORY_ADDRESS.toHexString())!;

  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);
  if (token0 === null || token1 === null) {
    return;
  }

  // update exchange info (except balances, sync will cover that)
  let token0Amount = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  let token1Amount = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );

  // update txn counts
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // get new amounts of USD and MON for tracking
  let bundle = Bundle.load("1")!;
  bundle.monPrice = getMonPriceInUSD();
  bundle.save();
  let amountTotalUSD = token1.derivedMON
    .times(token1Amount)
    .plus(token0.derivedMON.times(token0Amount))
    .times(bundle.monPrice);

  // update txn counts
  pair.txCount = pair.txCount.plus(ONE_BI);
  picule.txCount = picule.txCount.plus(ONE_BI);

  // save entities
  token0.save();
  token1.save();
  pair.save();
  picule.save();

  mint.sender = event.params.sender;
  mint.amount0 = token0Amount as BigDecimal;
  mint.amount1 = token1Amount as BigDecimal;
  mint.logIndex = event.logIndex;
  mint.amountUSD = amountTotalUSD as BigDecimal;
  mint.save();

  // update day entities
  updatePairDayData(pair, event);
  updatePairHourData(pair, event);
  updatePiculeDayData(event);
  updateTokenDayData(token0 as Token, event);
  updateTokenDayData(token1 as Token, event);
}

export function handleBurn(event: Burn): void {
  let transaction = getOrCreateTransaction(event, TRANSACTION_TYPE_DEX);

  let burns = transaction.burns;
  let burn = BurnEvent.load(burns[burns.length - 1]);

  if (burn === null) {
    return;
  }

  let pair = Pair.load(event.address.toHex())!;
  let picule = PiculeFactory.load(FACTORY_ADDRESS.toHexString())!;

  //update token info
  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);
  if (token0 === null || token1 === null) {
    return;
  }

  let token0Amount = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  let token1Amount = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );

  // update txn counts
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // get new amounts of USD and MON for tracking
  let bundle = Bundle.load("1")!;
  bundle.monPrice = getMonPriceInUSD();
  bundle.save();
  let amountTotalUSD = token1.derivedMON
    .times(token1Amount)
    .plus(token0.derivedMON.times(token0Amount))
    .times(bundle.monPrice);

  // update txn counts
  picule.txCount = picule.txCount.plus(ONE_BI);
  pair.txCount = pair.txCount.plus(ONE_BI);

  // update global counter and save
  token0.save();
  token1.save();
  pair.save();
  picule.save();

  // update burn
  // burn.sender = event.params.sender
  burn.amount0 = token0Amount as BigDecimal;
  burn.amount1 = token1Amount as BigDecimal;
  // burn.to = event.params.to
  burn.logIndex = event.logIndex;
  burn.amountUSD = amountTotalUSD as BigDecimal;
  burn.save();

  // update day entities
  updatePairDayData(pair, event);
  updatePairHourData(pair, event);
  updatePiculeDayData(event);
  updateTokenDayData(token0 as Token, event);
  updateTokenDayData(token1 as Token, event);
}

function updateLiquidityPosition(
  account: Address,
  pair: Pair,
  liquidityDelta: BigDecimal,
  event: Transfer
): void {
  let positionId = account.toHexString().concat("-").concat(pair.id);
  let position = LiquidityPosition.load(positionId);

  if (!position) {
    position = new LiquidityPosition(positionId);
    position.account = account.toHexString();
    position.pair = pair.id;
    position.liquidityTokenBalance = ZERO_BD;
  }

  position.liquidityTokenBalance =
    position.liquidityTokenBalance.plus(liquidityDelta);

  if (position.liquidityTokenBalance.equals(ZERO_BD)) {
    store.remove("LiquidityPosition", positionId);
    return;
  }

  position.save();

  createLiquidityPositionSnapshot(position, event);
}

function createLiquidityPositionSnapshot(
  position: LiquidityPosition,
  event: Transfer
): void {
  let snapshotId = position.id
    .concat("-")
    .concat(event.block.timestamp.toString());

  let snapshot = new LiquidityPositionSnapshot(snapshotId);
  let pair = Pair.load(position.pair)!;
  let bundle = Bundle.load("1")!;
  bundle.monPrice = getMonPriceInUSD();
  bundle.save();

  snapshot.liquidityPosition = position.id;
  snapshot.timestamp = event.block.timestamp.toI32();
  snapshot.block = event.block.number.toI32();
  snapshot.account = position.account;
  snapshot.pair = position.pair;
  snapshot.liquidityTokenBalance = position.liquidityTokenBalance;
  snapshot.liquidityTokenTotalSupply = pair.totalSupply;
  snapshot.reserve0 = pair.reserve0;
  snapshot.reserve1 = pair.reserve1;
  snapshot.reserveUSD = pair.reserveUSD;

  let token0 = Token.load(pair.token0)!;
  let token1 = Token.load(pair.token1)!;
  snapshot.token0PriceUSD = token0.derivedMON.times(bundle.monPrice);
  snapshot.token1PriceUSD = token1.derivedMON.times(bundle.monPrice);

  snapshot.save();
}
