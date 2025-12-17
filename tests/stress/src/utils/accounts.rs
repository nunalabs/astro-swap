//! Test Account Management
//!
//! Utilities for generating and managing test accounts for stress testing.

use soroban_sdk::{testutils::Address as _, Address, Env};
use std::collections::HashMap;

/// Manages a pool of test accounts
pub struct AccountPool {
    accounts: Vec<Address>,
    account_map: HashMap<String, usize>,
    next_index: usize,
}

impl AccountPool {
    /// Create a new account pool with specified number of accounts
    pub fn new(env: &Env, num_accounts: u32) -> Self {
        let mut accounts = Vec::new();
        let mut account_map = HashMap::new();

        for i in 0..num_accounts {
            let account = Address::generate(env);
            account_map.insert(format!("account_{}", i), i as usize);
            accounts.push(account);
        }

        Self {
            accounts,
            account_map,
            next_index: 0,
        }
    }

    /// Get the total number of accounts
    pub fn len(&self) -> usize {
        self.accounts.len()
    }

    /// Check if the pool is empty
    pub fn is_empty(&self) -> bool {
        self.accounts.is_empty()
    }

    /// Get an account by index
    pub fn get(&self, index: usize) -> Option<&Address> {
        self.accounts.get(index)
    }

    /// Get an account by name
    pub fn get_by_name(&self, name: &str) -> Option<&Address> {
        self.account_map
            .get(name)
            .and_then(|&index| self.accounts.get(index))
    }

    /// Get the next account in round-robin fashion
    pub fn next(&mut self) -> &Address {
        let account = &self.accounts[self.next_index];
        self.next_index = (self.next_index + 1) % self.accounts.len();
        account
    }

    /// Get a random account
    pub fn random(&self) -> &Address {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let index = rng.gen_range(0..self.accounts.len());
        &self.accounts[index]
    }

    /// Get all accounts
    pub fn all(&self) -> &[Address] {
        &self.accounts
    }

    /// Get a slice of accounts
    pub fn slice(&self, start: usize, end: usize) -> &[Address] {
        &self.accounts[start.min(self.accounts.len())..end.min(self.accounts.len())]
    }

    /// Reset the round-robin counter
    pub fn reset(&mut self) {
        self.next_index = 0;
    }

    /// Get account at specific index (for parallel operations)
    pub fn get_account(&self, index: usize) -> &Address {
        &self.accounts[index % self.accounts.len()]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_account_pool_creation() {
        let env = Env::default();
        let pool = AccountPool::new(&env, 10);

        assert_eq!(pool.len(), 10);
        assert!(!pool.is_empty());
    }

    #[test]
    fn test_account_pool_access() {
        let env = Env::default();
        let pool = AccountPool::new(&env, 5);

        // Test get by index
        assert!(pool.get(0).is_some());
        assert!(pool.get(4).is_some());
        assert!(pool.get(5).is_none());

        // Test get by name
        assert!(pool.get_by_name("account_0").is_some());
        assert!(pool.get_by_name("account_4").is_some());
        assert!(pool.get_by_name("account_5").is_none());
    }

    #[test]
    fn test_account_pool_round_robin() {
        let env = Env::default();
        let mut pool = AccountPool::new(&env, 3);

        let first = pool.next();
        let second = pool.next();
        let third = pool.next();
        let fourth = pool.next(); // Should wrap to first

        assert_eq!(first, pool.get(0).unwrap());
        assert_eq!(second, pool.get(1).unwrap());
        assert_eq!(third, pool.get(2).unwrap());
        assert_eq!(fourth, pool.get(0).unwrap());
    }

    #[test]
    fn test_account_pool_reset() {
        let env = Env::default();
        let mut pool = AccountPool::new(&env, 3);

        pool.next();
        pool.next();
        pool.reset();

        assert_eq!(pool.next(), pool.get(0).unwrap());
    }

    #[test]
    fn test_account_pool_slice() {
        let env = Env::default();
        let pool = AccountPool::new(&env, 10);

        let slice = pool.slice(2, 5);
        assert_eq!(slice.len(), 3);

        // Test boundary conditions
        let slice = pool.slice(8, 15);
        assert_eq!(slice.len(), 2); // Only 8 and 9 exist
    }
}
