import { BigDecimal } from "@graphprotocol/graph-ts";
import {
  ItemListed,
  ItemSold,
  ListingCancelled,
  ListingUpdated,
} from "../../generated/Marketplace/Marketplace";
import {
  Listing,
  Sale,
  PriceUpdate,
  ListingCancellation,
  ERC721Token,
  MarketplaceStats,
} from "../../generated/schema";
import { ZERO_BD, ZERO_BI, ONE_BI } from "../common/constants";
import { getOrCreateAccount } from "../common/helpers";
import { getOrCreateTransaction, TransactionType } from "../common/transaction";

export function handleItemListed(event: ItemListed): void {
  let transaction = getOrCreateTransaction(event, TransactionType.MARKETPLACE);

  let seller = getOrCreateAccount(event.params.seller);

  let listingId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());

  let listing = new Listing(listingId);
  listing.seller = seller.id;
  listing.nftContract = event.params.nftContract;
  listing.tokenId = event.params.tokenId;

  let nftTokenId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());
  listing.token = nftTokenId;

  listing.price = event.params.price.toBigDecimal();
  listing.active = true;
  listing.createdAt = event.block.timestamp;
  listing.updatedAt = event.block.timestamp;
  listing.save();

  let nftToken = ERC721Token.load(nftTokenId);
  if (nftToken) {
    nftToken.price = listing.price;
    nftToken.save();
  }

  updateMarketplaceStats(ZERO_BD, true, false);
}

export function handleItemSold(event: ItemSold): void {
  let transaction = getOrCreateTransaction(event, TransactionType.MARKETPLACE);

  let seller = getOrCreateAccount(event.params.seller);
  let buyer = getOrCreateAccount(event.params.buyer);

  let listingId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());

  let listing = Listing.load(listingId);
  if (!listing) {
    return;
  }

  let saleId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let sale = new Sale(saleId);
  sale.listing = listing.id;
  sale.seller = seller.id;
  sale.buyer = buyer.id;
  sale.nftContract = event.params.nftContract;
  sale.tokenId = event.params.tokenId;
  sale.price = event.params.price.toBigDecimal();
  sale.timestamp = event.block.timestamp;
  sale.transaction = transaction.id;
  sale.save();

  listing.active = false;
  listing.updatedAt = event.block.timestamp;
  listing.save();

  let nftTokenId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());
  let nftToken = ERC721Token.load(nftTokenId);
  if (nftToken) {
    nftToken.price = ZERO_BD;
    nftToken.save();
  }

  updateMarketplaceStats(sale.price, false, true);
}

export function handleListingCancelled(event: ListingCancelled): void {
  let transaction = getOrCreateTransaction(event, TransactionType.MARKETPLACE);

  let seller = getOrCreateAccount(event.params.seller);

  let listingId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());

  let listing = Listing.load(listingId);
  if (!listing) {
    return;
  }

  let cancellationId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let cancellation = new ListingCancellation(cancellationId);
  cancellation.listing = listing.id;
  cancellation.seller = seller.id;
  cancellation.nftContract = event.params.nftContract;
  cancellation.tokenId = event.params.tokenId;
  cancellation.timestamp = event.block.timestamp;
  cancellation.transaction = transaction.id;
  cancellation.save();

  listing.active = false;
  listing.updatedAt = event.block.timestamp;
  listing.save();

  let nftTokenId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());
  let nftToken = ERC721Token.load(nftTokenId);
  if (nftToken) {
    nftToken.price = ZERO_BD;
    nftToken.save();
  }
}

export function handleListingUpdated(event: ListingUpdated): void {
  let transaction = getOrCreateTransaction(event, TransactionType.MARKETPLACE);

  let listingId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());

  let listing = Listing.load(listingId);
  if (!listing) {
    return;
  }

  let priceUpdateId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let priceUpdate = new PriceUpdate(priceUpdateId);
  priceUpdate.listing = listing.id;
  priceUpdate.oldPrice = event.params.oldPrice.toBigDecimal();
  priceUpdate.newPrice = event.params.newPrice.toBigDecimal();
  priceUpdate.timestamp = event.block.timestamp;
  priceUpdate.transaction = transaction.id;
  priceUpdate.save();

  listing.price = priceUpdate.newPrice;
  listing.updatedAt = event.block.timestamp;
  listing.save();

  let nftTokenId = event.params.nftContract
    .toHexString()
    .concat("-")
    .concat(event.params.tokenId.toString());
  let nftToken = ERC721Token.load(nftTokenId);
  if (nftToken) {
    nftToken.price = listing.price;
    nftToken.save();
  }
}

function updateMarketplaceStats(
  volume: BigDecimal,
  isListing: boolean,
  isSale: boolean
): void {
  let stats = MarketplaceStats.load("1");
  if (!stats) {
    stats = new MarketplaceStats("1");
    stats.totalListings = ZERO_BI;
    stats.totalSales = ZERO_BI;
    stats.totalVolume = ZERO_BI;
    stats.totalVolumeUSD = ZERO_BD;
  }

  if (isListing) {
    stats.totalListings = stats.totalListings.plus(ONE_BI);
  }

  if (isSale) {
    stats.totalSales = stats.totalSales.plus(ONE_BI);
    stats.totalVolume = stats.totalVolume.plus(volume.truncate(0).digits);
  }

  stats.save();
}
