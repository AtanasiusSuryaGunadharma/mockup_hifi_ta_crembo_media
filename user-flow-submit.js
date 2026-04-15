(function () {
  var SUPABASE_URL = "https://iyqfsgtawhkbvbkvrbsa.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MJ58ehoCWPwvX1m836BOPA_AhZepXMQ";

  function headers() {
    return {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    };
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getElementValue(id) {
    var element = byId(id);
    return String((element && element.value) || "").trim();
  }

  var runtimeDefs = [];

  function asNumber(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  async function requestJson(method, path, body) {
    var options = {
      method: method,
      headers: headers()
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    var response = await fetch(SUPABASE_URL + path, options);
    var text = await response.text();
    var data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error((data && (data.message || data.error_description || data.error)) || "Request gagal");
    }

    return data;
  }

  async function ensureFlow(slug) {
    var rows = await requestJson("GET", "/rest/v1/uf_flows?select=id,slug&slug=eq." + encodeURIComponent(slug));
    if (!rows || !rows.length) {
      throw new Error("Flow tidak ditemukan di database: " + slug);
    }
    return rows[0];
  }

  function collectNodeDefinitions(flowSlug) {
    var questionnaire = byId("ufQuestionnaire");
    if (!questionnaire) {
      return [];
    }

    var lanes = Array.prototype.slice.call(document.querySelectorAll(".lane"));
    var defs = [];
    var stepNo = 1;

    lanes.forEach(function (lane) {
      if (lane === questionnaire || lane.classList.contains("checklist-lane")) {
        return;
      }

      var laneTitleEl = lane.querySelector(".lane-head h2");
      var laneTitle = laneTitleEl ? String(laneTitleEl.textContent || "").trim() : "";
      var nodes = lane.querySelectorAll(".flow .node");
      var prevNodeTitle = "";

      nodes.forEach(function (node) {
        var nodeTitleEl = node.querySelector("strong");
        var nodeDescEl = node.querySelector("p");
        var nodeTitle = nodeTitleEl ? String(nodeTitleEl.textContent || "").trim() : "Langkah " + stepNo;
        var nodeDesc = nodeDescEl ? String(nodeDescEl.textContent || "").trim() : "Silakan uji langkah ini sesuai skenario flow.";
        var links = Array.prototype.slice.call(node.querySelectorAll("a")).map(function (a) {
          return String(a.textContent || "").trim();
        }).filter(Boolean);

        var openText = links.length
          ? "Klik dan buka halaman berikut secara berurutan: " + links.join(" lalu ") + "."
          : "Buka halaman pada node ini dari tautan yang tersedia.";

        var prevText = prevNodeTitle
          ? "Setelah menyelesaikan langkah \"" + prevNodeTitle + "\", lanjutkan ke langkah ini."
          : "Mulai dari langkah ini sebagai awal alur pengujian.";

        var actionInstruction = [
          prevText,
          openText,
          "Fokuskan pengujian pada: " + nodeDesc,
          "Setelah selesai, simpan perubahan jika ada dan lanjutkan ke langkah berikutnya."
        ].join(" ");

        prevNodeTitle = nodeTitle;

        defs.push({
          step_no: stepNo,
          step_title: nodeTitle,
          flow_title: laneTitle,
          action_instruction: actionInstruction,
          question_text: "Apakah " + nodeTitle + " pada " + laneTitle + " sudah sesuai dan mudah digunakan?"
        });

        stepNo += 1;
      });
    });

    return defs;
  }

  async function ensureStepsAndQuestions(flowId, defs) {
    var existingSteps = await requestJson(
      "GET",
      "/rest/v1/uf_steps?select=id,flow_id,step_no,step_title,action_instruction&flow_id=eq." + flowId + "&order=step_no.asc"
    );

    var byStepNo = {};
    (existingSteps || []).forEach(function (row) {
      byStepNo[asNumber(row.step_no)] = row;
    });

    for (var i = 0; i < defs.length; i += 1) {
      var item = defs[i];
      var existingStep = byStepNo[asNumber(item.step_no)];

      if (!existingStep) {
        var inserted = await requestJson("POST", "/rest/v1/uf_steps", {
          flow_id: flowId,
          step_no: item.step_no,
          step_title: item.step_title,
          action_instruction: item.action_instruction,
          page_url: window.location.pathname.split("/").pop()
        });

        if (inserted && inserted.length) {
          byStepNo[item.step_no] = inserted[0];
        }
      } else {
        var existingTitle = String(existingStep.step_title || "").trim();
        var existingInstruction = String(existingStep.action_instruction || "").trim();
        var nextTitle = String(item.step_title || "").trim();
        var nextInstruction = String(item.action_instruction || "").trim();

        if (existingTitle !== nextTitle || existingInstruction !== nextInstruction) {
          await requestJson(
            "PATCH",
            "/rest/v1/uf_steps?id=eq." + encodeURIComponent(existingStep.id),
            {
              step_title: item.step_title,
              action_instruction: item.action_instruction,
              page_url: window.location.pathname.split("/").pop()
            }
          );
        }
      }
    }

    existingSteps = await requestJson(
      "GET",
      "/rest/v1/uf_steps?select=id,flow_id,step_no,step_title,action_instruction&flow_id=eq." + flowId + "&order=step_no.asc"
    );

    var qMap = {};
    for (var j = 0; j < defs.length; j += 1) {
      var currentDef = defs[j];
      var step = existingSteps.find(function (row) {
        return asNumber(row.step_no) === asNumber(currentDef.step_no);
      });

      if (!step) {
        continue;
      }

      var questions = await requestJson(
        "GET",
        "/rest/v1/uf_questions?select=id,step_id,question_no,question_text&step_id=eq." + encodeURIComponent(step.id) + "&question_no=eq.1"
      );

      if (questions && questions.length) {
        var currentQuestion = questions[0];
        var oldText = String(currentQuestion.question_text || "").trim();
        var newText = String(currentDef.question_text || "").trim();

        if (oldText !== newText) {
          await requestJson(
            "PATCH",
            "/rest/v1/uf_questions?id=eq." + encodeURIComponent(currentQuestion.id),
            {
              question_text: currentDef.question_text,
              answer_type: "yes_no_note"
            }
          );
          currentQuestion.question_text = currentDef.question_text;
        }

        qMap[step.id] = questions[0];
        continue;
      }

      var insertedQuestion = await requestJson("POST", "/rest/v1/uf_questions", {
        step_id: step.id,
        question_no: 1,
        question_text: currentDef.question_text,
        answer_type: "yes_no_note"
      });

      if (insertedQuestion && insertedQuestion.length) {
        qMap[step.id] = insertedQuestion[0];
      }
    }

    return {
      steps: existingSteps,
      questionByStepId: qMap
    };
  }

  function buildQuestionnaire(defs) {
    defs.forEach(function (item) {
      var candidates = document.querySelectorAll(".lane .flow .node");
      var node = candidates[item.step_no - 1];
      if (!node || node.querySelector(".uf-node-question")) {
        return;
      }

      var card = document.createElement("div");
      card.className = "uf-node-question";
      card.setAttribute("data-step-no", String(item.step_no));
      card.innerHTML = [
        '<div class="uf-node-question-head">',
          '<span class="uf-node-question-step">Step ' + item.step_no + '</span>',
          '<span class="uf-node-question-flow">' + escapeHtml(item.flow_title) + '</span>',
        '</div>',
        '<p class="uf-node-question-action">' + escapeHtml(item.action_instruction) + '</p>',
        '<p class="uf-node-question-text">Pertanyaan: ' + escapeHtml(item.question_text) + '</p>',
        '<div class="uf-answer-row">',
          '<label><input type="radio" name="answer-' + item.step_no + '" value="YA"> YA</label>',
          '<label><input type="radio" name="answer-' + item.step_no + '" value="TIDAK"> TIDAK</label>',
        '</div>',
        '<label class="uf-label">Catatan</label>',
        '<textarea id="note-' + item.step_no + '" rows="2" placeholder="Catatan untuk kotak ini..."></textarea>'
      ].join("");

      node.appendChild(card);
    });
  }

  function selectedValue(stepNo) {
    var checked = document.querySelector('input[name="answer-' + stepNo + '"]:checked');
    return checked ? checked.value : "";
  }

  function renderMessage(type, text) {
    var el = byId("ufSubmitInfo");
    if (!el) {
      return;
    }

    el.className = "uf-submit-info " + type;
    el.textContent = text;
  }

  function detectDevice() {
    var ua = String(navigator.userAgent || "").toLowerCase();
    if (/android|iphone|ipad|ipod|mobile/.test(ua)) {
      return "Handphone";
    }
    return "PC/Laptop";
  }

  function detectBrowser() {
    var ua = String(navigator.userAgent || "");
    if (/Edg\//.test(ua)) {
      return "Microsoft Edge";
    }
    if (/OPR\//.test(ua)) {
      return "Opera";
    }
    if (/Brave\//.test(ua)) {
      return "Brave";
    }
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) {
      return "Google Chrome";
    }
    if (/Firefox\//.test(ua)) {
      return "Mozilla Firefox";
    }
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
      return "Safari";
    }
    return "Lainnya";
  }

  function applyIdentityDefaults() {
    var deviceEl = byId("testerDevice");
    var browserEl = byId("testerBrowser");

    if (deviceEl && !deviceEl.value) {
      deviceEl.value = detectDevice();
    }

    if (browserEl && !browserEl.value) {
      browserEl.value = detectBrowser();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    var root = byId("ufQuestionnaire");
    var flowSlug = root ? root.getAttribute("data-flow-slug") : "";
    var defs = runtimeDefs.length ? runtimeDefs : collectNodeDefinitions(flowSlug);

    var fullName = getElementValue("testerFullName");
    var testerDevice = getElementValue("testerDevice");
    var testerBrowser = getElementValue("testerBrowser");

    if (!fullName) {
      renderMessage("error", "Nama lengkap penguji wajib diisi.");
      return;
    }

    if (!testerDevice) {
      renderMessage("error", "Pilih device yang digunakan penguji.");
      return;
    }

    if (!testerBrowser) {
      renderMessage("error", "Pilih browser yang digunakan penguji.");
      return;
    }

    var submitButton = byId("ufSubmitBtn");
    submitButton.disabled = true;
    renderMessage("loading", "Sedang menyimpan hasil pengujian...");

    try {
      var flow = await ensureFlow(flowSlug);
      var mapping = await ensureStepsAndQuestions(flow.id, defs);

      var answers = [];
      var stepNotes = [];
      var missingAnswers = [];

      defs.forEach(function (def) {
        var step = (mapping.steps || []).find(function (s) {
          return asNumber(s.step_no) === asNumber(def.step_no);
        });
        if (!step) {
          return;
        }

        var question = mapping.questionByStepId[step.id];
        var answerValue = selectedValue(def.step_no);
        var noteText = String((byId("note-" + def.step_no) || {}).value || "").trim();

        if (!answerValue) {
          missingAnswers.push("Step " + def.step_no + " - " + def.step_title);
        }

        if (question) {
          answers.push({
            step_id: step.id,
            question_id: question.id,
            answer_value: answerValue,
            note_text: noteText
          });
        }
      });

      if (missingAnswers.length) {
        renderMessage("error", "Masih ada jawaban kosong: " + missingAnswers.join("; "));
        submitButton.disabled = false;
        return;
      }

      var payload = {
        payload: {
          flow_slug: flowSlug,
          tester_org: getElementValue("testerOrg"),
          tester_phone: getElementValue("testerPhone"),
          tester_device: testerDevice,
          tester_browser: testerBrowser,
          tester: {
            full_name: fullName,
            org: getElementValue("testerOrg"),
            instansi_unit: getElementValue("testerOrg"),
            email: getElementValue("testerEmail"),
            phone: getElementValue("testerPhone"),
            no_hp: getElementValue("testerPhone"),
            device: testerDevice,
            browser: testerBrowser,
            user_agent: String(navigator.userAgent || "")
          },
          answers: answers,
          step_notes: stepNotes
        }
      };

      var submissionId = await requestJson("POST", "/rest/v1/rpc/uf_submit_full", payload);
      renderMessage("success", "Submit berhasil. ID submission: " + submissionId);
      byId("ufForm").reset();
      applyIdentityDefaults();
    } catch (error) {
      renderMessage("error", "Submit gagal: " + error.message);
    } finally {
      submitButton.disabled = false;
    }
  }

  function injectStyles() {
    if (document.getElementById("ufRuntimeStyles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "ufRuntimeStyles";
    style.textContent = [
      ".uf-form { display:grid; gap:10px; padding:12px; }",
      ".uf-grid { display:grid; grid-template-columns:repeat(2,minmax(220px,1fr)); gap:8px; }",
      ".uf-grid input,.uf-grid select { width:100%; border:1px solid #b9c2d1; border-radius:8px; padding:8px; font:inherit; font-size:0.82rem; background:#fff; color:#0f172a; }",
      ".uf-node-question { margin-top:10px; border:1px solid #cbd5e1; border-radius:12px; background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%); padding:10px; display:grid; gap:8px; }",
      ".uf-node-question-head { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; align-items:center; }",
      ".uf-node-question-step { display:inline-flex; align-items:center; border-radius:999px; padding:4px 8px; background:#dbeafe; color:#1e3a8a; font-size:0.72rem; font-weight:800; }",
      ".uf-node-question-flow { font-size:0.7rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.04em; }",
      ".uf-node-question-action,.uf-node-question-text { margin:0; font-size:0.78rem; color:#334155; line-height:1.45; }",
      ".uf-node-question-text { font-weight:700; color:#0f172a; }",
      ".uf-answer-row { display:flex; gap:14px; flex-wrap:wrap; font-size:0.78rem; color:#1f2937; }",
      ".uf-label { font-size:0.75rem; font-weight:700; color:#374151; }",
      ".uf-node-question textarea { width:100%; border:1px solid #b9c2d1; border-radius:8px; padding:8px; font:inherit; font-size:0.8rem; resize:vertical; }",
      ".uf-submit-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }",
      ".uf-btn { border:0; border-radius:8px; background:#1d4ed8; color:#fff; font-weight:700; padding:8px 12px; cursor:pointer; }",
      ".uf-btn.link { text-decoration:none; border:1px solid #94a3b8; background:#fff; color:#1f2937; }",
      ".uf-submit-info { font-size:0.78rem; padding:7px 9px; border-radius:8px; }",
      ".uf-submit-info.loading { background:#eff6ff; color:#1e3a8a; border:1px solid #bfdbfe; }",
      ".uf-submit-info.success { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }",
      ".uf-submit-info.error { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; }",
      "@media (max-width:900px){ .uf-grid{ grid-template-columns:1fr; } }"
    ].join("");
    document.head.appendChild(style);
  }

  function init() {
    var section = byId("ufQuestionnaire");
    if (!section) {
      return;
    }

    injectStyles();

    var flowSlug = section.getAttribute("data-flow-slug");
    applyIdentityDefaults();
    runtimeDefs = collectNodeDefinitions(flowSlug);
    buildQuestionnaire(runtimeDefs);
    byId("ufForm").addEventListener("submit", handleSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
