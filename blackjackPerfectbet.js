// Blackjack Simulator using Perfect Strategy
// (c) mrbtcgambler - Open Source Educational Tool

const { createHmac } = require('crypto');

// ---------------------------- Config & Global Control ----------------------------
const takeInsurance = false;
const useRandomSeed = false;
const debugMode = true; // Set to true for detailed round-by-round output
const debugDelay = 1000;  // Delay in ms between rounds when debugMode is true

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const randomServerSeed = useRandomSeed ? generateRandomServerSeed(64) : 'd83729554eeed8965116385e0486dab8a1f6634ae1a9e8139e849ab75f17341d';
const randomClientSeed = useRandomSeed ? generateRandomClientSeed(10) : 'wcvqnIM521';
const startNonce = useRandomSeed ? Math.floor(Math.random() * 1000000) + 1 : 1;

// ---------------------------- Card Definitions ----------------------------
const CARDS = [
  '♦2', '♥2', '♠2', '♣2', '♦3', '♥3', '♠3', '♣3',
  '♦4', '♥4', '♠4', '♣4', '♦5', '♥5', '♠5', '♣5',
  '♦6', '♥6', '♠6', '♣6', '♦7', '♥7', '♠7', '♣7',
  '♦8', '♥8', '♠8', '♣8', '♦9', '♥9', '♠9', '♣9',
  '♦10','♥10','♠10','♣10','♦J','♥J','♠J','♣J',
  '♦Q','♥Q','♠Q','♣Q','♦K','♥K','♠K','♣K',
  '♦A','♥A','♠A','♣A'
];

function generateRandomClientSeed(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateRandomServerSeed(length) {
  const hexRef = '0123456789abcdef';
  return Array.from({ length }, () => hexRef[Math.floor(Math.random() * 16)]).join('');
}

// ---------------------------- Hand Logic ----------------------------
function getCardValue(card) {
  const rank = card.slice(1);
  if (["J", "Q", "K"].includes(rank)) return 10;
  if (rank === "A") return 11;
  return parseInt(rank);
}

class BlackjackHand {
  constructor() {
    this.cards = [];
  }
  add(card) {
    this.cards.push(card);
  }
  get values() {
    return this.cards.map(getCardValue);
  }
  get total() {
    let total = this.values.reduce((a, b) => a + b, 0);
    let aces = this.values.filter(v => v === 11).length;
    while (total > 21 && aces--) total -= 10;
    return total;
  }
  get isBlackjack() {
    return this.cards.length === 2 && this.total === 21;
  }
  get isBust() {
    return this.total > 21;
  }
  get isSoft() {
    return this.values.includes(11) && this.total <= 21;
  }
  toString() {
    return `${this.cards.join(', ')} (${this.total}${this.isSoft ? ' soft' : ''})`;
  }
}

// ---------------------------- Provably Fair Draw Engine ----------------------------
function hmacSha256(seed, msg) {
  return createHmac('sha256', seed).update(msg).digest();
}

function getCardsFromSeed(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  let cursor = 0;
  while (floats.length < count) {
    const hash = hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor++}`);
    for (let i = 0; i < 32; i += 4) {
      if (floats.length >= count) break;
      const byte1 = hash[i];
      const byte2 = hash[i+1];
      const byte3 = hash[i+2];
      const byte4 = hash[i+3];
      const val = byte1 / 256 + byte2 / (256**2) + byte3 / (256**3) + byte4 / (256**4);
      floats.push(val);
    }
  }
  return floats.map(f => CARDS[Math.floor(f * CARDS.length)]);
}

// ---------------------------- Strategy Tables ----------------------------
const pairsTable = [
  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2, 2, 2, 2, 0, 0],
  [1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 0, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

const softTable = [
  ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
  ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
  ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
  ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
  ["S", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "H"],
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"],
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]
];

const hardTable = [
  ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"],
  ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
  ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"],
  ["D", "D", "D", "D", "D", "D", "D", "D", "D", "H"],
  ["H", "H", "S", "S", "S", "H", "H", "H", "H", "H"],
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]
];

const actionMapping = {
  "H": "hit",
  "S": "stand",
  "D": "double",
  "P": "split",
  "Ds": "double",
  "St": "stand"
};

// ---------------------------- Decision Engine ----------------------------
function determinePerfectStrategy(playerHand, dealerUpcard) {
  const dealerValue = getCardValue(dealerUpcard);
  const p = playerHand;

  if (p.cards.length === 2 && getCardValue(p.cards[0]) === getCardValue(p.cards[1])) {
    const pairValue = getCardValue(p.cards[0]);
    if (pairValue === 11 || pairValue === 8) return 'P';
    if (pairValue === 10) return 'S';
    if (pairValue === 9) {
      if ([7, 10, 11].includes(dealerValue)) return 'S';
      return 'P';
    }
    if (pairValue === 7 && dealerValue <= 7) return 'P';
    if (pairValue === 6 && dealerValue <= 6) return 'P';
    if (pairValue === 5) return 'D';
    if (pairValue === 4 && dealerValue >= 5 && dealerValue <= 6) return 'P';
    if ((pairValue === 3 || pairValue === 2) && dealerValue <= 7) return 'P';
    return 'H';
  }

  if (p.isSoft) {
    const total = p.total;
    if (total >= 19) return 'S';
    if (total === 18) {
      if (dealerValue >= 2 && dealerValue <= 6) return 'D';
      if (dealerValue === 7 || dealerValue === 8) return 'S';
      return 'H';
    }
    if (total === 17) {
      if (dealerValue >= 3 && dealerValue <= 6) return 'D';
      return 'H';
    }
    if (total === 16 || total === 15) {
      if (dealerValue >= 4 && dealerValue <= 6) return 'D';
      return 'H';
    }
    if (total === 14 || total === 13) {
      if (dealerValue >= 5 && dealerValue <= 6) return 'D';
      return 'H';
    }
  }

  const total = p.total;
  if (total >= 17) return 'S';
  if (total >= 13 && total <= 16) return (dealerValue >= 2 && dealerValue <= 6) ? 'S' : 'H';
  if (total === 12) return (dealerValue >= 4 && dealerValue <= 6) ? 'S' : 'H';
  if (total === 11) return 'D';
  if (total === 10) return (dealerValue <= 9) ? 'D' : 'H';
  if (total === 9) return (dealerValue >= 3 && dealerValue <= 6) ? 'D' : 'H';
  return 'H';
}

// ---------------------------- Start Batch Simulation ----------------------------
async function simulateManyRounds(config) {
  const {
    serverSeed,
    clientSeed,
    startNonce,
    totalRounds,
    baseBet,
    startBalance
  } = config;

  let balance = startBalance;
  let nextRoundInitialBet = baseBet;
  let wins = 0, losses = 0, pushes = 0, bjCount = 0;
  let winStreak = 0, lossStreak = 0;
  let highestWinStreak = 0, highestLossStreak = 0;
  let largestBetPlaced = baseBet;
  let wager = 0;
  const increaseOnLoss = 2.0;
  const startTime = Date.now();

  for (let i = 0; i < totalRounds; i++) {
    if (!debugMode && (i + 1) % 100000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const roundsSec = elapsed > 0 ? (i + 1) / elapsed : Infinity;
      const progress = (((i + 1) / totalRounds) * 100).toFixed(2);
      console.log([
        `Progress %: ${progress}`,
        `Rounds: ${i + 1}`,
        `Balance: ${balance.toFixed(2)}`,
        `Profit: ${(balance - startBalance).toFixed(2)}`,
        `Wagered: ${wager.toFixed(2)}`,
        `Wins: ${wins}`,
        `Losses: ${losses}`,
        `Pushes: ${pushes}`,
        `Blackjacks: ${bjCount}`,
        `Highest Win Streak: ${highestWinStreak}`,
        `Highest Losing Streak: ${highestLossStreak}`,
        `Largest Bet Placed: ${largestBetPlaced.toFixed(2)}`,
        `Rounds/sec: ${roundsSec.toFixed(2)}`
      ].join(" | "));
    }
    if (balance < nextRoundInitialBet || nextRoundInitialBet <= 0) break;
    const nonce = startNonce + i;
    const cards = getCardsFromSeed(serverSeed, clientSeed, nonce, 20);

    const player = new BlackjackHand();
    const dealer = new BlackjackHand();

    player.add(cards[0]);
    player.add(cards[2]);
    dealer.add(cards[1]);
    dealer.add(cards[3]);

    let drawIndex = 4;
    const dealerUpCard = dealer.cards[0];
    const playerBJ = player.isBlackjack;
    const dealerBJ = dealer.isBlackjack;

    let totalStakedThisRound = nextRoundInitialBet;
    let roundResult = "";
    let roundOverDueToBJ = false;

    balance -= nextRoundInitialBet;
    wager += nextRoundInitialBet;
    if (nextRoundInitialBet > largestBetPlaced) largestBetPlaced = nextRoundInitialBet;

    if (dealerBJ || playerBJ) {
      roundOverDueToBJ = true;
      if (dealerBJ && playerBJ) {
        pushes++;
        balance += nextRoundInitialBet;
        roundResult = "🤝 PUSH (Both BJ)";
        winStreak = 0;
        lossStreak = 0;
      } else if (dealerBJ) {
        losses++;
        lossStreak++;
        if (lossStreak > highestLossStreak) highestLossStreak = lossStreak;
        winStreak = 0;
        nextRoundInitialBet *= increaseOnLoss;
        roundResult = "❌ LOSE (Dealer BJ)";
      } else if (playerBJ) {
        wins++;
        bjCount++;
        winStreak++;
        if (winStreak > highestWinStreak) highestWinStreak = winStreak;
        lossStreak = 0;
        balance += nextRoundInitialBet * 2.5;
        nextRoundInitialBet = baseBet;
        roundResult = "✅ WIN (Player BJ)";
      }
    } else {

    let action;
    while (true) {
      action = determinePerfectStrategy(player, dealerUpCard);
      if (action === 'H') {
        player.add(cards[drawIndex++]);
        if (player.isBust) break;
      } else if (action === 'D' && player.cards.length === 2 && balance >= nextRoundInitialBet) {
        balance -= nextRoundInitialBet;
        wager += nextRoundInitialBet;
        totalStakedThisRound += nextRoundInitialBet;
        nextRoundInitialBet *= 2;
        player.add(cards[drawIndex++]);
        break;
      } else {
        break;
      }
    }

    while (dealer.total < 17 || (dealer.total === 17 && dealer.isSoft)) {
      dealer.add(cards[drawIndex++]);
    }

    if (player.isBust) {
      losses++;
      lossStreak++;
      if (lossStreak > highestLossStreak) highestLossStreak = lossStreak;
      winStreak = 0;
      nextRoundInitialBet *= increaseOnLoss;
      roundResult = "❌ BUST";
    } else if (dealer.isBust || player.total > dealer.total) {
      wins++;
      winStreak++;
      if (winStreak > highestWinStreak) highestWinStreak = winStreak;
      lossStreak = 0;
      balance += nextRoundInitialBet * 2;
      nextRoundInitialBet = baseBet;
      roundResult = dealer.isBust ? "✅ WIN (Dealer Bust)" : "✅ WIN";
    } else if (player.total === dealer.total) {
      pushes++;
      winStreak = 0;
      lossStreak = 0;
      balance += nextRoundInitialBet;
      roundResult = "🤝 PUSH";
    } else {
      losses++;
      lossStreak++;
      if (lossStreak > highestLossStreak) highestLossStreak = lossStreak;
      winStreak = 0;
      nextRoundInitialBet *= increaseOnLoss;
      roundResult = "❌ LOSE";
    }
  }

    if (debugMode) {
      console.log("┌────────────────────────────────────────────┐");
      console.log(`│ 🧑 Player: ${player.toString().padEnd(58)}│`);
      console.log(`│ 🃏 Dealer: ${dealer.toString().padEnd(58)}│`);
      console.log(`│ 🎰 Round #${(i + 1).toString().padEnd(58)}│`);
      console.log("├────────────────────────────────────────────┤");
      console.log(`│ 🔑 Server Seed: ${serverSeed.substring(0, 10)}....`.padEnd(58) + "│");
      console.log(`│ 🧬 Client Seed: ${clientSeed.padEnd(58)}│`);
      console.log(`│ 🔁 Current Nonce: ${nonce.toString().padEnd(58)}│`);
      console.log(`│ 💰 Balance: ${balance.toFixed(2).padEnd(58)}│`);
      console.log(`│ 📈 Profit: ${(balance - startBalance).toFixed(2).padEnd(58)}│`);
      console.log(`│ 🧾 Stakes this round: ${totalStakedThisRound.toFixed(2)} (Total Sim Wager: ${wager.toFixed(2)})`.padEnd(58) + "│");
      console.log(`│ 🎯 Next Round Bet: ${nextRoundInitialBet.toFixed(2).padEnd(58)}│`);
      console.log(`│ 🔥 Win Streak: ${winStreak}, 🥶 Loss Streak: ${lossStreak}`.padEnd(58) + "│");
      console.log(`│ ${roundResult.padEnd(58)}│`);
      console.log("└────────────────────────────────────────────┘");
      await sleep(debugDelay);
    }

  }

  const endTime = Date.now();
  const seconds = (endTime - startTime) / 1000;

  console.log("\n---------------- FINAL SIMULATION SUMMARY ----------------");
  console.log([
    `Balance: ${balance.toFixed(2)}`,
    `Profit: ${(balance - startBalance).toFixed(2)}`,
    `Total Wagered: ${wager.toFixed(2)}`,
    `Wins: ${wins}`,
    `Losses: ${losses}`,
    `Pushes: ${pushes}`,
    `Blackjacks: ${bjCount}`,
    `Largest Bet: ${largestBetPlaced.toFixed(2)}`,
    `Elapsed Time: ${seconds.toFixed(2)}s`
  ].join(" | "));
  console.log("\n✅ Simulation Complete");
}

if (require.main === module) {
  simulateManyRounds({
    serverSeed: randomServerSeed,
    clientSeed: randomClientSeed,
    startNonce: startNonce,
    totalRounds: debugMode ? 50 : 1680000,
    baseBet: 1,
    startBalance: 1000000000000,
  });
}
