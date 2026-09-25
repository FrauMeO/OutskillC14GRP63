#!/bin/bash
# Saves a checkpoint of the project with git, so you can always return to a working version.
# Use it after each prompt step once the app works.
cd "$(dirname "$0")" || exit 1
if ! git --version >/dev/null 2>&1; then
  xcode-select --install 2>/dev/null
  echo "Git needs Apple's developer tools. Finish that install, then run this again."
  read -r -p "Press Return to close. "; exit 1
fi
if [ ! -d .git ]; then
  git init -q -b main
  git config user.name  >/dev/null || git config user.name  "$(id -F 2>/dev/null || whoami)"
  git config user.email >/dev/null || git config user.email "$(whoami)@localhost"
fi
git add -A
if git diff --cached --quiet; then
  echo "Nothing has changed since the last checkpoint."
else
  echo "Changed files:"; git diff --cached --stat | tail -n 15
  read -r -p "Describe this checkpoint (for example: Prompt 3 habit logging works): " msg
  git commit -q -m "Checkpoint: ${msg:-unnamed}"
  echo "Saved."
fi
echo; echo "Recent checkpoints:"; git log --oneline -n 8
read -r -p "Press Return to close. "
