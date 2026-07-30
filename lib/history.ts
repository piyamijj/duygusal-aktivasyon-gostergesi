/**
 * Duygusal Aktivasyon Göstergesi - LocalStorage History Tracking Module
 * SSR-safe client-side storage for past measurement records.
 */

export interface MeasurementRecord {
  id: string;
  timestamp: number;
  mode: 'audio' | 'camera_audio';
  score: number; // Internal 0-100 score (ic_gosterge_puani)
  level: 'dusuk' | 'orta' | 'yuksek';
  pulseBpm?: number;
  voicePitchHz?: number;
  speechRateSPM?: number;
  aiCommentary?: string;
}

const STORAGE_KEY = 'dag_measurement_history';
const MAX_HISTORY_ITEMS = 100;

/**
 * Helper to generate a unique ID (UUID) with a simple fallback if crypto is unavailable.
 */
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'rec_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

/**
 * Safely retrieves the history array from localStorage.
 */
export function getHistory(): MeasurementRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Sort ascending by timestamp (oldest first, for charts)
    return parsed.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e) {
    console.error("Error reading measurement history from localStorage:", e);
    return [];
  }
}

/**
 * Saves a new measurement record to localStorage.
 */
export function saveMeasurement(
  record: Omit<MeasurementRecord, 'id' | 'timestamp'>
): MeasurementRecord {
  const newRecord: MeasurementRecord = {
    ...record,
    id: generateUUID(),
    timestamp: Date.now(),
  };

  if (typeof window === 'undefined') return newRecord;

  try {
    const history = getHistory();
    history.push(newRecord);

    // Sort descending to trim oldest items first, then reverse back to ascending
    history.sort((a, b) => b.timestamp - a.timestamp);
    const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
    trimmed.reverse(); // Keep ascending order for storage/charting

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Error saving measurement to localStorage:", e);
    // Handle quota exceeded or other storage errors gracefully
  }

  return newRecord;
}

/**
 * Deletes a single measurement record by its ID.
 */
export function deleteMeasurement(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getHistory();
    const filtered = history.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Error deleting measurement from localStorage:", e);
  }
}

/**
 * Clears all measurement history.
 */
export function clearHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Error clearing history from localStorage:", e);
  }
}

/**
 * Computes simple aggregate statistics from the history.
 */
export function getHistoryStats(): {
  totalCount: number;
  avgScore: number;
  mostCommonLevel: 'dusuk' | 'orta' | 'yuksek' | null;
  last7DaysCount: number;
} {
  const history = getHistory();
  const totalCount = history.length;

  if (totalCount === 0) {
    return {
      totalCount: 0,
      avgScore: 0,
      mostCommonLevel: null,
      last7DaysCount: 0,
    };
  }

  // 1. Average Score
  const sumScore = history.reduce((sum, item) => sum + item.score, 0);
  const avgScore = Math.round((sumScore / totalCount) * 10) / 10;

  // 2. Most Common Level
  const levelCounts = history.reduce(
    (acc, item) => {
      acc[item.level] = (acc[item.level] || 0) + 1;
      return acc;
    },
    { dusuk: 0, orta: 0, yuksek: 0 } as Record<'dusuk' | 'orta' | 'yuksek', number>
  );

  let mostCommonLevel: 'dusuk' | 'orta' | 'yuksek' = 'dusuk';
  let maxCount = -1;
  for (const level in levelCounts) {
    const lvl = level as 'dusuk' | 'orta' | 'yuksek';
    if (levelCounts[lvl] > maxCount) {
      maxCount = levelCounts[lvl];
      mostCommonLevel = lvl;
    }
  }

  // 3. Last 7 Days Count
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const last7DaysCount = history.filter((item) => item.timestamp >= sevenDaysAgo).length;

  return {
    totalCount,
    avgScore,
    mostCommonLevel: maxCount > 0 ? mostCommonLevel : null,
    last7DaysCount,
  };
}