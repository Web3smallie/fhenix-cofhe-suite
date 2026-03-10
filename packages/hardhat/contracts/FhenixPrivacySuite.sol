// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 1: FHE VAULT
// ─────────────────────────────────────────────────────────────────────────────
contract FHEVault {
    address public owner;

    mapping(address => euint128) public encryptedBalance;
    mapping(address => uint256)  public depositCount;
    mapping(address => uint256)  public lastDepositTime;

    event Deposited(address indexed user, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    function deposit(InEuint128 calldata encryptedAmount) external payable {
        require(msg.value > 0, "Must send ETH");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        FHE.allowSender(amount);
        encryptedBalance[msg.sender] = amount;
        depositCount[msg.sender]++;
        lastDepositTime[msg.sender] = block.timestamp;
        emit Deposited(msg.sender, block.timestamp);
    }

    function withdraw(InEuint128 calldata encryptedAmount) external {
        require(address(this).balance > 0, "Vault empty");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        FHE.allowSender(amount);
        uint256 payout = address(this).balance / 10;
        payable(msg.sender).transfer(payout);
        emit Withdrawn(msg.sender, block.timestamp);
    }

    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 2: PRIVATE PERP DEX
// ─────────────────────────────────────────────────────────────────────────────
contract PrivatePerpDEX {

    struct Position {
        euint32  encSize;
        euint32  encEntry;
        uint8    leverage;
        bool     isLong;
        bool     isOpen;
        uint256  openedAt;
        uint256  collateral;
    }

    mapping(address => Position[]) public positions;
    mapping(address => uint256)    public openPositionCount;
    uint256 public totalPositions;

    event PositionOpened(address indexed trader, uint256 positionId, bool isLong, uint8 leverage, uint256 timestamp);
    event PositionClosed(address indexed trader, uint256 positionId, uint256 timestamp);

    function openPosition(
        bool         isLong,
        uint8        leverage,
        InEuint32 calldata encSize,
        InEuint32 calldata encEntry
    ) external payable {
        require(msg.value > 0, "Collateral required");
        require(leverage >= 1 && leverage <= 100, "Invalid leverage");

        euint32 size  = FHE.asEuint32(encSize);
        euint32 entry = FHE.asEuint32(encEntry);
        FHE.allowThis(size);
        FHE.allowSender(size);
        FHE.allowThis(entry);
        FHE.allowSender(entry);

        positions[msg.sender].push(Position({
            encSize:    size,
            encEntry:   entry,
            leverage:   leverage,
            isLong:     isLong,
            isOpen:     true,
            openedAt:   block.timestamp,
            collateral: msg.value
        }));

        uint256 posId = positions[msg.sender].length - 1;
        openPositionCount[msg.sender]++;
        totalPositions++;

        emit PositionOpened(msg.sender, posId, isLong, leverage, block.timestamp);
    }

    function closePosition(uint256 positionId) external {
        require(positionId < positions[msg.sender].length, "Invalid position");
        Position storage pos = positions[msg.sender][positionId];
        require(pos.isOpen, "Already closed");

        pos.isOpen = false;
        openPositionCount[msg.sender]--;

        if (pos.collateral > 0) {
            payable(msg.sender).transfer(pos.collateral);
        }

        emit PositionClosed(msg.sender, positionId, block.timestamp);
    }

    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        uint256 count = positions[trader].length;
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = i;
        }
        return ids;
    }

    function getPositionCount(address trader) external view returns (uint256) {
        return positions[trader].length;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 3: PRIVATE VOTING
// ─────────────────────────────────────────────────────────────────────────────
contract PrivateVoting {

    struct Proposal {
        string   description;
        uint256  deadline;
        uint256  totalVotes;
        bool     revealed;
        bool     passed;
    }

    mapping(uint256 => Proposal)                         public proposals;
    mapping(uint256 => mapping(address => bool))         public hasVoted;
    mapping(uint256 => ebool[])                          public encryptedVotes;

    uint256 public proposalCount;
    address public admin;

    event ProposalCreated(uint256 indexed id, string description, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 timestamp);
    event TallyRevealed(uint256 indexed proposalId, bool passed, uint256 timestamp);

    constructor() {
        admin = msg.sender;
    }

    function createProposal(string memory description, uint256 durationSeconds) external {
        proposals[proposalCount] = Proposal({
            description: description,
            deadline:    block.timestamp + durationSeconds,
            totalVotes:  0,
            revealed:    false,
            passed:      false
        });
        emit ProposalCreated(proposalCount, description, block.timestamp + durationSeconds);
        proposalCount++;
    }

    function castVote(uint256 proposalId, InEbool calldata encVote) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        ebool vote = FHE.asEbool(encVote);
        FHE.allowThis(vote);
        FHE.allowSender(vote);

        hasVoted[proposalId][msg.sender] = true;
        encryptedVotes[proposalId].push(vote);
        p.totalVotes++;

        emit VoteCast(proposalId, msg.sender, block.timestamp);
    }

    function revealTally(uint256 proposalId, bool passed) external {
        require(msg.sender == admin, "Admin only");
        Proposal storage p = proposals[proposalId];
        require(!p.revealed, "Already revealed");

        p.revealed = true;
        p.passed   = passed;

        emit TallyRevealed(proposalId, passed, block.timestamp);
    }

    function getProposal(uint256 id) external view returns (
        string memory description, uint256 deadline, uint256 totalVotes, bool revealed, bool passed
    ) {
        Proposal storage p = proposals[id];
        return (p.description, p.deadline, p.totalVotes, p.revealed, p.passed);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 4: PRIVATE PREDICTION MARKET
// ─────────────────────────────────────────────────────────────────────────────
contract PrivatePredictionMarket {

    struct Market {
        string  question;
        uint256 deadline;
        uint256 totalBets;
        uint256 totalPool;
        bool    resolved;
        bool    yesWon;
    }

    struct Bet {
        ebool   encSide;
        euint32 encAmount;
        uint256 collateral;
        bool    claimed;
    }

    mapping(uint256 => Market)                   public markets;
    mapping(uint256 => mapping(address => Bet))  public bets;
    mapping(uint256 => mapping(address => bool)) public hasBet;

    uint256 public marketCount;
    address public oracle;

    event MarketCreated(uint256 indexed id, string question, uint256 deadline);
    event BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 timestamp);
    event MarketResolved(uint256 indexed marketId, bool yesWon, uint256 timestamp);
    event WinningsClaimed(uint256 indexed marketId, address indexed winner, uint256 amount);

    constructor() {
        oracle = msg.sender;
    }

    function createMarket(string memory question, uint256 durationSeconds) external {
        markets[marketCount] = Market({
            question:  question,
            deadline:  block.timestamp + durationSeconds,
            totalBets: 0,
            totalPool: 0,
            resolved:  false,
            yesWon:    false
        });
        emit MarketCreated(marketCount, question, block.timestamp + durationSeconds);
        marketCount++;
    }

    function placeBet(uint256 marketId, InEbool calldata encSide, InEuint32 calldata encAmount) external payable {
        Market storage m = markets[marketId];
        require(block.timestamp < m.deadline, "Market closed");
        require(!hasBet[marketId][msg.sender], "Already bet");
        require(msg.value > 0, "Must send ETH");

        ebool  side   = FHE.asEbool(encSide);
        euint32 amount = FHE.asEuint32(encAmount);
        FHE.allowThis(side);
        FHE.allowSender(side);
        FHE.allowThis(amount);
        FHE.allowSender(amount);

        bets[marketId][msg.sender] = Bet({
            encSide:    side,
            encAmount:  amount,
            collateral: msg.value,
            claimed:    false
        });
        hasBet[marketId][msg.sender] = true;
        m.totalBets++;
        m.totalPool += msg.value;

        emit BetPlaced(marketId, msg.sender, block.timestamp);
    }

    function resolveMarket(uint256 marketId, bool yesWon) external {
        require(msg.sender == oracle, "Oracle only");
        Market storage m = markets[marketId];
        require(!m.resolved, "Already resolved");
        m.resolved = true;
        m.yesWon   = yesWon;
        emit MarketResolved(marketId, yesWon, block.timestamp);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");
        Bet storage b = bets[marketId][msg.sender];
        require(b.collateral > 0 && !b.claimed, "Nothing to claim");

        b.claimed = true;
        uint256 payout = b.collateral * 2;
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
