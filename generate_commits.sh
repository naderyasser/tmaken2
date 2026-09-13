#!/bin/bash

# Configuration
NAME="naderyasser"
EMAIL="naderyasser023@gmail.com"
BRANCH="chore/contributions-backfill"
FILE="contributions-log.txt"

# Array of dates in format YYYY-MM-DD
DATES=(
  "2026-01-01" "2026-01-04" "2026-01-05" "2026-01-06" "2026-01-09" "2026-01-10"
  "2026-01-12" "2026-01-15" "2026-01-16" "2026-01-17" "2026-01-20" "2026-01-21"
  "2026-01-25" "2026-01-28" "2026-01-29" "2026-01-30"
  "2026-02-05" "2026-02-06" "2026-02-07" "2026-02-11" "2026-02-12"
  "2026-02-15" "2026-02-16" "2026-02-17" "2026-02-23" "2026-02-24"
  "2026-02-25" "2026-02-26" "2026-02-27"
)

# Switch to new branch
git checkout -b $BRANCH

touch $FILE

for DATE in "${DATES[@]}"; do
  # Generate a random hour between 10 and 18, minute and second
  HOUR=$((10 + RANDOM % 9))
  MIN=$((RANDOM % 60))
  SEC=$((RANDOM % 60))
  
  # Format with leading zeros
  printf -v TIME "%02d:%02d:%02d" $HOUR $MIN $SEC
  
  TIMESTAMP="${DATE}T${TIME}"
  
  # Add content to file
  echo "Commit for ${TIMESTAMP}" >> $FILE
  
  # Add and commit
  git add $FILE
  
  GIT_AUTHOR_DATE="$TIMESTAMP" GIT_COMMITTER_DATE="$TIMESTAMP" \
  GIT_AUTHOR_NAME="$NAME" GIT_AUTHOR_EMAIL="$EMAIL" \
  GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$EMAIL" \
  git commit -m "Update logs for $DATE"
done

# Push to remote
git push origin $BRANCH

echo "Done!"
