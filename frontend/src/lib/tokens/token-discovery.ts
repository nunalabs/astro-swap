/**
 * Token Discovery Service
 *
 * Combines 3 token sources for comprehensive token discovery:
 * 1. Whitelist (verified tokens, highest priority)
 * 2. StellarExpert API (curated tokens with rating)
 * 3. Horizon API (search any token on Stellar)
 *
 * Priority: whitelist > stellar_expert > horizon > factory
 */

import type { Token, TokenSource } from '../../types';
import whitelistData from './whitelist.json';

// Stellar network configuration
const STELLAR_NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';
const HORIZON_URL = STELLAR_NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';
const STELLAR_EXPERT_NETWORK = STELLAR_NETWORK === 'mainnet' ? 'public' : 'testnet';

// Cache settings
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const tokenCache = new Map<string, { token: Token; timestamp: number }>();
const searchCache = new Map<string, { results: Token[]; timestamp: number }>();

// Whitelist token interface (from JSON)
interface WhitelistToken {
  code: string;
  issuer: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
  domain?: string;
  verified?: boolean;
  popular?: boolean;
  testnet?: boolean;
}

/**
 * Get whitelist tokens (pre-verified, highest trust)
 */
export function getWhitelistTokens(): Token[] {
  const tokens: Token[] = [];
  const isTestnet = STELLAR_NETWORK === 'testnet';

  for (const wt of whitelistData.tokens as WhitelistToken[]) {
    // Skip testnet-only tokens on mainnet
    if (!isTestnet && wt.testnet) continue;
    // Skip mainnet tokens on testnet (unless they're available on both)
    if (isTestnet && !wt.testnet && wt.issuer !== 'native') continue;

    tokens.push({
      address: wt.issuer === 'native' ? 'native' : createSACAddress(wt.code, wt.issuer),
      symbol: wt.symbol,
      name: wt.name,
      decimals: wt.decimals,
      logoURI: wt.icon,
      issuer: wt.issuer,
      domain: wt.domain,
      verified: wt.verified ?? true,
      popular: wt.popular ?? false,
      source: 'whitelist' as TokenSource,
    });
  }

  return tokens;
}

/**
 * Get popular/featured tokens from whitelist
 */
export function getPopularTokens(): Token[] {
  return getWhitelistTokens().filter(t => t.popular);
}

/**
 * Fetch tokens from StellarExpert API (rated tokens)
 */
export async function fetchStellarExpertTokens(options: {
  limit?: number;
  sort?: 'rating' | 'volume24h' | 'trades24h';
} = {}): Promise<Token[]> {
  const { limit = 50, sort = 'rating' } = options;

  try {
    const url = `https://api.stellar.expert/explorer/${STELLAR_EXPERT_NETWORK}/asset?sort=${sort}&order=desc&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('StellarExpert API error:', response.status);
      return [];
    }

    const data = await response.json();
    const tokens: Token[] = [];

    for (const asset of data._embedded?.records || []) {
      // Skip native XLM (handled by whitelist)
      if (asset.asset_type === 'native') continue;

      // Skip unrated or very low-rated tokens
      if (asset.rating && asset.rating.average < 1) continue;

      // Get clean asset code (not the full address)
      const assetCode = asset.asset || '';

      const token: Token = {
        address: createSACAddress(assetCode, asset.issuer),
        symbol: assetCode,  // Just the code, e.g., "USDC"
        name: asset.toml_info?.name || asset.name || assetCode,
        decimals: 7, // Stellar default
        logoURI: asset.toml_info?.image,
        issuer: asset.issuer,
        domain: asset.domain,
        rating: asset.rating?.average,
        verified: (asset.rating?.average || 0) >= 3,
        source: 'stellar_expert' as TokenSource,
      };

      tokens.push(token);
    }

    return tokens;
  } catch (error) {
    console.error('Error fetching StellarExpert tokens:', error);
    return [];
  }
}

/**
 * Search tokens using Horizon API (search any token)
 */
export async function searchHorizonTokens(query: string): Promise<Token[]> {
  if (!query || query.length < 2) return [];

  // Check cache first
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }

  try {
    // Search by asset code
    const url = `${HORIZON_URL}/assets?asset_code=${encodeURIComponent(query.toUpperCase())}&limit=20`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Horizon API error:', response.status);
      return [];
    }

    const data = await response.json();
    const tokens: Token[] = [];

    for (const record of data._embedded?.records || []) {
      const token: Token = {
        address: createSACAddress(record.asset_code, record.asset_issuer),
        symbol: record.asset_code,
        name: record.asset_code,
        decimals: 7,
        issuer: record.asset_issuer,
        domain: record._links?.toml?.href?.replace('https://', '').replace('/.well-known/stellar.toml', ''),
        source: 'horizon' as TokenSource,
      };

      // Try to get more info from toml
      if (record._links?.toml) {
        const tomlInfo = await fetchTomlInfo(record._links.toml.href, record.asset_code);
        if (tomlInfo) {
          token.name = tomlInfo.name || token.name;
          token.logoURI = tomlInfo.image;
          token.domain = tomlInfo.domain;
        }
      }

      tokens.push(token);
    }

    // Cache results
    searchCache.set(cacheKey, { results: tokens, timestamp: Date.now() });

    return tokens;
  } catch (error) {
    console.error('Error searching Horizon tokens:', error);
    return [];
  }
}

/**
 * Fetch token info from stellar.toml
 */
async function fetchTomlInfo(tomlUrl: string, assetCode: string): Promise<{
  name?: string;
  image?: string;
  domain?: string;
} | null> {
  try {
    const response = await fetch(tomlUrl, {
      headers: { 'Accept': 'text/plain' },
    });

    if (!response.ok) return null;

    const tomlText = await response.text();

    // Parse relevant fields (simplified TOML parsing)
    const currencies = tomlText.split('[[CURRENCIES]]');

    for (const currency of currencies) {
      if (currency.includes(`code = "${assetCode}"`) || currency.includes(`code="${assetCode}"`)) {
        const name = extractTomlValue(currency, 'name');
        const image = extractTomlValue(currency, 'image');
        const domain = extractTomlValue(tomlText, 'ORG_NAME') ||
                       extractTomlValue(tomlText, 'DOCUMENTATION.ORG_NAME');

        return { name, image, domain };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function extractTomlValue(text: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i');
  const match = text.match(regex);
  return match?.[1];
}

/**
 * Create SAC (Stellar Asset Contract) address from asset code and issuer
 * This is a placeholder - in production, you'd compute the actual contract address
 */
function createSACAddress(assetCode: string, issuer: string): string {
  if (issuer === 'native') return 'native';
  // Return composite identifier CODE:ISSUER
  return `${assetCode}:${issuer}`;
}

/**
 * Truncate issuer address for display
 */
export function truncateIssuer(issuer: string, chars: number = 4): string {
  if (!issuer || issuer === 'native') return '';
  if (issuer.length <= chars * 2 + 3) return issuer;
  return `${issuer.slice(0, chars)}...${issuer.slice(-chars)}`;
}

/**
 * Get display-friendly token info
 */
export function getTokenDisplayInfo(token: Token): {
  symbol: string;
  name: string;
  issuerShort: string;
  logoURI?: string;
} {
  // For whitelist tokens, use their defined symbol/name
  if (token.source === 'whitelist') {
    return {
      symbol: token.symbol,
      name: token.name,
      issuerShort: token.domain || truncateIssuer(token.issuer || ''),
      logoURI: token.logoURI,
    };
  }

  // For other tokens, extract code from address if needed
  let symbol = token.symbol;
  let issuer = token.issuer || '';

  // If symbol contains ':', it's in CODE:ISSUER format
  if (symbol.includes(':')) {
    const parts = symbol.split(':');
    symbol = parts[0];
    issuer = parts[1] || issuer;
  }

  return {
    symbol,
    name: token.name !== symbol ? token.name : symbol,
    issuerShort: token.domain || truncateIssuer(issuer),
    logoURI: token.logoURI,
  };
}

/**
 * Comprehensive token search combining all sources
 */
export async function discoverTokens(query?: string): Promise<Token[]> {
  const allTokens = new Map<string, Token>();

  // 1. Start with whitelist tokens (highest priority)
  const whitelistTokens = getWhitelistTokens();
  for (const token of whitelistTokens) {
    allTokens.set(token.address, token);
  }

  // 2. Add StellarExpert tokens (if no specific query)
  if (!query) {
    const expertTokens = await fetchStellarExpertTokens({ limit: 30 });
    for (const token of expertTokens) {
      if (!allTokens.has(token.address)) {
        allTokens.set(token.address, token);
      }
    }
  }

  // 3. Search Horizon if query provided
  if (query && query.length >= 2) {
    const horizonTokens = await searchHorizonTokens(query);
    for (const token of horizonTokens) {
      if (!allTokens.has(token.address)) {
        allTokens.set(token.address, token);
      }
    }
  }

  // Convert to array and sort by priority
  const tokens = Array.from(allTokens.values());

  return sortTokensByPriority(tokens, query);
}

/**
 * Sort tokens by priority and relevance
 */
function sortTokensByPriority(tokens: Token[], query?: string): Token[] {
  return tokens.sort((a, b) => {
    // Priority: verified > popular > high rating > alphabetical
    const getPriority = (t: Token): number => {
      let score = 0;
      if (t.verified) score += 1000;
      if (t.popular) score += 500;
      if (t.rating) score += t.rating * 50;
      if (t.source === 'whitelist') score += 100;
      if (t.source === 'stellar_expert') score += 50;

      // Boost exact query matches
      if (query) {
        const q = query.toLowerCase();
        if (t.symbol.toLowerCase() === q) score += 2000;
        if (t.symbol.toLowerCase().startsWith(q)) score += 500;
        if (t.name.toLowerCase().includes(q)) score += 100;
      }

      return score;
    };

    return getPriority(b) - getPriority(a);
  });
}

/**
 * Get token by address (with caching)
 */
export async function getTokenByAddress(address: string): Promise<Token | null> {
  // Check cache
  const cached = tokenCache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.token;
  }

  // Check whitelist first
  const whitelistToken = getWhitelistTokens().find(t => t.address === address);
  if (whitelistToken) {
    tokenCache.set(address, { token: whitelistToken, timestamp: Date.now() });
    return whitelistToken;
  }

  // Try to fetch from Horizon
  // TODO: Implement single token lookup
  return null;
}

/**
 * Validate if a token address is valid
 */
export function isValidTokenAddress(address: string): boolean {
  if (address === 'native') return true;

  // Check for SAC format (C... address)
  if (/^C[A-Z0-9]{55}$/.test(address)) return true;

  // Check for classic format (CODE:ISSUER)
  if (/^[A-Za-z0-9]+:G[A-Z0-9]{55}$/.test(address)) return true;

  return false;
}

/**
 * Clear all caches
 */
export function clearTokenDiscoveryCache(): void {
  tokenCache.clear();
  searchCache.clear();
}
