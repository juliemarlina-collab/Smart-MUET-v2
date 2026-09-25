/**
 * Smart MUET Guide — Smart Coach (free, no API key, works offline)
 * Rule-based Writing & Speaking feedback aligned to the MPM MUET
 * Regulations and Test Specifications (MPM language functions, task notes,
 * genre/register conventions) and common Malaysian learner error patterns.
 *
 * Load LAST on each Writing/Speaking page (after the page's own script).
 * It replaces the page's evaluateWriting()/evaluate() scoring with a
 * stronger version (same return shape) and adds a "Smart Coach" panel
 * after every submit. Nothing leaves the device except the normal save.
 *
 * TO EDIT WHAT THE COACH CHECKS: see TASK_BANK, FUNCTIONS and ERROR_RULES below.
 */
(function () {
  "use strict";

  /* =============================================================
     1 · TASK BANK — notes each Task 1 reply must cover, and topic
     words used to check relevance. Key: VAULT|task
     ============================================================= */
  var TASK_BANK = {
    "VAULT-01|1": {
      reader: "Aina (a friend)", register: "informal",
      notes: [
        { label: "Suggest one suitable activity", re: /\b(workshop|seminar|class(es)?|session|talk|discussion|practi[cs]e|mock (test|exam)|quiz|camp|activit(y|ies)|tuition|bootcamp|course|study group|revision|speaking club|debate)\b/i },
        { label: "Explain why the activity helps MUET candidates", re: /\b(help|improv|useful|benefit|confiden|skill|prepar|practi[cs]|boost|enhanc)\w*/i, also: /\b(because|since|as|so that|this (will|would|can))\b/i },
        { label: "Suggest a suitable place", re: /\b(library|hall|room|classroom|cent(re|er)|campus|lab|cafe|auditorium|dewan|venue|place|online|zoom|google meet)\b/i },
        { label: "Say whether you can help organise it", re: /\b(help (you )?(to )?organi[sz]e|i can help|i could help|cannot help|can't help|unable to help|happy to help|willing to help|glad to help|count me in|i('d| would) love to help|available)\b/i }
      ],
      topic: ["muet", "study", "programme", "program", "candidates", "semester", "break", "english"]
    },
    "VAULT-01|2": {
      statement: "Students learn more effectively when technology is used in education.",
      topic: ["technology", "students", "learn", "learning", "education", "online", "digital", "computer", "internet", "devices", "effective"]
    },
    "VAULT-02|1": {
      reader: "Linda (a coursemate)", register: "informal",
      notes: [
        { label: "Agree online business is more popular than traditional business", re: /\b(agree|true|right|indeed|definitely)\b/i, also: /\b(popular|online business|traditional|trend)\w*/i },
        { label: "Agree to join Linda", re: /\b(join (you|in)|count me in|partner|together|would love to|i('d| would) like to join|team up|with you)\b/i },
        { label: "Suggest two products", count: /\b(clothes|clothing|t-?shirts?|food|snacks?|cookies|cakes?|kuih|accessories|jewell?ery|books?|cosmetics|skincare|make-?up|crafts?|handicrafts?|stationery|shoes|bags?|phone cases?|gadgets?|perfumes?|hijabs?|tudungs?|drinks?|plants?|toys?|keychains?|products?)\b/gi, min: 2 },
        { label: "Explain why you cannot start now and suggest a better time", re: /\b(cannot|can't|unable|not able|not yet|busy|exam|final|studies|study|semester|assignment|commitment)\w*/i, also: /\b(after|during|next|holiday|break|once|when we (finish|graduate)|end of)\b/i }
      ],
      topic: ["online", "business", "sell", "products", "customers", "social media"]
    },
    "VAULT-02|2": { statement: "", topic: [] }, // statement read from the page's chosen question
    "MOCK-01|1": {
      reader: "Sabrina (a friend)", register: "informal to neutral",
      notes: [
        { label: "Great! — react positively to the programme", re: /\b(great|glad|happy|wonderful|excellent|fantastic|excited|delighted|good (idea|news|initiative)|proud|amazing)\b/i },
        { label: "Sorry… — say you cannot take part and why", re: /\b(sorry|cannot|can't|unable|not able|won't be able|afraid)\b/i, also: /\b(because|as|since|due to)\b/i },
        { label: "Agree, because… — agree plastic bags harm the environment, with a reason", re: /\bagree\w*/i, also: /\b(pollut|environment|ocean|sea|landfill|wildlife|animals?|decompose|years to|drains?|flood|harm)\w*/i },
        { label: "Tell Sabrina… — respond about bringing family and friends", re: /\b(tell|inform|share|ask|invite|spread|bring|encourage)\w*\b[^.!?]{0,60}\b(family|friends|neighbou?rs|parents|siblings|relatives|others)\b/i }
      ],
      topic: ["plastic", "bags", "programme", "neighbourhood", "environment", "reduce"]
    },
    "MOCK-01|2": {
      statement: "Modernisation has robbed us of our peace of mind.",
      topic: ["modernisation", "modernization", "modern", "technology", "peace", "mind", "stress", "life", "lifestyle", "pressure", "digital"]
    }
  };

  /* =============================================================
     2 · MPM LANGUAGE FUNCTIONS (from the MUET test specifications)
     ============================================================= */
  var FN = {
    "expressing opinions": { re: /\b(i think|i believe|in my (opinion|view)|personally|i feel (that)?|from my (perspective|point of view)|it seems to me|i (strongly |partially |totally |completely )?(agree|disagree))\b/i, tip: "In my opinion, … / I strongly believe that …" },
    "giving reasons": { re: /\b(because|since|due to|the (main )?reason (is|why)|as a result of|this is because)\b/i, tip: "This is because … / The main reason is …" },
    "elaborating": { re: /\b(in other words|what i mean is|to be (more )?specific|furthermore|moreover|in addition|besides( that)?|not only|for example|for instance|such as)\b/i, tip: "For example, … / In addition, …" },
    "justifying": { re: /\b(this (shows|proves|means|explains)|that is why|therefore|thus|hence|for this reason|as a result|consequently)\b/i, tip: "This shows that … / That is why …" },
    "summarising": { re: /\b(to sum up|in short|in summary|overall|in brief|to summari[sz]e|all in all)\b/i, tip: "To sum up, … / Overall, …" },
    "concluding": { re: /\b(in conclusion|to conclude|finally|lastly|in the end|that is all|thank you for listening)\b/i, tip: "In conclusion, … / To conclude, …" },
    "inferring": { re: /\b(it seems|this suggests|probably|it (might|may|could) (mean|be)|perhaps)\b/i, tip: "This suggests that … / It may mean that …" },
    "evaluating": { re: /\b(the (best|most (important|effective|practical|useful))|more (effective|important|practical|useful) than|better (option|choice|idea)|the strongest|the main factor|outweigh)\b/i, tip: "The most effective option is … because …" },
    "initiating": { re: /\b(let'?s start|let us start|shall we (begin|start)|i('d| would) like to start|to begin with|first of all|good (morning|afternoon)[, ]+(everyone|friends))\b/i, tip: "Shall we begin by looking at …?" },
    "prompting": { re: /\b(what do you think|how about you|do you agree|what('s| is) your (opinion|view)|would you like to add|any (other )?ideas|what about you)\b/i, tip: "What do you think, [name]?" },
    "turn-taking": { re: /\b(i agree with|i see your point|that'?s a (good|valid) point|building on|adding to|as \w+ (said|mentioned)|i('d| would) like to add)\b/i, tip: "I see your point, and I'd like to add …" },
    "negotiating": { re: /\b(how about|why don'?t we|shall we|maybe we (could|should)|i suggest|let'?s consider|can we agree|perhaps we (can|could)|i see your point,? but|i('m| am) afraid i disagree)\b/i, tip: "How about we combine both ideas? / I see your point, but …" },
    "interrupting": { re: /\b(sorry to interrupt|excuse me|may i (add|come in|say something)|can i just (add|say)|if i may)\b/i, tip: "Sorry to interrupt, but may I add …?" },
    "reaching a decision": { re: /\b(so we (all )?agree|we have decided|our (final )?decision|let'?s decide|we (can|should) choose|the best (option|suggestion|way) is)\b/i, tip: "So, we all agree that the best option is …" },
    // Writing Task 1 functions
    "expressing thanks": { re: /\b(thank(s| you)|appreciate)\b/i, tip: "Thank you for your email about …" },
    "apologising": { re: /\b(sorry|apologi[sz]e|regret)\b/i, tip: "I'm sorry, but I won't be able to …" },
    "expressing reactions": { re: /\b(great|glad|happy|excited|wonderful|delighted|amazing|what a (great|good) idea)\b/i, tip: "What a great idea! I'm so glad that …" },
    "accepting / declining": { re: /\b(i('d| would) love to|count me in|i('d| would) be (happy|glad) to|i accept|i('m| am) afraid i (can't|cannot)|unfortunately,? i (cannot|can't|am unable|won't))\b/i, tip: "I'd love to join, but unfortunately I can't …" },
    "making requests": { re: /\b(could you|can you|would you|please|let me know)\b/i, tip: "Could you let me know …?" },
    "giving precise information": { re: /\b(on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at \d|\d+ ?(am|pm|a\.m\.|p\.m\.)|next (week|month|semester)|in (the )?(library|hall|room)|from \d|\d+ (days|weeks|hours))\b/i, tip: "We could meet every Saturday at 9 a.m. in the library." },
    "giving advice / suggestions": { re: /\b(i suggest|you (should|could)|we (should|could)|how about|why don'?t (we|you)|it would be (good|better)|i recommend)\b/i, tip: "I suggest that we … / How about …?" },
    // Writing Task 2
    "discussing & evaluating ideas": { re: /\b(on the other hand|however|while|whereas|some people (believe|argue|think|say)|advantages?|disadvantages?|drawbacks?|benefits?|nevertheless|although)\b/i, tip: "Some people argue that …; however, …" },
    "giving examples": { re: /\b(for example|for instance|such as|a good example|to illustrate)\b/i, tip: "For instance, many students …" }
  };
  var FN_SETS = {
    W1: ["expressing thanks", "expressing reactions", "apologising", "accepting / declining", "giving advice / suggestions", "giving reasons", "giving precise information", "making requests"],
    W2: ["expressing opinions", "discussing & evaluating ideas", "giving reasons", "justifying", "giving examples", "concluding"],
    SA: ["expressing opinions", "giving reasons", "elaborating", "justifying", "summarising", "concluding"],
    SB: ["initiating", "expressing opinions", "giving reasons", "prompting", "turn-taking", "negotiating", "evaluating", "interrupting", "reaching a decision"]
  };

  /* =============================================================
     3 · COMMON ERROR RULES (Malaysian learner patterns)
     ============================================================= */
  var ERROR_RULES = [
    { re: /\bgot (a |an |many |a lot of |lots of )?(\w+)/i, onlyIf: /\b(it|the \w+|this|that|there|library|room|hall|place|school)\s+got\b/i, fix: "has / there is", why: "Use \"has\" or \"there is/are\" for possession, not \"got\"." },
    { re: /\bdiscuss about\b/i, fix: "discuss", why: "\"Discuss\" does not need \"about\"." },
    { re: /\bmore (better|worse|easier|faster|cheaper|bigger|smaller|happier|healthier|safer|stronger)\b/i, fix: "better / easier …", why: "Do not use \"more\" with a comparative (-er) form." },
    { re: /\bcan able to\b/i, fix: "can / am able to", why: "Use either \"can\" or \"be able to\", not both." },
    { re: /\b(i|we|they) (am|are) (agree|disagree)\b/i, fix: "I agree / I disagree", why: "\"Agree\" is a verb; do not add \"am/are\"." },
    { re: /\bpeoples\b/i, fix: "people", why: "\"People\" is already plural." },
    { re: /\b(informations|advices|equipments|furnitures|knowledges|homeworks|feedbacks|stuffs|researches)\b/i, fix: "information / advice …", why: "This noun is uncountable; it has no -s." },
    { re: /\b(he|she|it) (have|do|go|make|like|want|need|say|think|get|come)\b/i, fix: "has / does / goes / makes …", why: "Add -s/-es to the verb after he / she / it." },
    { re: /\b(students|people|children|teenagers|parents|they) (is|was|has)\b/i, fix: "are / were / have", why: "A plural subject needs a plural verb." },
    { re: /\bmust to \w+/i, fix: "must + verb", why: "Do not use \"to\" after \"must\"." },
    { re: /\bdespite of\b/i, fix: "despite / in spite of", why: "\"Despite\" is not followed by \"of\"." },
    { re: /\bcomprise of\b/i, fix: "comprise / consist of", why: "Say \"comprise\" or \"consist of\"." },
    { re: /\b(although|though|even though)\b[^.!?]{3,80},\s*but\b/i, fix: "remove \"but\"", why: "Do not use \"although\" and \"but\" together." },
    { re: /\bin conclude\b/i, fix: "in conclusion", why: "The phrase is \"in conclusion\"." },
    { re: /\bmake (a )?research\b/i, fix: "do research", why: "We \"do\" research." },
    { re: /\bi (very )?(very) (like|love|enjoy|want)\b/i, fix: "I really like / I like … very much", why: "\"Very\" cannot come before a verb." },
    { re: /\bsince \d+ years\b/i, fix: "for … years", why: "Use \"for\" with a period of time." },
    { re: /\beveryday (i|we|they|students|people|he|she)\b/i, fix: "every day", why: "\"Every day\" (two words) means each day; \"everyday\" is an adjective." },
    { re: /\balot\b/i, fix: "a lot", why: "\"A lot\" is two words." },
    { re: /\bcould of|should of|would of\b/i, fix: "could have / should have", why: "Write \"have\", not \"of\"." },
    { re: /\bbecause of (he|she|they|we|i|it|you) /i, fix: "because + clause", why: "Use \"because\" before a clause; \"because of\" before a noun." },
    { re: /\bthe (most|more) \w+est\b/i, fix: "the …est / the most …", why: "Do not use \"most\" with an -est form." },
    { re: /\b(\w{3,})\s+\1\b/i, fix: "remove the repeated word", why: "The same word is repeated." }
  ];
  var WRITING_ONLY_RULES = [
    { re: /(^|[.!?]\s+)i\b/, fix: "I", why: "The pronoun \"I\" is always a capital letter." },
    { re: /\b(gonna|wanna|kinda|gotta|lol|btw|u|ur|pls|thx|dunno)\b/i, fix: "going to / want to / you …", why: "Avoid text-message words in writing." }
  ];
  var INFORMAL = /\b(gonna|wanna|kinda|gotta|yeah|yup|nope|lol|btw|stuff|guys|u|ur|pls|thx|dunno|cool|awesome|super)\b/gi;
  var CONTRACTION = /\b\w+'(t|s|re|ve|ll|d|m)\b/gi;

  /* Cohesion categories for organisation scores */
  var COHESION = {
    addition: /\b(in addition|furthermore|moreover|besides|also|another|additionally)\b/i,
    contrast: /\b(however|on the other hand|although|though|whereas|while|nevertheless|but)\b/i,
    cause: /\b(because|since|therefore|thus|as a result|consequently|hence|so that)\b/i,
    example: /\b(for example|for instance|such as|to illustrate)\b/i,
    sequence: /\b(first(ly)?|second(ly)?|third(ly)?|next|then|finally|lastly|to begin with)\b/i,
    conclusion: /\b(in conclusion|to conclude|to sum up|in summary|overall|all in all)\b/i
  };
  var COMPLEX = /\b(which|who|whom|whose|although|though|whereas|while|if|unless|when|whenever|since|so that|even though|in order to|not only)\b/gi;
  var STOP = new Set("the a an and or but of to in on at for with is are was were be been being this that these those it its as by from we you they he she i our your their my me us them his her not no do does did have has had will would can could should may might must shall about into than then so such very more most much many some any all each every other also just only".split(" "));

  /* ---------------- helpers ---------------- */
  function words(t) { return (t.toLowerCase().match(/[a-z][a-z'-]*/g) || []); }
  function sentences(t) { return t.replace(/([.!?])\s+/g, "$1\n").split(/\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 2; }); }
  function paragraphs(t) { return t.split(/\n\s*\n|\n/).map(function (p) { return p.trim(); }).filter(function (p) { return p.split(/\s+/).length >= 4; }); }
  function clamp(n) { return Math.max(0, Math.min(6, Math.round(n))); }
  function quote(text, re) {
    var ss = sentences(text);
    for (var i = 0; i < ss.length; i++) {
      var m = ss[i].match(re);
      if (m) {
        var w = ss[i].split(/\s+/), idx = Math.max(0, ss[i].slice(0, m.index).split(/\s+/).length - 3);
        var q = w.slice(idx, idx + 12).join(" ");
        return (idx > 0 ? "…" : "") + q + (idx + 12 < w.length ? "…" : "");
      }
    }
    var m2 = text.match(re);
    return m2 ? m2[0] : "";
  }
  function diversity(ws) { // moving-window type-token ratio (length-fair)
    var content = ws.filter(function (w) { return w.length > 2; });
    if (content.length < 20) return content.length ? new Set(content).size / content.length : 0;
    var win = 40, sum = 0, n = 0;
    for (var i = 0; i + win <= content.length; i += 10) { sum += new Set(content.slice(i, i + win)).size / win; n++; }
    return n ? sum / n : new Set(content).size / content.length;
  }
  function topicScore(text, topicWords, statement) {
    var lower = " " + text.toLowerCase() + " ";
    var pool = (topicWords || []).slice();
    words(statement || "").forEach(function (w) { if (w.length > 3 && !STOP.has(w)) pool.push(w); });
    pool = Array.from(new Set(pool));
    var hits = pool.filter(function (w) { return lower.indexOf(w.replace(/s$/, "")) >= 0; }).length;
    return { hits: hits, pool: pool.length };
  }
  function findErrors(text, spoken) {
    var rules = spoken ? ERROR_RULES : ERROR_RULES.concat(WRITING_ONLY_RULES), out = [];
    rules.forEach(function (r) {
      if (r.onlyIf && !r.onlyIf.test(text)) return;
      var m = text.match(r.onlyIf || r.re);
      if (m && out.length < 6) out.push({ original: quote(text, r.onlyIf || r.re) || m[0], better: r.fix, why: r.why, hit: m[0] });
    });
    if (!spoken) {
      sentences(text).forEach(function (s) {
        if (out.length >= 6) return;
        var n = s.split(/\s+/).length;
        if (n > 40) out.push({ original: s.split(/\s+/).slice(0, 12).join(" ") + "…", better: "split into two sentences", why: "This sentence has " + n + " words. Long run-on sentences are hard to follow." });
        else if (/^[a-z]/.test(s) && !/^(e\.g|i\.e)/.test(s) && !out.some(function (e) { return e.better === "Capital letter at the start"; })) out.push({ original: s.split(/\s+/).slice(0, 8).join(" ") + "…", better: "Capital letter at the start", why: "Start every sentence with a capital letter." });
      });
    }
    return out;
  }
  function functionsReport(text, setKey) {
    var used = [], missing = [];
    FN_SETS[setKey].forEach(function (name) {
      var f = FN[name];
      if (f.re.test(text)) used.push({ function: name, quote: quote(text, f.re) });
      else missing.push({ function: name, tip: f.tip });
    });
    return { used: used, missing: missing };
  }
  function cohesionCats(text) { return Object.keys(COHESION).filter(function (k) { return COHESION[k].test(text); }); }
  function overused(text) {
    var lower = text.toLowerCase(), worst = null;
    ["and", "so", "also", "because", "firstly", "moreover", "furthermore", "in addition", "however"].forEach(function (c) {
      var n = (lower.match(new RegExp("\\b" + c + "\\b", "g")) || []).length;
      var limit = c === "and" ? Math.max(8, words(text).length / 12) : 4;
      if (n > limit && (!worst || n > worst.n)) worst = { word: c, n: n };
    });
    return worst;
  }

  /* =============================================================
     WRITING ANALYSIS → returns the page's shape + details
     ============================================================= */
  function analyseWriting(text, task, ctx) {
    text = String(text || "").trim();
    var ws = words(text), wc = ws.length, lower = text.toLowerCase();
    var min = task === 1 ? 100 : 250, paras = paragraphs(text), sents = sentences(text);
    var bank = TASK_BANK[(ctx.vaultId || "") + "|" + task] || {};
    var statement = ctx.statement || bank.statement || "";
    var errors = findErrors(text, false), fns = functionsReport(text, task === 1 ? "W1" : "W2");
    var cats = cohesionCats(text), over = overused(text), checklist = [];
    var topic = topicScore(text, bank.topic, statement);
    var offTopic = wc >= 30 && topic.pool >= 3 && topic.hits < 2;

    /* Content & task fulfilment */
    var tf;
    if (task === 1) {
      var covered = 0;
      (bank.notes || []).forEach(function (n) {
        var ok = n.count ? ((text.match(n.count) || []).length >= (n.min || 1)) : (n.re.test(text) && (!n.also || n.also.test(text)));
        if (ok) covered++;
        checklist.push({ label: n.label, ok: ok });
      });
      var total = (bank.notes || []).length || 4;
      tf = 1 + Math.round(covered / total * 4);                 // 1–5
      if (covered === total && wc >= min && sents.length >= 7) tf = 6;
    } else {
      var stance = FN["expressing opinions"].re.test(text);
      var developed = paras.slice(1).filter(function (p) { return (FN["giving reasons"].re.test(p) || FN.justifying.re.test(p) || FN.elaborating.re.test(p)) && (FN["giving examples"].re.test(p) || p.split(/\s+/).length >= 45); }).length;
      var concl = /\b(in conclusion|to conclude|to sum up|in summary|all in all|overall)\b/i.test(paras.length ? paras[paras.length - 1] : text);
      var counter = FN["discussing & evaluating ideas"].re.test(text);
      checklist.push({ label: "Clear stand on the statement", ok: stance });
      checklist.push({ label: "At least two developed body points (reason + example/explanation)", ok: developed >= 2 });
      checklist.push({ label: "Considers another view or evaluates ideas", ok: counter });
      checklist.push({ label: "Conclusion that returns to the statement", ok: concl });
      tf = (stance ? 2 : 1) + Math.min(2, developed) + (counter ? 1 : 0) + (concl ? 1 : 0);
    }
    if (wc < min * 0.5) tf = Math.min(tf, 2); else if (wc < min * 0.8) tf = Math.min(tf, 4);
    if (offTopic) tf = Math.min(tf, 2);

    /* Organisation & coherence */
    var expected = task === 1 ? 3 : 4;
    var co = 1 + (paras.length >= expected ? 2 : paras.length >= 2 ? 1 : 0) + Math.min(3, Math.max(0, cats.length - 1));
    if (over) co -= 1;
    if (task === 1) {
      var greet = /^(dear|hi|hello|hey)\b/i.test(text), close = /\b(regards|best wishes|yours (sincerely|truly|faithfully)|take care|love,|see you|cheers|sincerely)\b/i.test(text.slice(-160));
      checklist.push({ label: "Greeting and closing suitable for " + (bank.reader || "the reader"), ok: greet && close });
      if (!greet || !close) co -= 1;
    }
    co = clamp(Math.max(1, co));

    /* Language */
    var div = diversity(ws), complex = (lower.match(COMPLEX) || []).length / Math.max(1, wc) * 100;
    var avg = wc / Math.max(1, sents.length), errRate = errors.length / Math.max(1, wc) * 100;
    var lg = wc >= 40 ? 3 : 2;
    if (wc >= 60 && div >= 0.62) lg++; if (wc >= 60 && div >= 0.72) lg++;
    if (complex >= 3) lg++;
    if (errRate >= 3) lg -= 2; else if (errRate >= 1.5) lg -= 1;
    if (avg < 7 || avg > 32) lg -= 1;
    lg = clamp(Math.max(1, Math.min(lg, wc < min * 0.5 ? 3 : 6)));

    /* Register & style (Task 2) */
    var rs = null, informal = (text.match(INFORMAL) || []).length, contractions = (text.match(CONTRACTION) || []).length;
    if (task === 2) {
      rs = 5 - Math.min(3, informal) - (contractions > 3 ? 1 : 0) - ((lower.match(/\byou\b/g) || []).length > 5 ? 1 : 0) - ((text.match(/!/g) || []).length > 2 ? 1 : 0);
      if (rs >= 5 && wc >= min && /\b(moreover|furthermore|consequently|nevertheless|therefore)\b/i.test(text)) rs = 6;
      rs = clamp(Math.max(1, rs));
    }

    var raw = task === 1 ? tf + co + lg : tf + co + lg + rs, rawMax = task === 1 ? 18 : 24, scaledMax = task === 1 ? 30 : 60;
    var scaled = Math.round(raw / rawMax * scaledMax);

    /* Coaching */
    var strengths = [], steps = [];
    if (task === 1 && checklist.slice(0, (bank.notes || []).length).every(function (c) { return c.ok; })) strengths.push("You answered every note in the task.");
    if (task === 2 && checklist[0].ok) strengths.push("Your stand is clear: " + (quote(text, FN["expressing opinions"].re) || "you state your opinion") + ".");
    if (cats.length >= 4) strengths.push("You use a good range of linking words (" + cats.join(", ") + ").");
    if (div >= 0.68) strengths.push("Your vocabulary is varied, with little repetition.");
    if (fns.used.length >= 3 && strengths.length < 2) strengths.push("You use several MPM language functions, e.g. " + fns.used.slice(0, 2).map(function (f) { return f.function; }).join(" and ") + ".");
    if (!strengths.length) strengths.push(wc >= min ? "You wrote a full-length response." : "You made a start — build on it next time.");

    checklist.forEach(function (c) { if (!c.ok && steps.length < 2) steps.push((task === 1 ? "Add: " : "Fix: ") + c.label + "."); });
    if (wc < min) steps.push("Write at least " + min + " words (you wrote " + wc + ").");
    if (errors.length) steps.push("Check " + errors[0].why.replace(/\.$/, "").toLowerCase() + ".");
    if (over) steps.push("You used \"" + over.word + "\" " + over.n + " times — vary your linking words.");
    if (task === 2 && informal) steps.push("Replace informal words (e.g. \"" + (text.match(INFORMAL) || [""])[0] + "\") with formal ones.");
    if (offTopic) steps.unshift("Stay on the task: use the key ideas from the question.");

    return {
      tf: tf, co: co, lg: lg, rs: rs, raw: raw, rawMax: rawMax, scaled: scaled, scaledMax: scaledMax,
      wc: wc, words: wc,
      strength: strengths[0], focus: steps[0] || "Refine precision and add one more specific example.",
      detail: { kind: "Writing", task: task, checklist: checklist, functions: fns, errors: errors, strengths: strengths.slice(0, 3), steps: steps.slice(0, 3), offTopic: offTopic, wc: wc, min: min, cohesion: cats }
    };
  }

  /* =============================================================
     SPEAKING ANALYSIS → returns the page's shape + details
     ============================================================= */
  function analyseSpeaking(text, task, m, ctx) {
    text = String(text || "").trim(); m = m || {};
    var ws = words(text), wc = ws.length, lower = text.toLowerCase();
    var fns = functionsReport(text, task === "A" ? "SA" : "SB");
    var errors = findErrors(text, true), cats = cohesionCats(text);
    var topic = topicScore(text, ctx.keywords || [], ctx.prompt || "");
    var relevant = topic.hits >= 2 || (ctx.baselineTf || 0) >= 3;
    var checklist = [];

    /* Content & task fulfilment: PREP (A) or discussion moves (B) */
    var opinion = FN["expressing opinions"].re.test(text), reason = FN["giving reasons"].re.test(text);
    var example = /\b(for example|for instance|such as|like when|in my experience|i remember)\b/i.test(text);
    var close = FN.concluding.re.test(text) || FN.summarising.re.test(text) || FN["reaching a decision"].re.test(text);
    checklist.push({ label: task === "A" ? "P — state your point/opinion" : "State your view on the question", ok: opinion });
    checklist.push({ label: "R — give a reason", ok: reason });
    checklist.push({ label: "E — give an example or experience", ok: example });
    checklist.push({ label: task === "A" ? "P — restate / conclude your point" : "Help the group reach a decision", ok: close });
    checklist.push({ label: "Stay on the topic of the prompt", ok: relevant });
    var tf = [opinion, reason, example, close, relevant].filter(Boolean).length + (wc >= (task === "A" ? 150 : 120) ? 1 : 0);
    if (wc < 30) tf = Math.min(tf, 2); else if (wc < 70) tf = Math.min(tf, 4);
    if (!relevant) tf = Math.min(tf, 2);
    tf = clamp(Math.max(1, tf));

    /* Language (ASR-safe: no punctuation rules) */
    var div = diversity(ws), complex = (lower.match(COMPLEX) || []).length / Math.max(1, wc) * 100;
    var fillers = (lower.match(/\b(um+|uh+|erm+|ah+|you know|like)\b/g) || []).length;
    var lg = wc >= 30 ? 3 : 2;
    if (wc >= 40 && div >= 0.6) lg++; if (wc >= 40 && div >= 0.7) lg++;
    if (complex >= 3) lg++;
    if (errors.length >= 3) lg -= 2; else if (errors.length >= 1) lg -= 1;
    if (fillers > Math.max(4, wc / 20)) lg -= 1;
    var wpm = Number(m.wpm || m.wordsPerMinute || 0), sil = Number(m.silenceRatio || 0), dur = Number(m.durationSeconds || 0);
    if (wpm && (wpm < 70 || wpm > 200)) lg -= 1;
    if (sil > 50) lg -= 1;
    lg = clamp(Math.max(1, Math.min(lg, wc < 30 ? 2 : wc < 60 ? 4 : 6)));

    /* Coherence & organisation */
    var co = 2 + Math.min(3, Math.max(0, cats.length - 1)) + (opinion && close ? 1 : 0);
    if (overused(text)) co -= 1;
    co = clamp(Math.max(1, co));

    /* Interaction readiness (B) */
    var ir = null;
    if (task === "B") {
      var inter = ["initiating", "prompting", "turn-taking", "negotiating", "interrupting", "reaching a decision"].filter(function (k) { return FN[k].re.test(text); }).length;
      ir = clamp(1 + inter);
    }

    var strengths = [], steps = [];
    if (opinion && reason) strengths.push("You give a clear view with a reason: " + quote(text, FN["giving reasons"].re) + ".");
    if (fns.used.length >= 4) strengths.push("You use " + fns.used.length + " MPM language functions.");
    if (cats.length >= 3) strengths.push("You signpost your ideas with linking words (" + cats.join(", ") + ").");
    if (wpm >= 90 && wpm <= 170 && sil <= 35) strengths.push("Your pace (" + wpm + " words/min) is comfortable to follow.");
    if (!strengths.length) strengths.push("You completed a speaking attempt — keep practising with PREP.");
    checklist.forEach(function (c) { if (!c.ok && steps.length < 2) steps.push("Add: " + c.label + "."); });
    if (task === "A" && dur && dur < 90) steps.push("Speak for closer to 2 minutes (you spoke " + dur + " s).");
    if (sil > 45) steps.push("Reduce long pauses — plan 3 keywords per PREP step before you start.");
    if (task === "B" && ir < 4) steps.push("Use discussion phrases: " + fns.missing.slice(0, 2).map(function (f) { return "\"" + f.tip + "\""; }).join(" / ") + ".");
    if (errors.length) steps.push(errors[0].why);

    return {
      tf: tf, lg: lg, co: co, ir: ir, wc: wc,
      strength: strengths[0], focus: steps[0] || "Refine delivery and make your ending more decisive.",
      detail: { kind: "Speaking", task: task, checklist: checklist, functions: fns, errors: errors, strengths: strengths.slice(0, 3), steps: steps.slice(0, 3), wc: wc, wpm: wpm, silence: sil, duration: dur }
    };
  }

  /* =============================================================
     PAGE WIRING — override page scoring, keep its return shape
     ============================================================= */
  var body = document.body.className, LAST = {};
  var vaultId = /page-mock1/.test(body) ? "MOCK-01" : /page-v2|page-vault2/.test(body) ? "VAULT-02" : "VAULT-01";
  function safe(fn) { try { return fn(); } catch (_) { return ""; } }

  if (typeof window.evaluateWriting === "function") {
    window.evaluateWriting = function (text, task) {
      task = Number(task) === 2 ? 2 : 1;
      var statement = task === 2 ? safe(function () { return TASK2_BANK[q2.value].statement; }) : ""; // Vault 2 question picker
      var r = analyseWriting(text, task, { vaultId: vaultId, statement: statement });
      LAST["Writing|" + task] = r.detail;
      return r;
    };
  }
  if (typeof window.evaluate === "function" && /speaking/.test(body)) {
    var pageEvaluate = window.evaluate;
    window.evaluate = function (text, task, m) {
      var base = safe(function () { return pageEvaluate(text, task, m); }) || {};
      var prompt = task === "A"
        ? safe(function () { return prompts[topicA.value]; }) || safe(function () { return candidatePrompts[candidate.value]; })
        : safe(function () { return document.querySelector("#taskB, [id*=TaskB], .task-b")?.innerText; });
      var keys = task === "A" ? (safe(function () { return topicKeywords[topicA.value]; }) || []) : [];
      var r = analyseSpeaking(text, task, m, { prompt: prompt || "", keywords: keys, baselineTf: base.tf });
      LAST["Speaking|" + task] = r.detail;
      return r;
    };
  }

  /* Show the coach panel after every Writing/Speaking save */
  if (typeof window.saveSmartMuetAttempt === "function") {
    var original = window.saveSmartMuetAttempt;
    window.saveSmartMuetAttempt = function (payload, action) {
      try {
        if (/^save(Writing|Speaking)Attempt$/.test(action || "")) {
          var key = payload.component === "Writing" ? "Writing|" + (Number(payload.taskNumber) === 2 ? 2 : 1) : "Speaking|" + (/B/.test(payload.taskType || "") ? "B" : "A");
          var d = LAST[key];
          if (!d) {
            var txt = payload.answerText || payload.transcript || "";
            d = payload.component === "Writing"
              ? analyseWriting(txt, Number(payload.taskNumber) === 2 ? 2 : 1, { vaultId: payload.vaultId, statement: payload.questionText }).detail
              : analyseSpeaking(txt, /B/.test(payload.taskType || "") ? "B" : "A", payload, { prompt: payload.prompt || "" }).detail;
          }
          payload.coachFeedback = JSON.stringify({ checklist: d.checklist, used: d.functions.used.map(function (f) { return f.function; }), missing: d.functions.missing.map(function (f) { return f.function; }), errors: d.errors.map(function (e) { return e.hit || e.original; }) });
          placePanel(payload, d);
        }
      } catch (e) { console.warn("Smart Coach skipped", e); }
      return original.apply(this, arguments);
    };
  }

  /* ---------------- rendering ---------------- */
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function render(d, label) {
    var s = document.createElement("section");
    s.className = "smart-coach";
    s.setAttribute("aria-label", "Smart Coach feedback " + label);
    var li = function (a) { return (a || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); };
    var check = d.checklist.map(function (c) { return '<li class="' + (c.ok ? "ok" : "no") + '"><span aria-hidden="true">' + (c.ok ? "✅" : "⬜") + "</span> " + esc(c.label) + '<span class="sr">' + (c.ok ? " — done" : " — missing") + "</span></li>"; }).join("");
    var used = d.functions.used.map(function (f) { return "<li><b>" + esc(f.function) + ":</b> “" + esc(f.quote) + "”</li>"; }).join("");
    var miss = d.functions.missing.slice(0, 4).map(function (f) { return "<li><b>" + esc(f.function) + ":</b> " + esc(f.tip) + "</li>"; }).join("");
    var errs = d.errors.slice(0, 4).map(function (e) { return "<li><span class=\"sc-orig\">" + esc(e.original) + "</span> → <b>" + esc(e.better) + "</b><br><small>" + esc(e.why) + "</small></li>"; }).join("");
    s.innerHTML =
      '<span class="sc-kicker">SMART COACH · ' + esc(label.toUpperCase()) + "</span>" +
      '<h3 class="sc-title">What to keep, what to fix</h3>' +
      '<div class="sc-grid"><div class="sc-block"><h4>💪 Keep doing</h4><ul>' + li(d.strengths) + '</ul></div>' +
      '<div class="sc-block"><h4>🎯 Next attempt</h4><ol>' + li(d.steps.length ? d.steps : ["Add one more specific example to your strongest point."]) + "</ol></div></div>" +
      '<div class="sc-block"><h4>📋 Task checklist</h4><ul class="sc-check">' + check + "</ul></div>" +
      '<div class="sc-grid"><div class="sc-block"><h4>✅ MPM functions you used</h4><ul>' + (used || "<li>None clearly shown yet.</li>") + '</ul></div>' +
      '<div class="sc-block"><h4>➕ Functions to add</h4><ul>' + (miss || "<li>Great coverage!</li>") + "</ul></div></div>" +
      (errs ? '<div class="sc-block"><h4>🔧 Check these</h4><ul class="sc-errs">' + errs + "</ul></div>" : "") +
      '<p class="sc-note">Smart Coach checks task points, MPM language functions, organisation and common errors. It cannot fully judge meaning or pronunciation — your lecturer\'s feedback is final. Practice estimate only, not an official MUET result.</p>';
    return s;
  }
  function placePanel(p, d) {
    injectStyle();
    var k = d.kind === "Writing" ? String(d.task) : d.task;
    var label = d.kind === "Writing" ? "Task " + k : "Task " + k + (k === "A" ? " · Presentation" : " · Discussion");
    var id = "smartCoach-" + d.kind + "-" + k, node = render(d, label);
    node.id = id;
    var put = function () {
      var after = document.getElementById("save" + k);
      var box = document.getElementById("report") || document.getElementById("finalResult") || document.getElementById("finishResult");
      var old = document.getElementById(id);
      if (old) { old.replaceWith(node); return true; }
      if (after) { after.insertAdjacentElement("afterend", node); return true; }
      if (box && box.innerHTML.trim()) { box.appendChild(node); return true; }
      return false;
    };
    if (!put()) { var tries = 0, t = setInterval(function () { if (put() || ++tries > 20) clearInterval(t); }, 400); }
    else setTimeout(function () { if (!document.getElementById(id)) put(); }, 800);
  }
  function injectStyle() {
    if (document.getElementById("smart-coach-style")) return;
    var st = document.createElement("style");
    st.id = "smart-coach-style";
    st.textContent =
      ".smart-coach{margin:16px 0;border:3px solid #111;border-radius:18px;background:#fff;box-shadow:5px 5px 0 #111;padding:18px;color:#111;font-size:16px;line-height:1.55;text-align:left}" +
      ".smart-coach .sc-kicker{display:inline-block;background:#111;color:#fff;border-radius:999px;padding:4px 12px;font:800 13px/1.3 Sora,'DM Sans',sans-serif;letter-spacing:.06em}" +
      ".smart-coach .sc-title{margin:10px 0 4px!important;font:800 20px/1.25 Sora,'DM Sans',sans-serif!important}" +
      ".smart-coach .sc-grid{display:grid;gap:12px}@media(min-width:760px){.smart-coach .sc-grid{grid-template-columns:1fr 1fr}}" +
      ".smart-coach .sc-block{border:2px solid #111;border-radius:14px;padding:12px 14px;margin-top:12px;background:#fff}" +
      ".smart-coach h4{margin:0 0 8px!important;font:800 16px/1.3 Sora,'DM Sans',sans-serif!important}" +
      ".smart-coach ul,.smart-coach ol{margin:0;padding-left:20px}.smart-coach li{margin:6px 0;font-size:16px}" +
      ".smart-coach .sc-check{list-style:none;padding-left:0}.smart-coach .sc-check li.no{font-weight:700}" +
      ".smart-coach .sc-orig{text-decoration:line-through;color:#8a1c1c}.smart-coach small{font-size:14px!important;color:#3b4652}" +
      ".smart-coach .sc-note{margin:14px 0 0;font-size:14px!important;color:#3b4652}" +
      ".smart-coach .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}";
    document.head.appendChild(st);
  }

  window.SmartCoach = { analyseWriting: analyseWriting, analyseSpeaking: analyseSpeaking, TASK_BANK: TASK_BANK };
})();
