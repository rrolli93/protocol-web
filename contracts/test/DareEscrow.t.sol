// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {DareEscrow} from "../src/DareEscrow.sol";
import {TestUSDC} from "../src/TestUSDC.sol";

contract DareEscrowTest is Test {
    DareEscrow internal escrow;
    TestUSDC internal usdc;
    address internal oracle = makeAddr("oracle");
    address internal treasury = makeAddr("treasury");
    address internal owner = makeAddr("owner");
    address internal funder = makeAddr("funder");
    address internal funderTwo = makeAddr("funderTwo");
    address internal doer = makeAddr("doer");
    address internal charity = makeAddr("charity");
    bytes32 internal id = keccak256("dare");

    uint64 internal deadline;
    uint64 internal grace = 7 days;

    function setUp() public {
        usdc = new TestUSDC();
        escrow = new DareEscrow(address(usdc), oracle, treasury, owner);
        deadline = uint64(block.timestamp + 2 days);
        usdc.mint(funder, 1_000_000e6);
        usdc.mint(funderTwo, 1_000_000e6);
        vm.prank(funder);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(funderTwo);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _open(bool charityOnFail, uint16 feeBps) internal {
        escrow.openDare(id, charityOnFail ? charity : address(0), charityOnFail, deadline, grace, feeBps, 100e6);
    }

    function test_doerNeverDeposits() public {
        _open(false, 1_000);
        vm.prank(doer);
        escrow.accept(id);
        vm.prank(funder);
        escrow.fund(id, 20e6);
        vm.prank(doer);
        usdc.mint(doer, 20e6);
        vm.prank(doer);
        usdc.approve(address(escrow), 20e6);
        vm.prank(doer);
        vm.expectRevert(DareEscrow.DoerCannotFund.selector);
        escrow.fund(id, 1e6);
    }

    function test_funderCannotBecomeDoer() public {
        _open(false, 1_000);
        vm.prank(funder);
        escrow.fund(id, 20e6);
        vm.prank(funder);
        vm.expectRevert(DareEscrow.DoerHasDeposit.selector);
        escrow.accept(id);
    }

    function test_releasePaysDoerMinusFeeExactlyOnce() public {
        _open(false, 1_000);
        vm.prank(doer);
        escrow.accept(id);
        vm.prank(funder);
        escrow.fund(id, 20e6);

        vm.prank(oracle);
        escrow.release(id);

        assertEq(usdc.balanceOf(doer), 18e6);
        assertEq(usdc.balanceOf(treasury), 2e6);
        assertEq(uint256(escrow.dares(id).outcome), uint256(DareEscrow.Outcome.Released));

        vm.prank(oracle);
        vm.expectRevert(DareEscrow.Settled.selector);
        escrow.release(id);
        vm.prank(oracle);
        vm.expectRevert(DareEscrow.Settled.selector);
        escrow.refund(id);
        vm.prank(oracle);
        vm.expectRevert(DareEscrow.Settled.selector);
        escrow.donate(id);
    }

    function test_strangerCannotSettle() public {
        _open(false, 1_000);
        vm.prank(doer);
        escrow.accept(id);
        vm.prank(funder);
        escrow.fund(id, 20e6);
        vm.prank(funder);
        vm.expectRevert(DareEscrow.NotOracle.selector);
        escrow.release(id);
        vm.prank(owner);
        vm.expectRevert(DareEscrow.NotOracle.selector);
        escrow.release(id);
    }

    function test_refundIsPullAndClaimableOnce() public {
        _open(false, 1_000);
        vm.prank(funder);
        escrow.fund(id, 12e6);
        vm.prank(funderTwo);
        escrow.fund(id, 8e6);
        vm.prank(oracle);
        escrow.refund(id);

        vm.prank(funder);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(funder), 1_000_000e6);
        vm.prank(funder);
        vm.expectRevert(DareEscrow.NothingToClaim.selector);
        escrow.claimRefund(id);

        vm.prank(funderTwo);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(funderTwo), 1_000_000e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_donateSendsFullBountyAndNoFee() public {
        _open(true, 1_000);
        vm.prank(funder);
        escrow.fund(id, 25e6);
        vm.prank(oracle);
        escrow.donate(id);
        assertEq(usdc.balanceOf(charity), 25e6);
        assertEq(usdc.balanceOf(treasury), 0);
        vm.prank(oracle);
        vm.expectRevert(DareEscrow.Settled.selector);
        escrow.donate(id);
    }

    function test_donateRequiresCharityFlag() public {
        _open(false, 1_000);
        vm.prank(funder);
        escrow.fund(id, 10e6);
        vm.prank(oracle);
        vm.expectRevert(DareEscrow.NoCharity.selector);
        escrow.donate(id);
    }

    function test_timeoutRefundDoesNotNeedOracle() public {
        _open(false, 1_000);
        vm.prank(funder);
        escrow.fund(id, 15e6);
        vm.expectRevert(DareEscrow.TooEarly.selector);
        vm.prank(funder);
        escrow.claimRefund(id);

        vm.warp(deadline + grace);
        vm.prank(funder);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(funder), 1_000_000e6);

        vm.prank(oracle);
        vm.expectRevert(DareEscrow.Settled.selector);
        escrow.release(id);
    }

    function test_adminRefundCannotRedirectToOwner() public {
        _open(false, 500);
        vm.prank(funder);
        escrow.fund(id, 40e6);
        vm.prank(owner);
        escrow.adminRefund(id);
        assertEq(usdc.balanceOf(owner), 0);
        vm.prank(funder);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(funder), 1_000_000e6);
        assertEq(usdc.balanceOf(owner), 0);
    }

    function test_pauseBlocksDepositsButNotTimeoutRefund() public {
        _open(false, 1_000);
        vm.prank(owner);
        escrow.pause(true);
        vm.prank(funder);
        vm.expectRevert(DareEscrow.Paused.selector);
        escrow.fund(id, 1e6);
        vm.prank(owner);
        escrow.pause(false);
        vm.prank(funder);
        escrow.fund(id, 9e6);
        vm.warp(deadline + grace);
        vm.prank(funder);
        escrow.claimRefund(id);
        assertEq(usdc.balanceOf(funder), 1_000_000e6);
    }

    function test_reentrancyOnReleaseDoesNotDoublePay() public {
        _open(false, 1_000);
        vm.prank(doer);
        escrow.accept(id);
        vm.prank(funder);
        escrow.fund(id, 20e6);
        vm.prank(owner);
        escrow.setOracle(address(usdc));
        usdc.arm(escrow, id);
        usdc.releaseAsOracle();
        assertFalse(usdc.attackSucceeded());
        assertEq(usdc.balanceOf(doer), 18e6);
        assertEq(usdc.balanceOf(treasury), 2e6);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_twoStepOwnership() public {
        address next = makeAddr("next");
        vm.prank(owner);
        escrow.transferOwnership(next);
        vm.prank(next);
        escrow.acceptOwnership();
        assertEq(escrow.owner(), next);
        vm.prank(owner);
        vm.expectRevert(DareEscrow.NotOwner.selector);
        escrow.pause(true);
    }

    function test_feePlusNetEqualsBounty(uint96 rawAmount, uint16 rawFee) public {
        uint256 amount = bound(rawAmount, 1, 100e6);
        uint16 feeBps = uint16(bound(rawFee, 0, 1_000));
        bytes32 fuzzId = keccak256(abi.encode(amount, feeBps, "fee"));
        escrow.openDare(fuzzId, address(0), false, deadline, grace, feeBps, 100e6);
        vm.prank(doer);
        escrow.accept(fuzzId);
        vm.prank(funder);
        escrow.fund(fuzzId, amount);
        vm.prank(oracle);
        escrow.release(fuzzId);
        uint256 fee = (amount * feeBps) / 10_000;
        assertEq(usdc.balanceOf(doer), amount - fee);
        assertEq(usdc.balanceOf(treasury), fee);
        assertEq(usdc.balanceOf(doer) + usdc.balanceOf(treasury), amount);
    }

    function testFuzz_cannotReleaseTwice(uint96 rawAmount) public {
        uint256 amount = bound(rawAmount, 1, 50e6);
        bytes32 fuzzId = keccak256(abi.encode(rawAmount, "once"));
        escrow.openDare(fuzzId, address(0), false, deadline, grace, 1_000, 50e6);
        vm.prank(doer);
        escrow.accept(fuzzId);
        vm.prank(funder);
        escrow.fund(fuzzId, amount);
        vm.prank(oracle);
        escrow.release(fuzzId);
        vm.prank(oracle);
        vm.expectRevert(DareEscrow.Settled.selector);
        escrow.release(fuzzId);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testFuzz_refundReturnsExactDeposit(uint96 a, uint96 b) public {
        uint256 first = bound(a, 1, 40e6);
        uint256 second = bound(b, 1, 40e6);
        bytes32 fuzzId = keccak256(abi.encode(first, second));
        escrow.openDare(fuzzId, address(0), false, deadline, grace, 1_000, 80e6);
        uint256 beforeFirst = usdc.balanceOf(funder);
        uint256 beforeSecond = usdc.balanceOf(funderTwo);
        vm.prank(funder);
        escrow.fund(fuzzId, first);
        vm.prank(funderTwo);
        escrow.fund(fuzzId, second);
        vm.prank(oracle);
        escrow.refund(fuzzId);
        vm.prank(funder);
        escrow.claimRefund(fuzzId);
        vm.prank(funderTwo);
        escrow.claimRefund(fuzzId);
        assertEq(usdc.balanceOf(funder), beforeFirst);
        assertEq(usdc.balanceOf(funderTwo), beforeSecond);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_rejectsMainnetWindowAndFee() public {
        vm.expectRevert(DareEscrow.BadFee.selector);
        escrow.openDare(keccak256("fee"), address(0), false, deadline, grace, 1_001, 1);
        vm.expectRevert(DareEscrow.BadWindow.selector);
        escrow.openDare(keccak256("past"), address(0), false, uint64(block.timestamp), grace, 100, 1);
    }
}
