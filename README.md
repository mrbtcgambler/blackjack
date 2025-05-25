# ♠ Blackjack Simulator using Perfect Strategy
(c) mrbtcgambler – Open Source Educational Tool

This high-speed Blackjack simulator demonstrates fair play and risk exposure using a provably fair card draw engine, Martingale progression, and an optional Perfect Strategy integration.

---

## 🛠 Requirements

- Stake account (Over 18's only!)  
  👉 Join here: https://stake.com/?c=oZP9iLB2

- Node.js (v18 or higher recommended)  
  👉 Install from: https://nodejs.org/

---

## ▶️ Running the Simulator

1. **Install dependencies** (only crypto needed, already built-in):
```bash
npm install crypto
```

2. **Run the script**:
```bash
node blackjackSimulator.js
```

---

## ⚙️ Configuration (edit in script)

```js
const takeInsurance = false;     // Enable/disable insurance bet
const useRandomSeed = false;     // Use random or fixed seeds
const debugMode = true;          // Show each round with visuals
const debugDelay = 1000;         // Delay in ms between rounds (debug only)
```

You can also customise:
- `baseBet`
- `startBalance`
- `totalRounds`

---

## 🎯 Strategy

- Blackjack pays 3:2
- Martingale logic (2x bet after loss, reset on win)
- Push does not reset bet
- Tracks streaks, win/loss rate, bet sizes, profit/loss

---

## 🧪 Example Summary Output

```bash
Progress %: 100.00 | Rounds: 100000 | Profit: 314.50 | Win Rate: 43.2% | Rounds/sec: 91,500
✅ Simulation Complete
Highest Win Streak: 17
Largest Bet Placed: 128.00
```

---

## 📜 License

MIT – Use freely with attribution to **@mrbtcgambler**
