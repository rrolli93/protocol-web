# DareEscrow security review

Reviewed against the parked `ProtocolEscrow` (ABI in `lib/contracts.ts`, behaviour described in the product spec). That contract is a pooled-stake game: every player deposits, the oracle names winners, and the pot is split. It is the wrong shape for Dare, so it is not deployed and not called. `DareEscrow` is a new contract that keeps only the ideas that still fit: a `bytes32` id, an ERC-20 (USDC), an oracle, and a treasury.

No audit firm has reviewed this. It is testnet-only (Base Sepolia). Do not point it at mainnet USDC.

## What was wrong with ProtocolEscrow

| Finding | Why it matters for Dare |
|---|---|
| Creator can `cancel()` any time before resolve, including after the end | A losing side can unwind the dare. Dare has no “creator cancel after funding”. |
| `resolve()` reverts when there are zero winners | A miss has no path. Dare must refund or donate. |
| `transfer` return values ignored | A false return can look like a payment. |
| Unbounded loops over participants | One stuck recipient can trap the whole pot. |
| One EOA oracle names any winner | Same trust remains, but the new contract pays only the recorded doer, the funders, or the recorded charity. |
| No pause, no two-step ownership | Both are in `DareEscrow`. |
| Division dust stuck in the contract | Fee is `bounty * bps / 10_000` and net is the remainder, so fee + net = bounty. |

## What DareEscrow does

- **Doer never deposits.** `fund` reverts if `msg.sender` is the doer. `accept` reverts if that address already has a deposit. `accept` pulls no tokens.
- **Who settles.** `release`, `refund`, and `donate` are `onlyOracle`. The owner cannot release to themselves. A stranger cannot settle.
- **Once.** `outcome` starts at `None`. The first successful settle writes `Released`, `Refunded`, or `Donated` before any token move. A second call reverts `Settled`.
- **Reentrancy.** A lock wraps every function that moves tokens. Deposits are increased only after the balance check on the way in, and a claim zeroes the deposit before the payout. A callback token armed as the oracle cannot release twice (Foundry test).
- **Fee only on success.** `release` pays the doer `bounty - fee` and the treasury the fee, capped at 10% (`MAX_FEE_BPS`). `donate` sends the full bounty to the charity recorded at open. `refund` sends nothing to the treasury.
- **Refunds are pull.** `refund` and `adminRefund` only flip the outcome. Each funder calls `claimRefund` for their own balance. One bad recipient cannot block the others. `adminRefund` cannot retarget funds to the owner.
- **Timeout.** `refundAfter = deadline + grace` (grace 1–30 days). After that, anyone can `claimRefund` without the oracle. The first such call opens refunds, which also blocks a late `release`. Funds are not stuck if the oracle disappears.
- **Pause** blocks new `openDare` and `fund`. It does not block `claimRefund` after the timeout.
- **Ownership** is two-step.
- **Fee-on-transfer tokens** are rejected: `fund` requires the contract’s balance to rise by exactly `amount`.
- **Windows.** A dare lasts between 1 hour and 30 days. Fee above 10% reverts.

## Remaining risks

- **Oracle key.** One address can `release`, `refund`, or `donate` while the dare is open. A leaked testnet key can pay the recorded doer or refund. It cannot invent a new recipient on `release` (the doer was set by `accept`) and cannot donate unless charity-on-fail was set at open. A multisig oracle is future work. This is not mainnet-ready.
- **Owner can `setOracle` and `setTreasury`.** A compromised owner can point the fee at a new treasury, or point the oracle at themselves and then `release`. They still cannot change the doer after `accept`. Treat the owner like the oracle: a hardware wallet, testnet only.
- **Timeout always refunds.** If the oracle never calls `donate`, funders get their USDC back after the grace period. Charity is not an automatic timeout. That is deliberate so a dead oracle cannot send money to a charity the funder can no longer stop.
- **No on-chain proof.** The oracle is trusted to match the app’s review. The contract does not see the video.
- **USDC blacklist / pause.** Circle can freeze a USDC holder. A frozen doer or funder can fail a transfer. `release` would revert and can be retried; refunds stay pull-based so other funders still exit.
- **No formal audit, no bug bounty, no mainnet deployment.** Fuzz tests cover fee identity, single release, and exact refunds (256 runs locally, 128 in the Foundry default profile here). That is not an audit.
- **Wallet UX.** The app asks the browser wallet to switch to chain 84532 and refuses chain 8453 before `eth_sendTransaction`. A modified wallet could ignore that. The contract itself has no chain check; the deploy script does (`require(block.chainid == 84532)`).

## Deploy (Rafael, not this agent)

See `contracts/script/DeploySepolia.s.sol` and the USDC section of `DEPLOY.md`. Broadcasting needs a Sepolia key and test ETH. This repository’s CI only runs `forge test`.
