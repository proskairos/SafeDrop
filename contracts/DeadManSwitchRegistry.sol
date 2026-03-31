// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeadManSwitchRegistry
 * @notice Decentralized dead man's switch for digital wills on Filecoin.
 *         Supports XOR key-splitting: share2 is revealed on-chain AFTER release
 *         by an autonomous agent, not at creation time.
 *
 * Architecture:
 *   1. Owner calls createWill(cid, "", beneficiary, timeout) with EMPTY encryptedKey
 *   2. Share2 (XOR half of AES key) is held by a custodian agent off-chain
 *   3. Share1 is embedded in the recovery link sent to the beneficiary
 *   4. Owner calls checkIn(willId) to reset the timer
 *   5. After timeout: anyone calls triggerRelease, then agent calls revealShare(share2)
 *   6. Alternative: owner can call ownerRelease() to release early (testing / intent)
 *   7. Beneficiary opens recovery link, gets share1 + reads share2 from chain, decrypts
 *
 * @dev Custom errors throughout for gas efficiency.
 *      No fund/payment logic — purely a dead man's switch + key reveal registry.
 */
contract DeadManSwitchRegistry {

    // ─── Data Structures ─────────────────────────────────────

    struct Will {
        address owner;
        address beneficiary;
        string  cid;
        bytes   encryptedKey;    // XOR share2 — empty at creation, filled by revealShare
        uint256 lastCheckIn;
        uint256 timeoutDuration;
        bool    isReleased;
        bool    revealed;         // true once share2 has been stored on-chain
        bool    exists;
    }

    // ─── Custom Errors ───────────────────────────────────────

    error ZeroAddress();
    error SelfBeneficiary();
    error EmptyCid();
    error BelowMinTimeout();
    error WillNotFound(uint256 willId);
    error NotOwner(uint256 willId);
    error AlreadyReleased(uint256 willId);
    error NotReleased(uint256 willId);
    error TimeoutNotReached(uint256 willId);
    error AlreadyRevealed(uint256 willId);
    error EmptyShare();

    // ─── Events ──────────────────────────────────────────────

    event WillCreated(
        uint256 indexed willId,
        address indexed owner,
        address indexed beneficiary,
        string  cid,
        uint256 timeoutDuration
    );

    event CheckedIn(
        uint256 indexed willId,
        address indexed owner,
        uint256 timestamp
    );

    event WillReleased(
        uint256 indexed willId,
        address indexed owner,
        address indexed beneficiary,
        string  cid
    );

    event ShareRevealed(
        uint256 indexed willId,
        address indexed revealer
    );

    // ─── Constants ───────────────────────────────────────────

    uint256 public constant MIN_TIMEOUT = 1 days;
    uint256 public constant MAX_TIMEOUT = 3650 days;

    // ─── State ───────────────────────────────────────────────

    uint256 private _nextWillId;
    mapping(uint256 => Will) private _wills;
    mapping(address => uint256[]) private _ownerWills;
    mapping(address => uint256[]) private _beneficiaryWills;

    // ─── Modifiers ───────────────────────────────────────────

    modifier willExists(uint256 willId) {
        if (!_wills[willId].exists) revert WillNotFound(willId);
        _;
    }

    modifier onlyOwner(uint256 willId) {
        if (_wills[willId].owner != msg.sender) revert NotOwner(willId);
        _;
    }

    modifier notReleased(uint256 willId) {
        if (_wills[willId].isReleased) revert AlreadyReleased(willId);
        _;
    }

    // ─── Write Functions ─────────────────────────────────────

    /**
     * @notice Create a new digital will
     * @param _cid IPFS Content Identifier for encrypted blob
     * @param _encryptedKey Can be empty bytes — share2 comes later via revealShare
     * @param _beneficiary Address that receives access after release
     * @param _timeoutDuration Seconds before auto-release (min 1 day)
     */
    function createWill(
        string calldata _cid,
        bytes calldata _encryptedKey,
        address _beneficiary,
        uint256 _timeoutDuration
    ) external {
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (_beneficiary == msg.sender) revert SelfBeneficiary();
        if (bytes(_cid).length == 0) revert EmptyCid();
        if (_timeoutDuration < MIN_TIMEOUT) revert BelowMinTimeout();
        // encryptedKey can be empty — share2 is revealed later by agent
        // _encryptedKey parameter kept for ABI compatibility with old callers

        uint256 willId = _nextWillId++;

        _wills[willId] = Will({
            owner: msg.sender,
            beneficiary: _beneficiary,
            cid: _cid,
            encryptedKey: _encryptedKey,
            lastCheckIn: block.timestamp,
            timeoutDuration: _timeoutDuration,
            isReleased: false,
            revealed: bytes(_encryptedKey).length > 0, // auto-mark if caller included key
            exists: true
        });

        _ownerWills[msg.sender].push(willId);
        _beneficiaryWills[_beneficiary].push(willId);

        emit WillCreated(willId, msg.sender, _beneficiary, _cid, _timeoutDuration);
    }

    /**
     * @notice Check-in to reset the dead man's switch timer
     * @param willId The ID of the will to check-in for
     */
    function checkIn(uint256 willId)
        external
        willExists(willId)
        onlyOwner(willId)
        notReleased(willId)
    {
        _wills[willId].lastCheckIn = block.timestamp;
        emit CheckedIn(willId, msg.sender, block.timestamp);
    }

    /**
     * @notice Trigger release after timeout expires (permissionless)
     * @param willId The ID of the will to release
     */
    function triggerRelease(uint256 willId)
        external
        willExists(willId)
        notReleased(willId)
    {
        Will storage will = _wills[willId];
        uint256 deadline = will.lastCheckIn + will.timeoutDuration;
        if (block.timestamp <= deadline) revert TimeoutNotReached(willId);

        will.isReleased = true;
        emit WillReleased(willId, will.owner, will.beneficiary, will.cid);
    }

    /**
     * @notice Owner can release early regardless of timer
     * @dev Useful for testing, or if owner intentionally wants to release
     * @param willId The ID of the will to release
     */
    function ownerRelease(uint256 willId)
        external
        willExists(willId)
        onlyOwner(willId)
        notReleased(willId)
    {
        _wills[willId].isReleased = true;
        emit WillReleased(willId, _wills[willId].owner, _wills[willId].beneficiary, _wills[willId].cid);
    }

    /**
     * @notice Reveal share2 (XOR key share) on-chain after release
     * @dev Callable by anyone (typically the custodian agent). Once revealed,
     *      share2 is permanently on-chain for the beneficiary to read.
     * @param willId The ID of the will
     * @param _share XOR share2 as bytes (32 bytes for AES-256)
     */
    function revealShare(
        uint256 willId,
        bytes calldata _share
    ) external
        willExists(willId)
    {
        Will storage will = _wills[willId];

        if (!will.isReleased) revert NotReleased(willId);
        if (will.revealed) revert AlreadyRevealed(willId);
        if (_share.length == 0) revert EmptyShare();

        will.encryptedKey = _share;
        will.revealed = true;

        emit ShareRevealed(willId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────

    function getWill(uint256 willId) external view returns (Will memory) {
        if (!_wills[willId].exists) revert WillNotFound(willId);
        return _wills[willId];
    }

    function getOwnerWills(address owner) external view returns (uint256[] memory) {
        return _ownerWills[owner];
    }

    function getBeneficiaryWills(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiaryWills[beneficiary];
    }

    function getOwnerWillCount(address owner) external view returns (uint256) {
        return _ownerWills[owner].length;
    }

    function getBeneficiaryWillCount(address beneficiary) external view returns (uint256) {
        return _beneficiaryWills[beneficiary].length;
    }

    function canRelease(uint256 willId) external view returns (bool) {
        Will memory will = _wills[willId];
        if (!will.exists || will.isReleased) return false;
        return block.timestamp > will.lastCheckIn + will.timeoutDuration;
    }

    function getTimeUntilRelease(uint256 willId) external view returns (uint256) {
        Will memory will = _wills[willId];
        if (!will.exists || will.isReleased) return 0;
        uint256 deadline = will.lastCheckIn + will.timeoutDuration;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    function getTotalWills() external view returns (uint256) {
        return _nextWillId;
    }

    /// @notice Check if a will has been released
    function isReleased(uint256 willId) external view returns (bool) {
        if (!_wills[willId].exists) revert WillNotFound(willId);
        return _wills[willId].isReleased;
    }

    /// @notice Check if share2 has been revealed on-chain
    function isRevealed(uint256 willId) external view returns (bool) {
        if (!_wills[willId].exists) revert WillNotFound(willId);
        return _wills[willId].revealed;
    }
}
