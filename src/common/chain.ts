import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const FACTORY_ADDRESS = Address.fromString(
  "0x4c4a92931a3f0a4fb369c61fd990efce28b044e7"
);
export const TOKEN_LAUNCH_MANAGER_ADDRESS = Address.fromString(
  "0x8375e6f077c5a4b6ff05620928588e04717e8a4e"
);
export const ICO_ADDRESS = Address.fromString(
  "0x541fb0d5ba646f7ef0eb1fece90032c389592b1e"
);
export const MARKETPLACE_ADDRESS = Address.fromString(
  "0xe8c3490eed91ba902731ea2bbb69426282604012"
);

export const USDC_ADDRESS = Address.fromString(
  "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
);
export const MON_ADDRESS = Address.fromString(
  "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"
);
export const MON_USDC_EXTERNAL_POOL = Address.fromString(
  "0xEc8eb233538aBFc97f337da8ec3d1b57fbe31895"
);

export const REFERENCE_TOKEN = MON_ADDRESS;

export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);

export const WHITELIST: string[] = [
  USDC_ADDRESS.toHexString(),
  MON_ADDRESS.toHexString(),
];

export const MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString("100");
export const MINIMUM_LIQUIDITY_THRESHOLD_MON = BigDecimal.fromString("10");

export class TokenDefinition {
  address: Address;
  symbol: string;
  name: string;
  decimals: BigInt;

  constructor(
    address: Address,
    symbol: string,
    name: string,
    decimals: BigInt
  ) {
    this.address = address;
    this.symbol = symbol;
    this.name = name;
    this.decimals = decimals;
  }
}
export const STATIC_TOKEN_DEFINITIONS: TokenDefinition[] = [
  new TokenDefinition(
    Address.fromString("0xc70c0da850c8d042a1be575d12f45e4392d9a889"),
    "MPC",
    "MrPicule Token",
    BigInt.fromI32(18)
  ),
];
