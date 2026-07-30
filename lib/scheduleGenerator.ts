export interface Team {
  id: string;
  name?: string;
}

export interface ScheduledMatch {
  home_team_id: string | null;
  away_team_id: string | null;
  match_number: number;
  leg: number;
  scheduled_order: number;
  stage_name?: string;
  is_placeholder?: boolean;
}

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex: number;
  const result = [...array];
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
  }
  return result;
}

function resolveConsecutiveConstraint(matches: ScheduledMatch[]): ScheduledMatch[] {
  const resolved = [...matches];
  let maxIterations = 100;
  
  while (maxIterations > 0) {
    let violationIndex = -1;
    const consecutiveCount: Record<string, number> = {};
    
    for (let i = 0; i < resolved.length; i++) {
      const match = resolved[i];
      const h = match.home_team_id;
      const a = match.away_team_id;
      
      if (h) consecutiveCount[h] = (consecutiveCount[h] || 0) + 1;
      if (a) consecutiveCount[a] = (consecutiveCount[a] || 0) + 1;
      
      for (const t in consecutiveCount) {
        if (t !== h && t !== a) {
          consecutiveCount[t] = 0;
        }
      }
      
      if ((h && consecutiveCount[h] > 2) || (a && consecutiveCount[a] > 2)) {
        violationIndex = i;
        break;
      }
    }
    
    if (violationIndex !== -1 && violationIndex < resolved.length - 1) {
      const temp = resolved[violationIndex];
      resolved[violationIndex] = resolved[violationIndex + 1];
      resolved[violationIndex + 1] = temp;
      maxIterations--;
    } else if (violationIndex !== -1 && violationIndex > 1) {
      const temp = resolved[violationIndex];
      resolved[violationIndex] = resolved[violationIndex - 2];
      resolved[violationIndex - 2] = temp;
      maxIterations--;
    } else {
      break; 
    }
  }
  
  return resolved.map((m, idx) => ({ ...m, scheduled_order: idx + 1 }));
}

export function generateLeagueSchedule(teams: Team[], legs: 1 | 2): ScheduledMatch[] {
  const matches: ScheduledMatch[] = [];
  const teamIds = teams.map(t => t.id);
  
  if (teamIds.length < 2) return [];

  const isOdd = teamIds.length % 2 !== 0;
  const tIds = isOdd ? [...teamIds, null] : [...teamIds];
  const numRounds = tIds.length - 1;
  const half = tIds.length / 2;

  let matchNum = 1;
  for (let leg = 1; leg <= legs; leg++) {
    const currentTIds = [...tIds];
    
    for (let round = 0; round < numRounds; round++) {
      for (let i = 0; i < half; i++) {
        const home = currentTIds[i];
        const away = currentTIds[currentTIds.length - 1 - i];
        
        if (home !== null && away !== null) {
          const stageName = legs === 2 ? `League (Leg ${leg})` : 'League Match'
          if (leg === 2) {
            matches.push({ home_team_id: away, away_team_id: home, match_number: matchNum++, leg, scheduled_order: 0, stage_name: stageName });
          } else {
            matches.push({ home_team_id: home, away_team_id: away, match_number: matchNum++, leg, scheduled_order: 0, stage_name: stageName });
          }
        }
      }
      currentTIds.splice(1, 0, currentTIds.pop()!);
    }
  }

  return resolveConsecutiveConstraint(matches);
}

/**
 * World Cup (1-Leg) or UCL (2-Leg) Knockout format scheduler
 */
export function generateKnockoutSchedule(teams: Team[], legs: 1 | 2): ScheduledMatch[] {
  const randomized = shuffle(teams.map(t => t.id));
  const matches: ScheduledMatch[] = [];
  let matchNum = 1;
  const isUcl = legs === 2;

  if (randomized.length === 2) {
    // Single Final
    const [teamA, teamB] = randomized;
    matches.push({ home_team_id: teamA, away_team_id: teamB, match_number: matchNum++, leg: 1, scheduled_order: 0, stage_name: isUcl ? 'Final (Leg 1)' : 'Final' });
    if (isUcl) {
      matches.push({ home_team_id: teamB, away_team_id: teamA, match_number: matchNum++, leg: 2, scheduled_order: 0, stage_name: 'Final (Leg 2)' });
    }
  } else if (randomized.length === 3) {
    // 3 teams: Semi-Final + Final
    const [byeTeam, teamB, teamC] = randomized;
    
    // Semi Final
    matches.push({ home_team_id: teamB, away_team_id: teamC, match_number: matchNum++, leg: 1, scheduled_order: 0, stage_name: isUcl ? 'Semi-Final (Leg 1)' : 'Semi-Final' });
    if (isUcl) {
      matches.push({ home_team_id: teamC, away_team_id: teamB, match_number: matchNum++, leg: 2, scheduled_order: 0, stage_name: 'Semi-Final (Leg 2)' });
    }
    
    // Final with Bye team
    matches.push({ home_team_id: byeTeam, away_team_id: null, match_number: matchNum++, leg: 1, scheduled_order: 0, is_placeholder: true, stage_name: 'Final' });
  } else if (randomized.length === 4) {
    // 4 teams: 2 Semi-Finals + 3rd Place + Final
    const [teamA, teamB, teamC, teamD] = randomized;
    
    // Semi Final 1
    matches.push({ home_team_id: teamA, away_team_id: teamB, match_number: matchNum++, leg: 1, scheduled_order: 0, stage_name: isUcl ? 'Semi-Final 1 (Leg 1)' : 'Semi-Final 1' });
    if (isUcl) {
      matches.push({ home_team_id: teamB, away_team_id: teamA, match_number: matchNum++, leg: 2, scheduled_order: 0, stage_name: 'Semi-Final 1 (Leg 2)' });
    }
    
    // Semi Final 2
    matches.push({ home_team_id: teamC, away_team_id: teamD, match_number: matchNum++, leg: 1, scheduled_order: 0, stage_name: isUcl ? 'Semi-Final 2 (Leg 1)' : 'Semi-Final 2' });
    if (isUcl) {
      matches.push({ home_team_id: teamD, away_team_id: teamC, match_number: matchNum++, leg: 2, scheduled_order: 0, stage_name: 'Semi-Final 2 (Leg 2)' });
    }

    // Final
    matches.push({ home_team_id: null, away_team_id: null, match_number: matchNum++, leg: 1, scheduled_order: 0, is_placeholder: true, stage_name: 'Final' });
  } else {
    // 5+ teams: Round of 16 / Quarter-Finals setup
    for (let i = 0; i < randomized.length; i += 2) {
      const home = randomized[i];
      const away = randomized[i + 1] || null;
      const stage = randomized.length > 8 ? 'Round of 16' : 'Quarter-Final';
      
      matches.push({ home_team_id: home, away_team_id: away, match_number: matchNum++, leg: 1, scheduled_order: 0, stage_name: isUcl ? `${stage} (Leg 1)` : stage });
      if (isUcl && away) {
        matches.push({ home_team_id: away, away_team_id: home, match_number: matchNum++, leg: 2, scheduled_order: 0, stage_name: `${stage} (Leg 2)` });
      }
    }
    
    // Placeholder Final
    matches.push({ home_team_id: null, away_team_id: null, match_number: matchNum++, leg: 1, scheduled_order: 0, is_placeholder: true, stage_name: 'Final' });
  }

  return matches.map((m, idx) => ({ ...m, scheduled_order: idx + 1 }));
}

export const generateTournamentSchedule = generateKnockoutSchedule;
