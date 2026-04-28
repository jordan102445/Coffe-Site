import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PEOPLE = [
  "Aleksandar Ivanonski",
  "Aleksandar Petrov",
  "Filip Efremov",
  "Verica Koceva",
  "Viktor Miladinov",
  "Martin Gjurov",
  "Valerija Tomeva",
  "Jasna Kuzmanovksa",
  "Despina Trajkova",
  "Jordan Trajkov",
  "Bojan Kocev",
  "Viktorija Davceva"
];

const FALLBACK_PLACES = [
  "Mosh",
  "Broz",
  "Public Room",
  "Coffee Factory",
  "Trend",
  "Intermezzo",
  "Kolektiv"
];

const ADMIN_PIN = "1200";
const DAY_NAMES = ["Недела", "Понеделник", "Вторник", "Среда", "Четврток", "Петок", "Сабота"];
const WORK_DAYS = [1, 2, 3, 4, 5];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDay(date) {
  return DAY_NAMES[date.getDay()];
}

function getCurrentWorkWeekDays() {
  const days = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const dayOffsetFromMonday = (cursor.getDay() + 6) % 7;
  cursor.setDate(cursor.getDate() - dayOffsetFromMonday);

  for (let index = 0; index < WORK_DAYS.length; index += 1) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function createBlankResponses() {
  return PEOPLE.reduce((acc, person) => {
    acc[person] = {
      awake: false,
      coffee: false,
      place: "",
      arrival: ""
    };
    return acc;
  }, {});
}

function loadBoard() {
  try {
    const stored = localStorage.getItem("coffee-daily-board");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function App() {
  const days = useMemo(() => getCurrentWorkWeekDays(), []);
  const [selectedKey, setSelectedKey] = useState(() => {
    const todayKey = toDateKey(new Date());
    return days.some((day) => toDateKey(day) === todayKey) ? todayKey : toDateKey(days[0]);
  });
  const [board, setBoard] = useState(loadBoard);
  const [now, setNow] = useState(new Date());
  const [pin, setPin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    localStorage.setItem("coffee-daily-board", JSON.stringify(board));
  }, [board]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedDay = days.find((day) => toDateKey(day) === selectedKey) ?? days[0];
  const responses = board[selectedKey]?.responses ?? createBlankResponses();
  const result = board[selectedKey]?.result;
  const selectedIsToday = selectedKey === toDateKey(now);
  const isWorkday = WORK_DAYS.includes(now.getDay());
  const isNoonOrLater = now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() >= 0);
  const canGenerate = isAdmin && selectedIsToday && isWorkday && isNoonOrLater;

  const awakeCount = Object.values(responses).filter((person) => person.awake).length;
  const coffeePeople = Object.entries(responses).filter(([, response]) => response.coffee);
  const coffeeCount = coffeePeople.length;

  function updatePerson(person, field, value) {
    setBoard((current) => ({
      ...current,
      [selectedKey]: {
        ...current[selectedKey],
        responses: {
          ...createBlankResponses(),
          ...current[selectedKey]?.responses,
          [person]: {
            ...createBlankResponses()[person],
            ...current[selectedKey]?.responses?.[person],
            [field]: value
          }
        }
      }
    }));
  }

  function unlockAdmin(event) {
    event.preventDefault();
    setIsAdmin(pin === ADMIN_PIN);
  }

  function generateCoffeePlan() {
    if (!canGenerate) return;

    const suggestedPlaces = coffeePeople
      .map(([, response]) => response.place.trim())
      .filter(Boolean);
    const pool = suggestedPlaces.length ? suggestedPlaces : FALLBACK_PLACES;
    const place = pool[Math.floor(Math.random() * pool.length)];
    const people = coffeePeople.map(([name]) => name);

    setBoard((current) => ({
      ...current,
      [selectedKey]: {
        ...current[selectedKey],
        result: {
          place,
          people,
          generatedAt: new Date().toISOString()
        }
      }
    }));
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Дневна проверка</p>
          <h1>Кафе во 12:00</h1>
        </div>
        <div className="clock-card" aria-live="polite">
          <span>{formatDay(now)}</span>
          <strong>{pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}</strong>
        </div>
      </section>

      <nav className="day-tabs" aria-label="Работен ден">
        {days.map((day) => {
          const key = toDateKey(day);
          return (
            <button
              className={key === selectedKey ? "active" : ""}
              key={key}
              onClick={() => setSelectedKey(key)}
              type="button"
            >
              <span>{DAY_NAMES[day.getDay()]}</span>
            </button>
          );
        })}
      </nav>

      <section className="status-strip">
        <div>
          <span>Избран ден</span>
          <strong>{formatDay(selectedDay)}</strong>
        </div>
        <div>
          <span>Станати</span>
          <strong>{awakeCount}/{PEOPLE.length}</strong>
        </div>
        <div>
          <span>За кафе</span>
          <strong>{coffeeCount}/{PEOPLE.length}</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="table-panel">
          <div className="table-header">
            <span>Име</span>
            <span>Станат</span>
            <span>За кафе</span>
            <span>Кафич</span>
            <span>Кога стига</span>
          </div>

          {PEOPLE.map((person) => {
            const response = responses[person] ?? createBlankResponses()[person];
            return (
              <article className="person-row" key={person}>
                <strong>{person}</strong>
                <label className="check-cell">
                  <input
                    checked={response.awake}
                    onChange={(event) => updatePerson(person, "awake", event.target.checked)}
                    type="checkbox"
                  />
                  <span>Станат</span>
                </label>
                <label className="check-cell">
                  <input
                    checked={response.coffee}
                    onChange={(event) => updatePerson(person, "coffee", event.target.checked)}
                    type="checkbox"
                  />
                  <span>Кафе</span>
                </label>
                <input
                  aria-label={`${person} кафич`}
                  onChange={(event) => updatePerson(person, "place", event.target.value)}
                  placeholder="предлог кафич"
                  type="text"
                  value={response.place}
                />
                <input
                  aria-label={`${person} време`}
                  onChange={(event) => updatePerson(person, "arrival", event.target.value)}
                  placeholder="пример 12:05"
                  type="text"
                  value={response.arrival}
                />
              </article>
            );
          })}
        </div>

        <aside className="admin-panel">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Случаен избор</h2>
          </div>

          <form className="admin-login" onSubmit={unlockAdmin}>
            <input
              aria-label="Admin PIN"
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN"
              type="password"
              value={pin}
            />
            <button type="submit">{isAdmin ? "Админ вклучен" : "Отклучи"}</button>
          </form>

          <button
            className="generate-button"
            disabled={!canGenerate}
            onClick={generateCoffeePlan}
            type="button"
          >
            Генерирај
          </button>

          <p className="hint">
            Копчето се активира само за админ, за денешниот работен ден, после 12:00.
          </p>

          {result ? (
            <div className="result-box">
              <span>Денес седиме во</span>
              <strong>{result.place}</strong>
              <p>{result.people.length ? result.people.join(", ") : "Нема пријавени за кафе."}</p>
            </div>
          ) : (
            <div className="empty-result">Резултатот ќе се појави тука.</div>
          )}
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
