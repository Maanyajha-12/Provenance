use num_bigint::BigInt;
use num_traits::{Signed, ToPrimitive, Zero};
pub fn hedge(before: &BigInt, after: &BigInt) -> i32 {
    if before.is_zero() {
        return if after.is_zero() { 10000 } else { 0 };
    }
    (((before.abs() - after.abs()) * BigInt::from(10000)) / before.abs())
        .to_i32()
        .unwrap_or(-10000)
        .clamp(-10000, 10000)
}
pub fn slippage(side: u8, limit: &BigInt, price: &BigInt, cap: u32) -> i32 {
    if limit <= &BigInt::zero() || price <= &BigInt::zero() || cap >= 10000 {
        return 0;
    }
    // Desk declares minimum received amount, so buy's maximum price is limit/(1-cap).
    let ok = if side == 0 {
        price * BigInt::from(10000 - cap) <= limit * BigInt::from(10000)
    } else {
        price * BigInt::from(10000) >= limit * BigInt::from(10000 - cap)
    };
    if ok {
        10000
    } else {
        0
    }
}
pub fn freshness(now: u64, mark_time: u64, max_age: u64) -> i32 {
    if mark_time > 0 && mark_time <= now && now - mark_time <= max_age {
        10000
    } else {
        0
    }
}
pub fn verified(hedge: i32, slippage: i32, mandate: i32, staleness: i32) -> i32 {
    ((hedge + 10000) / 2 + slippage + mandate + staleness) / 4
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded() {
        assert_eq!(hedge(&10.into(), &5.into()), 5000);
        assert_eq!(hedge(&1.into(), &100000.into()), -10000);
        assert_eq!(hedge(&0.into(), &1.into()), 0);
    }
    #[test]
    fn limits() {
        assert_eq!(slippage(0, &100.into(), &101.into(), 100), 10000);
        assert_eq!(slippage(1, &100.into(), &98.into(), 100), 0);
        assert_eq!(freshness(100, 101, 60), 0);
        assert_eq!(freshness(100, 1, 60), 0);
    }
}
