
(() => {
  const PROFILE_KEY = 'muet_profile';
  const PREF_KEY = 'muet_preferences';

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  }

  window.SmartMUET = {
    loadProfile() { return loadJSON(PROFILE_KEY, {}); },
    saveProfile(profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile || {}));
      window.dispatchEvent(new CustomEvent('smartmuet:profile-updated', {detail:profile || {}}));
    },
    loadPreferences() {
      return loadJSON(PREF_KEY, {
        progressReminders:true,
        reducedMotion:false
      });
    },
    savePreferences(prefs) {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs || {}));
    },
    resetProgressOnly() {
      [
        'muet_speaking_sessions','muet_reading_history','muet_listening_sessions',
        'muet_writing_sessions','muet_attempt_log',
        'muet_activity_log'
      ].forEach(k => localStorage.removeItem(k));
    },
    resetAll() {
      localStorage.clear();
    }
  };
})();
