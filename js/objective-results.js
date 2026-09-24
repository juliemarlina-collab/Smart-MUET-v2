/**
 * Smart MUET objective-paper result helper.
 * Persists Reading/Listening responses, normalises scores to /90,
 * records only fully answered papers as complete, and sends attempts
 * through the existing local-first backend connection.
 */
(function () {
  "use strict";

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "");
    } catch (_) {
      return fallback;
    }
  }

  function profile() {
    return readJSON("muet_profile", {});
  }

  function init(config) {
    const component = String(config.component || "").toLowerCase();
    const prefix = `muet_${config.stageKey}_${component}`;
    const totalItems = Number(config.totalItems);
    const questionBase = Number(config.questionBase || 0);
    const answerMap = config.answerMap;

    function correctAnswer(questionNumber, index) {
      return Array.isArray(answerMap) ? answerMap[index] : answerMap[questionNumber];
    }

    function collect() {
      const responses = {};
      let answered = 0;
      let correct = 0;

      for (let index = 0; index < totalItems; index++) {
        const questionNumber = index + questionBase;
        const selected = document.querySelector(`input[name="q${questionNumber}"]:checked`);
        if (!selected) continue;
        responses[String(questionNumber)] = selected.value;
        answered++;
        if (String(selected.value) === String(correctAnswer(questionNumber, index))) correct++;
      }

      return {
        responses,
        answered,
        correct,
        totalItems,
        score90: Math.round(correct / totalItems * 90),
        percent: Math.round(correct / totalItems * 100),
        complete: answered === totalItems
      };
    }

    function persistResponses() {
      const result = collect();
      localStorage.setItem(`${prefix}_responses`, JSON.stringify(result.responses));
      return result;
    }

    function restoreResponses() {
      const saved = readJSON(`${prefix}_responses`, {});
      Object.keys(saved).forEach(questionNumber => {
        const value = String(saved[questionNumber]);
        const options = document.querySelectorAll(`input[name="q${questionNumber}"]`);
        options.forEach(option => {
          if (String(option.value) === value) option.checked = true;
        });
      });
    }

    function saveResult(extra) {
      const result = persistResponses();
      const savedAt = new Date().toISOString();
      const attemptId = crypto.randomUUID();
      const record = Object.assign({}, result, extra || {}, {
        stageKey: config.stageKey,
        vaultId: config.vaultId,
        component: config.component,
        status: result.complete ? "Complete" : "Incomplete",
        savedAt
      });

      localStorage.setItem(`${prefix}_score`, String(result.correct));
      localStorage.setItem(`${prefix}_score90`, String(result.score90));
      localStorage.setItem(`${prefix}_result`, JSON.stringify(record));
      if (result.complete) localStorage.setItem(prefix, "true");
      else localStorage.removeItem(prefix);

      const learner = profile();
      if (typeof window.saveSmartMuetAttempt === "function") {
        window.saveSmartMuetAttempt({
          vault: config.vaultId,
          vaultId: config.vaultId,
          component: config.component,
          studentName: learner.name || "",
          studentEmail: learner.email || "",
          studentRegNo: learner.regNo || "",
          classGroup: learner.group || "",
          targetBand: learner.targetBand || "",
          rawScore: result.correct,
          totalItems: result.totalItems,
          score90: result.score90,
          percentage: result.percent,
          answered: result.answered,
          status: record.status,
          answerText: JSON.stringify(result.responses),
          createdAt: savedAt
          ,attemptId
        });
      }

      return result;
    }

    restoreResponses();
    document.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener("change", persistResponses);
    });

    return { collect, saveResult, restoreResponses };
  }

  window.SmartMUETObjective = { init };
})();
