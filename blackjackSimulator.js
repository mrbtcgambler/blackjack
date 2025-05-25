import { unlink, access, constants } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import StakeApi from "./StakeApi.mjs";

const clientConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const serverConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));
let config = {
    apiKey: process.env.CLIENT_API_KEY || clientConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || clientConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || clientConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || clientConfig.currency,
    recoverAmount: process.env.SERVER_RECOVER_AMOUNT || serverConfig.recoverAmount,
    recoverThreshold: process.env.CLIENT_RECOVER_THRESHOLD || clientConfig.recoverThreshold,
    funds: null
};

const apiClient = new StakeApi(config.apiKey);
config.funds = await apiClient.getFunds(config.currency);

await apiClient.depositToVault(config.currency, config.funds.available - clientConfig.recoverThreshold);
await new Promise(r => setTimeout(r, 2000));

let balance = config.funds.available,
    baseBetAmount = balance / 4000,
    currentBet = baseBetAmount,
    profit = 0,
    win = false,
    isBust = false,
    currency = config.currency,
    game = "blackjack", 
    bets = 0,
    wager = 0,
    vaulted = 0,
    currentStreak = 0,
    highestLosingStreak = 0,
    winCount = 0,
    paused = false,
    stage = 1,
    pauseLogged = false,
    lastHourBets = [],
    version = 0.1;

    const pairsTable = [
        // Dealer Up Card:  2, 3, 4, 5, 6, 7, 8, 9, 10, A
        /* 2-2 */  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0], // Always split 2s if the dealer shows 2-7, otherwise hit.
        /* 3-3 */  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0], // Always split 3s if the dealer shows 2-7, otherwise hit.
        /* 4-4 */  [0, 0, 0, 1, 1, 0, 0, 0, 0, 0], // Split 4s if the dealer shows 5 or 6, otherwise hit.
        /* 5-5 */  [2, 2, 2, 2, 2, 2, 2, 2, 0, 0], // Always double down 5s, except against 9, 10, or A.
        /* 6-6 */  [1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // Split 6s if the dealer shows 2-6, otherwise hit.
        /* 7-7 */  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0], // Split 7s if the dealer shows 2-7, otherwise hit.
        /* 8-8 */  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Always split 8s.
        /* 9-9 */  [1, 1, 1, 1, 1, 0, 1, 1, 0, 0], // Split 9s if the dealer shows 2-6, 8, or 9, otherwise stand.
        /* T-T */  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Never split 10s.
        /* A-A */  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Always split Aces.
    ];
    
    const softTable = [
        // Dealer Up Card:  2, 3, 4, 5, 6, 7, 8, 9, 10, A
        /* A,2 */  ["H", "H", "H", "H", "D", "H", "H", "H", "H", "H"],
        /* A,3 */  ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
        /* A,4 */  ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"],
        /* A,5 */  ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"],
        /* A,6 */  ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
        /* A,7 */  ["S", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "H"],
        /* A,8 */  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"],
        /* A,9 */  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]
    ];
    
    const hardTable = [
        // Dealer Up Card:  2, 3, 4, 5, 6, 7, 8, 9, 10, A
        /* 8 */  ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"],
        /* 9 */  ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"],
        /* 10 */ ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"],
        /* 11 */ ["D", "D", "D", "D", "D", "D", "D", "D", "D", "H"],
        /* 12 */ ["H", "H", "S", "S", "S", "H", "H", "H", "H", "H"],
        /* 13 */ ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
        /* 14 */ ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
        /* 15 */ ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
        /* 16 */ ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"],
        /* 17+ */["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]
    ];

const actionMapping = {
    "H": "hit",
    "S": "stand",
    "D": "double",
    "split": "split",
    "noInsurance": "noInsurance"  // Added action for rejecting insurance
}; 

// Delete old state file
const dicebotStateFilename = new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url);
access(dicebotStateFilename, constants.F_OK, (error) => {
    if (!error) {
        unlink(dicebotStateFilename, (err) => {
            if (err) console.error('Error deleting old state file:', err);
        });
    }
});

async function writeStatsFile() {
    await writeFile(dicebotStateFilename, JSON.stringify({
        bets: bets,
        stage: stage,
        wager: wager,
        vaulted: vaulted,
        profit: profit,
        betSize: currentBet,
        currentStreak: currentStreak,
        highestLosingStreak: highestLosingStreak,
        betsPerHour: getBetsPerHour(),
        lastBet: (new Date()).toISOString(),
        wins: winCount,
        losses: (bets - winCount),
        version: version,
        paused: paused
    }));
}

async function doBet() {
    let pauseFileUrl = new URL('pause', import.meta.url);
    access(pauseFileUrl, constants.F_OK, (error) => {
        paused = !error;
    });

    if (paused) {
        if (!pauseLogged) {
            console.log('[INFO] Paused...');
            pauseLogged = true;
        }
        await writeStatsFile();
        await new Promise(r => setTimeout(r, 1000));
        return;
    } else {
        pauseLogged = false; // Reset the flag when not paused
    }

    if (game === "blackjack") {
        try {
            // Check for an active game
            let activeBetResponse = await apiClient.BlackjackActiveBet();
            let activeBetData = JSON.parse(activeBetResponse);

            if (activeBetData && activeBetData.data && activeBetData.data.user && activeBetData.data.user.activeCasinoBet) {
                console.log("Continuing with active game...");
                await continueBlackjackGame(activeBetData.data.user.activeCasinoBet.state);
            } else {
                // Start a new game
                let betResponse = await apiClient.BlackjackBet(currentBet, currency);
                console.log('BlackjackBet Response:', betResponse);

                let betData = JSON.parse(betResponse);

                if (!betData || !betData.data || !betData.data.blackjackBet) {
                    console.error("Invalid response from BlackjackBet:", betData);
                    throw new Error("Invalid response from BlackjackBet");
                }

                betData = betData.data.blackjackBet;

                console.log('Starting Blackjack bet with:', currentBet);
                console.log('Initial Player Cards:', betData.state.player[0].cards);
                console.log('Dealer Up Card:', betData.state.dealer[0].cards[0]);

                while (betData.state.player[0].actions.length > 0 && !isBust) {
                    const playerCards = betData.state.player[0].cards;
                    const dealerUpCard = betData.state.dealer[0].cards[0];

                    // Check for insurance offer and reject it
                    if (betData.state.insuranceOffered) {
                        console.log('Insurance offered, rejecting...');
                        let rejectInsuranceResponse = await apiClient.BlackjackNextBet("noInsurance"); // Pass as string
                        console.log('Insurance Rejected Response:', rejectInsuranceResponse);
                        betData = JSON.parse(rejectInsuranceResponse).data.blackjackNext;
                        continue;
                    }

                    let action = determineAction(playerCards, dealerUpCard);
                    console.log('Player Action:', action);

                    if (!action) {
                        console.error('Invalid action determined:', action);
                        throw new Error("Invalid action determined");
                    }

                    action = actionMapping[action] || action;

                    // Correct API call with the observed syntax
                    let nextResponse = await apiClient.BlackjackNextBet(action); // Pass as string
                    console.log('BlackjackNextBet Response:', nextResponse);

                    let nextData = JSON.parse(nextResponse);

                    if (!nextData || !nextData.data || !nextData.data.blackjackNext) {
                        console.error("Invalid response from BlackjackNextBet:", nextData);
                        throw new Error("Invalid response from BlackjackNextBet");
                    }

                    betData = nextData.data.blackjackNext;

                    console.log('Updated Player Cards:', betData.state.player[0].cards);
                    console.log('Updated Dealer Cards:', betData.state.dealer[0].cards);

                    if (action === "stand" || action === "double" || isBust) {
                        break;
                    }
                }

                profit += betData.state.player[0].profit;
                console.log('Round Profit:', betData.state.player[0].profit);
                console.log('Total Profit:', profit);

                if (profit > 0) {
                    currentBet = baseBetAmount;
                } else if (!betData.state.player[0].win) {
                    currentBet = baseBetAmount ;//*= 2
                }

                console.log('Next Bet Amount:', currentBet);
            }
        } catch (e) {
            console.error(e);
        }
    } else if (game === "dice") {
        // Existing dice game logic here
    } else if (game === "dragontower") {
        // Existing dragon tower game logic here
    }
    lastHourBets.push(+new Date());
    await writeStatsFile();
}


// Blackjack logic
function determineAction(playerCards, dealerUpCard) {
    let playerValue = getPlayerValue(playerCards);
    let dealerValue = getCardValue(dealerUpCard.rank);
    let isPair = playerCards.length === 2 && playerCards[0].rank === playerCards[1].rank;
    let isSoft = playerCards.some(card => card.rank === 'A') && playerValue <= 21;

    console.log('Player Value:', playerValue);
    console.log('Dealer Value:', dealerValue);
    console.log('Is Pair:', isPair);
    console.log('Is Soft:', isSoft);

    if (playerValue > 21) {
        console.error('Player value exceeds 21, player is bust');
        return "bust";
    }

    if (isPair) {
        console.log('Pair detected');
        let cardValue = getCardValue(playerCards[0].rank);
        // Ensure index is within bounds
        if (cardValue >= 2 && cardValue <= 10) {
            const action = pairsTable[cardValue - 2][dealerValue - 2];
            return action === 1 ? "split" : action === 2 ? "double" : "stand"; // Default to stand for pairs of 10s
        } else {
            console.error('Invalid pair card value:', cardValue);
            return "stand"; // Safeguard: stand for any unexpected pair value
        }
    } else if (isSoft) {
        console.log('Soft hand detected');
        if (playerValue - 13 >= 0 && playerValue - 13 < softTable.length) {
            const action = softTable[playerValue - 13][dealerValue - 2];
            return action === "S" ? "stand" : action === "D" ? "double" : "hit";
        } else {
            console.error('Player value out of range for soft hand:', playerValue);
            return "hit"; // Default to hit for out-of-range values
        }
    } else {
        console.log('Hard hand detected');
        if (playerValue < 8) {
            console.log('Player value less than 8, hitting');
            return "hit"; // Always hit on values less than 8
        }
        if (playerValue >= 17) {
            console.log('Player value is 17 or more, standing');
            return "stand"; // Always stand on values of 17 or more
        }
        if (playerValue - 8 >= 0 && playerValue - 8 < hardTable.length) {
            const action = hardTable[playerValue - 8][dealerValue - 2];
            return action === "S" ? "stand" : action === "D" ? "double" : "hit";
        } else {
            console.error('Player value out of range for hard hand:', playerValue);
            return "hit"; // Default to hit for out-of-range values
        }
    }
}
async function continueBlackjackGame(gameState) {
    try {
        console.log('Continuing Blackjack game...');
        console.log('Initial Player Cards:', JSON.stringify(gameState.player[0].cards));
        console.log('Dealer Up Card:', JSON.stringify(gameState.dealer[0].cards[0]));
        console.log('Game State:', JSON.stringify(gameState, null, 2));

        // Handle insurance if necessary
        if (gameState.dealer[0].cards[0].rank === 'A') {
            console.log('Dealer showing an Ace, checking for insurance...');

            if (gameState.player[0].actions.includes("noInsurance")) {
                console.log('Insurance available, rejecting insurance...');

                let rejectInsuranceResponse = await apiClient.BlackjackNextBet("noInsurance", gameState.id);
                let rejectInsuranceData = JSON.parse(rejectInsuranceResponse);

                if (rejectInsuranceData.errors && rejectInsuranceData.errors.length > 0) {
                    console.error('Insurance rejection failed with errors:', rejectInsuranceData.errors);
                    throw new Error('Insurance rejection failed');
                }

                if (!rejectInsuranceData.data || !rejectInsuranceData.data.blackjackNext) {
                    console.error('Invalid response during insurance rejection:', rejectInsuranceResponse);
                    throw new Error('Invalid insurance rejection response');
                }

                gameState = rejectInsuranceData.data.blackjackNext;
                console.log('Insurance successfully rejected. Updated Game State:', JSON.stringify(gameState, null, 2));

                // Re-check actions after insurance is handled
                if (gameState.player[0].actions.includes("deal")) {
                    console.log('Insurance handled, proceeding with the game...');
                } else {
                    console.error('Expected to proceed with the game, but no valid actions are available. Halting.');
                    return;
                }
            } else {
                console.log('No insurance action available, likely already handled. Proceeding...');
            }
        }

        // Proceed with the usual gameplay after ensuring insurance is handled
        for (let i = 0; i < gameState.player.length; i++) {
            const playerHand = gameState.player[i];
            const playerCards = playerHand.cards;
            const dealerUpCard = gameState.dealer[0].cards[0];

            console.log(`Processing hand ${i + 1} with cards:`, playerCards);

            let action = determineAction(playerCards, dealerUpCard);
            console.log('Determined Player Action:', action);

            if (!playerHand.actions.includes(action)) {
                console.warn(`Action ${action} is not valid. Checking for alternatives.`);
                if (playerHand.actions.includes("stand")) {
                    action = "stand";
                } else {
                    action = playerHand.actions[0];
                    console.warn(`Fallback action chosen: ${action}`);
                }
            }

            console.log('Executing Player Action:', action);

            let nextResponse = await apiClient.BlackjackNextBet(action, gameState.id);
            let nextData = JSON.parse(nextResponse);

            if (!nextData || !nextData.data || !nextData.data.blackjackNext) {
                throw new Error("Invalid response from BlackjackNextBet");
            }

            gameState = nextData.data.blackjackNext;
            console.log('Updated Player Cards:', JSON.stringify(playerHand.cards));
            console.log('Updated Dealer Cards:', JSON.stringify(gameState.dealer[0].cards));

            if (getPlayerValue(playerCards) > 21) {
                console.log('Player value exceeds 21, player is bust.');
                break;  // No further action required if bust
            }

            if (action === "stand" || action === "double") {
                break; // End processing if the action is a final action like "stand"
            }
        }

        profit += gameState.player.reduce((acc, hand) => acc + hand.profit, 0);
        console.log('Round Profit:', profit);
        console.log('Total Profit:', profit);

        currentBet = profit > 0 ? baseBetAmount : currentBet * 2;
        console.log('Next Bet Amount:', currentBet);

    } catch (e) {
        console.error('Error during Blackjack game:', e);
    }
}

function getPlayerValue(cards) {
    let value = 0;
    let aceCount = 0;

    cards.forEach(card => {
        if (card.rank === 'A') {
            aceCount++;
        } else {
            value += getCardValue(card.rank);
        }
    });

    while (aceCount > 0) {
        if (value + 11 <= 21) {
            value += 11;
        } else {
            value += 1;
        }
        aceCount--;
    }

    return value;
}

function getCardValue(rank) {
    if (rank === 'A') return 1;
    if (['K', 'Q', 'J'].includes(rank)) return 10;
    return parseInt(rank);
}

function getBetsPerHour() {
    const now = +new Date();
    lastHourBets = lastHourBets.filter((timestamp) => now - timestamp <= 60 * 60 * 1000);

    return lastHourBets.length;
}

(async () => {
    while (true) {
        await doBet();
        await new Promise(r => setTimeout(r, 1000)); // wait 1 second between bets
    }
})();
