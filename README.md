# Picule Protocol Subgraph

A comprehensive subgraph for indexing the Picule decentralized protocol on Monad blockchain. This subgraph tracks DEX operations, NFT marketplace, ICO activities, token launches, and liquidity management.

## Protocol Overview

Picule is a decentralized protocol for automated ERC20 token exchange that makes NFTs valuable on Monad blockchain. The protocol includes:

- **DEX Factory & Pairs** - Automated market maker for token swaps
- **Token Launch Manager** - Create and launch new ERC20 tokens with NFT collections
- **ICO System** - Crowdfunding mechanism for new projects
- **NFT Marketplace** - Trade NFTs with integrated pricing
- **Funds Manager** - LP token locking and bonus distribution system

## Tracked Contracts

| Contract           | Address                                      | Description           |
| ------------------ | -------------------------------------------- | --------------------- |
| Factory            | `0x88f935cc12efc73f1590bfc12178539351b145c5` | DEX pair factory      |
| TokenLaunchManager | `0xbb29be458dcaa439f1259bc9b42a7240b1d37af5` | Token creation system |
| ICO                | `0x7927a4bd40ab5a60c4a319ea55424469560e947b` | ICO management        |
| Marketplace        | `0xe8c3490eed91ba902731ea2bbb69426282604012` | NFT marketplace       |
| NFTPicule          | `0x1a91f666527b04fb8dfe8ae05fd2e628e9370bad` | Main NFT collection   |
| MPC Token          | `0xe91df27c401084ec11998766d64717f998b47b33` | Protocol token        |

## Core Entities

### DEX Entities

#### PiculeFactory

Global factory statistics

- `totalVolumeUSD` - Total trading volume in USD
- `totalLiquidityUSD` - Total value locked
- `pairCount` - Number of trading pairs
- `txCount` - Total transactions

#### Pair

Trading pair information

- `token0` / `token1` - Paired tokens
- `reserve0` / `reserve1` - Token reserves
- `volumeUSD` - Pair trading volume
- `liquidityProviderCount` - Number of LPs
- `token0Price` / `token1Price` - Current exchange rates

#### Token

ERC20 token data with price tracking

- `symbol` / `name` / `decimals` - Token metadata
- `derivedMON` - Price in MON (reference token)
- `tradeVolumeUSD` - Trading volume
- `totalLiquidity` - Token liquidity across pairs

#### Bundle

Price oracle data

- `monPrice` - Current MON/USD price from external BubbleFi pool

### Trading Entities

#### Swap

Individual swap transactions

- `amountUSD` - Swap value in USD
- `amount0In` / `amount1In` - Input amounts
- `amount0Out` / `amount1Out` - Output amounts
- `sender` / `to` - Transaction participants

#### Mint / Burn

Liquidity provision events

- `amount0` / `amount1` - Token amounts
- `amountUSD` - USD value
- `liquidity` - LP tokens minted/burned

#### LiquidityPosition

User liquidity positions

- `liquidityTokenBalance` - LP token holdings
- `account` - Position owner
- `pair` - Associated trading pair

### NFT Entities

#### ERC721Token

Individual NFT tracking

- `identifier` - Token ID
- `owner` - Current owner
- `uri` - Metadata URI
- `price` - Current marketplace price

#### ERC721Contract

NFT collection data

- `name` / `symbol` - Collection metadata
- `totalSupply` - Total minted tokens

### Marketplace Entities

#### Listing

Active NFT listings

- `price` - Listing price
- `active` - Listing status
- `seller` - NFT owner
- `createdAt` / `updatedAt` - Timestamps

#### Sale

Completed NFT sales

- `price` - Sale price
- `buyer` / `seller` - Transaction parties
- `timestamp` - Sale time

#### MarketplaceStats

Global marketplace metrics

- `totalSales` - Number of completed sales
- `totalVolume` - Trading volume
- `totalListings` - Active listings count

### ICO Entities

#### ICORequest

Crowdfunding campaigns

- `totalContributions` - Raised amount
- `totalContributors` - Number of backers
- `creator` - Project creator
- `active` - Campaign status

#### Contribution

Individual ICO contributions

- `amount` - Contribution amount
- `contributor` - Backer address
- `timestamp` - Contribution time

### Token Launch Entities

#### Project

Created token projects

- `token` - Associated ERC20 token
- `nft` - Associated NFT collection
- `fundsManager` - Liquidity management contract
- `creator` - Project creator

#### ERC20Token

Launched tokens

- `totalSupply` - Token supply
- `derivedUSD` - USD price
- `totalHolders` - Number of holders

#### FundsManager

Liquidity management

- `totalLockedValue` - Locked LP tokens
- `totalBonusClaimed` - Distributed rewards

## Time-Series Data

### Daily Aggregations

- `PiculeDayData` - Protocol daily stats
- `PairDayData` - Pair daily stats
- `TokenDayData` - Token daily stats

### Hourly Data

- `PairHourData` - Pair hourly stats
- `TokenHourData` - Token hourly OHLC data

### Minute Data

- `TokenMinuteData` - Token minute-level OHLC data for real-time charts

## Price Discovery

The subgraph uses a hybrid pricing system:

1. **External Price Oracle**: MON/USDC price from BubbleFi pool (`0xEc8eb233538aBFc97f337da8ec3d1b57fbe31895`)
2. **Internal Price Calculation**: Token prices derived through trading pairs using MON as reference
3. **Whitelist System**: USDC and MON as trusted pricing tokens

## Query Examples

### Get Factory Stats

```graphql
{
  piculeFactory(id: "0x4c4a92931a3f0a4fb369c61fd990efce28b044e7") {
    totalVolumeUSD
    totalLiquidityUSD
    pairCount
    txCount
  }
}
```

### Get Top Trading Pairs

```graphql
{
  pairs(orderBy: volumeUSD, orderDirection: desc, first: 10) {
    id
    token0 {
      symbol
    }
    token1 {
      symbol
    }
    volumeUSD
    reserveUSD
    txCount
  }
}
```

### Get Token Price History

```graphql
{
  tokenDayDatas(
    where: { token: "0x..." }
    orderBy: date
    orderDirection: desc
    first: 30
  ) {
    date
    priceUSD
    dailyVolumeUSD
    totalLiquidityUSD
  }
}
```

### Get Recent Swaps

```graphql
{
  swaps(orderBy: timestamp, orderDirection: desc, first: 100) {
    pair {
      token0 {
        symbol
      }
      token1 {
        symbol
      }
    }
    amountUSD
    sender
    timestamp
  }
}
```

### Get NFT Marketplace Activity

```graphql
{
  sales(orderBy: timestamp, orderDirection: desc, first: 20) {
    price
    buyer {
      id
    }
    seller {
      id
    }
    nftContract
    tokenId
    timestamp
  }
}
```

### Get ICO Projects

```graphql
{
  icoRequests(where: { active: true }) {
    numOfRequest
    totalContributions
    totalContributors
    creator {
      id
    }
    createdAt
  }
}
```

## Network Information

- **Blockchain**: Monad Testnet
- **API Version**: 0.0.7
- **Spec Version**: 0.0.8

## Architecture

The subgraph follows a modular architecture with:

- **Common utilities** for price calculations, time aggregations, and helpers
- **Dedicated mappings** for each contract type
- **Template contracts** for dynamically created pairs, tokens, and NFTs
- **Comprehensive entity relationships** for complex queries
