#!/bin/bash

# Configuration
NAME="naderyasser"
EMAIL="naderyasser023@gmail.com"
BRANCH="chore/contributions-backfill-full"
FILE="contributions-full-log.txt"

# Switch to new branch
git checkout -b $BRANCH

touch $FILE

# Days in January 2026: 31
# Days in February 2026: 28

for MONTH in 1 2; do
  if [ $MONTH -eq 1 ]; then
    DAYS=31
  else
    DAYS=28
  fi
  
  for DAY in $(seq 1 $DAYS); do
    DATE=$(printf "2026-%02d-%02d" $MONTH $DAY)
    
    # Generate a random number of commits for this day (between 4 and 10 commits per day to make it nice and green)
    NUM_COMMITS=$((4 + RANDOM % 7))
    
    for i in $(seq 1 $NUM_COMMITS); do
      # Generate random time during the day
      HOUR=$((9 + RANDOM % 12))
      MIN=$((RANDOM % 60))
      SEC=$((RANDOM % 60))
      TIME=$(printf "%02d:%02d:%02d" $HOUR $MIN $SEC)
      TIMESTAMP="${DATE}T${TIME}"
      
      echo "Commit $i for ${TIMESTAMP}" >> $FILE
      git add $FILE
      
      GIT_AUTHOR_DATE="$TIMESTAMP" GIT_COMMITTER_DATE="$TIMESTAMP" \
      GIT_AUTHOR_NAME="$NAME" GIT_AUTHOR_EMAIL="$EMAIL" \
      GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$EMAIL" \
      git commit -m "Update logs for $DATE - Part $i" > /dev/null
    done
  done
done

# Push to remote
GIT_SSH_COMMAND="ssh -i /home/frappeuser/.ssh/github_nader_rsa -o IdentitiesOnly=yes" git push origin $BRANCH

echo "Done generating full graph for Jan and Feb 2026!"
