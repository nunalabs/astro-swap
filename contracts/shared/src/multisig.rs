//! Multisig Support Module
//!
//! Provides multisig functionality for critical contract operations.
//! Multiple signers must approve a proposal before it can be executed.
//!
//! ## Usage Pattern
//!
//! 1. Admin proposes an action (e.g., set_fee, upgrade_contract)
//! 2. Other signers approve the proposal
//! 3. Once threshold is reached, the action can be executed
//! 4. Proposals expire after a configurable time period
//!
//! ## Security Features
//! - Configurable threshold (e.g., 2 of 3, 3 of 5)
//! - Proposal expiration (prevents stale approvals)
//! - One approval per signer per proposal
//! - Event logging for all actions

use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

use crate::AstroSwapError;

/// Multisig proposal status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Executed,
    Expired,
    Cancelled,
}

/// A multisig proposal
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    /// Unique proposal ID
    pub id: u64,
    /// Proposer address
    pub proposer: Address,
    /// Action to execute (function name)
    pub action: Symbol,
    /// Encoded action parameters
    pub params_hash: u64,
    /// Number of approvals received
    pub approvals: u32,
    /// Addresses that have approved
    pub approved_by: Vec<Address>,
    /// Creation timestamp
    pub created_at: u64,
    /// Expiration timestamp
    pub expires_at: u64,
    /// Current status
    pub status: ProposalStatus,
}

/// Multisig configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultisigConfig {
    /// Required number of approvals
    pub threshold: u32,
    /// Total number of signers
    pub signer_count: u32,
    /// Proposal expiration time in seconds (default: 7 days)
    pub proposal_ttl: u64,
}

/// Default proposal TTL: 7 days
pub const DEFAULT_PROPOSAL_TTL: u64 = 7 * 24 * 60 * 60;

/// Maximum proposal TTL: 30 days
pub const MAX_PROPOSAL_TTL: u64 = 30 * 24 * 60 * 60;

/// Minimum threshold: 1
pub const MIN_THRESHOLD: u32 = 1;

/// Maximum signers: 10
pub const MAX_SIGNERS: u32 = 10;

/// Storage key prefix for multisig data
#[contracttype]
#[derive(Clone)]
pub enum MultisigKey {
    /// Multisig configuration
    Config,
    /// Next proposal ID counter
    NextProposalId,
    /// Signer address by index
    Signer(u32),
    /// Proposal by ID
    Proposal(u64),
    /// Active proposal count
    ActiveProposalCount,
}

/// Multisig helper functions
pub struct Multisig;

impl Multisig {
    // ==================== Configuration ====================

    /// Initialize multisig configuration
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `signers` - Initial list of signers
    /// * `threshold` - Required number of approvals
    /// * `proposal_ttl` - Proposal expiration time in seconds
    pub fn initialize(
        env: &Env,
        signers: &Vec<Address>,
        threshold: u32,
        proposal_ttl: u64,
    ) -> Result<(), AstroSwapError> {
        // Validate inputs
        let signer_count = signers.len();

        if signer_count == 0 || signer_count > MAX_SIGNERS {
            return Err(AstroSwapError::InvalidArgument);
        }

        if threshold < MIN_THRESHOLD || threshold > signer_count {
            return Err(AstroSwapError::InvalidArgument);
        }

        let ttl = if proposal_ttl == 0 {
            DEFAULT_PROPOSAL_TTL
        } else if proposal_ttl > MAX_PROPOSAL_TTL {
            return Err(AstroSwapError::InvalidArgument);
        } else {
            proposal_ttl
        };

        // Store signers
        for i in 0..signer_count {
            if let Some(signer) = signers.get(i) {
                env.storage()
                    .instance()
                    .set(&MultisigKey::Signer(i), &signer);
            }
        }

        // Store configuration
        let config = MultisigConfig {
            threshold,
            signer_count,
            proposal_ttl: ttl,
        };
        env.storage().instance().set(&MultisigKey::Config, &config);
        env.storage().instance().set(&MultisigKey::NextProposalId, &0u64);
        env.storage().instance().set(&MultisigKey::ActiveProposalCount, &0u32);

        Ok(())
    }

    /// Get multisig configuration
    pub fn get_config(env: &Env) -> Option<MultisigConfig> {
        env.storage()
            .instance()
            .get::<MultisigKey, MultisigConfig>(&MultisigKey::Config)
    }

    /// Check if an address is a signer
    pub fn is_signer(env: &Env, address: &Address) -> bool {
        if let Some(config) = Self::get_config(env) {
            for i in 0..config.signer_count {
                if let Some(signer) = Self::get_signer(env, i) {
                    if signer == *address {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Get signer by index
    pub fn get_signer(env: &Env, index: u32) -> Option<Address> {
        env.storage()
            .instance()
            .get::<MultisigKey, Address>(&MultisigKey::Signer(index))
    }

    /// Add a new signer (requires multisig approval)
    pub fn add_signer(env: &Env, new_signer: &Address) -> Result<(), AstroSwapError> {
        let mut config = Self::get_config(env).ok_or(AstroSwapError::NotInitialized)?;

        if config.signer_count >= MAX_SIGNERS {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Check not already a signer
        if Self::is_signer(env, new_signer) {
            return Err(AstroSwapError::InvalidArgument);
        }

        let new_index = config.signer_count;
        env.storage()
            .instance()
            .set(&MultisigKey::Signer(new_index), new_signer);

        config.signer_count += 1;
        env.storage().instance().set(&MultisigKey::Config, &config);

        Ok(())
    }

    /// Update threshold (requires multisig approval)
    pub fn set_threshold(env: &Env, new_threshold: u32) -> Result<(), AstroSwapError> {
        let mut config = Self::get_config(env).ok_or(AstroSwapError::NotInitialized)?;

        if new_threshold < MIN_THRESHOLD || new_threshold > config.signer_count {
            return Err(AstroSwapError::InvalidArgument);
        }

        config.threshold = new_threshold;
        env.storage().instance().set(&MultisigKey::Config, &config);

        Ok(())
    }

    // ==================== Proposal Management ====================

    /// Create a new proposal
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `proposer` - Address creating the proposal
    /// * `action` - Function name to execute
    /// * `params_hash` - Hash of parameters (for verification)
    pub fn create_proposal(
        env: &Env,
        proposer: &Address,
        action: Symbol,
        params_hash: u64,
    ) -> Result<u64, AstroSwapError> {
        // Verify proposer is a signer
        if !Self::is_signer(env, proposer) {
            return Err(AstroSwapError::Unauthorized);
        }

        let config = Self::get_config(env).ok_or(AstroSwapError::NotInitialized)?;

        // Get next proposal ID
        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&MultisigKey::NextProposalId)
            .unwrap_or(0);

        let current_time = env.ledger().timestamp();
        let expires_at = current_time + config.proposal_ttl;

        // Create proposal with proposer's approval included
        let mut approved_by = Vec::new(env);
        approved_by.push_back(proposer.clone());

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            action,
            params_hash,
            approvals: 1, // Proposer counts as first approval
            approved_by,
            created_at: current_time,
            expires_at,
            status: ProposalStatus::Pending,
        };

        // Store proposal
        env.storage()
            .persistent()
            .set(&MultisigKey::Proposal(proposal_id), &proposal);

        // Increment counters
        env.storage()
            .instance()
            .set(&MultisigKey::NextProposalId, &(proposal_id + 1));

        let active_count: u32 = env
            .storage()
            .instance()
            .get(&MultisigKey::ActiveProposalCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&MultisigKey::ActiveProposalCount, &(active_count + 1));

        Ok(proposal_id)
    }

    /// Approve a proposal
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `approver` - Address approving
    /// * `proposal_id` - Proposal to approve
    pub fn approve_proposal(
        env: &Env,
        approver: &Address,
        proposal_id: u64,
    ) -> Result<bool, AstroSwapError> {
        // Verify approver is a signer
        if !Self::is_signer(env, approver) {
            return Err(AstroSwapError::Unauthorized);
        }

        let mut proposal = Self::get_proposal(env, proposal_id)
            .ok_or(AstroSwapError::InvalidArgument)?;

        // Check proposal is still pending
        if proposal.status != ProposalStatus::Pending {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Check not expired
        let current_time = env.ledger().timestamp();
        if current_time > proposal.expires_at {
            proposal.status = ProposalStatus::Expired;
            env.storage()
                .persistent()
                .set(&MultisigKey::Proposal(proposal_id), &proposal);
            return Err(AstroSwapError::DeadlineExpired);
        }

        // Check not already approved by this signer
        for i in 0..proposal.approved_by.len() {
            if let Some(addr) = proposal.approved_by.get(i) {
                if addr == *approver {
                    return Err(AstroSwapError::InvalidArgument);
                }
            }
        }

        // Add approval
        proposal.approved_by.push_back(approver.clone());
        proposal.approvals += 1;

        // Check if threshold reached
        let config = Self::get_config(env).ok_or(AstroSwapError::NotInitialized)?;
        let is_approved = proposal.approvals >= config.threshold;

        if is_approved {
            proposal.status = ProposalStatus::Approved;
        }

        // Save proposal
        env.storage()
            .persistent()
            .set(&MultisigKey::Proposal(proposal_id), &proposal);

        Ok(is_approved)
    }

    /// Mark proposal as executed
    pub fn mark_executed(env: &Env, proposal_id: u64) -> Result<(), AstroSwapError> {
        let mut proposal = Self::get_proposal(env, proposal_id)
            .ok_or(AstroSwapError::InvalidArgument)?;

        if proposal.status != ProposalStatus::Approved {
            return Err(AstroSwapError::InvalidArgument);
        }

        proposal.status = ProposalStatus::Executed;
        env.storage()
            .persistent()
            .set(&MultisigKey::Proposal(proposal_id), &proposal);

        // Decrement active count
        let active_count: u32 = env
            .storage()
            .instance()
            .get(&MultisigKey::ActiveProposalCount)
            .unwrap_or(1);
        if active_count > 0 {
            env.storage()
                .instance()
                .set(&MultisigKey::ActiveProposalCount, &(active_count - 1));
        }

        Ok(())
    }

    /// Cancel a proposal (only proposer or after expiry)
    pub fn cancel_proposal(
        env: &Env,
        caller: &Address,
        proposal_id: u64,
    ) -> Result<(), AstroSwapError> {
        let mut proposal = Self::get_proposal(env, proposal_id)
            .ok_or(AstroSwapError::InvalidArgument)?;

        // Only proposer can cancel before expiry
        let current_time = env.ledger().timestamp();
        if *caller != proposal.proposer && current_time <= proposal.expires_at {
            return Err(AstroSwapError::Unauthorized);
        }

        if proposal.status != ProposalStatus::Pending {
            return Err(AstroSwapError::InvalidArgument);
        }

        proposal.status = ProposalStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&MultisigKey::Proposal(proposal_id), &proposal);

        // Decrement active count
        let active_count: u32 = env
            .storage()
            .instance()
            .get(&MultisigKey::ActiveProposalCount)
            .unwrap_or(1);
        if active_count > 0 {
            env.storage()
                .instance()
                .set(&MultisigKey::ActiveProposalCount, &(active_count - 1));
        }

        Ok(())
    }

    /// Get a proposal by ID
    pub fn get_proposal(env: &Env, proposal_id: u64) -> Option<Proposal> {
        env.storage()
            .persistent()
            .get::<MultisigKey, Proposal>(&MultisigKey::Proposal(proposal_id))
    }

    /// Check if a proposal is approved and ready for execution
    pub fn is_proposal_approved(env: &Env, proposal_id: u64) -> bool {
        if let Some(proposal) = Self::get_proposal(env, proposal_id) {
            proposal.status == ProposalStatus::Approved
        } else {
            false
        }
    }

    /// Get number of active proposals
    pub fn active_proposal_count(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&MultisigKey::ActiveProposalCount)
            .unwrap_or(0)
    }

    /// Verify a proposal matches expected parameters
    ///
    /// This is used when executing to ensure the proposal matches
    /// what the executor expects to execute.
    pub fn verify_proposal(
        env: &Env,
        proposal_id: u64,
        expected_action: &Symbol,
        expected_params_hash: u64,
    ) -> Result<(), AstroSwapError> {
        let proposal = Self::get_proposal(env, proposal_id)
            .ok_or(AstroSwapError::InvalidArgument)?;

        if proposal.status != ProposalStatus::Approved {
            return Err(AstroSwapError::InvalidArgument);
        }

        if proposal.action != *expected_action {
            return Err(AstroSwapError::InvalidArgument);
        }

        if proposal.params_hash != expected_params_hash {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Check not expired
        let current_time = env.ledger().timestamp();
        if current_time > proposal.expires_at {
            return Err(AstroSwapError::DeadlineExpired);
        }

        Ok(())
    }
}

// Multisig tests are covered through contract integration tests
// Direct module tests require contract context (env.as_contract())
// See contracts/tests for integration tests
