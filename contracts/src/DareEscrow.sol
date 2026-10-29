// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title DareEscrow
/// @notice USDC bounties for one doer. Funders deposit. The doer never does.
///         Approved proof releases the bounty minus a fee. A miss refunds funders
///         or sends the bounty to charity. Settlement happens at most once.
/// @dev This is not ProtocolEscrow. That contract pools stakes from every player,
///      lets the creator cancel after the end, and reverts when nobody wins.
///      Those rules contradict Dare, so this contract keeps only the ideas that
///      still fit: a bytes32 id, an ERC-20 token, an oracle, and a treasury.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DareEscrow {
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000;
    uint256 public constant MIN_WINDOW = 1 hours;
    uint256 public constant MAX_WINDOW = 30 days;
    uint256 public constant MIN_GRACE = 1 days;
    uint256 public constant MAX_GRACE = 30 days;

    enum Outcome {
        None,
        Released,
        Refunded,
        Donated
    }

    struct Dare {
        address doer;
        address charity;
        uint64 deadline;
        uint64 refundAfter;
        uint16 feeBps;
        bool charityOnFail;
        bool opened;
        Outcome outcome;
        uint256 bounty;
        uint256 maxBounty;
    }

    IERC20 public immutable usdc;
    address public oracle;
    address public treasury;
    address public owner;
    address public pendingOwner;
    bool public paused;

    mapping(bytes32 => Dare) private _dares;
    mapping(bytes32 => mapping(address => uint256)) public deposits;

    uint256 private _locked = 1;

    error ZeroAddress();
    error BadWindow();
    error BadFee();
    error DareExists();
    error UnknownDare();
    error Settled();
    error NotOracle();
    error NotOwner();
    error Paused();
    error DoerCannotFund();
    error AlreadyDoer();
    error DoerHasDeposit();
    error AfterDeadline();
    error AmountZero();
    error CapExceeded();
    error NoDoer();
    error NoCharity();
    error TooEarly();
    error NothingToClaim();
    error Reentrancy();

    event DareOpened(bytes32 indexed id, uint64 deadline, uint64 refundAfter, uint16 feeBps, bool charityOnFail);
    event Accepted(bytes32 indexed id, address indexed doer);
    event Funded(bytes32 indexed id, address indexed funder, uint256 amount, uint256 bounty);
    event Released(bytes32 indexed id, address indexed doer, uint256 net, uint256 fee);
    event RefundsOpened(bytes32 indexed id);
    event RefundClaimed(bytes32 indexed id, address indexed funder, uint256 amount);
    event Donated(bytes32 indexed id, address indexed charity, uint256 amount);
    event PausedSet(bool paused);
    event OracleSet(address oracle);
    event TreasurySet(address treasury);
    event OwnershipTransferStarted(address pendingOwner);
    event OwnershipTransferred(address owner);

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address usdc_, address oracle_, address treasury_, address owner_) {
        if (usdc_ == address(0) || oracle_ == address(0) || treasury_ == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20(usdc_);
        oracle = oracle_;
        treasury = treasury_;
        owner = owner_;
    }

    function dares(bytes32 id) external view returns (Dare memory) {
        return _dares[id];
    }

    function openDare(
        bytes32 id,
        address charity,
        bool charityOnFail,
        uint64 deadline,
        uint64 grace,
        uint16 feeBps,
        uint256 maxBounty
    ) external {
        if (paused) revert Paused();
        if (_dares[id].opened) revert DareExists();
        if (deadline <= block.timestamp) revert BadWindow();
        if (deadline - block.timestamp < MIN_WINDOW || deadline - block.timestamp > MAX_WINDOW) revert BadWindow();
        if (grace < MIN_GRACE || grace > MAX_GRACE) revert BadWindow();
        if (feeBps > MAX_FEE_BPS) revert BadFee();
        if (charityOnFail && charity == address(0)) revert NoCharity();
        if (maxBounty == 0) revert AmountZero();

        Dare storage dare = _dares[id];
        dare.charity = charity;
        dare.deadline = deadline;
        dare.refundAfter = deadline + grace;
        dare.feeBps = feeBps;
        dare.charityOnFail = charityOnFail;
        dare.opened = true;
        dare.maxBounty = maxBounty;
        emit DareOpened(id, deadline, dare.refundAfter, feeBps, charityOnFail);
    }

    /// @notice The doer locks themselves in. This function pulls no tokens.
    function accept(bytes32 id) external {
        Dare storage dare = _existing(id);
        if (dare.outcome != Outcome.None) revert Settled();
        if (dare.doer != address(0)) revert AlreadyDoer();
        if (deposits[id][msg.sender] != 0) revert DoerHasDeposit();
        dare.doer = msg.sender;
        emit Accepted(id, msg.sender);
    }

    function fund(bytes32 id, uint256 amount) external nonReentrant {
        if (paused) revert Paused();
        Dare storage dare = _existing(id);
        if (dare.outcome != Outcome.None) revert Settled();
        if (block.timestamp >= dare.deadline) revert AfterDeadline();
        if (amount == 0) revert AmountZero();
        if (msg.sender == dare.doer) revert DoerCannotFund();
        if (dare.bounty + amount > dare.maxBounty) revert CapExceeded();

        dare.bounty += amount;
        deposits[id][msg.sender] += amount;
        _pull(msg.sender, amount);
        emit Funded(id, msg.sender, amount, dare.bounty);
    }

    /// @notice Oracle-only. Pays the doer `bounty - fee` and the treasury the fee. Once.
    function release(bytes32 id) external onlyOracle nonReentrant {
        Dare storage dare = _existing(id);
        if (dare.outcome != Outcome.None) revert Settled();
        if (dare.doer == address(0)) revert NoDoer();
        if (dare.bounty == 0) revert AmountZero();

        uint256 bounty = dare.bounty;
        uint256 fee = (bounty * dare.feeBps) / BPS;
        uint256 net = bounty - fee;
        dare.outcome = Outcome.Released;
        dare.bounty = 0;

        if (net != 0) _push(dare.doer, net);
        if (fee != 0) _push(treasury, fee);
        emit Released(id, dare.doer, net, fee);
    }

    /// @notice Oracle-only. Opens pull refunds. Sends nothing to the owner.
    function refund(bytes32 id) external onlyOracle nonReentrant {
        _openRefunds(id);
    }

    /// @notice Oracle-only, and only when the dare was opened with charity-on-fail.
    ///         The full bounty goes to the charity. No fee.
    function donate(bytes32 id) external onlyOracle nonReentrant {
        Dare storage dare = _existing(id);
        if (dare.outcome != Outcome.None) revert Settled();
        if (!dare.charityOnFail || dare.charity == address(0)) revert NoCharity();
        uint256 bounty = dare.bounty;
        if (bounty == 0) revert AmountZero();
        dare.outcome = Outcome.Donated;
        dare.bounty = 0;
        _push(dare.charity, bounty);
        emit Donated(id, dare.charity, bounty);
    }

    /// @notice After `refundAfter`, anyone can open refunds and pull their own deposit.
    ///         This is the path that keeps funds from sitting forever if the oracle stops.
    function claimRefund(bytes32 id) external nonReentrant {
        Dare storage dare = _existing(id);
        if (dare.outcome == Outcome.None) {
            if (block.timestamp < dare.refundAfter) revert TooEarly();
            dare.outcome = Outcome.Refunded;
            emit RefundsOpened(id);
        }
        if (dare.outcome != Outcome.Refunded) revert Settled();
        uint256 amount = deposits[id][msg.sender];
        if (amount == 0) revert NothingToClaim();
        deposits[id][msg.sender] = 0;
        _push(msg.sender, amount);
        emit RefundClaimed(id, msg.sender, amount);
    }

    /// @notice Owner can only open the same pull-refund path. Cannot redirect funds.
    function adminRefund(bytes32 id) external onlyOwner nonReentrant {
        _openRefunds(id);
    }

    function pause(bool next) external onlyOwner {
        paused = next;
        emit PausedSet(next);
    }

    function setOracle(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        oracle = next;
        emit OracleSet(next);
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        treasury = next;
        emit TreasurySet(next);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        pendingOwner = next;
        emit OwnershipTransferStarted(next);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(msg.sender);
    }

    function _openRefunds(bytes32 id) private {
        Dare storage dare = _existing(id);
        if (dare.outcome != Outcome.None) revert Settled();
        dare.outcome = Outcome.Refunded;
        emit RefundsOpened(id);
    }

    function _existing(bytes32 id) private view returns (Dare storage dare) {
        dare = _dares[id];
        if (!dare.opened) revert UnknownDare();
    }

    function _pull(address from, uint256 amount) private {
        uint256 beforeBal = usdc.balanceOf(address(this));
        bool ok = usdc.transferFrom(from, address(this), amount);
        if (!ok) revert AmountZero();
        if (usdc.balanceOf(address(this)) - beforeBal != amount) revert AmountZero();
    }

    function _push(address to, uint256 amount) private {
        bool ok = usdc.transfer(to, amount);
        if (!ok) revert AmountZero();
    }
}
