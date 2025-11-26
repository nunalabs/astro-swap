//! Token Management
//!
//! Utilities for setting up and managing test tokens for stress testing.

use soroban_sdk::{Address, Env};
use soroban_token_sdk::TokenClient;
use std::collections::HashMap;

/// Token information
#[derive(Clone, Debug)]
pub struct TokenInfo {
    pub address: Address,
    pub client: TokenClient<'static>,
    pub name: String,
    pub decimals: u32,
}

/// Manages test tokens for stress testing
pub struct TokenManager {
    tokens: Vec<TokenInfo>,
    token_map: HashMap<String, usize>,
}

impl TokenManager {
    /// Create a new token manager
    pub fn new() -> Self {
        Self {
            tokens: Vec::new(),
            token_map: HashMap::new(),
        }
    }

    /// Create and register a new token
    pub fn create_token(
        &mut self,
        env: &Env,
        admin: &Address,
        name: String,
        decimals: u32,
        initial_supply: i128,
    ) -> &TokenInfo {
        let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_client = TokenClient::new(env, &token_address);

        // Mint initial supply to admin
        token_client.mint(admin, &initial_supply);

        let index = self.tokens.len();
        let token_info = TokenInfo {
            address: token_address,
            client: token_client,
            name: name.clone(),
            decimals,
        };

        self.token_map.insert(name, index);
        self.tokens.push(token_info);

        &self.tokens[index]
    }

    /// Create multiple tokens at once
    pub fn create_tokens(
        &mut self,
        env: &Env,
        admin: &Address,
        count: u32,
        initial_supply: i128,
    ) {
        for i in 0..count {
            let name = format!("TOKEN_{}", i);
            self.create_token(env, admin, name, 7, initial_supply);
        }
    }

    /// Get token by index
    pub fn get(&self, index: usize) -> Option<&TokenInfo> {
        self.tokens.get(index)
    }

    /// Get token by name
    pub fn get_by_name(&self, name: &str) -> Option<&TokenInfo> {
        self.token_map
            .get(name)
            .and_then(|&index| self.tokens.get(index))
    }

    /// Get all tokens
    pub fn all(&self) -> &[TokenInfo] {
        &self.tokens
    }

    /// Get number of tokens
    pub fn len(&self) -> usize {
        self.tokens.len()
    }

    /// Check if manager is empty
    pub fn is_empty(&self) -> bool {
        self.tokens.is_empty()
    }

    /// Distribute tokens to multiple accounts
    pub fn distribute(
        &self,
        from: &Address,
        to_accounts: &[Address],
        amount_per_account: i128,
    ) {
        for token in &self.tokens {
            for account in to_accounts {
                token.client.transfer(from, account, &amount_per_account);
            }
        }
    }

    /// Distribute specific token to accounts
    pub fn distribute_token(
        &self,
        token_index: usize,
        from: &Address,
        to_accounts: &[Address],
        amount_per_account: i128,
    ) {
        if let Some(token) = self.tokens.get(token_index) {
            for account in to_accounts {
                token.client.transfer(from, account, &amount_per_account);
            }
        }
    }

    /// Get balance of account for specific token
    pub fn balance(&self, token_index: usize, account: &Address) -> i128 {
        self.tokens
            .get(token_index)
            .map(|token| token.client.balance(account))
            .unwrap_or(0)
    }

    /// Get token pair (useful for creating trading pairs)
    pub fn get_pair(&self, index_a: usize, index_b: usize) -> Option<(&TokenInfo, &TokenInfo)> {
        if index_a < self.tokens.len() && index_b < self.tokens.len() && index_a != index_b {
            Some((&self.tokens[index_a], &self.tokens[index_b]))
        } else {
            None
        }
    }

    /// Get all possible pairs (combinatorial)
    pub fn all_pairs(&self) -> Vec<(usize, usize)> {
        let mut pairs = Vec::new();
        for i in 0..self.tokens.len() {
            for j in (i + 1)..self.tokens.len() {
                pairs.push((i, j));
            }
        }
        pairs
    }

    /// Get token addresses for pair creation
    pub fn get_pair_addresses(&self, index_a: usize, index_b: usize) -> Option<(Address, Address)> {
        self.get_pair(index_a, index_b)
            .map(|(a, b)| (a.address.clone(), b.address.clone()))
    }
}

impl Default for TokenManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_token_manager_creation() {
        let manager = TokenManager::new();
        assert_eq!(manager.len(), 0);
        assert!(manager.is_empty());
    }

    #[test]
    fn test_create_token() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let mut manager = TokenManager::new();

        let token = manager.create_token(
            &env,
            &admin,
            "TEST".to_string(),
            7,
            1_000_000_0000000,
        );

        assert_eq!(token.name, "TEST");
        assert_eq!(token.decimals, 7);
        assert_eq!(token.client.balance(&admin), 1_000_000_0000000);
    }

    #[test]
    fn test_create_multiple_tokens() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let mut manager = TokenManager::new();

        manager.create_tokens(&env, &admin, 5, 1_000_000_0000000);

        assert_eq!(manager.len(), 5);
        assert!(manager.get_by_name("TOKEN_0").is_some());
        assert!(manager.get_by_name("TOKEN_4").is_some());
        assert!(manager.get_by_name("TOKEN_5").is_none());
    }

    #[test]
    fn test_distribute_tokens() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        let mut manager = TokenManager::new();

        manager.create_tokens(&env, &admin, 2, 1_000_000_0000000);
        manager.distribute(&admin, &[user1.clone(), user2.clone()], 10_000_0000000);

        assert_eq!(manager.balance(0, &user1), 10_000_0000000);
        assert_eq!(manager.balance(0, &user2), 10_000_0000000);
        assert_eq!(manager.balance(1, &user1), 10_000_0000000);
        assert_eq!(manager.balance(1, &user2), 10_000_0000000);
    }

    #[test]
    fn test_get_pairs() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let mut manager = TokenManager::new();

        manager.create_tokens(&env, &admin, 4, 1_000_000_0000000);

        let pairs = manager.all_pairs();
        // With 4 tokens: (0,1), (0,2), (0,3), (1,2), (1,3), (2,3) = 6 pairs
        assert_eq!(pairs.len(), 6);

        assert!(manager.get_pair(0, 1).is_some());
        assert!(manager.get_pair(0, 0).is_none()); // Same index
        assert!(manager.get_pair(0, 10).is_none()); // Out of bounds
    }
}
