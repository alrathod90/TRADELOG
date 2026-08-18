/**
 * Goal Calculations Library
 * All business logic for goal tracking (progress, health, forecasts, streaks)
 * Independent of storage/API - works with goal objects
 */

/**
 * Calculate progress as percentage (0-100)
 * Handles both increasing and decreasing goal types
 */
export function calculateProgress(goal) {
  if (!goal || !goal.measurements || goal.measurements.length === 0) return 0;

  const current = getCurrentValue(goal);
  const target = goal.targetValue || 0;

  if (goal.goalType === 'binary') {
    return current ? 100 : 0;
  }

  if (target === 0) return 0;

  const progress = goal.increasing
    ? (current / target) * 100
    : Math.max(0, 100 - (current / target) * 100);

  return Math.min(100, Math.max(0, progress));
}

/**
 * Get current value (latest measurement or aggregated)
 */
export function getCurrentValue(goal) {
  if (!goal.measurements || goal.measurements.length === 0) return 0;

  if (goal.goalType === 'binary') {
    return goal.measurements[goal.measurements.length - 1]?.value ? 1 : 0;
  }

  if (goal.aggregationType === 'sum') {
    return goal.measurements.reduce((sum, m) => sum + (m.value || 0), 0);
  }

  if (goal.aggregationType === 'average') {
    if (goal.measurements.length === 0) return 0;
    const sum = goal.measurements.reduce((s, m) => s + (m.value || 0), 0);
    return sum / goal.measurements.length;
  }

  if (goal.aggregationType === 'max') {
    return Math.max(...goal.measurements.map(m => m.value || 0));
  }

  if (goal.aggregationType === 'min') {
    const vals = goal.measurements.map(m => m.value || 0).filter(v => v !== 0);
    return vals.length > 0 ? Math.min(...vals) : 0;
  }

  // Default: latest value
  return goal.measurements[goal.measurements.length - 1]?.value || 0;
}

/**
 * Calculate expected progress based on time elapsed
 */
export function calculateExpectedProgress(goal) {
  if (!goal.startDate || !goal.targetDate) return 0;

  const start = new Date(goal.startDate).getTime();
  const target = new Date(goal.targetDate).getTime();
  const now = Date.now();

  if (now < start) return 0;
  if (now > target) return 100;

  const elapsed = now - start;
  const total = target - start;

  return (elapsed / total) * 100;
}

/**
 * Calculate the pace required to hit target
 */
export function calculateRequiredPace(goal) {
  if (!goal.targetDate) return null;

  const target = new Date(goal.targetDate).getTime();
  const now = Date.now();
  const daysRemaining = Math.max(1, (target - now) / (1000 * 60 * 60 * 24));

  const current = getCurrentValue(goal);
  const remaining = Math.max(0, goal.targetValue - current);

  return {
    daysRemaining: Math.ceil(daysRemaining),
    remainingValue: remaining,
    requiredPerDay: remaining / daysRemaining,
    requiredPerWeek: (remaining / daysRemaining) * 7,
  };
}

/**
 * Calculate current streak
 * A streak is broken on a day with no progress or a failed habit
 */
export function calculateStreak(measurements, goalType = 'habit', frequency = 'daily') {
  if (!measurements || measurements.length === 0) {
    return { current: 0, longest: 0, active: false };
  }

  // Sort by date descending
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let current = 0;
  let longest = 0;
  let streak = 0;

  // Check if streak is still active (has entry today or yesterday)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastEntry = sorted[0];
  const lastEntryDate = new Date(lastEntry.date);
  lastEntryDate.setHours(0, 0, 0, 0);

  const active =
    lastEntryDate.getTime() === today.getTime() ||
    lastEntryDate.getTime() === yesterday.getTime();

  // Calculate streaks
  let currentDate = new Date(sorted[0].date);
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const mDate = new Date(m.date);
    mDate.setHours(0, 0, 0, 0);

    const expected = new Date(currentDate);
    const dayDiff = Math.floor((currentDate.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24));

    // For daily frequency, allow only consecutive days
    if (frequency === 'daily' && dayDiff <= 1) {
      streak++;
      current = i === 0 ? streak : current;
      longest = Math.max(longest, streak);
      currentDate = new Date(mDate);
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (frequency !== 'daily') {
      // For other frequencies, more lenient
      streak++;
      current = i === 0 ? streak : current;
      longest = Math.max(longest, streak);
    } else {
      // Break in streak
      streak = 0;
    }
  }

  return {
    current: active ? current : 0,
    longest,
    active,
  };
}

/**
 * Calculate goal health score (0-100)
 * Based on progress vs expected progress, streak, consistency
 */
export function calculateGoalHealth(goal) {
  let score = 0;

  if (!goal) return score;

  // 1. Progress score (0-40 points)
  const progress = calculateProgress(goal);
  const expected = calculateExpectedProgress(goal);
  const progressScore = progress >= expected ? 40 : (progress / Math.max(1, expected)) * 40;
  score += Math.min(40, progressScore);

  // 2. Consistency score (0-30 points)
  if (goal.measurements && goal.measurements.length > 0) {
    const streak = calculateStreak(goal.measurements, goal.goalType, goal.frequency);
    const consistencyScore = (streak.current / Math.max(1, streak.longest + 1)) * 30;
    score += Math.min(30, consistencyScore);
  }

  // 3. On-track score (0-30 points)
  if (goal.targetDate) {
    const pace = calculateRequiredPace(goal);
    const onTrack = pace.daysRemaining <= 0 || progress >= expected;
    score += onTrack ? 30 : Math.max(0, (progress / 100) * 30);
  } else {
    score += 30; // No deadline, assume on track
  }

  return Math.round(score);
}

/**
 * Forecast completion date
 * Based on current pace and trend
 */
export function forecastCompletion(goal) {
  if (!goal.measurements || goal.measurements.length < 2) {
    return null; // Not enough data
  }

  const sorted = [...goal.measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate average progress per day
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const firstDate = new Date(first.date);
  const lastDate = new Date(last.date);
  const daysElapsed = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysElapsed === 0) return null;

  const current = getCurrentValue(goal);
  const remaining = Math.max(0, goal.targetValue - current);
  const progressPerDay = current / Math.max(1, daysElapsed);

  if (progressPerDay === 0) return null;

  const daysToComplete = remaining / progressPerDay;
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + daysToComplete);

  return {
    date: completionDate,
    daysFromNow: Math.ceil(daysToComplete),
    progressPerDay: progressPerDay.toFixed(2),
    onTrack: goal.targetDate ? completionDate <= new Date(goal.targetDate) : true,
  };
}

/**
 * Generate forecasting scenarios (optimistic, current, conservative)
 */
export function forecastScenarios(goal) {
  if (!goal.measurements || goal.measurements.length < 2) {
    return { optimistic: null, current: null, conservative: null };
  }

  const sorted = [...goal.measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const values = sorted.map(m => m.value || 0);
  const recent = values.slice(-7); // Last 7 measurements
  const all = values;

  // Current trend (last 7 or all if less)
  const currentAvg = recent.length > 0
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : 0;

  // Optimistic (best recent performance)
  const optimisticAvg = Math.max(...recent) * 0.8; // 80% of best

  // Conservative (worst recent performance)
  const conservativeAvg = Math.min(...recent) * 1.2; // 120% of worst

  const calcDate = (perDay) => {
    const current = getCurrentValue(goal);
    const remaining = Math.max(0, goal.targetValue - current);
    if (perDay === 0) return null;
    const days = remaining / perDay;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return { date, days: Math.ceil(days) };
  };

  return {
    current: calcDate(currentAvg),
    optimistic: calcDate(optimisticAvg),
    conservative: calcDate(conservativeAvg),
  };
}

/**
 * Check if milestone is achieved
 */
export function isMilestoneAchieved(milestone, currentValue) {
  if (!milestone) return false;

  if (milestone.type === 'value') {
    return currentValue >= milestone.value;
  }

  if (milestone.type === 'date') {
    return new Date() >= new Date(milestone.date);
  }

  if (milestone.type === 'streak') {
    return currentValue >= milestone.streakDays;
  }

  return false;
}

/**
 * Get next unachieved milestone
 */
export function getNextMilestone(goal) {
  if (!goal.milestones || goal.milestones.length === 0) return null;

  const current = getCurrentValue(goal);
  return goal.milestones.find(m => !isMilestoneAchieved(m, current));
}

/**
 * Calculate progress to next milestone
 */
export function progressToNextMilestone(goal) {
  const next = getNextMilestone(goal);
  if (!next) return null;

  const current = getCurrentValue(goal);

  if (next.type === 'value') {
    const start = next.startValue || 0;
    const range = next.value - start;
    const progress = Math.max(0, current - start);
    return {
      milestone: next,
      current,
      target: next.value,
      percentage: range > 0 ? (progress / range) * 100 : 0,
    };
  }

  return null;
}

/**
 * Get all achievements (completed milestones)
 */
export function getAchievements(goal) {
  if (!goal.milestones) return [];

  const current = getCurrentValue(goal);
  return goal.milestones.filter(m => isMilestoneAchieved(m, current));
}

/**
 * Create a goal from template
 */
export function createGoalFromTemplate(template, overrides = {}) {
  return {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    status: 'active',
    measurements: [],
    milestones: [],
    reminders: [],
    ...template,
    ...overrides,
  };
}

/**
 * Get goal status as human-readable text
 */
export function getGoalStatus(goal) {
  const progress = calculateProgress(goal);
  const expected = calculateExpectedProgress(goal);
  const health = calculateGoalHealth(goal);

  if (goal.status === 'completed') return 'Completed';
  if (goal.status === 'paused') return 'Paused';
  if (goal.status === 'archived') return 'Archived';

  if (progress >= 100) return 'Achieved 🎉';
  if (progress >= expected && progress > 0) return 'On Track ✓';
  if (progress >= expected * 0.8) return 'Slightly Behind ⚠';
  if (progress > 0) return 'Behind 📉';
  return 'Not Started';
}

/**
 * Calculate progress for display with context
 */
export function getProgressDisplay(goal) {
  const current = getCurrentValue(goal);
  const target = goal.targetValue || 0;
  const progress = calculateProgress(goal);
  const health = calculateGoalHealth(goal);

  return {
    current,
    target,
    percentage: Math.round(progress),
    health,
    unit: goal.unit || '',
    label: `${Math.round(progress)}% complete`,
    status: getGoalStatus(goal),
  };
}

export default {
  calculateProgress,
  getCurrentValue,
  calculateExpectedProgress,
  calculateRequiredPace,
  calculateStreak,
  calculateGoalHealth,
  forecastCompletion,
  forecastScenarios,
  isMilestoneAchieved,
  getNextMilestone,
  progressToNextMilestone,
  getAchievements,
  createGoalFromTemplate,
  getGoalStatus,
  getProgressDisplay,
};
