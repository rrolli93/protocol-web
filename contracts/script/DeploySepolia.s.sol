// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DareEscrow} from "../src/DareEscrow.sol";

/// @notice Deploys DareEscrow on Base Sepolia only. Refuses every other chain, including Base mainnet.
///         Rafael runs this. The agent must not broadcast it.
contract DeploySepolia is Script {
    uint256 internal constant BASE_SEPOLIA = 84532;
    /// @dev Circle USDC on Base Sepolia.
    address internal constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (DareEscrow escrow) {
        require(block.chainid == BASE_SEPOLIA, "Base Sepolia only");
        address oracle = vm.envAddress("DARE_ORACLE");
        address treasury = vm.envAddress("DARE_TREASURY");
        address owner = vm.envAddress("DARE_OWNER");
        vm.startBroadcast();
        escrow = new DareEscrow(USDC_SEPOLIA, oracle, treasury, owner);
        vm.stopBroadcast();
        console2.log("DareEscrow", address(escrow));
    }
}
