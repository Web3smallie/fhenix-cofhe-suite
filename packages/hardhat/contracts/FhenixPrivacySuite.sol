// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 1: FHE VAULT
// Stores encrypted balances. In production this would use CoFHE SDK.
// For testnet we store encrypted bytes and emit events the frontend reads.
// ─────────────────────────────────────────────────────────────────────────────
contract FHEVault {
    address public owner;

    // encrypted balance per user (ciphertext stored as bytes)
    mapping(address => bytes32) public encryptedBalance;
    mapping(address => uint256) public depositCount;
    mapping(address => uint256) public lastDepositTime;

    event Deposited(address indexed user, bytes32 encryptedAmount, uint256 timestamp);
    event Withdrawn(address indexed user, bytes32 encryptedAmount, uint256 timestamp);
    event EncryptedTransfer(address indexed from, address indexed to, bytes32 encCiphertext, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    // Deposit ETH and store encrypted representation
    function deposit(bytes32 encryptedAmount) external payable {
        require(msg.value > 0, "Must send ETH");
        encryptedBalance[msg.sender] = encryptedAmount;
        depositCount[msg.sender]++;
        lastDepositTime[msg.sender] = block.timestamp;
        emit Deposited(msg.sender, encryptedAmount, block.timestamp);
    }

    // Withdraw — in real CoFHE this would verify encrypted amount
    function withdraw(bytes32 encryptedAmount) external {
        require(address(this).balance > 0, "Vault empty");
        uint256 amount = address(this).balance / 10; // demo: withdraw 10%
        encryptedBalance[msg.sender] = encryptedAmount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, encryptedAmount, block.timestamp);
    }

    // Private transfer — amounts hidden
    function encryptedTransfer(address to, bytes32 encCiphertext) external {
        require(to != address(0), "Invalid address");
        emit EncryptedTransfer(msg.sender, to, encCiphertext, block.timestamp);
    }

    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getUserInfo(address user) external view returns (bytes32 encBal, uint256 count, uint256 lastTime) {
        return (encryptedBalance[user], depositCount[user], lastDepositTime[user]);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 2: PRIVATE PERP DEX
// Encrypted positions — size and entry price stored as ciphertexts
// ─────────────────────────────────────────────────────────────────────────────
contract PrivatePerpDEX {

    struct Position {
        bytes32 encSize;       // encrypted position size
        bytes32 encEntry;      // encrypted entry price
        uint8   leverage;
        bool    isLong;
        bool    isOpen;
        uint256 openedAt;
        uint256 collateral;    // ETH collateral in wei (public — needed for liquidation)
    }

    mapping(address => Position[]) public positions;
    mapping(address => uint256)    public openPositionCount;

    uint256 public totalVolumeEncrypted; // count only, not amounts
    uint256 public totalPositions;

    event PositionOpened(address indexed trader, uint256 positionId, bool isLong, uint8 leverage, bytes32 encSize, bytes32 encEntry, uint256 timestamp);
    event PositionClosed(address indexed trader, uint256 positionId, bytes32 encPnl, uint256 timestamp);
    event Liquidated(address indexed trader, uint256 positionId, uint256 timestamp);

    function openPosition(
        bytes32 encSize,
        bytes32 encEntry,
        uint8   leverage,
        bool    isLong
    ) external payable {
        require(msg.value > 0, "Collateral required");
        require(leverage >= 1 && leverage <= 100, "Invalid leverage");

        positions[msg.sender].push(Position({
            encSize:    encSize,
            encEntry:   encEntry,
            leverage:   leverage,
            isLong:     isLong,
            isOpen:     true,
            openedAt:   block.timestamp,
            collateral: msg.value
        }));

        uint256 posId = positions[msg.sender].length - 1;
        openPositionCount[msg.sender]++;
        totalPositions++;
        totalVolumeEncrypted++;

        emit PositionOpened(msg.sender, posId, isLong, leverage, encSize, encEntry, block.timestamp);
    }

    function closePosition(uint256 positionId, bytes32 encPnl) external {
        require(positionId < positions[msg.sender].length, "Invalid position");
        Position storage pos = positions[msg.sender][positionId];
        require(pos.isOpen, "Already closed");

        pos.isOpen = false;
        openPositionCount[msg.sender]--;

        // Return collateral (in production PnL would be calculated via CoFHE)
        if (pos.collateral > 0) {
            payable(msg.sender).transfer(pos.collateral);
        }

        emit PositionClosed(msg.sender, positionId, encPnl, block.timestamp);
    }

    function getPositionCount(address trader) external view returns (uint256) {
        return positions[trader].length;
    }

    function getPosition(address trader, uint256 id) external view returns (
        bytes32 encSize, bytes32 encEntry, uint8 leverage, bool isLong, bool isOpen, uint256 openedAt, uint256 collateral
    ) {
        Position storage p = positions[trader][id];
        return (p.encSize, p.encEntry, p.leverage, p.isLong, p.isOpen, p.openedAt, p.collateral);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 3: PRIVATE VOTING
// Votes encrypted — tally hidden until owner reveals
// ─────────────────────────────────────────────────────────────────────────────
contract PrivateVoting {

    struct Proposal {
        string  title;
        string  description;
        uint256 deadline;
        uint256 quorum;
        uint256 totalVotes;    // count only, not breakdown
        bool    revealed;
        bool    passed;
        bytes32 encYesCount;   // encrypted tally
        bytes32 encNoCount;
    }

    mapping(uint256 => Proposal)              public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => bytes32[])             public encryptedVotes; // each vote stored encrypted

    uint256 public proposalCount;
    address public admin;

    event ProposalCreated(uint256 indexed id, string title, uint256 deadline, uint256 quorum);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bytes32 encVote, uint256 timestamp);
    event TallyRevealed(uint256 indexed proposalId, bool passed, uint256 timestamp);

    constructor() {
        admin = msg.sender;
    }

    function createProposal(string memory title, string memory description, uint256 durationSeconds, uint256 quorum) external {
        require(msg.sender == admin, "Admin only");
        proposals[proposalCount] = Proposal({
            title:       title,
            description: description,
            deadline:    block.timestamp + durationSeconds,
            quorum:      quorum,
            totalVotes:  0,
            revealed:    false,
            passed:      false,
            encYesCount: bytes32(0),
            encNoCount:  bytes32(0)
        });
        emit ProposalCreated(proposalCount, title, block.timestamp + durationSeconds, quorum);
        proposalCount++;
    }

    function castVote(uint256 proposalId, bytes32 encVote) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        hasVoted[proposalId][msg.sender] = true;
        encryptedVotes[proposalId].push(encVote);
        p.totalVotes++;

        emit VoteCast(proposalId, msg.sender, encVote, block.timestamp);
    }

    // Admin reveals result after deadline (in production CoFHE decrypts)
    function revealTally(uint256 proposalId, bytes32 encYes, bytes32 encNo, bool passed) external {
        require(msg.sender == admin, "Admin only");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.deadline || p.totalVotes >= p.quorum, "Too early");
        require(!p.revealed, "Already revealed");

        p.encYesCount = encYes;
        p.encNoCount  = encNo;
        p.revealed    = true;
        p.passed      = passed;

        emit TallyRevealed(proposalId, passed, block.timestamp);
    }

    function getProposal(uint256 id) external view returns (
        string memory title, uint256 deadline, uint256 totalVotes, bool revealed, bool passed
    ) {
        Proposal storage p = proposals[id];
        return (p.title, p.deadline, p.totalVotes, p.revealed, p.passed);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 4: PRIVATE PREDICTION MARKET
// Bets encrypted — odds and positions hidden until resolution
// ─────────────────────────────────────────────────────────────────────────────
contract PrivatePredictionMarket {

    struct Market {
        string  question;
        uint256 deadline;
        uint256 totalBets;
        uint256 totalPool;     // total ETH in pool
        bool    resolved;
        bool    yesWon;
        bytes32 encYesPool;    // encrypted pool sizes
        bytes32 encNoPool;
    }

    struct Bet {
        bytes32 encSide;       // encrypted YES/NO
        bytes32 encAmount;     // encrypted amount
        uint256 collateral;    // actual ETH sent
        bool    claimed;
    }

    mapping(uint256 => Market)                          public markets;
    mapping(uint256 => mapping(address => Bet))         public bets;
    mapping(uint256 => mapping(address => bool))        public hasBet;

    uint256 public marketCount;
    address public oracle;

    event MarketCreated(uint256 indexed id, string question, uint256 deadline);
    event BetPlaced(uint256 indexed marketId, address indexed bettor, bytes32 encSide, bytes32 encAmount, uint256 timestamp);
    event MarketResolved(uint256 indexed marketId, bool yesWon, uint256 timestamp);
    event WinningsClaimed(uint256 indexed marketId, address indexed winner, uint256 amount);

    constructor() {
        oracle = msg.sender;
    }

    function createMarket(string memory question, uint256 durationSeconds) external {
        require(msg.sender == oracle, "Oracle only");
        markets[marketCount] = Market({
            question:   question,
            deadline:   block.timestamp + durationSeconds,
            totalBets:  0,
            totalPool:  0,
            resolved:   false,
            yesWon:     false,
            encYesPool: bytes32(0),
            encNoPool:  bytes32(0)
        });
        emit MarketCreated(marketCount, question, block.timestamp + durationSeconds);
        marketCount++;
    }

    function placeBet(uint256 marketId, bytes32 encSide, bytes32 encAmount) external payable {
        Market storage m = markets[marketId];
        require(block.timestamp < m.deadline, "Market closed");
        require(!hasBet[marketId][msg.sender], "Already bet");
        require(msg.value > 0, "Must send ETH");

        bets[marketId][msg.sender] = Bet({
            encSide:    encSide,
            encAmount:  encAmount,
            collateral: msg.value,
            claimed:    false
        });
        hasBet[marketId][msg.sender] = true;
        m.totalBets++;
        m.totalPool += msg.value;

        emit BetPlaced(marketId, msg.sender, encSide, encAmount, block.timestamp);
    }

    function resolveMarket(uint256 marketId, bool yesWon, bytes32 encYesPool, bytes32 encNoPool) external {
        require(msg.sender == oracle, "Oracle only");
        Market storage m = markets[marketId];
        require(!m.resolved, "Already resolved");

        m.resolved   = true;
        m.yesWon     = yesWon;
        m.encYesPool = encYesPool;
        m.encNoPool  = encNoPool;

        emit MarketResolved(marketId, yesWon, block.timestamp);
    }

    // Simplified claim — in production CoFHE verifies encrypted side matches winner
    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");
        Bet storage b = bets[marketId][msg.sender];
        require(b.collateral > 0 && !b.claimed, "Nothing to claim");

        b.claimed = true;
        uint256 payout = b.collateral * 2; // demo: 2x payout
        if (address(this).balance >= payout) {
            payable(msg.sender).transfer(payout);
        } else {
            payable(msg.sender).transfer(address(this).balance);
        }

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    function getMarket(uint256 id) external view returns (
        string memory question, uint256 deadline, uint256 totalBets, uint256 totalPool, bool resolved, bool yesWon
    ) {
        Market storage m = markets[id];
        return (m.question, m.deadline, m.totalBets, m.totalPool, m.resolved, m.yesWon);
    }
}
