import { useState, useEffect } from 'react';
import {
  calculateProgress,
  calculateGoalHealth,
  calculateStreak,
  getCurrentValue,
  forecastCompletion,
  getNextMilestone,
  getAchievements,
  getGoalStatus,
} from '../goalCalculations.js';
import {
  getTemplatesByCategory,
  GOAL_TYPES,
  FREQUENCIES,
  AGGREGATION_TYPES,
  MILESTONE_TEMPLATES,
} from '../goalTemplates.js';
import {
  sbFetchGoalsArray,
  sbSaveGoal,
  sbDeleteGoal,
  sbAddMeasurement,
  sbDeleteMeasurement,
  sbSaveMilestone,
  sbDeleteMilestone,
  sbSaveReminder,
  sbDeleteReminder,
} from '../supabase.js';

const GOALS_STORAGE_KEY = 'tradelog_goals_list';

function goalsLoad(u) {
  const k = u ? `tradelog_goals_list_${u}` : GOALS_STORAGE_KEY;
  try {
    const data = JSON.parse(localStorage.getItem(k) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function goalsSave(goals, u) {
  const k = u ? `tradelog_goals_list_${u}` : GOALS_STORAGE_KEY;
  try {
    localStorage.setItem(k, JSON.stringify(goals));
  } catch (e) {
    console.warn('[TradeLog] Could not save goals', e);
  }
}

export function GoalsPage({ username, userId }) {
  const [goals, setGoals] = useState(() => goalsLoad(username));
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // active, paused, archived
  const [filterType, setFilterType] = useState('all');

  // Sync with backend on mount
  useEffect(() => {
    if (!userId) return;
    sbFetchGoalsArray(userId).then(data => {
      if (data && data.length > 0) {
        setGoals(data);
        goalsSave(data, username);
      }
    });
  }, [userId]);

  // Save to localStorage whenever goals change
  useEffect(() => {
    goalsSave(goals, username);
  }, [goals, username]);

  const save = (updatedGoals) => {
    setGoals(updatedGoals);
    if (userId) {
      updatedGoals.forEach(g => sbSaveGoal(userId, g));
    }
  };

  const handleDeleteGoal = (goalId) => {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    const updated = goals.filter(g => g.id !== goalId);
    save(updated);
    if (userId) sbDeleteGoal(userId, goalId);
    if (selectedGoal?.id === goalId) setSelectedGoal(null);
  };

  const handleTogglePause = (goalId) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, status: g.status === 'paused' ? 'active' : 'paused' };
      }
      return g;
    });
    save(updated);
  };

  const handleCompleteGoal = (goalId) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, status: 'completed', completedAt: new Date().toISOString() };
      }
      return g;
    });
    save(updated);
  };

  const handleArchiveGoal = (goalId) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, status: 'archived' };
      }
      return g;
    });
    save(updated);
  };

  // Filter goals
  const filtered = goals.filter(g => {
    const statusMatch =
      (activeTab === 'active' && g.status === 'active') ||
      (activeTab === 'paused' && g.status === 'paused') ||
      (activeTab === 'archived' && (g.status === 'archived' || g.status === 'completed'));

    const typeMatch = filterType === 'all' || g.goalType === filterType;

    return statusMatch && typeMatch;
  });

  // Calculate stats
  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const avgHealth =
    activeGoals.length > 0
      ? Math.round(activeGoals.reduce((s, g) => s + calculateGoalHealth(g), 0) / activeGoals.length)
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Syne'", fontSize: 28, fontWeight: 700, letterSpacing: '-.02em' }}>
              🎯 Goals
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: "'DM Mono'", marginTop: 4 }}>
              {goals.length} total · {activeGoals.length} active · {completedGoals.length} completed
            </div>
          </div>
          <button
            onClick={() => setShowTemplates(true)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              color: '#111',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'DM Mono'",
            }}
          >
            + New Goal
          </button>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--txt4)', fontFamily: "'DM Mono'", letterSpacing: '.08em', marginBottom: 6 }}>
              ACTIVE GOALS
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt1)' }}>{activeGoals.length}</div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--txt4)', fontFamily: "'DM Mono'", letterSpacing: '.08em', marginBottom: 6 }}>
              AVG HEALTH
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: avgHealth >= 70 ? 'var(--accent)' : avgHealth >= 40 ? 'var(--amber)' : 'var(--red)' }}>
              {avgHealth}%
            </div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--txt4)', fontFamily: "'DM Mono'", letterSpacing: '.08em', marginBottom: 6 }}>
              COMPLETED
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{completedGoals.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[
          { id: 'active', label: 'Active' },
          { id: 'paused', label: 'Paused' },
          { id: 'archived', label: 'Archive' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.id ? '#111' : 'var(--txt3)',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 700 : 400,
              cursor: 'pointer',
              fontFamily: "'DM Mono'",
              transition: 'all .15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Type Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterType('all')}
          style={{
            padding: '4px 12px',
            borderRadius: 20,
            border: `1px solid ${filterType === 'all' ? 'var(--accent)' : 'var(--border)'}`,
            background: filterType === 'all' ? 'rgba(0,229,160,.1)' : 'transparent',
            color: filterType === 'all' ? 'var(--accent)' : 'var(--txt3)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: "'DM Mono'",
          }}
        >
          All
        </button>
        {Object.keys(GOAL_TYPES).map(type => (
          <button
            key={type}
            onClick={() => setFilterType(GOAL_TYPES[type])}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: `1px solid ${filterType === GOAL_TYPES[type] ? 'var(--accent)' : 'var(--border)'}`,
              background: filterType === GOAL_TYPES[type] ? 'rgba(0,229,160,.1)' : 'transparent',
              color: filterType === GOAL_TYPES[type] ? 'var(--accent)' : 'var(--txt3)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: "'DM Mono'",
              textTransform: 'capitalize',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Goals List */}
      {filtered.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--txt4)',
            fontSize: 13,
            fontFamily: "'DM Mono'",
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
            <div>
              {goals.length === 0
                ? 'No goals yet. Click + New Goal to get started!'
                : 'No goals in this category. Try another filter.'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, flex: 1, overflowY: 'auto' }}>
          {filtered.map(goal => (
            <GoalCardComponent
              key={goal.id}
              goal={goal}
              onSelect={() => setSelectedGoal(goal)}
              onTogglePause={() => handleTogglePause(goal.id)}
              onComplete={() => handleCompleteGoal(goal.id)}
              onArchive={() => handleArchiveGoal(goal.id)}
              onDelete={() => handleDeleteGoal(goal.id)}
              isSelected={selectedGoal?.id === goal.id}
            />
          ))}
        </div>
      )}

      {/* Goal Detail Panel or Template Selector */}
      {selectedGoal && (
        <GoalDetailPanel
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onUpdate={(updated) => {
            const newGoals = goals.map(g => (g.id === updated.id ? updated : g));
            save(newGoals);
            setSelectedGoal(updated);
          }}
          onAddMeasurement={(measurement) => {
            const updated = { ...selectedGoal };
            updated.measurements = updated.measurements || [];
            updated.measurements.push({
              id: Date.now().toString(),
              date: measurement.date || new Date().toISOString(),
              value: measurement.value,
              note: measurement.note,
            });
            const newGoals = goals.map(g => (g.id === updated.id ? updated : g));
            save(newGoals);
            setSelectedGoal(updated);
            if (userId) sbAddMeasurement(userId, selectedGoal.id, measurement);
          }}
          userId={userId}
        />
      )}

      {showTemplates && (
        <TemplateSelector
          onSelect={(template) => {
            const newGoal = {
              id: Date.now().toString(),
              ...template,
              measurements: [],
              milestones: [],
              reminders: [],
              status: 'active',
              createdAt: new Date().toISOString(),
            };
            const newGoals = [newGoal, ...goals];
            save(newGoals);
            setShowTemplates(false);
            setSelectedGoal(newGoal);
          }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}

/**
 * Goal Card Component
 */
function GoalCardComponent({ goal, onSelect, onTogglePause, onComplete, onArchive, onDelete, isSelected }) {
  const progress = calculateProgress(goal);
  const health = calculateGoalHealth(goal);
  const current = getCurrentValue(goal);
  const status = getGoalStatus(goal);

  const statusColors = {
    'Achieved 🎉': { bg: 'rgba(0,229,160,.08)', txt: 'var(--accent)' },
    'On Track ✓': { bg: 'rgba(0,229,160,.08)', txt: 'var(--accent)' },
    'Slightly Behind ⚠': { bg: 'rgba(255,179,64,.08)', txt: 'var(--amber)' },
    'Behind 📉': { bg: 'rgba(255,92,92,.08)', txt: 'var(--red)' },
    'Not Started': { bg: 'rgba(255,255,255,.02)', txt: 'var(--txt2)' },
    Completed: { bg: 'rgba(0,229,160,.08)', txt: 'var(--accent)' },
    Paused: { bg: 'rgba(255,255,255,.02)', txt: 'var(--txt3)' },
    Archived: { bg: 'rgba(255,255,255,.02)', txt: 'var(--txt4)' },
  };

  const colors = statusColors[status] || statusColors['Not Started'];

  return (
    <div
      onClick={onSelect}
      style={{
        background: colors.bg,
        border: `1px solid var(--border)`,
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all .2s',
        opacity: goal.status === 'paused' ? 0.6 : 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.txt)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 15, color: 'var(--txt1)', marginBottom: 4 }}>
            {goal.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 8 }}>{goal.description}</div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: progress + '%',
                  background: colors.txt,
                  transition: 'width .3s',
                }}
              />
            </div>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono'", fontWeight: 600, color: colors.txt, minWidth: 45 }}>
              {Math.round(progress)}%
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--txt4)', fontFamily: "'DM Mono'", marginBottom: 6 }}>Health</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: health >= 70 ? 'var(--accent)' : health >= 40 ? 'var(--amber)' : 'var(--red)',
            }}
          >
            {health}
          </div>
        </div>
      </div>

      {/* Status Badge & Value */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 20,
              background: 'var(--bg4)',
              color: 'var(--txt3)',
              fontFamily: "'DM Mono'",
            }}
          >
            {status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {goal.status === 'active' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePause();
                }}
                title="Pause"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
              >
                ⏸
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                title="Mark Complete"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
              >
                ✓
              </button>
            </>
          )}
          {goal.status === 'paused' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause();
              }}
              title="Resume"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
            >
              ▶
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            title="Archive"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
          >
            📦
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.4 }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Goal Detail Panel
 */
function GoalDetailPanel({ goal, onClose, onUpdate, onAddMeasurement, userId }) {
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementNote, setMeasurementNote] = useState('');
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);

  const progress = calculateProgress(goal);
  const health = calculateGoalHealth(goal);
  const current = getCurrentValue(goal);
  const forecast = forecastCompletion(goal);
  const nextMilestone = getNextMilestone(goal);
  const achievements = getAchievements(goal);
  const streak = calculateStreak(goal.measurements, goal.goalType, goal.frequency);

  const handleAddMeasurement = () => {
    if (!measurementValue) return;
    onAddMeasurement({
      value: parseFloat(measurementValue),
      note: measurementNote,
      date: new Date(measurementDate).toISOString(),
    });
    setMeasurementValue('');
    setMeasurementNote('');
    setMeasurementDate(new Date().toISOString().split('T')[0]);
    setShowMeasurementForm(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 990,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg2)',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: 600,
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border2)',
          boxShadow: '0 -8px 32px rgba(0,0,0,.3)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 0', marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'Syne'", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{goal.name}</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{goal.description}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: 'var(--txt3)',
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--txt4)', fontFamily: "'DM Mono'", marginBottom: 4 }}>PROGRESS</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(progress)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--txt4)', fontFamily: "'DM Mono'", marginBottom: 4 }}>HEALTH</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: health >= 70 ? 'var(--accent)' : health >= 40 ? 'var(--amber)' : 'var(--red)',
                }}
              >
                {health}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--txt4)', fontFamily: "'DM Mono'", marginBottom: 4 }}>CURRENT</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt1)' }}>
                {current.toFixed(1)} {goal.unit}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--txt4)', fontFamily: "'DM Mono'", marginBottom: 4 }}>TARGET</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>{goal.targetValue} {goal.unit}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div
              style={{
                height: '100%',
                width: progress + '%',
                background: 'var(--accent)',
                transition: 'width .3s',
              }}
            />
          </div>
        </div>

        <div style={{ padding: '0 24px' }}>
          {/* Streak Info */}
          {streak.current > 0 && (
            <div style={{ background: 'rgba(0,229,160,.08)', border: '1px solid rgba(0,229,160,.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: "'DM Mono'", fontWeight: 600 }}>CURRENT STREAK</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{streak.current} days</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--txt4)', fontFamily: "'DM Mono'" }}>Best: {streak.longest} days</div>
                </div>
              </div>
            </div>
          )}

          {/* Forecast */}
          {forecast && (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--txt4)', fontFamily: "'DM Mono'", fontWeight: 600, marginBottom: 6 }}>
                FORECAST
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 2 }}>
                    {forecast.onTrack ? '✓ On Track' : '⚠ Off Track'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: "'DM Mono'" }}>
                    Completion in {forecast.daysFromNow} days
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)' }}>
                    {forecast.date.toLocaleDateString('en-IN', { day: 'short', month: 'short' })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Milestones */}
          {(goal.milestones && goal.milestones.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--txt4)', fontFamily: "'DM Mono'", fontWeight: 600, letterSpacing: '.05em', marginBottom: 10 }}>
                MILESTONES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {goal.milestones.map(m => {
                  const achieved = m.value <= current;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: achieved ? 'rgba(0,229,160,.08)' : 'var(--bg3)',
                        border: `1px solid ${achieved ? 'rgba(0,229,160,.2)' : 'transparent'}`,
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, color: achieved ? 'var(--accent)' : 'var(--txt2)' }}>
                        {achieved ? '✓' : '○'} {m.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--txt4)', fontFamily: "'DM Mono'" }}>{m.value} {goal.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Measurement Form */}
          {showMeasurementForm ? (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--txt4)', fontFamily: "'DM Mono'", marginBottom: 10, fontWeight: 600 }}>
                ADD MEASUREMENT
              </div>
              <div style={{ marginBottom: 10 }}>
                <input
                  type="number"
                  value={measurementValue}
                  onChange={(e) => setMeasurementValue(e.target.value)}
                  placeholder={`Value (${goal.unit})`}
                  style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--txt1)' }}
                />
                <input
                  type="date"
                  value={measurementDate}
                  onChange={(e) => setMeasurementDate(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--txt1)' }}
                />
                <input
                  type="text"
                  value={measurementNote}
                  onChange={(e) => setMeasurementNote(e.target.value)}
                  placeholder="Note (optional)"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--txt1)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAddMeasurement}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#111',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => setShowMeasurementForm(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--txt3)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowMeasurementForm(true)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 16,
              }}
            >
              + Log Progress
            </button>
          )}

          {/* Measurements History */}
          {goal.measurements && goal.measurements.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--txt4)', fontFamily: "'DM Mono'", fontWeight: 600, letterSpacing: '.05em', marginBottom: 10 }}>
                RECENT MEASUREMENTS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {[...goal.measurements].reverse().slice(0, 10).map(m => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg3)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--txt1)', fontWeight: 600 }}>
                        {m.value} {goal.unit}
                      </div>
                      {m.note && <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{m.note}</div>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--txt4)', fontFamily: "'DM Mono'" }}>
                      {new Date(m.date).toLocaleDateString('en-IN', { day: 'short', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--bg3)',
              color: 'var(--txt2)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Template Selector Modal
 */
function TemplateSelector({ onSelect, onClose }) {
  const templates = getTemplatesByCategory();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg2)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border2)',
          boxShadow: '0 24px 96px rgba(0,0,0,.4)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: "'Syne'", fontSize: 20, fontWeight: 700 }}>Choose Goal Template</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>Start with a preset or create custom</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: 'var(--txt3)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Templates by Category */}
        <div style={{ padding: '20px' }}>
          {Object.entries(templates).map(([category, categoryTemplates]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--txt4)', fontFamily: "'DM Mono'", fontWeight: 600, letterSpacing: '.05em', marginBottom: 10 }}>
                {category.toUpperCase()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {categoryTemplates.map(template => (
                  <button
                    key={template.key}
                    onClick={() => onSelect(template)}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                      color: 'var(--txt2)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all .15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(0,229,160,.08)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg3)';
                      e.currentTarget.style.color = 'var(--txt2)';
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{template.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{template.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--txt4)', lineHeight: 1.4 }}>{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GoalsPage;
