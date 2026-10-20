(() => {
  const STORAGE_KEY = "health-roadmap-2026-local-v1";
  const form = document.querySelector(".record form");
  if (!form) return;

  const dateInput = form.querySelector('input[type="date"]');
  const numberInputs = form.querySelectorAll('input[type="number"]');
  const weightInput = numberInputs[0];
  const fatInput = numberInputs[1];
  const meditationInput = form.querySelector('.medcheck input[type="checkbox"]');
  const mealInputs = [...form.querySelectorAll(".meal-grid input")];
  const noteInput = form.querySelector(".note-more textarea");
  const saveButton = form.querySelector('button[type="submit"]');
  const reloadButton = form.querySelector('button[type="button"]');
  const details = [...document.querySelectorAll("main details")];
  const graphDetails = details.find((item) => item.querySelector("summary")?.textContent.includes("변화 그래프"));
  const planDetails = details.find((item) => item.querySelector("summary")?.textContent.includes("계획 보기"));
  const reviewDetails = details.find((item) => item.querySelector("summary")?.textContent.includes("돌아보기"));
  const historyDetails = details.find((item) => item.querySelector("summary")?.textContent.includes("지난 기록"));
  const monthSelect = document.querySelector(".meditation select");
  let reviewPeriod = "week";

  function readData() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        reviews: data.reviews && typeof data.reviews === "object" ? data.reviews : {},
      };
    } catch {
      return { entries: [], reviews: {} };
    }
  }

  let data = readData();

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function localDate(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function mondayOf(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return localDate(date);
  }

  function sortedEntries() {
    return [...data.entries].sort((a, b) => a.date.localeCompare(b.date));
  }

  function showStatus(message, isError = false) {
    let status = form.querySelector(".save-status");
    if (!status) {
      status = document.createElement("p");
      status.className = "save-status";
      status.setAttribute("role", "status");
      form.append(status);
    }
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function selectedEntry() {
    return data.entries.find((entry) => entry.date === dateInput.value);
  }

  function fillForm(entry) {
    weightInput.value = entry?.weight ?? "";
    fatInput.value = entry?.fat ?? "";
    meditationInput.checked = Boolean(entry?.meditation);
    mealInputs.forEach((input, index) => {
      input.value = entry?.meals?.[index] ?? "";
    });
    noteInput.value = entry?.note ?? "";
  }

  function renderGoal(card, kind, starting, target) {
    const latest = [...sortedEntries()].reverse().find((entry) => entry[kind] !== null && entry[kind] !== "");
    const recent = card.querySelector(".ends strong");
    const track = card.querySelector(".track i");
    if (!latest) {
      recent.textContent = "아직 없어요";
      track.style.width = "0%";
      return;
    }
    const value = Number(latest[kind]);
    const unit = kind === "weight" ? "kg" : "%";
    recent.textContent = `${value.toFixed(1)}${unit} · ${latest.date}`;
    const progress = starting === target ? 0 : Math.max(0, Math.min(100, ((starting - value) / (starting - target)) * 100));
    track.style.width = `${progress}%`;
  }

  function renderMeditation() {
    if (!monthSelect) return;
    const month = monthSelect.value;
    const completed = data.entries.filter((entry) => entry.date.startsWith(month) && entry.meditation).length;
    const count = Math.min(7, completed);
    const value = document.querySelector(".meditation .value");
    value.innerHTML = `${count}<small>/ 7회</small>`;
    document.querySelectorAll(".meditation .dots span").forEach((dot, index) => {
      dot.classList.toggle("done", index < count);
      dot.setAttribute("aria-label", `${index + 1}회${index < count ? " 완료" : " 남음"}`);
    });
    const remaining = document.querySelector(".meditation .ends strong");
    remaining.textContent = count >= 7 ? "이번 달 목표를 채웠어요" : `${7 - count}회 남았어요`;
  }

  function renderHistory() {
    if (!historyDetails) return;
    let container = historyDetails.querySelector(".local-history");
    if (!container) {
      container = document.createElement("div");
      container.className = "local-history";
      historyDetails.querySelector("p")?.remove();
      historyDetails.append(container);
    }
    container.replaceChildren();
    const entries = [...sortedEntries()].reverse();
    if (!entries.length) {
      container.textContent = "아직 기록이 없어요. 첫 기록을 남겨보세요.";
      return;
    }
    for (const entry of entries) {
      const row = document.createElement("article");
      row.className = "history-row";
      const summary = document.createElement("div");
      summary.className = "history-summary";
      const date = document.createElement("strong");
      date.textContent = entry.date;
      const values = document.createElement("span");
      const parts = [];
      if (entry.weight !== null && entry.weight !== "") parts.push(`체중 ${Number(entry.weight).toFixed(1)}kg`);
      if (entry.fat !== null && entry.fat !== "") parts.push(`체지방률 ${Number(entry.fat).toFixed(1)}%`);
      if (entry.meditation) parts.push("명상");
      values.textContent = parts.join(" · ") || "식사·메모 기록";
      summary.append(date, values);
      const actions = document.createElement("div");
      actions.className = "history-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "수정";
      edit.addEventListener("click", () => {
        dateInput.value = entry.date;
        fillForm(entry);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.addEventListener("click", () => {
        if (!window.confirm(`${entry.date} 기록을 삭제할까요?`)) return;
        data.entries = data.entries.filter((item) => item.date !== entry.date);
        persist();
        renderAll();
      });
      actions.append(edit, remove);
      row.append(summary, actions);
      container.append(row);
    }
  }

  function renderGraphs() {
    if (!graphDetails) return;
    const panels = graphDetails.querySelectorAll(":scope > div > div");
    const entries = sortedEntries();
    ["weight", "fat"].forEach((kind, index) => {
      const panel = panels[index * 2 + 1];
      if (!panel) return;
      let chart = panel.querySelector(".local-chart");
      if (!chart) {
        chart = document.createElement("div");
        chart.className = "local-chart";
        panel.append(chart);
      }
      chart.replaceChildren();
      const measured = entries.filter((entry) => entry[kind] !== null && entry[kind] !== "").slice(-12);
      if (!measured.length) return;
      [...panel.childNodes].forEach((node) => {
        if (node !== chart) node.remove();
      });
      const values = measured.map((entry) => Number(entry[kind]));
      const low = Math.min(...values);
      const high = Math.max(...values);
      measured.forEach((entry, rowIndex) => {
        const bar = document.createElement("div");
        bar.className = "chart-row";
        const label = document.createElement("span");
        label.textContent = entry.date.slice(5);
        const rail = document.createElement("span");
        rail.className = "chart-rail";
        const fill = document.createElement("i");
        const width = high === low ? 58 : 28 + ((values[rowIndex] - low) / (high - low)) * 72;
        fill.style.width = `${width}%`;
        rail.append(fill);
        const number = document.createElement("strong");
        number.textContent = `${values[rowIndex].toFixed(1)}${kind === "weight" ? "kg" : "%"}`;
        bar.append(label, rail, number);
        chart.append(bar);
      });
    });
  }

  function renderPlans() {
    if (!planDetails) return;
    const cards = planDetails.querySelectorAll("button");
    ["2026-10", "2026-11", "2026-12"].forEach((month, index) => {
      const count = Math.min(7, data.entries.filter((entry) => entry.date.startsWith(month) && entry.meditation).length);
      const strong = cards[index]?.querySelector("strong");
      if (strong) strong.textContent = `${count} / 7회`;
    });
  }

  function currentReviewKey() {
    if (reviewPeriod === "month") return `month:${dateInput.value.slice(0, 7)}`;
    return `week:${mondayOf(dateInput.value)}`;
  }

  function renderReview() {
    if (!reviewDetails) return;
    const buttons = reviewDetails.querySelectorAll("button");
    const weekButton = [...buttons].find((button) => button.textContent.trim() === "주간");
    const monthButton = [...buttons].find((button) => button.textContent.trim() === "월간");
    weekButton?.classList.toggle("selected", reviewPeriod === "week");
    monthButton?.classList.toggle("selected", reviewPeriod === "month");
    const label = reviewDetails.querySelector("small");
    label.textContent = reviewPeriod === "week" ? `${mondayOf(dateInput.value)} 시작 주` : `${dateInput.value.slice(0, 7)} 월간 기록`;
    const textArea = reviewDetails.querySelector('textarea[aria-label="돌아보기 내용"]');
    textArea.value = data.reviews[currentReviewKey()] || "";
    const save = [...reviewDetails.querySelectorAll("button")].find((button) => button.textContent.includes("돌아보기 저장"));
    if (save) save.disabled = !textArea.value.trim();
  }

  function renderAll() {
    renderGoal(document.querySelectorAll(".goals .goal")[0], "weight", 24, 55);
    renderGoal(document.querySelectorAll(".goals .goal")[1], "fat", 22, 17);
    renderMeditation();
    renderHistory();
    renderGraphs();
    renderPlans();
    renderReview();
    if (dateInput.value) fillForm(selectedEntry());
  }

  function saveRecord(event) {
    event.preventDefault();
    const entry = {
      date: dateInput.value,
      weight: weightInput.value === "" ? null : Number(weightInput.value),
      fat: fatInput.value === "" ? null : Number(fatInput.value),
      meditation: meditationInput.checked,
      meals: mealInputs.map((input) => input.value.trim()),
      note: noteInput.value.trim(),
    };
    if (!entry.date) {
      showStatus("기록 날짜를 선택해 주세요.", true);
      return;
    }
    if (entry.weight === null && entry.fat === null && !entry.meditation && !entry.meals.some(Boolean) && !entry.note) {
      showStatus("저장할 내용을 하나 이상 입력해 주세요.", true);
      return;
    }
    data.entries = data.entries.filter((item) => item.date !== entry.date);
    data.entries.push(entry);
    try {
      persist();
      renderAll();
      showStatus("이 브라우저에 기록을 저장했어요.");
    } catch {
      showStatus("브라우저 저장 공간을 사용할 수 없어요. 저장 공간 설정을 확인해 주세요.", true);
    }
  }

  form.addEventListener("submit", saveRecord);
  saveButton.disabled = false;
  dateInput.value = localDate();
  reloadButton?.addEventListener("click", () => {
    fillForm(selectedEntry());
    showStatus(selectedEntry() ? "저장된 기록을 불러왔어요." : "이 날짜에 저장된 기록이 없어요.");
  });
  dateInput.addEventListener("change", renderAll);
  monthSelect?.addEventListener("change", renderMeditation);

  if (reviewDetails) {
    const buttons = reviewDetails.querySelectorAll("button");
    [...buttons].find((button) => button.textContent.trim() === "주간")?.addEventListener("click", () => {
      reviewPeriod = "week";
      renderReview();
    });
    [...buttons].find((button) => button.textContent.trim() === "월간")?.addEventListener("click", () => {
      reviewPeriod = "month";
      renderReview();
    });
    const reviewForm = reviewDetails.querySelector("form");
    reviewForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const textArea = reviewForm.querySelector("textarea");
      data.reviews[currentReviewKey()] = textArea.value.trim();
      try {
        persist();
        renderReview();
        showStatus("돌아보기를 이 브라우저에 저장했어요.");
      } catch {
        showStatus("브라우저 저장 공간을 사용할 수 없어요.", true);
      }
    });
    reviewForm?.querySelector("textarea")?.addEventListener("input", (event) => {
      const save = reviewForm.querySelector("button[type='submit']") || reviewForm.querySelector("button");
      if (save) save.disabled = !event.currentTarget.value.trim();
    });
  }

  renderAll();
})();
