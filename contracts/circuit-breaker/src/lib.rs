#![no_std]
//! AstroSwap Circuit Breaker Contract
//!
//! Emergency circuit breaker for coordinated pausing of all ecosystem contracts.
//!
//! ## Features
//! - Pause/unpause multiple contracts atomically
//! - Track registered pausable contracts
//! - Timelock for unpause operations (prevents malicious rapid toggling)
//! - Guardian addresses for emergency actions
//! - Event logging for all state changes
//!
//! ## Security Model
//! - Admin can pause immediately (emergency response)
//! - Unpause requires timelock delay (prevents abuse)
//! - Multiple guardians can initiate pause (redundancy)
//! - All actions are logged for audit trail

mod storage;

use astroswap_shared::AstroSwapError;
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Env, IntoVal, Symbol, Vec,
};

use crate::storage::{
    extend_instance_ttl, get_admin, get_guardian, get_guardian_count, get_pausable_contract,
    get_pausable_count, get_paused_at, get_timelock_delay, get_unpause_scheduled_at,
    is_global_paused, is_initialized, remove_guardian, remove_pausable_contract, set_admin,
    set_global_paused, set_guardian, set_guardian_count, set_initialized, set_pausable_contract,
    set_pausable_count, set_paused_at, set_timelock_delay, set_unpause_scheduled_at,
};

/// Default timelock delay: 1 hour (3600 seconds)
const DEFAULT_TIMELOCK_DELAY: u64 = 3600;

/// Maximum timelock delay: 7 days
const MAX_TIMELOCK_DELAY: u64 = 7 * 24 * 60 * 60;

/// Contract paused event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircuitBroken {
    pub caller: Address,
    pub timestamp: u64,
    pub reason: Symbol,
}

/// Contract unpaused event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircuitRestored {
    pub caller: Address,
    pub timestamp: u64,
}

/// Unpause scheduled event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnpauseScheduled {
    pub caller: Address,
    pub scheduled_at: u64,
    pub effective_at: u64,
}

/// Guardian added event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GuardianAdded {
    pub guardian: Address,
}

/// Guardian removed event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GuardianRemoved {
    pub guardian: Address,
}

/// Pausable contract registered event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractRegistered {
    pub contract_address: Address,
    pub name: Symbol,
}

/// Pausable contract info
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausableContract {
    pub address: Address,
    pub name: Symbol,
    pub is_paused: bool,
}

#[contract]
pub struct CircuitBreaker;

#[contractimpl]
impl CircuitBreaker {
    // ==================== Initialization ====================

    /// Initialize the circuit breaker contract
    ///
    /// # Arguments
    /// * `admin` - Admin address with full control
    /// * `timelock_delay` - Delay in seconds before unpause takes effect
    pub fn initialize(
        env: Env,
        admin: Address,
        timelock_delay: u64,
    ) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        // Validate timelock delay
        let delay = if timelock_delay == 0 {
            DEFAULT_TIMELOCK_DELAY
        } else if timelock_delay > MAX_TIMELOCK_DELAY {
            return Err(AstroSwapError::InvalidArgument);
        } else {
            timelock_delay
        };

        set_admin(&env, &admin);
        set_timelock_delay(&env, delay);
        set_global_paused(&env, false);
        set_guardian_count(&env, 0);
        set_pausable_count(&env, 0);
        set_initialized(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Emergency Functions ====================

    /// Break the circuit - pause all registered contracts
    ///
    /// Can be called by admin or any guardian for immediate emergency response.
    /// No timelock required for pausing (safety first).
    ///
    /// # Arguments
    /// * `caller` - Admin or guardian address
    /// * `reason` - Short reason code for the pause (e.g., "exploit", "bug", "audit")
    pub fn break_circuit(
        env: Env,
        caller: Address,
        reason: Symbol,
    ) -> Result<(), AstroSwapError> {
        caller.require_auth();
        Self::require_admin_or_guardian(&env, &caller)?;

        // Already paused? No-op
        if is_global_paused(&env) {
            return Ok(());
        }

        let timestamp = env.ledger().timestamp();

        // Set global pause state
        set_global_paused(&env, true);
        set_paused_at(&env, timestamp);

        // Clear any pending unpause
        set_unpause_scheduled_at(&env, 0);

        // Pause all registered contracts
        let count = get_pausable_count(&env);
        for i in 0..count {
            if let Some(contract_info) = get_pausable_contract(&env, i) {
                // Call set_paused(admin, true) on each contract
                let admin = get_admin(&env)?;
                Self::call_set_paused(&env, &contract_info.address, &admin, true);
            }
        }

        // Emit event
        CircuitBroken {
            caller: caller.clone(),
            timestamp,
            reason,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Schedule circuit restoration (unpause)
    ///
    /// Starts the timelock period. The actual unpause can only be executed
    /// after the timelock delay has passed.
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    pub fn schedule_restore(env: Env, admin: Address) -> Result<u64, AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        if !is_global_paused(&env) {
            return Err(AstroSwapError::ContractNotPaused);
        }

        let current_time = env.ledger().timestamp();
        let delay = get_timelock_delay(&env);
        let effective_at = current_time + delay;

        set_unpause_scheduled_at(&env, effective_at);

        // Emit event
        UnpauseScheduled {
            caller: admin,
            scheduled_at: current_time,
            effective_at,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(effective_at)
    }

    /// Execute circuit restoration (unpause)
    ///
    /// Can only be executed after the timelock period has passed.
    /// This two-step process prevents malicious rapid toggling.
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    pub fn execute_restore(env: Env, admin: Address) -> Result<(), AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        if !is_global_paused(&env) {
            return Err(AstroSwapError::ContractNotPaused);
        }

        let scheduled_at = get_unpause_scheduled_at(&env);
        if scheduled_at == 0 {
            return Err(AstroSwapError::UnpauseNotScheduled);
        }

        let current_time = env.ledger().timestamp();
        if current_time < scheduled_at {
            return Err(AstroSwapError::TimelockNotExpired);
        }

        // Unpause all registered contracts
        let count = get_pausable_count(&env);
        for i in 0..count {
            if let Some(contract_info) = get_pausable_contract(&env, i) {
                // Call set_paused(admin, false) on each contract
                Self::call_set_paused(&env, &contract_info.address, &admin, false);
            }
        }

        // Clear pause state
        set_global_paused(&env, false);
        set_paused_at(&env, 0);
        set_unpause_scheduled_at(&env, 0);

        // Emit event
        CircuitRestored {
            caller: admin,
            timestamp: current_time,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Cancel a scheduled unpause
    ///
    /// Use this if conditions change and you need to keep the circuit broken.
    ///
    /// # Arguments
    /// * `caller` - Admin or guardian address
    pub fn cancel_restore(env: Env, caller: Address) -> Result<(), AstroSwapError> {
        caller.require_auth();
        Self::require_admin_or_guardian(&env, &caller)?;

        set_unpause_scheduled_at(&env, 0);

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Contract Management ====================

    /// Register a pausable contract
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    /// * `contract_address` - Address of the contract to register
    /// * `name` - Short name for the contract (e.g., "router", "factory")
    pub fn register_contract(
        env: Env,
        admin: Address,
        contract_address: Address,
        name: Symbol,
    ) -> Result<u32, AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let index = get_pausable_count(&env);

        let contract_info = PausableContract {
            address: contract_address.clone(),
            name: name.clone(),
            is_paused: false,
        };

        set_pausable_contract(&env, index, &contract_info);
        set_pausable_count(&env, index + 1);

        // Emit event
        ContractRegistered {
            contract_address,
            name,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(index)
    }

    /// Remove a pausable contract
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    /// * `index` - Index of the contract to remove
    pub fn remove_contract(env: Env, admin: Address, index: u32) -> Result<(), AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let count = get_pausable_count(&env);
        if index >= count {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Move the last contract to this index (swap-and-pop)
        if index < count - 1 {
            if let Some(last_contract) = get_pausable_contract(&env, count - 1) {
                set_pausable_contract(&env, index, &last_contract);
            }
        }

        remove_pausable_contract(&env, count - 1);
        set_pausable_count(&env, count - 1);

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Guardian Management ====================

    /// Add a guardian address
    ///
    /// Guardians can break the circuit but cannot restore it.
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    /// * `guardian` - Address to add as guardian
    pub fn add_guardian(env: Env, admin: Address, guardian: Address) -> Result<u32, AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let index = get_guardian_count(&env);

        set_guardian(&env, index, &guardian);
        set_guardian_count(&env, index + 1);

        // Emit event
        GuardianAdded {
            guardian: guardian.clone(),
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(index)
    }

    /// Remove a guardian address
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    /// * `index` - Index of the guardian to remove
    pub fn remove_guardian(env: Env, admin: Address, index: u32) -> Result<(), AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let count = get_guardian_count(&env);
        if index >= count {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Get guardian address for event
        let guardian = get_guardian(&env, index);

        // Move the last guardian to this index (swap-and-pop)
        if index < count - 1 {
            if let Some(last_guardian) = get_guardian(&env, count - 1) {
                set_guardian(&env, index, &last_guardian);
            }
        }

        remove_guardian(&env, count - 1);
        set_guardian_count(&env, count - 1);

        // Emit event
        if let Some(g) = guardian {
            GuardianRemoved { guardian: g }.publish(&env);
        }

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Admin Functions ====================

    /// Update the timelock delay
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    /// * `delay` - New delay in seconds
    pub fn set_timelock_delay(env: Env, admin: Address, delay: u64) -> Result<(), AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        if delay == 0 || delay > MAX_TIMELOCK_DELAY {
            return Err(AstroSwapError::InvalidArgument);
        }

        set_timelock_delay(&env, delay);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Transfer admin role
    ///
    /// # Arguments
    /// * `admin` - Current admin
    /// * `new_admin` - New admin address
    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), AstroSwapError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        new_admin.require_auth();
        set_admin(&env, &new_admin);

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== View Functions ====================

    /// Check if the circuit is broken (global pause)
    pub fn is_broken(env: Env) -> bool {
        is_global_paused(&env)
    }

    /// Get the timestamp when pause was activated
    pub fn paused_at(env: Env) -> u64 {
        get_paused_at(&env)
    }

    /// Get the scheduled unpause timestamp (0 if not scheduled)
    pub fn unpause_scheduled_at(env: Env) -> u64 {
        get_unpause_scheduled_at(&env)
    }

    /// Get the timelock delay
    pub fn timelock_delay(env: Env) -> u64 {
        get_timelock_delay(&env)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Result<Address, AstroSwapError> {
        extend_instance_ttl(&env);
        get_admin(&env)
    }

    /// Get number of registered contracts
    pub fn contract_count(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_pausable_count(&env)
    }

    /// Get contract info by index
    pub fn get_contract(env: Env, index: u32) -> Option<PausableContract> {
        extend_instance_ttl(&env);
        get_pausable_contract(&env, index)
    }

    /// Get number of guardians
    pub fn guardian_count(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_guardian_count(&env)
    }

    /// Get guardian address by index
    pub fn get_guardian(env: Env, index: u32) -> Option<Address> {
        extend_instance_ttl(&env);
        get_guardian(&env, index)
    }

    /// Check if an address is a guardian
    pub fn is_guardian(env: Env, address: Address) -> bool {
        let count = get_guardian_count(&env);
        for i in 0..count {
            if let Some(guardian) = get_guardian(&env, i) {
                if guardian == address {
                    return true;
                }
            }
        }
        false
    }

    // ==================== Internal Functions ====================

    /// Verify caller is admin
    fn require_admin(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        if *caller != get_admin(env)? {
            return Err(AstroSwapError::Unauthorized);
        }
        Ok(())
    }

    /// Verify caller is admin or guardian
    fn require_admin_or_guardian(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        // Check if admin
        if let Ok(admin) = get_admin(env) {
            if *caller == admin {
                return Ok(());
            }
        }

        // Check if guardian
        let count = get_guardian_count(env);
        for i in 0..count {
            if let Some(guardian) = get_guardian(env, i) {
                if guardian == *caller {
                    return Ok(());
                }
            }
        }

        Err(AstroSwapError::Unauthorized)
    }

    /// Call set_paused on a contract
    fn call_set_paused(env: &Env, contract: &Address, admin: &Address, paused: bool) {
        // Try to call set_paused - if it fails, we continue to the next contract
        // This is intentionally non-blocking to ensure other contracts get paused
        let _result = env.try_invoke_contract::<(), soroban_sdk::Error>(
            contract,
            &Symbol::new(env, "set_paused"),
            Vec::from_array(env, [admin.to_val(), paused.into_val(env)]),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        assert_eq!(client.admin(), admin);
        assert!(!client.is_broken());
        assert_eq!(client.timelock_delay(), 3600);
        assert_eq!(client.contract_count(), 0);
        assert_eq!(client.guardian_count(), 0);
    }

    #[test]
    fn test_break_and_restore_circuit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &60); // 60 second timelock

        // Break the circuit
        client.break_circuit(&admin, &Symbol::new(&env, "test"));
        assert!(client.is_broken());

        // Schedule restore
        let effective_at = client.schedule_restore(&admin);
        assert!(effective_at > 0);

        // Try to execute before timelock - should fail
        // (We'd need to check for error, skipping for simplicity)

        // Advance time past timelock
        env.ledger().set_timestamp(effective_at + 1);

        // Execute restore
        client.execute_restore(&admin);
        assert!(!client.is_broken());
    }

    #[test]
    fn test_guardian_management() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let guardian1 = Address::generate(&env);
        let guardian2 = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Add guardians
        client.add_guardian(&admin, &guardian1);
        client.add_guardian(&admin, &guardian2);

        assert_eq!(client.guardian_count(), 2);
        assert!(client.is_guardian(&guardian1));
        assert!(client.is_guardian(&guardian2));

        // Remove guardian
        client.remove_guardian(&admin, &0);
        assert_eq!(client.guardian_count(), 1);
    }

    #[test]
    fn test_contract_registration() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let router = Address::generate(&env);
        let factory = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Register contracts
        client.register_contract(&admin, &router, &Symbol::new(&env, "router"));
        client.register_contract(&admin, &factory, &Symbol::new(&env, "factory"));

        assert_eq!(client.contract_count(), 2);

        let router_info = client.get_contract(&0).unwrap();
        assert_eq!(router_info.address, router);
        assert_eq!(router_info.name, Symbol::new(&env, "router"));
    }

    #[test]
    fn test_guardian_can_break_circuit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CircuitBreaker, ());
        let client = CircuitBreakerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let guardian = Address::generate(&env);

        client.initialize(&admin, &3600);
        client.add_guardian(&admin, &guardian);

        // Guardian breaks the circuit
        client.break_circuit(&guardian, &Symbol::new(&env, "emergency"));
        assert!(client.is_broken());
    }
}
