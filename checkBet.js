// Blackjack Simulator using Perfect Strategy
// (c) mrbtcgambler - Open Source Educational Tool

const { createHmac } = require('crypto');

// ---------------------------- Card Definitions ----------------------------
// Stake.com-style 52-card infinite shoe in fixed suit order
const CARDS = [
  '♦2', '♥2', '♠2', '♣2', '♦3', '♥3', '♠3', '♣3',
  '♦4', '♥4', '♠4', '♣4', '♦5', '♥5', '♠5', '♣5',
  '♦6', '♥6', '♠6', '♣6', '♦7', '♥7', '♠7', '♣7',
  '♦8', '♥8', '♠8', '♣8', '♦9', '♥9', '♠9', '♣9',
  '♦10','♥10','♠10','♣10','♦J','♥J','♠J','♣J',
  '♦Q','♥Q','♠Q','♣Q','♦K','♥K','♠K','♣K',
  '♦A','♥A','♠A','♣A'
];

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
      const f = hash[i] / 256 + hash[i+1]/(256**2) + hash[i+2]/(256**3) + hash[i+3]/(256**4);
      floats.push(f);
    }
  }
  return floats.map(f => CARDS[Math.floor(f * 52)]);
}

// ---------------------------- Round Simulation ----------------------------
function simulateBlackjackRound(serverSeed, clientSeed, nonce) {
  const cards = getCardsFromSeed(serverSeed, clientSeed, nonce, 12);
  const player = new BlackjackHand();
  const dealer = new BlackjackHand();

  player.add(cards[0]);
  player.add(cards[1]);
  dealer.add(cards[2]);
  dealer.add(cards[3]);

  let drawIndex = 4;

  console.log(`\n🎲 Round (Nonce ${nonce})`);
  console.log(`🧑 Player: ${player.toString()}`);
  console.log(`🃏 Dealer: ${dealer.toString()}`);

  // Check for initial Blackjack condition or insurance offer
  const playerBJ = player.isBlackjack;
  const dealerBJ = dealer.isBlackjack;
  const dealerUpCard = dealer.cards[0];

  if (dealerUpCard.endsWith('A')) {
    console.log("💡 Insurance offered (but not taken).");
  }

  // --- Check for Blackjack resolution ---
  if (dealerBJ || playerBJ) {
    if (dealerBJ && playerBJ) return console.log("🤝 Push (both have Blackjack).");
    if (dealerBJ) return console.log("❌ Dealer has Blackjack. Player loses.");
    if (playerBJ) return console.log("✅ Player has Blackjack!");
  }

  // Player turn (basic logic: hit under 17)
  while (player.total < 17) {
    player.add(cards[drawIndex++]);
    console.log(`🔁 Player hits: ${player.toString()}`);
    if (player.isBust) break;
  }

  // Dealer turn
  if (!player.isBust) {
    while (dealer.total < 17 || (dealer.total === 17 && dealer.isSoft)) {
      dealer.add(cards[drawIndex++]);
      console.log(`🔁 Dealer hits: ${dealer.toString()}`);
    }
  }

  // Outcome
  const p = player;
  const d = dealer;
  if (p.isBust) return console.log("❌ Player busts. Dealer wins.");
  if (d.isBust) return console.log("✅ Dealer busts. Player wins.");
  if (p.total > d.total) return console.log("✅ Player wins.");
  if (p.total < d.total) return console.log("❌ Dealer wins.");
  console.log("🤝 Push.");
}

// ---------------------------- Example Run ----------------------------
simulateBlackjackRound(
  'd83729554eeed8965116385e0486dab8a1f6634ae1a9e8139e849ab75f17341d',
  'wcvqnIM521',
  26
);
