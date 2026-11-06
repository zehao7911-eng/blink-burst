# Blink Burst

Tap bright orange eyes before the countdown ring closes. Hold pink eyes until the charge bar fills. Leave crossed decoys alone. Missing a scoring eye or tapping a decoy costs one of five lives. Three consecutive hits increase the point bonus, and the pace increases as the round goes on.

Tap **Pause** or press Escape to stop the round. Continue restores the score, lives, positions and remaining countdowns. Each round saves its own checkpoint.

Extract the ZIP and open `index.html` or `standalone.html` to play offline. `index-source.html` is the editable HTTP-served entry. Run `python build.py` to regenerate both offline entries. Run `node tests.mjs` to check game rules and the SDK adapter.

The public reference is Rezona's [Eyebloom](https://rezona.ai/game/pgcserver/pv/QsDURwfE/v4/dist/index.html). Blink Burst rebuilds the pop, avoid and hold loop with original CSS artwork, procedural sound, its own scoring and spawn tuning, and a separate name.

## GameWave

Use the root-index ZIP. The game starts independently of `window.neonlib`. GameWave receives start calls from real play or continuation and an end call when the last life is lost or a started round is abandoned. Local and cloud saves use the game's own `blink-burst-v1` key and versioned profile.

A confirmed positive like equips a gold arcade badge. A confirmed new direct comment equips mint burst confetti. The rewards are optional and their flags persist. A local-only flag is specific to the browser profile.

The official SDK document was rechecked during reference research on November 6, 2026, and displayed an October 30 revision. [GameWave SDK](https://rg975ojk5z.feishu.cn/wiki/MQg7wMknzieOkukxyWVc4UB0nDh)
