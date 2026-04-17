(function () {
  var runtimeDefs = [];
  var LOCAL_SUBMISSION_KEY = "uf-last-submission";

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

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildContextQuestion(item) {
    var haystack = normalizeText([item.step_title, item.flow_title, item.action_instruction].join(" "));

    if (haystack.indexOf("dashboard") !== -1 || haystack.indexOf("header") !== -1 || haystack.indexOf("headline") !== -1) {
      return "Apakah warna, kontras teks, dan posisi elemen header pada langkah ini sudah nyaman dilihat?";
    }

    if (haystack.indexOf("form") !== -1) {
      return "Apakah susunan field, label, dan tombol pada form ini sudah jelas?";
    }

    if (haystack.indexOf("kerusakan") !== -1) {
      return "Apakah alur pelaporan kerusakan barang pada langkah ini sudah mudah dipahami?";
    }

    if (haystack.indexOf("peminjaman") !== -1 || haystack.indexOf("pengembalian") !== -1 || haystack.indexOf("pengambilan") !== -1) {
      return "Apakah urutan aksi dan status persetujuan pada alur ini sudah sesuai?";
    }

    if (haystack.indexOf("berita") !== -1 || haystack.indexOf("pengumuman") !== -1 || haystack.indexOf("agenda") !== -1) {
      return "Apakah tampilan daftar dan tombol aksi pada halaman ini sudah rapi?";
    }

    if (haystack.indexOf("login") !== -1 || haystack.indexOf("otp") !== -1 || haystack.indexOf("reset") !== -1) {
      return "Apakah alur autentikasi dan pesan bantuannya sudah jelas?";
    }

    if (haystack.indexOf("profil") !== -1) {
      return "Apakah komposisi judul, isi, dan tombol pada halaman ini sudah seimbang?";
    }

    return "Apakah tampilan langkah ini sudah sesuai dengan high fidelity mock up yang diharapkan?";
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
          question_text: "Apakah " + nodeTitle + " pada " + laneTitle + " sudah sesuai dan mudah digunakan?",
          context_question_text: buildContextQuestion({
            step_title: nodeTitle,
            flow_title: laneTitle,
            action_instruction: actionInstruction
          })
        });

        stepNo += 1;
      });
    });

    return defs;
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
        '<div class="uf-question-block">',
          '<p class="uf-question-label">Pertanyaan 1</p>',
          '<p class="uf-node-question-text">' + escapeHtml(item.question_text) + '</p>',
          '<div class="uf-answer-row">',
            '<label><input type="radio" name="answer-main-' + item.step_no + '" value="YA"> YA</label>',
            '<label><input type="radio" name="answer-main-' + item.step_no + '" value="TIDAK"> TIDAK</label>',
          '</div>',
        '</div>',
        '<div class="uf-question-block">',
          '<p class="uf-question-label">Pertanyaan 2</p>',
          '<p class="uf-node-question-context">' + escapeHtml(item.context_question_text) + '</p>',
          '<div class="uf-answer-row secondary">',
            '<label><input type="radio" name="answer-context-' + item.step_no + '" value="YA"> YA</label>',
            '<label><input type="radio" name="answer-context-' + item.step_no + '" value="TIDAK"> TIDAK</label>',
          '</div>',
        '</div>',
        '<label class="uf-label">Catatan</label>',
        '<textarea id="note-' + item.step_no + '" rows="2" placeholder="Catatan untuk kotak ini..."></textarea>'
      ].join("");

      node.appendChild(card);
    });
  }

  function selectedValue(groupName, stepNo) {
    var checked = document.querySelector('input[name="' + groupName + '-' + stepNo + '"]:checked');
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
    renderMessage("loading", "Sedang menyimpan hasil pengujian secara lokal...");

    try {
      var answers = [];
      var missingAnswers = [];

      defs.forEach(function (def) {
        var mainAnswer = selectedValue("answer-main", def.step_no);
        var contextAnswer = selectedValue("answer-context", def.step_no);
        var noteText = String((byId("note-" + def.step_no) || {}).value || "").trim();

        if (!mainAnswer || !contextAnswer) {
          missingAnswers.push("Step " + def.step_no + " - " + def.step_title);
        }

        answers.push({
          step_no: def.step_no,
          step_title: def.step_title,
          flow_title: def.flow_title,
          main_answer: mainAnswer,
          context_answer: contextAnswer,
          note_text: noteText
        });
      });

      if (missingAnswers.length) {
        renderMessage("error", "Masih ada jawaban kosong: " + missingAnswers.join("; "));
        submitButton.disabled = false;
        return;
      }

      var submission = {
        id: "local-" + Date.now(),
        submitted_at: new Date().toISOString(),
        flow_slug: flowSlug,
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
        answers: answers
      };

      localStorage.setItem(LOCAL_SUBMISSION_KEY, JSON.stringify(submission));
      localStorage.setItem(LOCAL_SUBMISSION_KEY + "-" + flowSlug, JSON.stringify(submission));
      window.__UF_LAST_SUBMISSION__ = submission;
      renderMessage("success", "Hasil pengujian tersimpan lokal. Koneksi Supabase sementara dimatikan.");
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
      ".uf-question-block { border:1px solid #dbe3ef; border-radius:10px; background:#fff; padding:8px; display:grid; gap:6px; }",
      ".uf-question-label { margin:0; font-size:0.72rem; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.04em; }",
      ".uf-node-question { margin-top:10px; border:1px solid #cbd5e1; border-radius:12px; background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%); padding:10px; display:grid; gap:8px; }",
      ".uf-node-question-head { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; align-items:center; }",
      ".uf-node-question-step { display:inline-flex; align-items:center; border-radius:999px; padding:4px 8px; background:#dbeafe; color:#1e3a8a; font-size:0.72rem; font-weight:800; }",
      ".uf-node-question-flow { font-size:0.7rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.04em; }",
      ".uf-node-question-action,.uf-node-question-text,.uf-node-question-context { margin:0; font-size:0.78rem; color:#334155; line-height:1.45; }",
      ".uf-node-question-text { font-weight:700; color:#0f172a; }",
      ".uf-answer-row { display:flex; gap:14px; flex-wrap:wrap; font-size:0.78rem; color:#1f2937; }",
      ".uf-answer-row.secondary { border-top:1px dashed #dbe3ef; padding-top:6px; }",
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
