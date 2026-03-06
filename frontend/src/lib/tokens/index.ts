/**
 * Token Discovery Module
 *
 * Exports all token discovery functionality:
 * - Whitelist tokens (verified)
 * - StellarExpert API (rated)
 * - Horizon API (search any)
 * - Factory tokens (on-chain)
 */

export {
  getWhitelistTokens,
  getPopularTokens,
  fetchStellarExpertTokens,
  searchHorizonTokens,
  discoverTokens,
  getTokenByAddress,
  isValidTokenAddress,
  clearTokenDiscoveryCache,
  truncateIssuer,
  getTokenDisplayInfo,
} from './token-discovery';

// Re-export whitelist data for direct access
export { default as whitelistData } from './whitelist.json';
