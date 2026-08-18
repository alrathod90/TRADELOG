/**
 * Goal Templates Library
 * Pre-defined templates for quick goal setup
 */

export const GOAL_TYPES = {
  NUMERIC: 'numeric',      // Increase/decrease a number (weight, distance, savings)
  HABIT: 'habit',          // Daily/weekly habit (meditation, exercise, reading)
  DURATION: 'duration',    // Time-based (hours, minutes)
  BINARY: 'binary',        // Yes/no goal (did it or not?)
  MILESTONE: 'milestone',  // Achieve specific milestones
};

export const FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
};

export const AGGREGATION_TYPES = {
  LATEST: 'latest',
  SUM: 'sum',
  AVERAGE: 'average',
  MAX: 'max',
  MIN: 'min',
};

export const GOAL_TEMPLATES = {
  // Health & Fitness
  weight_loss: {
    name: 'Weight Loss',
    description: 'Track weight loss progress towards target',
    icon: '⚖️',
    goalType: 'numeric',
    increasing: false,
    unit: 'kg',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 0, // User sets
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  daily_exercise: {
    name: 'Daily Exercise',
    description: 'Exercise for a set duration daily',
    icon: '💪',
    goalType: 'duration',
    increasing: true,
    unit: 'minutes',
    aggregationType: 'sum',
    frequency: 'daily',
    targetValue: 30,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  steps_per_day: {
    name: 'Daily Steps',
    description: 'Walk a certain number of steps daily',
    icon: '🚶',
    goalType: 'numeric',
    increasing: true,
    unit: 'steps',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 10000,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  meditation: {
    name: 'Daily Meditation',
    description: 'Meditate for a set time daily',
    icon: '🧘',
    goalType: 'habit',
    increasing: true,
    unit: 'minutes',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 10,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  // Financial
  monthly_savings: {
    name: 'Monthly Savings',
    description: 'Save a target amount each month',
    icon: '💰',
    goalType: 'numeric',
    increasing: true,
    unit: 'INR',
    aggregationType: 'sum',
    frequency: 'monthly',
    targetValue: 10000,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  investment_growth: {
    name: 'Investment Target',
    description: 'Grow investment portfolio to target',
    icon: '📈',
    goalType: 'numeric',
    increasing: true,
    unit: 'INR',
    aggregationType: 'latest',
    frequency: 'monthly',
    targetValue: 500000,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  debt_payoff: {
    name: 'Debt Payoff',
    description: 'Pay off debt by target date',
    icon: '🔗',
    goalType: 'numeric',
    increasing: false,
    unit: 'INR',
    aggregationType: 'latest',
    frequency: 'monthly',
    targetValue: 0,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  // Learning
  reading_habit: {
    name: 'Reading Habit',
    description: 'Read books monthly',
    icon: '📚',
    goalType: 'numeric',
    increasing: true,
    unit: 'books',
    aggregationType: 'sum',
    frequency: 'monthly',
    targetValue: 1,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  learning_hours: {
    name: 'Learning Hours',
    description: 'Learn/study for set hours weekly',
    icon: '🎓',
    goalType: 'duration',
    increasing: true,
    unit: 'hours',
    aggregationType: 'sum',
    frequency: 'weekly',
    targetValue: 10,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  // Habit Formation
  no_smoking: {
    name: 'Quit Smoking',
    description: 'Stay smoke-free daily',
    icon: '🚭',
    goalType: 'habit',
    increasing: true,
    unit: 'days',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 365,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  water_intake: {
    name: 'Daily Water Intake',
    description: 'Drink enough water daily',
    icon: '💧',
    goalType: 'numeric',
    increasing: true,
    unit: 'liters',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 2.5,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  sleep_hours: {
    name: 'Daily Sleep',
    description: 'Get enough sleep each night',
    icon: '😴',
    goalType: 'duration',
    increasing: true,
    unit: 'hours',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 8,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  // Trading (Custom for TradeLog)
  win_rate_target: {
    name: 'Win Rate Target',
    description: 'Achieve target win rate percentage',
    icon: '📊',
    goalType: 'numeric',
    increasing: true,
    unit: '%',
    aggregationType: 'latest',
    frequency: 'monthly',
    targetValue: 55,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  monthly_profit: {
    name: 'Monthly Profit Target',
    description: 'Earn target monthly P&L',
    icon: '💹',
    goalType: 'numeric',
    increasing: true,
    unit: 'INR',
    aggregationType: 'sum',
    frequency: 'monthly',
    targetValue: 50000,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  risk_management: {
    name: 'Max Daily Loss Limit',
    description: 'Keep daily loss under limit',
    icon: '⚠️',
    goalType: 'numeric',
    increasing: false,
    unit: 'INR',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 10000,
    startDate: new Date().toISOString(),
    targetDate: null,
  },

  trade_per_day: {
    name: 'Max Trades Per Day',
    description: 'Limit trades per day',
    icon: '🎯',
    goalType: 'numeric',
    increasing: false,
    unit: 'trades',
    aggregationType: 'latest',
    frequency: 'daily',
    targetValue: 3,
    startDate: new Date().toISOString(),
    targetDate: null,
  },
};

export const MILESTONE_TEMPLATES = {
  percentage_milestones: [
    { name: 'First Step', percentage: 25, value: null },
    { name: 'Quarter Way', percentage: 25, value: null },
    { name: 'Halfway', percentage: 50, value: null },
    { name: 'Three Quarters', percentage: 75, value: null },
    { name: 'Finish Line', percentage: 100, value: null },
  ],

  value_milestones: (targetValue) => [
    { name: 'Start', value: 0 },
    { name: '25%', value: targetValue * 0.25 },
    { name: '50%', value: targetValue * 0.5 },
    { name: '75%', value: targetValue * 0.75 },
    { name: 'Goal', value: targetValue },
  ],

  streak_milestones: [
    { name: '1 Week Streak', streakDays: 7 },
    { name: '1 Month Streak', streakDays: 30 },
    { name: '100 Days', streakDays: 100 },
    { name: '1 Year', streakDays: 365 },
  ],
};

export const REMINDER_TEMPLATES = {
  daily_morning: {
    name: 'Daily Morning',
    type: 'time',
    time: '08:00',
    frequency: 'daily',
    message: 'Time to work on your goal!',
  },

  daily_evening: {
    name: 'Daily Evening',
    type: 'time',
    time: '20:00',
    frequency: 'daily',
    message: 'Log your progress for today',
  },

  weekly_sunday: {
    name: 'Weekly Review',
    type: 'time',
    dayOfWeek: 0, // Sunday
    time: '18:00',
    frequency: 'weekly',
    message: 'Weekly goal review time!',
  },

  monthly_first: {
    name: 'Monthly Check-in',
    type: 'time',
    dayOfMonth: 1,
    time: '09:00',
    frequency: 'monthly',
    message: 'Check your monthly goal progress',
  },

  missed_day: {
    name: 'Missed Day Alert',
    type: 'streak_break',
    frequency: 'when_needed',
    message: 'You missed today! Keep your streak alive.',
  },

  milestone_reached: {
    name: 'Milestone Alert',
    type: 'milestone',
    frequency: 'when_needed',
    message: 'Congratulations! You reached a milestone!',
  },
};

/**
 * Get template by key
 */
export function getTemplate(templateKey) {
  return GOAL_TEMPLATES[templateKey];
}

/**
 * Get all templates
 */
export function getAllTemplates() {
  return Object.entries(GOAL_TEMPLATES).map(([key, template]) => ({
    key,
    ...template,
  }));
}

/**
 * Group templates by category
 */
export function getTemplatesByCategory() {
  const categories = {
    'Health & Fitness': ['weight_loss', 'daily_exercise', 'steps_per_day', 'meditation'],
    'Finance': ['monthly_savings', 'investment_growth', 'debt_payoff'],
    'Learning': ['reading_habit', 'learning_hours'],
    'Habits': ['no_smoking', 'water_intake', 'sleep_hours'],
    'Trading': ['win_rate_target', 'monthly_profit', 'risk_management', 'trade_per_day'],
  };

  const result = {};
  Object.entries(categories).forEach(([cat, keys]) => {
    result[cat] = keys.map(key => ({
      key,
      ...GOAL_TEMPLATES[key],
    })).filter(Boolean);
  });

  return result;
}

export default {
  GOAL_TYPES,
  FREQUENCIES,
  AGGREGATION_TYPES,
  GOAL_TEMPLATES,
  MILESTONE_TEMPLATES,
  REMINDER_TEMPLATES,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
};
