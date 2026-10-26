// js/assistant.js
// "Ask" tab (account holders, Massachusetts pilot): an AI helper for nonpartisan
// questions about politics and voting. Answers come from Kiro through our
// assistant server (server/assistant.py), which holds the key, checks your
// login and limits how much any one person can ask.
//
// The helper is shown what is on this page (the places, offices, candidates and
// ballot questions you are looking at) so it can answer about your ballot. It is
// told to stay nonpartisan, to say when it is unsure, and to send people to the
// official lookup for dates, deadlines and polling places.

import { assistant, ApiError } from "./api.js";
import { h, ico } from "./dom.js";

const MAX_QUESTION = 500;

const EXAMPLES = [
  "What does the Governor's Council do?",
  "What is the difference between a state senator and a state representative?",
  "What would a yes vote on Question 4 change?",
  "Who decides which judges are appointed in Massachusetts?",
];

const OFFICIAL = "https://www.sec.state.ma.us/wheredoivotema/bal/myelectioninfo.aspx";

function friendly(err) {
  switch (err.code) {
    case "rate_limited":
      return err.retryAfterSeconds
        ? `You've asked a lot today. Try again in about ${Math.max(1, Math.round(err.retryAfterSeconds / 60))} minutes.`
        : "You've reached today's limit for questions. Please try again tomorrow.";
    case "ai_unavailable":
    case "busy":
    case "capacity_reached":
    case "service_unavailable":
      return "The AI helper is busy or offline right now. Please try again in a few minutes.";
    case "unauthorized":
      return "Please sign in again to ask questions.";
    case "network":
      return err.message;
    case "not_configured":
      return "The AI helper isn't switched on for this copy of the site.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

export class AskPanel {
  /**
   * @param {HTMLElement} root
   * @param {{getContext: () => {place: object, context: string}}} deps
   */
  constructor(root, deps) {
    this.root = root;
    this.deps = deps;
    this.busy = false;
    this.turns = []; // { q, a, error } for this visit only; nothing is saved
    this.render();
  }

  render() {
    const input = h("textarea", {
      id: "askInput",
      class: "ask-input",
      rows: "3",
      maxlength: String(MAX_QUESTION),
      placeholder: "Ask about an office, a ballot question, or how something works",
      "aria-describedby": "askHelp askCount",
    });
    const count = h("span", { id: "askCount", class: "ask-count", text: `0/${MAX_QUESTION}` });
    const send = h("button", { class: "btn btn-accent", type: "submit", text: "Ask" });
    input.addEventListener("input", () => {
      count.textContent = `${input.value.length}/${MAX_QUESTION}`;
    });
    input.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") form.requestSubmit();
    });

    const form = h(
      "form",
      {
        class: "ask-form",
        onsubmit: (e) => {
          e.preventDefault();
          this.ask(input.value, send, input);
        },
      },
      h("label", { for: "askInput", class: "ask-label", text: "Your question" }),
      input,
      h("div", { class: "ask-row" }, count, send)
    );

    this.log = h("div", { class: "ask-log", "aria-live": "polite" });
    this.root.replaceChildren(
      h("h3", { class: "vi-title" }, ico("chat", 20), " Ask a question"),
      h("p", {
        id: "askHelp",
        class: "ask-help",
        text: "An AI helper answers in plain language and tries to stay nonpartisan. It can be wrong. It will not tell you who to vote for.",
      }),
      form,
      h(
        "div",
        { class: "ask-examples" },
        h("span", { class: "ask-examples-label", text: "Try:" }),
        EXAMPLES.map((q) =>
          h("button", {
            class: "chip-btn ask-chip",
            type: "button",
            text: q,
            onclick: () => {
              input.value = q;
              count.textContent = `${q.length}/${MAX_QUESTION}`;
              input.focus();
            },
          })
        )
      ),
      this.log,
      h(
        "p",
        { class: "ask-official" },
        "For dates, deadlines, ID rules and your polling place, use the ",
        h("a", { href: OFFICIAL, target: "_blank", rel: "noopener noreferrer", text: "official Massachusetts lookup ↗" }),
        " or call your city or town clerk. Don't rely on an AI for those."
      )
    );
    this.paintLog();
  }

  paintLog() {
    this.log.replaceChildren(
      ...this.turns.map((t) =>
        h(
          "article",
          { class: "ask-turn" },
          h("p", { class: "ask-q" }, h("span", { class: "ask-who", text: "You asked" }), t.q),
          t.error
            ? h("p", { class: "ask-a ask-error", role: "alert", text: t.error })
            : h(
                "div",
                { class: "ask-a" },
                h("span", { class: "ask-who", text: "AI helper" }),
                // The answer is plain text. Paragraph breaks are kept; nothing is rendered as HTML.
                String(t.a)
                  .split(/\n{2,}/)
                  .map((para) => h("p", { text: para.trim() })),
                h("p", { class: "ask-disclaimer", text: t.disclaimer || "AI-written. It can make mistakes. Check anything important with an official source." })
              )
        )
      )
    );
    this.log.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async ask(raw, button, input) {
    const question = raw.trim();
    if (!question || this.busy) return;
    this.busy = true;
    button.disabled = true;
    button.textContent = "Thinking…";
    const turn = { q: question, a: "", error: null };
    this.turns.push(turn);
    this.paintLog();
    try {
      const { place, context } = this.deps.getContext();
      const res = await assistant("/v1/ask", { method: "POST", body: { question, place, context } });
      turn.a = res.answer;
      turn.disclaimer = res.disclaimer;
      input.value = "";
    } catch (err) {
      turn.error = err instanceof ApiError ? friendly(err) : "Something went wrong. Please try again.";
    } finally {
      this.busy = false;
      button.disabled = false;
      button.textContent = "Ask";
      this.paintLog();
    }
  }
}
