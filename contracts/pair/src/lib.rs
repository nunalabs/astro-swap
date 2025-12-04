#![no_std]

mod contract;
mod storage;
mod token;

#[cfg(test)]
mod tests;

pub use contract::AstroSwapPair;
