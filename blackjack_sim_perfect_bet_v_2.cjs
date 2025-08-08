// Blackjack Simulator using Perfect Strategy & Martingale Betting
// (c) mrbtcgambler - Open Source Educational Tool
// Aligned with the main bot script by Gemini

const { createHmac } = require('crypto');

// ---------------------------- Config & Global Control ----------------------------
const useRandomSeed = false; // Set to true to use random seeds for each run
const debugMode = false; // Set to true for detailed round-by-round logs
const debugDelay = 500; // Delay in ms between rounds in debug mode

// --- Simulation Parameters ---
const totalRoundsToSimulate = 87600000; //240000 (1 day), 1680000 (1 week), 7300000 (1 month), 87600000(1 year) 
const startingBalance = 1000000;
const baseBetRatio = 10000; // Bet is balance / 1000, same as the main bot
const playBalance = 10; // Balance to play with, same as the main bot

const increaseOnLossFactor = 2.0; // Martingale multiplier, same as the main bot

// --- Provably Fair Settings ---
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

// ---------------------------- Provably Fair Engine ----------------------------
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

function hmacSha256(seed, msg) {
    return createHmac('sha256', seed).update(msg).digest();
}

// Corrected function to return an array of card strings
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

// ---------------------------- Hand & Card Logic ----------------------------
function getCardFromString(cardString) {
    if (!cardString) {
        throw new Error("Attempted to draw from an empty card pool.");
    }
    return {
        rank: cardString.slice(1),
        suit: cardString.slice(0, 1),
        cardString: cardString
    };
}

function getCardValue(card) {
    const rank = card.rank;
    if (["J", "Q", "K"].includes(rank)) return 10;
    if (rank === "A") return 11;
    return parseInt(rank);
}

class BlackjackHand {
    constructor(cards = []) {
        this.cards = cards;
    }

    add(card) {
        this.cards.push(card);
    }

    get total() {
        let total = this.cards.reduce((acc, card) => acc + getCardValue(card), 0);
        let aces = this.cards.filter(c => c.rank === 'A').length;
        while (total > 21 && aces-- > 0) {
            total -= 10;
        }
        return total;
    }

    get isBlackjack() {
        return this.cards.length === 2 && this.total === 21;
    }

    get isBust() {
        return this.total > 21;
    }

    toString() {
        return this.cards.map(c => c.cardString).join(', ');
    }
}

// ---------------------------- Perfect Strategy Logic (from main bot) ----------------------------
const pairsTable = [
    ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
    ['H', 'H', 'H', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
    ['P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
    ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
];
const softTable = [
    ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    ['D', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
    ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
    ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S']
];
const hardTable = [
    ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
    ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H'],
    ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S']
];

function determineBestAction(playerHand, dealerUpCard, hasSplit = false) {
    const pv = playerHand.total;
    const dvRaw = getCardValue(dealerUpCard);
    const dv = dvRaw === 11 ? 11 : dvRaw;
    const di = Math.max(0, Math.min(dv === 11 ? 9 : dv - 2, 9));
    const canDouble = playerHand.cards.length === 2;

    let actionCode = 'S';
    if (playerHand.cards.length === 2 && getCardValue(playerHand.cards[0]) === getCardValue(playerHand.cards[1]) && !hasSplit) {
        const pi = Math.max(0, Math.min(getCardValue(playerHand.cards[0]) - 2, 9));
        actionCode = pairsTable[pi][di];
    } else if (playerHand.cards.some(c => c.rank === 'A') && pv <= 21) {
        const si = Math.max(0, Math.min(pv - 13, softTable.length - 1));
        actionCode = softTable[si][di];
    } else {
        const hi = pv <= 8 ? 0 : Math.max(0, Math.min(pv - 8, hardTable.length - 1));
        actionCode = hardTable[hi][di];
    }

    if (actionCode === 'D' && !canDouble) return 'H';
    if (actionCode === 'Ds' && !canDouble) return 'S';
    return actionCode;
}


// ---------------------------- Multi-Round Simulation Engine ----------------------------
async function simulateManyRounds(config) {
    const { serverSeed, clientSeed, startNonce, totalRounds, debugMode, debugDelay } = config;

    let balance = config.startBalance;
    const baseBetAmount = playBalance / config.baseBetRatio;
    let currentBet = baseBetAmount;
    
    let wins = 0, losses = 0, pushes = 0, blackjacks = 0;
    let worstLosingStreak = 0;
    let currentStreak = 0; // Positive for wins, negative for losses
    let largestBetPlaced = currentBet;
    let totalWagered = 0;
    const startTime = Date.now();
    let i; // Declare i outside the loop to be accessible in the final summary

    for (i = 0; i < totalRounds; i++) {
        try {
            const nonce = startNonce + i;
            if (balance < currentBet) {
                console.log(`\n--- SIMULATION ENDED: INSUFFICIENT FUNDS ---`);
                console.log(`Busted on round ${i + 1}. Balance: ${balance.toFixed(8)}, Needed: ${currentBet.toFixed(8)}`);
                break;
            }

            largestBetPlaced = Math.max(largestBetPlaced, currentBet);

            const balanceBeforeRound = balance;
            balance -= currentBet;
            let roundWager = currentBet;

            const cardPool = getCardsFromSeed(serverSeed, clientSeed, nonce, 100).map(cardString => getCardFromString(cardString));
            let drawIndex = 0;

            let playerHands = [new BlackjackHand([cardPool[drawIndex++], cardPool[drawIndex++]])];
            let handStakes = [currentBet];
            const dealerHand = new BlackjackHand([cardPool[drawIndex++], cardPool[drawIndex++]]);

            // Handle initial blackjacks
            if (dealerHand.isBlackjack) {
                if (playerHands[0].isBlackjack) {
                    // Push, bet returned. Do not increment counters here; handled by roundProfit classification below
                    balance += handStakes[0];
                } else {
                    // Loss is implicitly handled by the initial bet deduction
                }
            } else if (playerHands[0].isBlackjack) {
                blackjacks++;
                // Return stake + 3:2 payout on stake
                balance += handStakes[0] + (handStakes[0] * 1.5);
            } else {
                // Play out hands
                let handIndex = 0;
                while (handIndex < playerHands.length) {
                    let currentHand = playerHands[handIndex];
                    let hasSplit = playerHands.length > 1;

                    while (true) {
                        if (currentHand.total >= 21) break;
                        
                        const action = determineBestAction(currentHand, dealerHand.cards[0], hasSplit);

                        if (action === 'S') {
                            break;
                        } else if (action === 'H') {
                            currentHand.add(cardPool[drawIndex++]);
                        } else if (action === 'D') {
                            const stakeToDouble = handStakes[handIndex];
                            if (balance < stakeToDouble) { // Can't double up
                                currentHand.add(cardPool[drawIndex++]);
                            } else {
                                balance -= stakeToDouble;
                                roundWager += stakeToDouble;
                                handStakes[handIndex] = stakeToDouble * 2;
                                largestBetPlaced = Math.max(largestBetPlaced, handStakes[handIndex]);
                                currentHand.add(cardPool[drawIndex++]);
                            }
                            break;
                        } else if (action === 'P' && playerHands.length < 4) { // Prevent infinite splitting
                            const stakeToMatch = handStakes[handIndex];
                            if (balance < stakeToMatch) { // Can't split
                                const hardAction = determineBestAction(new BlackjackHand(currentHand.cards), dealerHand.cards[0], true);
                                if(hardAction === 'H') currentHand.add(cardPool[drawIndex++]); else break;
                            } else {
                                balance -= stakeToMatch;
                                roundWager += stakeToMatch;
                                const secondCard = currentHand.cards.pop();
                                playerHands.push(new BlackjackHand([secondCard, cardPool[drawIndex++]]));
                                handStakes.push(stakeToMatch);
                                largestBetPlaced = Math.max(largestBetPlaced, stakeToMatch);
                                currentHand.add(cardPool[drawIndex++]);
                            }
                        } else {
                            const hardTotal = currentHand.total;
                            if (hardTotal < 17) { 
                                currentHand.add(cardPool[drawIndex++]);
                            } else {
                                break; 
                            }
                        }
                    }
                    handIndex++;
                }

                // Dealer's turn
                while (dealerHand.total < 17 || (dealerHand.total === 17 && dealerHand.cards.some(c => c.rank === 'A'))) {
                    if (dealerHand.isBust) break;
                    dealerHand.add(cardPool[drawIndex++]);
                }

                // Settle bets
                playerHands.forEach((hand, idx) => {
                    const handBet = handStakes[idx];
                    if (hand.isBust) {
                        // Loss already accounted for
                    } else if (dealerHand.isBust || hand.total > dealerHand.total) {
                        balance += handBet * 2;
                    } else if (hand.total < dealerHand.total) {
                        // Loss already accounted for
                    } else {
                        balance += handBet;
                    }
                });
            }
            
            const roundProfit = balance - balanceBeforeRound;
            
            if (roundProfit > 0) wins++;
            else if (roundProfit < 0) losses++;
            else pushes++;

            totalWagered += roundWager;
            
            // Martingale & Streak Logic
            if (roundProfit > 0) { // Win
                currentBet = baseBetAmount;
                currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
            } else if (roundProfit < 0) { // Loss
                currentBet *= increaseOnLossFactor;
                currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
                if(Math.abs(currentStreak) > worstLosingStreak) {
                    worstLosingStreak = Math.abs(currentStreak);
                }
            } else { // Push
                // FIX: A push should not reset the streak counter for Martingale
                // currentStreak = 0; 
            }

            if (debugMode) {
                console.log(`\n--- Round ${i + 1} | Nonce ${nonce} ---`);
                console.log(`Server Seed: ${serverSeed}`);
                console.log(`Client Seed: ${clientSeed}`);
                console.log(`Nonce: ${nonce}`);
                console.log(`Player Hands: ${playerHands.map(h => h.toString() + ` (${h.total})`).join(' | ')}`);
                console.log(`Dealer Hand: ${dealerHand.toString()} (${dealerHand.total})`);
                console.log(`Result: ${roundProfit > 0 ? 'WIN' : roundProfit < 0 ? 'LOSS' : 'PUSH'} | Profit: ${roundProfit.toFixed(8)}`);
                console.log(`New Balance: ${balance.toFixed(8)} | Next Bet: ${currentBet.toFixed(8)}`);
                console.log(`Current Streak: ${currentStreak} | Worst Loss Streak: ${worstLosingStreak} | Largest Bet: ${largestBetPlaced.toFixed(8)}`);
                await new Promise(r => setTimeout(r, debugDelay));
            } else if ((i + 1) % 100000 === 0) {
                const runTimeSeconds = (Date.now() - startTime) / 1000;
                const betsPerSecond = ((i + 1) / runTimeSeconds).toFixed(2);
                console.log(
                    [
                        `Progress %: ${(((i + 1) / totalRounds) * 100).toFixed(2)}`,
                        `Rounds: ${i + 1}`,
                        `Balance: ${balance.toFixed(4)}`,
                        `Profit: ${(balance - config.startBalance).toFixed(4)}`,
                        `Total Wagered: ${totalWagered.toFixed(4)}`,
                        `Worst Loss Streak: ${worstLosingStreak}`,
                        `Bets per Second: ${betsPerSecond}`
                    ].join(' | ')
                );
            }
        } catch (error) {
            console.error(`\n--- ERROR on Round ${i + 1} (Nonce: ${startNonce + i}) ---`);
            console.error(error.message);
            break; // Stop the simulation on error
        }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n✅ Simulation Complete in ${duration.toFixed(2)}s`);
    console.log(`----------------------------------------`);
    console.log(`Final Balance: ${balance.toFixed(8)}`);
    console.log(`Total Profit: ${(balance - config.startBalance).toFixed(8)}`);
    console.log(`Total Wagered: ${totalWagered.toFixed(8)}`);
    console.log(`Rounds Played: ${i}`);
    console.log(`Wins: ${wins}, Losses: ${losses}, Pushes: ${pushes}`);
    console.log(`Blackjacks: ${blackjacks}`);
    console.log(`Worst Losing Streak: ${worstLosingStreak}`);
    console.log(`Largest Bet Placed: ${largestBetPlaced.toFixed(8)}`);
    console.log(`----------------------------------------`);
}

// ---------------------------- Start Simulation ----------------------------
simulateManyRounds({
    serverSeed: randomServerSeed,
    clientSeed: randomClientSeed,
    startNonce: startNonce,
    totalRounds: totalRoundsToSimulate,
    startBalance: startingBalance,
    baseBetRatio: baseBetRatio,
    debugMode: debugMode,
    debugDelay: debugDelay
});
