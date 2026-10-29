// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DareEscrow} from "./DareEscrow.sol";

/// @notice Mintable 6-decimal token for tests. Optional callback into the escrow on transfer.
contract TestUSDC {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    DareEscrow public escrow;
    bytes32 public attackId;
    bool public attack;
    bool public attackSucceeded;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _attack();
        return _move(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        return _move(from, to, amount);
    }

    function arm(DareEscrow escrow_, bytes32 id) external {
        escrow = escrow_;
        attackId = id;
        attack = true;
        attackSucceeded = false;
    }

    /// @dev Used when this token is the oracle, so the transfer callback is authorized
    ///      and must be stopped by the reentrancy lock and the settled flag.
    function releaseAsOracle() external {
        escrow.release(attackId);
    }

    function _attack() private {
        if (!attack) return;
        attack = false;
        try escrow.release(attackId) {
            attackSucceeded = true;
        } catch {
            attackSucceeded = false;
        }
    }

    function _move(address from, address to, uint256 amount) private returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
