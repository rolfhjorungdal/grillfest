import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  getISOWeek,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  startOfMonth,
} from "https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm";

const PERSON_COLORS = [
  "#d14a36",
  "#157f8a",
  "#6b8e23",
  "#7c4dff",
  "#ef6c00",
  "#2e7d32",
  "#00897b",
  "#ad1457",
  "#455a64",
  "#6d4c41",
];

const DEFAULT_STATE = {
  months: 6,
  people: [
    {
      id: createId(),
      name: "Friend A",
      color: getDefaultColor(0),
      weeksOn: 1,
      weeksOff: 1,
      anchorDate: format(new Date(), "yyyy-MM-dd"),
      anchorState: "off",
    },
    {
      id: createId(),
      name: "Friend B",
      color: getDefaultColor(1),
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
  updateAll();
});

el.addPerson.addEventListener("click", () => {
  if (state.people.length >= MAX_PEOPLE) {
    setStatus("Maximum number of people reached");
    return;
  }

  state.people.push({
    id: createId(),
    name: `Friend ${String.fromCharCode(65 + (state.people.length % 26))}`,
    color: getDefaultColor(state.people.length),
    weeksOn: 1,
    weeksOff: 1,
    anchorDate: format(new Date(), "yyyy-MM-dd"),
    anchorState: "off",
  });
  updateAll();
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
  updateAll();
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
  if (field === "color") {
    person.color = sanitizeColor(input.value, person.color);
    card.style.borderLeftColor = person.color;
  }
  if (field === "weeksOn") person.weeksOn = clampInt(input.value, 1, 26, 1);
  if (field === "weeksOff") person.weeksOff = clampInt(input.value, 1, 26, 1);
  if (field === "anchorDate") person.anchorDate = sanitizeDate(input.value);
  if (field === "anchorState") {
    person.anchorState = input.value === "work" ? "work" : "off";
  }

  updateCalendarOnly();
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
      color: getDefaultColor(0),
      weeksOn: 1,
      weeksOff: 1,
      anchorDate: format(new Date(), "yyyy-MM-dd"),
      anchorState: "off",
    });
  }

  updateAll();
});

function updateAll() {
  persistStateToHash(state);
  render();
}

function updateCalendarOnly() {
  persistStateToHash(state);
  const timeline = computeTimeline(state);
  renderCalendar(timeline);
}

function render() {
  el.months.value = String(state.months);

  renderPeople();

  const timeline = computeTimeline(state);
  renderCalendar(timeline);
}

function renderPeople() {
  el.peopleList.replaceChildren();

  state.people.forEach((person) => {
    const fragment = el.personTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".person");
    card.dataset.id = person.id;
    card.style.borderLeftColor = person.color;

    const fields = card.querySelectorAll("[data-field]");
    fields.forEach((fieldEl) => {
      const field = fieldEl.dataset.field;
      fieldEl.value = String(person[field] ?? "");
    });

    el.peopleList.append(card);
  });
}

function renderCalendar(timeline) {
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

    const weekLabel = document.createElement("div");
    weekLabel.className = "weekday weeklabel";
    weekLabel.textContent = "Wk";
    days.append(weekLabel);

    const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    weekdayNames.forEach((name) => {
      const wd = document.createElement("div");
      wd.className = "weekday";
      wd.textContent = name;
      days.append(wd);
    });

    const pad = (getDay(monthStart) + 6) % 7;
    const monthEnd = endOfMonth(monthStart);
    const gridStart = addDays(monthStart, -pad);
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    for (let rowStart = gridStart; !isAfterDay(rowStart, gridEnd); rowStart = addDays(rowStart, 7)) {
      const weekNumber = document.createElement("div");
      weekNumber.className = "weeknum";
      weekNumber.textContent = String(getISOWeek(rowStart));
      days.append(weekNumber);

      eachDayOfInterval({
        start: rowStart,
        end: addDays(rowStart, 6),
      }).forEach((dayDate) => {
      const key = format(dayDate, "yyyy-MM-dd");
      const data = byKey.get(key);

      const day = document.createElement("div");
      day.className = "day";

      if (isBeforeDay(dayDate, monthStart) || isAfterDay(dayDate, monthEnd)) {
        day.classList.add("blank");
        days.append(day);
        return;
      }

      const dateLabel = document.createElement("span");
      dateLabel.className = "date";
      dateLabel.textContent = String(dayDate.getDate());
      day.append(dateLabel);

      if (data) {
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = data.onCount === 0 ? "all free" : `${data.onCount} on`;

        if (data.onCount > 0) {
          const colors = data.workingPeople.map((p) => p.color);
          day.style.background = createWorkGradient(colors);
          day.style.borderColor = colors[0];

          const stripes = document.createElement("div");
          stripes.className = "work-stripes";
          data.workingPeople.forEach((person) => {
            const stripe = document.createElement("span");
            stripe.className = "work-stripe";
            stripe.style.backgroundColor = person.color;
            stripe.title = person.name || "(unnamed)";
            stripes.append(stripe);
          });
          day.append(stripes);
        } else {
          day.style.background = "";
          day.style.borderColor = "";
          day.classList.add("free");
        }

        day.append(count);
      }

      days.append(day);
    });
    }

    monthBox.append(days);
    el.calendar.append(monthBox);
  });
}

function computeTimeline(current) {
  const from = getTimelineStartDate(current);
  const to = endOfMonth(addMonths(from, current.months - 1));

  return eachDayOfInterval({ start: from, end: to }).map((date) => {
    const workingPeople = current.people.filter((person) => !isOffOnDate(person, date));
    return {
      date,
      onCount: workingPeople.length,
      workingPeople: workingPeople.map((p) => ({
        id: p.id,
        name: p.name || "(unnamed)",
        color: sanitizeColor(p.color, "#999999"),
      })),
    };
  });
}

function getTimelineStartDate(current) {
  const today = startOfDay(new Date());
  if (!Array.isArray(current?.people) || current.people.length === 0) return today;

  let earliest = today;
  current.people.forEach((person) => {
    const anchor = parseSafeDate(person.anchorDate);
    if (isBeforeDay(anchor, earliest)) earliest = anchor;
  });

  return earliest;
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
    people: Array.isArray(value?.people) ? value.people.slice(0, MAX_PEOPLE) : [],
  };

  clean.people = clean.people
    .map((person, index) => ({
      id: typeof person?.id === "string" ? person.id : createId(),
      name: typeof person?.name === "string" ? person.name.slice(0, 40) : "",
      color: sanitizeColor(person?.color, getDefaultColor(index)),
      weeksOn: normalizeWeeks(person, "workDays", "weeksOn", 1),
      weeksOff: normalizeWeeks(person, "offDays", "weeksOff", 1),
      anchorDate: sanitizeDate(person?.anchorDate),
      anchorState: person?.anchorState === "work" ? "work" : "off",
    }))
    .filter((p) => p.weeksOn >= 1 && p.weeksOff >= 1);

  if (!clean.people.length) {
    clean.people = structuredClone(DEFAULT_STATE.people);
  }

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

function sanitizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  return fallback;
}

function getDefaultColor(index) {
  return PERSON_COLORS[index % PERSON_COLORS.length];
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

function isBeforeDay(left, right) {
  return startOfDay(left).valueOf() < startOfDay(right).valueOf();
}

function isAfterDay(left, right) {
  return startOfDay(left).valueOf() > startOfDay(right).valueOf();
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

function createWorkGradient(colors) {
  const palette = Array.from(new Set(colors.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))));
  if (!palette.length) return "";
  if (palette.length === 1) {
    return `linear-gradient(160deg, ${hexToRgba(palette[0], 0.25)}, #fffefb 70%)`;
  }

  const step = 100 / palette.length;
  const stops = palette
    .map((color, index) => {
      const start = (index * step).toFixed(2);
      const end = ((index + 1) * step).toFixed(2);
      const tint = hexToRgba(color, 0.22);
      return `${tint} ${start}% ${end}%`;
    })
    .join(", ");

  return `linear-gradient(160deg, ${stops})`;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

persistStateToHash(state);
