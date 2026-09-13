pub mod predicates;
pub mod pb {
    include!(concat!(env!("OUT_DIR"), "/provenance.v1.rs"));
}
use num_bigint::BigInt;
use num_traits::Zero;
use pb::{Event, Events, Reward, Rewards};
use sha3::{Digest, Keccak256};
use std::collections::BTreeMap;
use substreams::{errors::Error, store::*};
use substreams_entity_change::{pb::entity::EntityChanges, tables::Tables};
use substreams_ethereum::pb::eth::v2::Block;
fn sig(s: &str) -> Vec<u8> {
    Keccak256::digest(s.as_bytes()).to_vec()
}
fn hx(v: &[u8]) -> String {
    format!("0x{}", hex::encode(v))
}
fn dec(v: &[u8]) -> String {
    BigInt::from_bytes_be(num_bigint::Sign::Plus, v).to_string()
}
fn n(v: &str) -> BigInt {
    v.parse().expect("validated decimal")
}
fn key(e: &Event) -> String {
    format!("{}:{}", e.agent_node, e.instrument_id)
}
// params: desk=<address>&marks=<address>&authority=<comma-separated addresses>
#[substreams::handlers::map]
pub fn map_events(params: String, block: Block) -> Result<Events, Error> {
    extract_events(params, block)
}
pub fn extract_events(params: String, block: Block) -> Result<Events, Error> {
    let config: BTreeMap<_, _> = params
        .split('&')
        .filter_map(|s| s.split_once('='))
        .collect();
    let desk = hex::decode(
        config
            .get("desk")
            .ok_or_else(|| Error::msg("desk required"))?
            .trim_start_matches("0x"),
    )?;
    let marks = hex::decode(
        config
            .get("marks")
            .ok_or_else(|| Error::msg("marks required"))?
            .trim_start_matches("0x"),
    )?;
    if desk.len() != 20
        || marks.len() != 20
        || desk.iter().all(|b| *b == 0)
        || marks.iter().all(|b| *b == 0)
    {
        return Err(Error::msg("nonzero deployed addresses required"));
    }
    let authorities: Vec<Vec<u8>> = config
        .get("authority")
        .unwrap_or(&"")
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| hex::decode(s.trim_start_matches("0x")))
        .collect::<Result<_, _>>()?;
    let mut out = Events {
        block: block.number,
        timestamp: block
            .header
            .as_ref()
            .and_then(|h| h.timestamp.as_ref())
            .ok_or_else(|| Error::msg("missing timestamp"))?
            .seconds as u64,
        block_hash: hx(&block.hash),
        events: vec![],
    };
    for view in block.logs() {
        let l = view.log;
        let t = &l.topics;
        if t.is_empty() {
            continue;
        }
        let mut e = Event {
            ordinal: l.ordinal,
            tx_hash: hx(&view.receipt.transaction.hash),
            ..Default::default()
        };
        if l.address == desk {
            if t[0] == sig("Intent(bytes32,bytes32,bytes32,uint8,uint256,uint256,uint16,uint48)")
                && t.len() == 4
                && l.data.len() == 160
            {
                e.kind = "intent".into();
                e.intent_id = hx(&t[1]);
                e.agent_node = hx(&t[2]);
                e.instrument_id = hx(&t[3]);
                e.values = l.data.chunks_exact(32).map(dec).collect();
            } else if t[0]
                == sig("Fill(bytes32,bytes32,bytes32,bytes32,uint256,uint256,uint256,uint256)")
                && t.len() == 4
                && l.data.len() == 160
            {
                e.kind = "fill".into();
                e.intent_id = hx(&t[1]);
                e.fill_id = hx(&t[2]);
                e.agent_node = hx(&t[3]);
                e.instrument_id = hx(&l.data[..32]);
                e.values = l.data[32..].chunks_exact(32).map(dec).collect();
            } else if t[0]
                == sig("MandateSnapshot(bytes32,bytes32,bool,uint48,uint256,uint256,bool)")
                && t.len() == 3
                && l.data.len() == 160
            {
                e.kind = "mandate".into();
                e.agent_node = hx(&t[1]);
                e.instrument_id = hx(&t[2]);
                e.values = l.data.chunks_exact(32).map(dec).collect();
            } else if t[0] == sig("Settlement(bytes32,uint256,uint256)")
                && t.len() == 2
                && l.data.len() == 64
            {
                e.kind = "settlement".into();
                e.intent_id = hx(&t[1]);
                e.values = l.data.chunks_exact(32).map(dec).collect();
            } else {
                continue;
            }
        } else if l.address == marks
            && t[0] == sig("PriceMark(bytes32,uint256,uint48)")
            && t.len() == 2
            && l.data.len() == 64
        {
            e.kind = "mark".into();
            e.instrument_id = hx(&t[1]);
            e.values = l.data.chunks_exact(32).map(dec).collect();
        } else if authorities.contains(&l.address) {
            // Preserve ENS EAC/resolver events verbatim, scoped by emitter and indexed resources.
            e.kind = "authority".into();
            e.agent_node = hx(&l.address);
            e.instrument_id = t.iter().map(|v| hx(v)).collect::<Vec<_>>().join(":");
            e.values = vec![hx(&l.data)];
        } else {
            continue;
        }
        out.events.push(e);
    }
    out.events.sort_by_key(|e| e.ordinal);
    Ok(out)
}
#[substreams::handlers::store]
pub fn store_marks(events: Events, store: StoreSetString) {
    for e in events.events {
        if e.kind == "mark" {
            store.set(e.ordinal, e.instrument_id, &e.values.join(":"));
        }
    }
}
#[substreams::handlers::store]
pub fn store_mandates(events: Events, store: StoreSetString) {
    for e in events.events {
        if e.kind == "authority" {
            store.set(e.ordinal, format!("raw:{}", key(&e)), &e.values[0]);
        } else if e.kind == "mandate" {
            store.set(e.ordinal, key(&e), &e.values.join(":"));
        }
    }
}
fn pairs(events: &Events) -> Vec<(&Event, &Event, &Event)> {
    let mut intents = BTreeMap::new();
    let mut settlements = BTreeMap::new();
    let mut out = vec![];
    for e in &events.events {
        let id = (&e.tx_hash, &e.intent_id);
        match e.kind.as_str() {
            "intent" => {
                intents.insert(id, e);
            }
            "settlement" => {
                settlements.insert(id, e);
            }
            "fill" => {
                if let (Some(i), Some(s)) = (intents.remove(&id), settlements.remove(&id)) {
                    if i.agent_node == e.agent_node
                        && i.instrument_id == e.instrument_id
                        && i.values[1] == e.values[0]
                    {
                        out.push((i, s, e));
                    }
                }
            }
            _ => {}
        }
    }
    out
}
#[substreams::handlers::store]
pub fn store_positions(events: Events, store: StoreAddBigInt) {
    for (i, s, f) in pairs(&events) {
        let amount = n(&s.values[0]);
        let delta = if i.values[0] == "0" { amount } else { -amount };
        store.add(f.ordinal, key(f), substreams::scalar::BigInt::from(delta));
    }
}
#[substreams::handlers::map]
pub fn map_rewards(
    events: Events,
    positions: StoreGetBigInt,
    marks: StoreGetString,
    mandates: StoreGetString,
) -> Result<Rewards, Error> {
    let mut rewards = vec![];
    for (i, _s, f) in pairs(&events) {
        let after = n(&positions
            .get_at(f.ordinal, key(f))
            .map(|v| v.to_string())
            .unwrap_or("0".into()));
        let before = n(&positions
            .get_at(f.ordinal.saturating_sub(1), key(f))
            .map(|v| v.to_string())
            .unwrap_or("0".into()));
        let mark = marks
            .get_at(f.ordinal, &f.instrument_id)
            .unwrap_or("0:0".into());
        let (price, time) = mark
            .split_once(':')
            .ok_or_else(|| Error::msg("invalid mark"))?;
        let hedge = predicates::hedge(&before, &after);
        let slippage = predicates::slippage(
            i.values[0].parse()?,
            &n(&i.values[2]),
            &n(&f.values[1]),
            i.values[3].parse()?,
        );
        let snapshot = mandates
            .get_at(f.ordinal, key(f))
            .unwrap_or("0:0:0:0:0".into());
        let values: Vec<&str> = snapshot.split(':').collect();
        if values.len() != 5 {
            return Err(Error::msg("invalid mandate snapshot"));
        }
        let mandate = if values[0] == "1"
            && values[4] == "1"
            && events.timestamp < values[1].parse::<u64>()?
            && events.timestamp <= i.values[4].parse::<u64>()?
            && n(&f.values[0]) <= n(values[2])
            && n(&i.values[3]) <= n(values[3])
        {
            10000
        } else {
            0
        };
        let staleness = if n(price) > BigInt::zero() {
            predicates::freshness(events.timestamp, time.parse()?, 60)
        } else {
            0
        };
        rewards.push(Reward {
            id: f.fill_id.clone(),
            agent_node: f.agent_node.clone(),
            instrument_id: f.instrument_id.clone(),
            block: events.block,
            block_hash: events.block_hash.clone(),
            tx_hash: f.tx_hash.clone(),
            hedge,
            slippage,
            mandate,
            staleness,
            route_regret: 0,
            route_regret_stub: true,
            verified: predicates::verified(hedge, slippage, mandate, staleness),
            position: after.to_string(),
            mark: price.into(),
            intent_id: f.intent_id.clone(),
            ordinal: f.ordinal,
        });
    }
    Ok(Rewards { rewards })
}
#[substreams::handlers::map]
pub fn graph_out(rewards: Rewards) -> Result<EntityChanges, Error> {
    entity_changes(rewards)
}
pub fn entity_changes(rewards: Rewards) -> Result<EntityChanges, Error> {
    let mut tables = Tables::new();
    for r in rewards.rewards {
        tables
            .create_row("Reward", &r.id)
            .set("agentNode", r.agent_node)
            .set("instrumentId", r.instrument_id)
            .set("block", substreams::scalar::BigInt::from(r.block))
            .set("blockHash", r.block_hash)
            .set("txHash", r.tx_hash)
            .set("hedge", r.hedge)
            .set("slippage", r.slippage)
            .set("mandate", r.mandate)
            .set("staleness", r.staleness)
            .set("routeRegret", r.route_regret)
            .set("routeRegretStub", r.route_regret_stub)
            .set("verified", r.verified)
            .set("position", r.position)
            .set("mark", r.mark)
            .set("intentId", r.intent_id);
    }
    let mut changes = tables.to_entity_changes();
    // Tables uses HashMaps internally; canonicalize protobuf repeated fields explicitly.
    changes.entity_changes.sort_by(|a, b| a.id.cmp(&b.id));
    for e in &mut changes.entity_changes {
        e.fields.sort_by(|a, b| a.name.cmp(&b.name));
    }
    Ok(changes)
}
#[cfg(test)]
mod tests {
    use super::*;
    use prost::Message;
    #[test]
    fn matching_requires_same_transaction_and_agent() {
        let i = Event {
            kind: "intent".into(),
            intent_id: "1".into(),
            agent_node: "a".into(),
            tx_hash: "tx".into(),
            values: vec!["0".into(), "10".into()],
            ..Default::default()
        };
        let s = Event {
            kind: "settlement".into(),
            intent_id: "1".into(),
            tx_hash: "tx".into(),
            ..Default::default()
        };
        let mut f = Event {
            kind: "fill".into(),
            intent_id: "1".into(),
            agent_node: "a".into(),
            tx_hash: "other".into(),
            values: vec!["10".into()],
            ..Default::default()
        };
        assert!(pairs(&Events {
            events: vec![i.clone(), s.clone(), f.clone()],
            ..Default::default()
        })
        .is_empty());
        f.tx_hash = "tx".into();
        assert_eq!(
            pairs(&Events {
                events: vec![i, s, f],
                ..Default::default()
            })
            .len(),
            1
        );
    }
    #[test]
    fn entity_output_is_byte_identical() {
        let input = Rewards {
            rewards: (0..10)
                .map(|i| Reward {
                    id: i.to_string(),
                    ..Default::default()
                })
                .collect(),
        };
        assert_eq!(
            entity_changes(input.clone()).unwrap().encode_to_vec(),
            entity_changes(input).unwrap().encode_to_vec()
        );
    }
}

#[cfg(test)]
mod decoding_tests {
    use super::*;
    use substreams_ethereum::pb::eth::v2::{
        BlockHeader, Log, TransactionReceipt, TransactionTrace,
    };
    fn word(v: u64) -> Vec<u8> {
        let mut w = vec![0u8; 24];
        w.extend_from_slice(&v.to_be_bytes());
        w
    }
    #[test]
    fn decode_real_abi_layout_and_ignore_failed_transactions() {
        let desk = vec![1u8; 20];
        let agent = vec![2u8; 32];
        let instrument = vec![3u8; 32];
        let intent = vec![4u8; 32];
        let log = Log {
            address: desk.clone(),
            topics: vec![
                sig("Intent(bytes32,bytes32,bytes32,uint8,uint256,uint256,uint16,uint48)"),
                intent,
                agent.clone(),
                instrument,
            ],
            data: [word(0), word(10), word(100), word(50), word(1000)].concat(),
            ordinal: 7,
            ..Default::default()
        };
        let tx = TransactionTrace {
            status: 1,
            hash: vec![5; 32],
            receipt: Some(TransactionReceipt {
                logs: vec![log],
                ..Default::default()
            }),
            ..Default::default()
        };
        let block = Block {
            number: 42,
            hash: vec![6; 32],
            header: Some(BlockHeader {
                timestamp: Some(prost_types::Timestamp {
                    seconds: 100,
                    nanos: 0,
                }),
                ..Default::default()
            }),
            transaction_traces: vec![tx],
            ..Default::default()
        };
        let params = format!("desk={}&marks={}&authority=", hx(&desk), hx(&[7u8; 20]));
        let output = extract_events(params.clone(), block.clone()).unwrap();
        assert_eq!(output.events.len(), 1);
        assert_eq!(output.events[0].agent_node, hx(&agent));
        assert_eq!(
            output.events[0].values,
            vec!["0", "10", "100", "50", "1000"]
        );
        let mut failed = block;
        failed.transaction_traces[0].status = 2;
        assert!(extract_events(params, failed).unwrap().events.is_empty());
    }
    #[test]
    fn empty_configuration_fails_closed() {
        assert!(extract_events(
            "desk=PLACEHOLDER&marks=PLACEHOLDER".into(),
            Block::default()
        )
        .is_err());
    }
}
