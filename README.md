# Second Look

Point your camera at something. One model explains what is in the photo and pins each claim to a spot. A second model, shown only that spot, says whether it is really there.

Live: https://patbing.github.io/second-look/ · Built for Pollinations quest #20023.

## What it does

1. Your photo is resized in the browser and a lettered grid (A–D × 1–3) is drawn on it.
2. `z-ai/glm-5.3-flash` explains the photo as 3–5 claims, each pinned to one grid cell, with how to spot it and one fact the photo cannot show.
3. Code crops each pinned cell. `openai/gpt-6-luna`, another model family, sees only that crop, says what it sees, then answers yes or no: is the claimed thing there?
4. Each photo also gets a decoy question about something that is not there. If the checker says yes to it, that photo's confirmations are marked weak.

Green pins are confirmed, red disputed, grey unanswered. "Did you know" facts come from the model's knowledge and are labelled as not checked.

Before sign-in, recorded photos replay real model replies, with a person's own check of each claim for comparison.

## Why these models

A pilot on three photos (in `docs/`-style notes in the commit history) tried other pairs. Picking a label for each crop agreed with the photo about half the time; a yes/no question to `openai/gpt-6-luna` confirmed 10 of 10 true claims, refused 8 of 10 claims moved to the farthest cell, and refused 4 of 4 decoys.

## Run it

Static files, no build. Serve the folder and open it. Sign in with Pollinations Connect to send a photo; you pay with your own Pollen and both default models are free-tier. The page will not send a photo that could push one visit past 0.05 Pollen (`CAP` in `js/config.js`). Tests: `npm test`.

## Files

- `js/look.js` grid cells, prompts, reply parsing, decoys, tally (pure, tested)
- `js/net.js` the only file that talks to `gen.pollinations.ai`
- `js/app.js` the page: grid, crops, pins
- `tools/record.py` makes the recorded photos, with a spend cap

Recorded photos are from Wikimedia Commons; each shows its author and licence. MIT licence for the code.
