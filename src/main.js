import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  startOfMonth,
} from "https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm";

const DEFAULT_STATE = {
  months: 6,
  minOff: 2,
  people: [
    {
      id: createId(),
      name: "Friend A",
      weeksOn: 1,
      weeksOff: 1,
      anchorDate: format(new Date(), "yyyy-MM-dd"),
      anchorState: "off",
    },
    {
      id: createId(),
      name: "Friend B",
      weeksOn: 2,
      weeksOff: 2,
      anchorDate: format(new Date(), "yyyy-MM-dd"),
      anchorState: "off",
    },
  ],
};

const MAX_PEOPLE = 30;

const el = {
  months: document.querySelector("#months"),
  minOff: document.querySelector("#minOff"),
  addPerson: document.querySelector("#addPerson"),
  copyUrl: document.querySelector("#copyUrl"),
  reset: document.querySelector("#reset"),
  status: document.querySelector("#status"),
  peopleList: document.querySelector("#peopleList"),
  personTemplate: document.querySelector("#personTemplate"),
  calendar: document.querySelector("#calendar"),
};

let state = loadStateFromHash();
render();

window.addEventListener("hashchange", () => {
  state = loadStateFromHash();
  render();
  setStatus("Loaded state from URL hash");
});

el.months.addEventListener("input", (event) => {
  state.months = clampInt(event.target.value, 1, 24, 6);
  update();
});

el.minOff.addEventListener("input", (event) => {
  state.minOff = clampInt(event.target.value, 1, MAX_PEOPLE, 2);
  update();
});

el.addPerson.addEventListener("click", () => {
  if (state.people.length >= MAX_PEOPLE) {
    setStatus("Maximum number of people reached");
    return;
  }

  state.people.push({
    id: createId(),
    name: `Friend ${String.fromCharCode(65 + (state.people.length % 26))}`,
    weeksOn: 1,
    weeksOff: 1,
    anchorDate: format(new Date(), "yyyy-MM-dd"),
    anchorState: "off",
  });
  update();
});

el.copyUrl.addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}${location.hash}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("Share URL copied");
  } catch {
    setStatus("Clipboard blocked by browser");
  }
});

el.reset.addEventListener("click", () => {
  state = structuredClone(DEFAULT_STATE);
  update();
  setStatus("Reset to defaults");
});

el.peopleList.addEventListener("input", (event) => {
  const input = event.target;
  const card = input.closest(".person");
  if (!card) return;

  const id = card.dataset.id;
  const person = state.people.find((p) => p.id === id);
  if (!person) return;

  const field = input.dataset.field;
  if (!field) return;

  if (field === "name") person.name = input.value.trim().slice(0, 40);
  if (field === "weeksOn") person.weeksOn = clampInt(input.value, 1, 26, 1);
  if (field === "weeksOff") person.weeksOff = clampInt(input.value, 1, 26, 1);
  if (field === "anchorDate") person.anchorDate = sanitizeDate(input.value);
  if (field === "anchorState") {
    person.anchorState = input.value === "work" ? "work" : "off";
  }

  update();
});

el.peopleList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action='remove']");
  if (!btn) return;

  const card = btn.closest(".person");
  if (!card) return;

  state.people = state.people.filter((p) => p.id !== card.dataset.id);
  if (!state.people.length) {
    state.people.push({
      id: createId(),
      name: "Friend A",
      weeksOn: 1,
      weeksOff: 1,
      anchorDate: format(new Date(), "yyyy-MM-dd"),
      anchorState: "off",
    });
  }

  update();
});

function update() {
  persistStateToHash(state);
  render();
}

function render() {
  el.months.value = String(state.months);
  el.minOff.value = String(state.minOff);

  renderPeople();

  const timeline = computeTimeline(state);
  renderCalendar(timeline, state.minOff);
}

function renderPeople() {
  el.peopleList.replaceChildren();

  state.people.forEach((person) => {
    const fragment = el.personTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".person");
    card.dataset.id = person.id;

    const fields = card.querySelectorAll("[data-field]");
    fields.forEach((fieldEl) => {
      const field = fieldEl.dataset.field;
      fieldEl.value = String(person[field] ?? "");
    });

    el.peopleList.append(card);
  });
}

function renderCalendar(timeline, minOff) {
  el.calendar.replaceChildren();

  if (!timeline.length) return;

  const start = startOfMonth(timeline[0].date);
  const end = endOfMonth(timeline[timeline.length - 1].date);
  const months = eachMonthFrom(start, end);

  const byKey = new Map(
    timeline.map((d) => [format(d.date, "yyyy-MM-dd"), d])
  );

  months.forEach((monthStart) => {
    const monthBox = document.createElement("section");
    monthBox.className = "month";

    const title = document.createElement("h3");
    title.textContent = format(monthStart, "MMMM yyyy");
    monthBox.append(title);

    const days = document.createElement("div");
    days.className = "days";

    const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    weekdayNames.forEach((name) => {
      const wd = document.createElement("div");
      wd.className = "weekday";
      wd.textContent = name;
      days.append(wd);
    });

    const pad = (getDay(monthStart) + 6) % 7;
    for (let i = 0; i < pad; i += 1) {
      const blank = document.createElement("div");
      blank.className = "day blank";
      days.append(blank);
    }

    eachDayOfInterval({
      start: monthStart,
      end: endOfMonth(monthStart),
    }).forEach((dayDate) => {
      const key = format(dayDate, "yyyy-MM-dd");
      const data = byKey.get(key);

      const day = document.createElement("div");
      day.className = "day";

      const dateLabel = document.createElement("span");
      dateLabel.className = "date";
      dateLabel.textContent = String(dayDate.getDate());
      day.append(dateLabel);

      if (data) {
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = `${data.offCount} off`;
        day.append(count);

        if (data.offCount >= minOff) day.classList.add("match");
        if (data.offCount === state.people.length) day.classList.add("perfect");
      }

      days.append(day);
    });

    monthBox.append(days);
    el.calendar.append(monthBox);
  });
}

function computeTimeline(current) {
  const from = startOfDay(new Date());
  const to = endOfMonth(addMonths(from, current.months - 1));

  return eachDayOfInterval({ start: from, end: to }).map((date) => {
    const offPeople = current.people.filter((person) => isOffOnDate(person, date));
    return {
      date,
      offCount: offPeople.length,
      names: offPeople.map((p) => p.name || "(unnamed)"),
    };
  });
}

function isOffOnDate(person, date) {
  const workDays = clampInt(person.weeksOn, 1, 26, 1) * 7;
  const offDays = clampInt(person.weeksOff, 1, 26, 1) * 7;
  const cycle = workDays + offDays;

  const anchor = parseSafeDate(person.anchorDate);
  const diff = differenceInCalendarDays(startOfDay(date), anchor);
  const index = modulo(diff, cycle);

  if (person.anchorState === "off") {
    return index < offDays;
  }

  return index >= workDays;
}

function eachMonthFrom(start, end) {
  const months = [];
  let cursor = start;

  while (isBefore(cursor, end) || isEqual(cursor, end)) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return months;
}

function loadStateFromHash() {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!hash) return structuredClone(DEFAULT_STATE);

  const normalized = hash.startsWith("v1:") ? hash.slice(3) : hash;
  try {
    const json = decodeHashValue(normalized);
    const parsed = JSON.parse(json);
    return sanitizeState(parsed);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function persistStateToHash(current) {
  const clean = sanitizeState(current);
  const json = JSON.stringify(clean);
  const encoded = encodeHashValue(json);
  const next = `v1:${encoded}`;

  if (location.hash.slice(1) !== next) {
    history.replaceState(null, "", `#${next}`);
  }
}

function sanitizeState(value) {
  const clean = {
    months: clampInt(value?.months, 1, 24, DEFAULT_STATE.months),
    minOff: clampInt(value?.minOff, 1, MAX_PEOPLE, DEFAULT_STATE.minOff),
    people: Array.isArray(value?.people) ? value.people.slice(0, MAX_PEOPLE) : [],
  };

  clean.people = clean.people
    .map((person) => ({
      id: typeof person?.id === "string" ? person.id : createId(),
      name: typeof person?.name === "string" ? person.name.slice(0, 40) : "",
      weeksOn: normalizeWeeks(person, "workDays", "weeksOn", 1),
      weeksOff: normalizeWeeks(person, "offDays", "weeksOff", 1),
      anchorDate: sanitizeDate(person?.anchorDate),
      anchorState: person?.anchorState === "work" ? "work" : "off",
    }))
    .filter((p) => p.weeksOn >= 1 && p.weeksOff >= 1);

  if (!clean.people.length) {
    clean.people = structuredClone(DEFAULT_STATE.people);
  }

  clean.minOff = clampInt(clean.minOff, 1, clean.people.length, 1);

  return clean;
}

function sanitizeDate(value) {
  if (typeof value !== "string") return format(new Date(), "yyyy-MM-dd");
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.valueOf())) return format(new Date(), "yyyy-MM-dd");
  return format(parsed, "yyyy-MM-dd");
}

function parseSafeDate(value) {
  const parsed = parseISO(sanitizeDate(value));
  return Number.isNaN(parsed.valueOf()) ? startOfDay(new Date()) : startOfDay(parsed);
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWeeks(person, legacyField, weeksField, fallback) {
  if (Number.isFinite(Number(person?.[weeksField]))) {
    return clampInt(person?.[weeksField], 1, 26, fallback);
  }

  const legacyDays = Number(person?.[legacyField]);
  if (Number.isFinite(legacyDays) && legacyDays >= 1) {
    return clampInt(Math.round(legacyDays / 7), 1, 26, fallback);
  }

  return fallback;
}

function modulo(value, base) {
  return ((value % base) + base) % base;
}

function base64ToBase64Url(base64) {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBase64(base64url) {
  const pad = base64url.length % 4;
  const fixed = base64url.replace(/-/g, "+").replace(/_/g, "/");
  if (pad === 0) return fixed;
  if (pad === 2) return `${fixed}==`;
  if (pad === 3) return `${fixed}=`;
  return fixed;
}

function encodeHashValue(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return base64ToBase64Url(btoa(binary));
}

function decodeHashValue(hashValue) {
  const binary = atob(base64UrlToBase64(hashValue));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function setStatus(text) {
  el.status.textContent = text;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    el.status.textContent = "";
  }, 2000);
}

persistStateToHash(state);
