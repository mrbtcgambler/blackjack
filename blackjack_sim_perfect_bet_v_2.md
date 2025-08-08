# Blackjack Simulator – Perfect Strategy + Provably Fair + Martingale

**Author:** [mrbtcgambler](https://github.com/mrbtcgambler)  
**Purpose:** Educational tool to demonstrate the **real risks** of casino gambling, even with optimal play.  
**Language:** Node.js  
**License:** Open Source (Educational Use Only)  

---

## 📖 Overview

This project is a **one-of-a-kind** high-speed Blackjack simulator that accurately reproduces **casino-style provably fair randomness** and plays each hand using **perfect Blackjack strategy** (the mathematically optimal set of decisions).  

It can simulate **up to ~50,000 rounds per second** on a typical machine while applying a **Martingale betting system** to show exactly how bankrolls rise and fall over time.

**⚠️ Disclaimer:**  
This code is for **education only**. It is **not** gambling software, and the author does **not** advocate gambling. It’s here to show why betting systems cannot beat the house in the long run, even in the fairest possible game.

---

## ✨ Features

- **Provably Fair Randomness**
  - Uses `HMAC-SHA256(server_seed, client_seed:nonce)` to generate results.
  - Anyone with the seeds and nonce can replay the same hands exactly.
  - Infinite-shoe dealing (with replacement), just like most crypto casinos.

- **Perfect Blackjack Strategy**
  - Encoded via 3 decision tables: **pairs**, **soft totals**, **hard totals**.
  - Includes splitting, doubling, and correct dealer play (dealer hits soft 17).
  - Blackjack pays 3:2.

- **Martingale Betting System**
  - Doubles the next bet after a loss, resets to base after a win.
  - Demonstrates why even “perfect play” cannot guarantee profit.

- **High-Speed Simulation**
  - No I/O or network calls during simulation.
  - Minimal logging for maximum speed.
  - Generates and deals cards entirely in memory.
  - Written to exploit Node’s fast native crypto primitives.

- **Detailed Stats**
  - Wins, losses, pushes, blackjacks.
  - Worst losing streak.
  - Largest bet placed.
  - Total wagered.
  - Bets per second.

---

## ⚙️ How It Works

1. **Initial Setup**
   - Choose fixed or random server/client seeds.
   - Set starting bankroll, base bet ratio, Martingale multiplier.

2. **Per Round**
   - Generate random cards using **HMAC-SHA256**:
     ```plaintext
     server_seed + client_seed + nonce + cursor
     ```
   - Deal to player and dealer.
   - Player plays out hand(s) using **perfect strategy**.
   - Dealer plays by house rules (hits soft 17).
   - Settle bets (win, loss, push, blackjack 3:2 payout).
   - Adjust next bet using **Martingale** rules.

3. **Repeat** for millions of rounds at speed.

---

## 🧮 Why "Perfect Strategy"?

Blackjack is one of the few casino games with a very low house edge — **~0.4% to 0.7%** under common rules — when you play every hand optimally.  

Perfect strategy:
- Minimises house edge.
- Removes emotional/guess play.
- Is based on millions of simulated hands and probability tables.

---

## 🚀 Performance

On a modern CPU:
- ~50,000 rounds per second in default mode (no debug logging).
- Full year of simulated play (~87M rounds) in under half an hour.
- Results are **100% reproducible** with the same seeds.

---

## 📊 Example Output

```plaintext
Progress %: 11.42 | Rounds: 10000000 | Balance: 0.1234 | Profit: -0.4567 | Total Wagered: 5.6789
Worst Loss Streak: 9 | Bets per Second: 49780.21

✅ Simulation Complete in 1753.20s
----------------------------------------
Final Balance: 0.05432100
Total Profit: -0.04567900
Total Wagered: 123.45678900
Rounds Played: 87600000
Wins: 38942000, Losses: 40012000, Pushes: 8656000
Blackjacks: 4008000
Worst Losing Streak: 11
Largest Bet Placed: 0.51200000
----------------------------------------
```

---

## 📦 Install & Run

**Requirements**
- Node.js v18+ (for native crypto speed)

```bash
git clone https://github.com/mrbtcgambler/blackjack-simulator.git
cd blackjack-simulator
node blackjack.js
```

**Configuration**
Edit the variables at the top of the script:
- `useRandomSeed` – whether to randomise each run.
- `totalRoundsToSimulate` – number of rounds to play.
- `startingBalance` – bankroll in “units”.
- `baseBetRatio` – controls base bet size.
- `increaseOnLossFactor` – Martingale multiplier.

---

## 📚 Educational Value

This simulator is designed to:
- Show that **perfect play** ≠ guaranteed wins.
- Teach how **provably fair randomness** works in crypto casinos.
- Quantify the risk of **progressive betting systems** like Martingale.
- Provide a reproducible testing ground for statistical analysis.

---

## ⚠️ Legal & Ethical Note

This project:
- Is **not** gambling software.
- Does **not** connect to any casino.
- Is intended for education, research, and awareness only.
- The author is not responsible for misuse.

---

## 📜 License

MIT License — free to use, modify, and share, but please credit **mrbtcgambler**.
