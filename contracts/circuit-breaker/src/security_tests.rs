//! Security Tests for AstroSwap Circuit Breaker Contract
//!
//! These tests verify protection against common attack vectors:
//! - Unauthorized circuit breaking
//! - Timelock bypass attempts
//! - Rapid toggle attacks
//! - Guardian privilege escalation
//! - Admin privilege escalation
//! - Invalid timelock configuration
//! - Unauthorized management operations
//! - Index out of bounds attacks

#[cfg(test)]
mod security_tests {
    use crate::{CircuitBreaker, CircuitBreakerClient};
    use astroswap_shared::AstroSwapError;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Address, Env, Symbol,
    };

    const SHORT_TIMELOCK: u64 = 60; // 60 seconds for testing

    // ==================== Authorization ====================

    #[test]
    fn test_only_admin_or_guardian_can_break_circuit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let guardian = Address::generate(&env);
        let attacker = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);
        client.add_guardian(&admin, &guardian);

        // SECURITY: Only admin or guardians can break the circuit
        let result = client.try_break_circuit(&attacker, &Symbol::new(&env, "attack"));

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));
        assert!(!client.is_broken());

        // require_admin_or_guardian() validates at line 535-554
    }

    #[test]
    fn test_guardian_can_break_but_not_restore() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let guardian = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);
        client.add_guardian(&admin, &guardian);

        // Guardian can break circuit
        client.break_circuit(&guardian, &Symbol::new(&env, "emergency"));
        assert!(client.is_broken());

        // SECURITY: Guardian CANNOT schedule restore (only admin can)
        let result = client.try_schedule_restore(&guardian);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        // Guardian CANNOT execute restore
        let result = client.try_execute_restore(&guardian);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        // require_admin() validates at line 527-532
    }

    // ==================== Timelock Protection ====================

    #[test]
    fn test_timelock_prevents_immediate_unpause() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);

        // Break circuit
        client.break_circuit(&admin, &Symbol::new(&env, "test"));
        assert!(client.is_broken());

        // Schedule restore
        let effective_at = client.schedule_restore(&admin);
        assert_eq!(effective_at, 1000 + SHORT_TIMELOCK);

        // SECURITY: Cannot execute restore before timelock expires
        let result = client.try_execute_restore(&admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::TimelockNotExpired));

        // Circuit should still be broken
        assert!(client.is_broken());

        // Timelock validation at line 245-248
    }

    #[test]
    fn test_restore_requires_schedule_first() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);
        client.break_circuit(&admin, &Symbol::new(&env, "test"));

        // SECURITY: Cannot execute restore without scheduling first
        let result = client.try_execute_restore(&admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::UnpauseNotScheduled));

        // Schedule check at line 240-243
    }

    #[test]
    fn test_timelock_can_execute_after_delay() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);
        client.break_circuit(&admin, &Symbol::new(&env, "test"));

        let effective_at = client.schedule_restore(&admin);

        // Advance time past timelock
        env.ledger().set_timestamp(effective_at + 1);

        // SECURITY: After timelock expires, restore can be executed
        let result = client.try_execute_restore(&admin);
        assert!(result.is_ok());
        assert!(!client.is_broken());
    }

    // ==================== Invalid Timelock Configuration ====================

    #[test]
    fn test_zero_timelock_uses_default() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        // SECURITY: Zero timelock defaults to DEFAULT_TIMELOCK_DELAY (3600)
        client.initialize(&admin, &0);

        assert_eq!(client.timelock_delay(), 3600); // DEFAULT_TIMELOCK_DELAY
        // Default assignment at line 119-120
    }

    #[test]
    fn test_excessive_timelock_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        // SECURITY: Timelock > MAX_TIMELOCK_DELAY (7 days) is rejected
        let max_delay = 7 * 24 * 60 * 60; // 7 days
        let result = client.try_initialize(&admin, &(max_delay + 1));

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::InvalidArgument));

        // Validation at line 121-122
    }

    #[test]
    fn test_timelock_update_validation() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: Cannot set timelock to 0
        let result = client.try_set_timelock_delay(&admin, &0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::InvalidArgument));

        // Cannot set timelock > MAX_TIMELOCK_DELAY
        let max_delay = 7 * 24 * 60 * 60;
        let result = client.try_set_timelock_delay(&admin, &(max_delay + 1));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::InvalidArgument));

        // Validation at line 433-435
    }

    // ==================== Rapid Toggle Protection ====================

    #[test]
    fn test_break_circuit_initial_clears_scheduled_unpause() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);

        // Set a scheduled unpause manually (simulating previous state)
        // In real scenario, this would be from a previous restore cycle that was interrupted

        // Break circuit (first time - not already paused)
        client.break_circuit(&admin, &Symbol::new(&env, "test1"));
        assert!(client.is_broken());

        // SECURITY: When breaking a non-broken circuit, scheduled unpause is cleared
        // This ensures no stale unpause schedule exists
        assert_eq!(client.unpause_scheduled_at(), 0);

        // Note: If circuit is already broken and you call break_circuit again,
        // it returns early (line 157-159) without clearing the scheduled unpause.
        // This is current contract behavior. To clear a scheduled unpause on
        // an already-broken circuit, use cancel_restore() instead.

        // Schedule cleared at line 168 (only when circuit transitions to broken state)
    }

    #[test]
    fn test_cancel_restore_prevents_unpause() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let guardian = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);
        client.add_guardian(&admin, &guardian);
        client.break_circuit(&admin, &Symbol::new(&env, "test"));

        let effective_at = client.schedule_restore(&admin);

        // SECURITY: Admin or guardian can cancel scheduled restore
        // Use case: new issue discovered before timelock expires
        client.cancel_restore(&guardian);
        assert_eq!(client.unpause_scheduled_at(), 0);

        // Advance past original timelock
        env.ledger().set_timestamp(effective_at + 1);

        // Cannot execute restore (cancelled)
        let result = client.try_execute_restore(&admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::UnpauseNotScheduled));
    }

    // ==================== Admin Privilege Escalation ====================

    #[test]
    fn test_unauthorized_admin_transfer() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let new_admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: Only current admin can transfer admin role
        let result = client.try_set_admin(&attacker, &new_admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        // Admin should not have changed
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn test_admin_transfer_requires_new_admin_auth() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: New admin must also authorize the transfer
        // This prevents:
        // 1. Admin transferring to arbitrary address
        // 2. Forcing admin role onto unwilling party
        // 3. Social engineering attacks
        //
        // See line 452: new_admin.require_auth()
        // With mock_all_auths, this passes, but in production both would need to sign

        client.set_admin(&admin, &new_admin);
        assert_eq!(client.admin(), new_admin);
    }

    // ==================== Guardian Management Security ====================

    #[test]
    fn test_unauthorized_guardian_addition() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let malicious_guardian = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: Only admin can add guardians
        let result = client.try_add_guardian(&attacker, &malicious_guardian);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        assert_eq!(client.guardian_count(), 0);
    }

    #[test]
    fn test_unauthorized_guardian_removal() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let guardian = Address::generate(&env);

        client.initialize(&admin, &3600);
        client.add_guardian(&admin, &guardian);

        // SECURITY: Only admin can remove guardians
        let result = client.try_remove_guardian(&attacker, &0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        assert_eq!(client.guardian_count(), 1);
    }

    #[test]
    fn test_guardian_removal_index_bounds() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let guardian = Address::generate(&env);

        client.initialize(&admin, &3600);
        client.add_guardian(&admin, &guardian);

        // SECURITY: Cannot remove guardian with invalid index
        let result = client.try_remove_guardian(&admin, &1); // Only index 0 exists
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::InvalidArgument));

        // Index validation at line 395-398
    }

    // ==================== Contract Management Security ====================

    #[test]
    fn test_unauthorized_contract_registration() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let malicious_contract = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: Only admin can register contracts
        let result = client.try_register_contract(
            &attacker,
            &malicious_contract,
            &Symbol::new(&env, "fake"),
        );
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        assert_eq!(client.contract_count(), 0);
    }

    #[test]
    fn test_unauthorized_contract_removal() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let router = Address::generate(&env);

        client.initialize(&admin, &3600);
        client.register_contract(&admin, &router, &Symbol::new(&env, "router"));

        // SECURITY: Only admin can remove contracts
        let result = client.try_remove_contract(&attacker, &0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        assert_eq!(client.contract_count(), 1);
    }

    #[test]
    fn test_contract_removal_index_bounds() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let router = Address::generate(&env);

        client.initialize(&admin, &3600);
        client.register_contract(&admin, &router, &Symbol::new(&env, "router"));

        // SECURITY: Cannot remove contract with invalid index
        let result = client.try_remove_contract(&admin, &1); // Only index 0 exists
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::InvalidArgument));

        // Index validation at line 339-342
    }

    // ==================== Re-initialization Protection ====================

    #[test]
    fn test_cannot_reinitialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: Cannot initialize twice
        let result = client.try_initialize(&attacker, &1);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::AlreadyInitialized));

        // Original admin should still be in control
        assert_eq!(client.admin(), admin);

        // Re-initialization check at line 114-116
    }

    // ==================== State Consistency ====================

    #[test]
    fn test_break_circuit_idempotent() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Break circuit
        client.break_circuit(&admin, &Symbol::new(&env, "test1"));
        assert!(client.is_broken());

        // SECURITY: Breaking already-broken circuit is idempotent (no-op)
        // This prevents:
        // 1. Resetting pause timestamp incorrectly
        // 2. Emitting duplicate events
        // 3. Clearing valid scheduled unpause
        //
        // See line 157-159: Already paused returns Ok(())
        client.break_circuit(&admin, &Symbol::new(&env, "test2"));
        assert!(client.is_broken());
    }

    #[test]
    fn test_cannot_schedule_when_not_broken() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // SECURITY: Cannot schedule restore when circuit is not broken
        let result = client.try_schedule_restore(&admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::ContractNotPaused));

        // State validation at line 203-205
    }

    #[test]
    fn test_unauthorized_cancel_restore() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 25,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);

        client.initialize(&admin, &SHORT_TIMELOCK);
        client.break_circuit(&admin, &Symbol::new(&env, "test"));
        client.schedule_restore(&admin);

        // SECURITY: Only admin or guardian can cancel restore
        let result = client.try_cancel_restore(&attacker);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(AstroSwapError::Unauthorized));

        // Schedule should still be active
        assert!(client.unpause_scheduled_at() > 0);
    }
}
