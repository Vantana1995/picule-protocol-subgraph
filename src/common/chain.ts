import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const FACTORY_ADDRESS = Address.fromString(
  "0x7a0ba2f48ecc7db655cd5890e1e53b01196c3616"
);
export const TOKEN_LAUNCH_MANAGER_ADDRESS = Address.fromString(
  "0x2223e98224a6c1f19dfba9e6f249606cdc21bd9d"
);
export const ICO_ADDRESS = Address.fromString(
  "0xf551cce75e94b08409cc4b6f69132abee27324c3"
);
export const MARKETPLACE_ADDRESS = Address.fromString(
  "0x6b705c2e5ab18eb9b888ba317420d9f1c5a46dc2"
);

export const USDC_ADDRESS = Address.fromString(
  "0xbe72e441bf55620febc26715db68d3494213d8cb"
);
export const MON_ADDRESS = Address.fromString(
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"
);
export const MON_USDC_EXTERNAL_POOL = Address.fromString(
  "0x92b8274aba7ab667bee7eb776ec1de32438d90bf"
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
    Address.fromString("0xe91df27c401084ec11998766d64717f998b47b33"),
    "MPC",
    "MrPicule Token",
    BigInt.fromI32(18)
  ),
];
