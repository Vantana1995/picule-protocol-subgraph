/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts/index";
import { Pair as PairContract } from "../../generated/templates/Pair/Pair"
import { Bundle, Pair, PairTokenLookup, Token } from "../../generated/schema";
import {
  MON_USDC_EXTERNAL_POOL,
  REFERENCE_TOKEN,
  USDC_ADDRESS,
  WHITELIST,
  MINIMUM_LIQUIDITY_THRESHOLD_MON,
  MINIMUM_USD_THRESHOLD_NEW_PAIRS,
  MON_ADDRESS,
} from "./chain";
import { ONE_BD, ZERO_BD } from "./constants";

export function getMonPriceInUSD(): BigDecimal {
  let poolContract = PairContract.bind(MON_USDC_EXTERNAL_POOL);

  let reservesResult = poolContract.try_getReserves();
  if (reservesResult.reverted) {
    return ZERO_BD;
  }

  let token0Result = poolContract.try_token0();
  if (token0Result.reverted) {
    return ZERO_BD;
  }

  let reserve0 = reservesResult.value.value0.toBigDecimal();
  let reserve1 = reservesResult.value.value1.toBigDecimal();

  if (token0Result.value.equals(MON_ADDRESS)) {
    // MON = token0, USDC = token1
    return safeDiv(reserve1, reserve0); // USDC/MON
  } else {
    // USDC = token0, MON = token1
    return safeDiv(reserve0, reserve1); // USDC/MON
  }
}

// return 0 if denominator is 0 in division
export function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
  if (amount1.equals(ZERO_BD)) {
    return ZERO_BD;
  } else {
    return amount0.div(amount1);
  }
}

/**
 * Search through graph to find derived MON per token.
 * @todo update to be derived MON (add stablecoin estimates)
 **/
export function findMonPerToken(token: Token): BigDecimal {
  if (token.id == REFERENCE_TOKEN.toHexString()) {
    return ONE_BD;
  }

  if (token.id == USDC_ADDRESS.toHexString()) {
    let bundle = Bundle.load("1")!;
    return safeDiv(ONE_BD, bundle.monPrice);
  }

  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairLookup = PairTokenLookup.load(
      token.id.concat("-").concat(WHITELIST[i])
    );
    if (pairLookup) {
      let pair = Pair.load(pairLookup.pair);
      if (pair && pair.reserveMON.gt(MINIMUM_LIQUIDITY_THRESHOLD_MON)) {
        if (pair.token0 == token.id) {
          let token1 = Token.load(pair.token1);
          if (token1) {
            return pair.token1Price.times(token1.derivedMON);
          }
        }
        if (pair.token1 == token.id) {
          let token0 = Token.load(pair.token0);
          if (token0) {
            return pair.token0Price.times(token0.derivedMON);
          }
        }
      }
    }
  }
  return ZERO_BD;
}
/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load("1")!;
  let price0 = token0.derivedMON.times(bundle.monPrice);
  let price1 = token1.derivedMON.times(bundle.monPrice);

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0);
    let reserve1USD = pair.reserve1.times(price1);
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD;
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (
        reserve0USD
          .times(BigDecimal.fromString("2"))
          .lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (
        reserve1USD
          .times(BigDecimal.fromString("2"))
          .lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load("1")!;
  let price0 = token0.derivedMON.times(bundle.monPrice);
  let price1 = token1.derivedMON.times(bundle.monPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

export function getTokenTrackedLiquidityUSD(
  tokenForPricing: Token,
  tokenForPricingAmount: BigDecimal,
  companionTokenAmount: BigDecimal,
  companionToken: Token
): BigDecimal {
  let bundle = Bundle.load("1")!;
  let price0 = tokenForPricing.derivedMON.times(bundle.monPrice);
  let price1 = companionToken.derivedMON.times(bundle.monPrice);

  // both are whitelist tokens, take average of both amounts
  if (
    WHITELIST.includes(tokenForPricing.id) &&
    WHITELIST.includes(companionToken.id)
  ) {
    return tokenForPricingAmount.times(price0);
  }

  // take double value of the whitelisted token amount
  if (
    WHITELIST.includes(tokenForPricing.id) &&
    !WHITELIST.includes(companionToken.id)
  ) {
    return tokenForPricingAmount.times(price0);
  }

  // take double value of the whitelisted token amount
  if (
    !WHITELIST.includes(tokenForPricing.id) &&
    WHITELIST.includes(companionToken.id)
  ) {
    return companionTokenAmount.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
