/* eslint-disable prefer-const */
import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ERC20 } from "../../generated/Factory/ERC20";
import { ERC721 } from "../../generated/templates/ERC721/ERC721";
import { Account, ERC721Contract } from "../../generated/schema";
import { TokenDefinition } from "./chain";
import { ONE_BI, ZERO_BD, ZERO_BI } from "./constants";
import { getStaticDefinition } from "./tokenDefinition";

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString("1");
  for (let i = ZERO_BI; i.lt(decimals); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString("10"));
  }
  return bd;
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString("1000000000000000000");
}

export function convertMONToDecimal(eth: BigInt): BigDecimal {
  return eth.toBigDecimal().div(exponentToBigDecimal(BigInt.fromI32(18)));
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = value.toString();
  const zero = ZERO_BD.toString();
  if (zero == formattedVal) {
    return true;
  }
  return false;
}

export function isNullMONValue(value: string): boolean {
  return (
    value ==
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  // static definitions overrides
  let staticDefinition = getStaticDefinition(tokenAddress);
  if (staticDefinition != null) {
    return (staticDefinition as TokenDefinition).symbol;
  }

  let contract = ERC20.bind(tokenAddress);

  // try types string and bytes32 for symbol
  let symbolValue = "unknown";
  let symbolResult = contract.try_symbol();

  symbolValue = symbolResult.value;

  return symbolValue;
}

export function fetchTokenName(tokenAddress: Address): string {
  // static definitions overrides
  let staticDefinition = getStaticDefinition(tokenAddress);
  if (staticDefinition != null) {
    return (staticDefinition as TokenDefinition).name;
  }

  let contract = ERC20.bind(tokenAddress);

  // try types string and bytes32 for name
  let nameValue = "unknown";
  let nameResult = contract.try_name();

  nameValue = nameResult.value;

  return nameValue;
}

export function fetchTokenTotalSupply(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let totalSupplyValue = BigInt.fromI32(0);
  let totalSupplyResult = contract.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    totalSupplyValue = totalSupplyResult.value;
  }
  return totalSupplyValue;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  // static definitions overrides
  let staticDefinition = getStaticDefinition(tokenAddress);
  if (staticDefinition != null) {
    return (staticDefinition as TokenDefinition).decimals;
  }

  let contract = ERC20.bind(tokenAddress);
  // try types uint8 for decimals
  let decimalValue = 0;
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value;
  }
  return BigInt.fromI32(decimalValue);
}

export function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHexString());
  if (!account) {
    account = new Account(address.toHexString());
    account.usdSwapped = ZERO_BD;
    account.save();
  }
  return account;
}

export function fetchNFTName(nftAddress: Address): string {
  let contract = ERC721.bind(nftAddress);
  let nameValue = "unknown";
  let nameResult = contract.try_name();

  nameValue = nameResult.value;

  return nameValue;
}

export function fetchNFTSymbol(nftAddress: Address): string {
  let contract = ERC721.bind(nftAddress);
  let symbolValue = "UKN";
  let symbolResult = contract.try_symbol();

  symbolValue = symbolResult.value;

  return symbolValue;
}

export function fetchNFTURI(nftAddress: Address, tokenId: BigInt): string {
  let contract = ERC721.bind(nftAddress);
  let uriValue = "uknown.jpg";
  let uriResult = contract.try_tokenURI(tokenId);

  uriValue = uriResult.value;

  return uriValue;
}
export function getNFTTotalSupply(nftAddress: Address): BigInt {
  let contractEntity = ERC721Contract.load(nftAddress.toHexString());

  if (!contractEntity) {
    return ZERO_BI;
  }
  return contractEntity.totalSupply;
}
