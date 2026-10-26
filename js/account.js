// js/account.js
// The account dialog: create an account, sign in, reset a password, sign out.
// Accounts are optional. Everything on the site works without one; an account
// adds the AI helper and protest reports in the Massachusetts pilot.

import { auth } from "./auth.js";
import { accountsConfigured } from "./config.js";
import { h, ico } from "./dom.js";

const MIN_PASSWORD = 10;

export class AccountDialog {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {HTMLButtonElement} button  the command-bar button that opens it
   */
  constructor(dialog, button) {
    this.dialog = dialog;
    this.button = button;
    this.mode = "signin"; // "signin" | "signup" | "reset" | "newpassword"
    this.message = null; // { kind: "error"|"info", text }

    button.addEventListener("click", () => this.open());
    dialog.addEventListener("click", (e) => {
      // A click on the backdrop (the dialog element itself) closes it.
      if (e.target === dialog) this.close();
    });
    auth.onChange((event) => {
      this.updateButton();
      if (event === "recovery") {
        this.mode = "newpassword";
        this.message = { kind: "info", text: "Choose a new password." };
        this.open();
      } else if (this.dialog.open) {
        this.message = null;
        this.render();
      }
    });
    this.updateButton();
  }

  updateButton() {
    const user = auth.user;
    this.button.classList.toggle("is-signed-in", !!user);
    const label = user ? `Account: signed in as ${user.email}` : "Account: sign in or create one";
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
  }

  open() {
    this.render();
    if (typeof this.dialog.showModal === "function") {
      if (!this.dialog.open) this.dialog.showModal();
    } else {
      this.dialog.setAttribute("open", "");
    }
    const first = this.dialog.querySelector("input, button.primary");
    if (first) first.focus();
  }

  close() {
    if (typeof this.dialog.close === "function") this.dialog.close();
    else this.dialog.removeAttribute("open");
    this.button.focus();
  }

  /**
   * Show a message. By default it is swapped in place so the form keeps what the
   * person typed; pass rerender when the screen itself is changing.
   */
  setMessage(kind, text, { rerender = false } = {}) {
    this.message = text ? { kind, text } : null;
    const box = this.dialog.querySelector("#acctMsg");
    if (box && !rerender) box.replaceChildren(...this._msgNodes());
    else this.render();
  }

  _msgNodes() {
    if (!this.message) return [];
    return [h("p", { class: `acct-msg acct-${this.message.kind}`, role: this.message.kind === "error" ? "alert" : "status", text: this.message.text })];
  }

  render() {
    let body;
    if (!accountsConfigured()) body = this._notConfigured();
    else if (auth.signedIn && this.mode !== "newpassword") body = this._signedIn();
    else if (this.mode === "reset") body = this._reset();
    else if (this.mode === "newpassword") body = this._newPassword();
    else body = this._form(this.mode === "signup");

    this.dialog.replaceChildren(
      h(
        "div",
        { class: "acct" },
        h(
          "header",
          { class: "acct-head" },
          h("h2", { class: "acct-title", id: "acctTitle" }, ico("user", 22), " Account"),
          h("button", { class: "btn btn-ghost acct-close", type: "button", "aria-label": "Close", onclick: () => this.close() }, ico("cross", 18))
        ),
        body
      )
    );
    this.dialog.setAttribute("aria-labelledby", "acctTitle");
  }

  _banner() {
    return h("div", { id: "acctMsg", class: "acct-msgbox" }, this._msgNodes());
  }

  _perks() {
    return h(
      "ul",
      { class: "acct-perks" },
      h("li", {}, ico("chat", 16), " Ask an AI helper nonpartisan questions about politics and voting."),
      h("li", {}, ico("sign", 16), " Report a protest near you and rate how intense it is. Reports show on the map for other account holders."),
      h("li", {}, ico("check", 16), " Free and optional. The rest of the site never needs an account.")
    );
  }

  _privacy() {
    return h(
      "details",
      { class: "acct-privacy" },
      h("summary", { text: "What is stored about you" }),
      h(
        "ul",
        {},
        h("li", { text: "Your email, used to sign in, and an optional display name." }),
        h("li", {
          text: "Your questions to the AI helper, and the text of any protest report, go from our assistant server to Kiro, the AI service that writes the answer or summary. Questions are not shown to anyone else.",
        }),
        h("li", {
          text: "A protest report keeps its location rounded to about 100 meters, the intensity you chose, the AI's summary, the text you wrote (kept private, never shown to others), your account ID and the time. Reports disappear from the map after 6 hours.",
        }),
        h("li", { text: "Other account holders see only the rounded location, the intensity, the summary and the time." })
      )
    );
  }

  _notConfigured() {
    return h(
      "div",
      { class: "acct-body" },
      h("p", { text: "Accounts aren't switched on for this copy of the site yet." }),
      h("p", { class: "acct-hint", text: "Everything else works without one. A site owner turns accounts on by adding Supabase settings in js/config.js (see server/README.md)." })
    );
  }

  _signedIn() {
    const user = auth.user;
    const name = user.user_metadata && user.user_metadata.display_name;
    return h(
      "div",
      { class: "acct-body" },
      h("p", { class: "acct-who" }, "Signed in as ", h("strong", { text: name ? `${name} (${user.email})` : user.email })),
      this._banner(),
      this._perks(),
      h(
        "p",
        { class: "acct-hint", text: "The AI helper and protest reports appear as tabs on Massachusetts pages." }
      ),
      this._privacy(),
      h("div", { class: "acct-actions" }, h("button", { class: "btn btn-accent primary", type: "button", onclick: () => this._signOut(), text: "Sign out" }))
    );
  }

  _form(signup) {
    const email = h("input", { id: "acctEmail", name: "email", type: "email", autocomplete: "email", required: true, inputmode: "email", autocapitalize: "off", spellcheck: "false" });
    const password = h("input", {
      id: "acctPassword",
      name: "password",
      type: "password",
      autocomplete: signup ? "new-password" : "current-password",
      required: true,
      minlength: signup ? String(MIN_PASSWORD) : null,
    });
    const nameInput = h("input", { id: "acctName", name: "displayName", type: "text", autocomplete: "nickname", maxlength: "40" });
    const submit = h("button", { class: "btn btn-accent primary", type: "submit", text: signup ? "Create account" : "Sign in" });

    const form = h(
      "form",
      {
        class: "acct-form",
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          const em = email.value.trim();
          const pw = password.value;
          if (!/^\S+@\S+\.\S+$/.test(em)) return this.setMessage("error", "Enter a valid email address.");
          if (signup && pw.length < MIN_PASSWORD) return this.setMessage("error", `Use at least ${MIN_PASSWORD} characters for your password.`);
          if (!pw) return this.setMessage("error", "Enter your password.");
          submit.disabled = true;
          submit.textContent = "One moment…";
          try {
            if (signup) {
              const res = await auth.signUp({ email: em, password: pw, displayName: nameInput.value.trim() });
              if (res.needsConfirmation) {
                this.mode = "signin";
                this.setMessage("info", "Almost done. We sent a link to your email. Open it to confirm, then sign in.", { rerender: true });
              } else {
                this.message = null;
                this.render();
              }
            } else {
              await auth.signIn({ email: em, password: pw });
              this.message = null;
              this.render();
            }
          } catch (err) {
            this.setMessage("error", err.message);
          }
        },
      },
      this._banner(),
      h("label", { for: "acctEmail", text: "Email" }),
      email,
      signup && h("label", { for: "acctName" }, "Display name ", h("span", { class: "acct-opt", text: "(optional)" })),
      signup && nameInput,
      h("label", { for: "acctPassword", text: "Password" }),
      password,
      signup && h("p", { class: "acct-hint", text: `At least ${MIN_PASSWORD} characters. A few random words works well.` }),
      submit
    );

    return h(
      "div",
      { class: "acct-body" },
      h(
        "div",
        { class: "acct-switch", role: "tablist", "aria-label": "Sign in or create an account" },
        h("button", { class: "acct-tab", type: "button", role: "tab", "aria-selected": String(!signup), onclick: () => this._go("signin"), text: "Sign in" }),
        h("button", { class: "acct-tab", type: "button", role: "tab", "aria-selected": String(signup), onclick: () => this._go("signup"), text: "Create account" })
      ),
      signup && this._perks(),
      form,
      !signup && h("button", { class: "acct-link", type: "button", onclick: () => this._go("reset"), text: "Forgot your password?" }),
      this._privacy()
    );
  }

  _reset() {
    const email = h("input", { id: "acctEmail", type: "email", autocomplete: "email", required: true, inputmode: "email" });
    return h(
      "div",
      { class: "acct-body" },
      h("p", { text: "Enter your email and we'll send a link to choose a new password." }),
      h(
        "form",
        {
          class: "acct-form",
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            try {
              await auth.resetPassword(email.value.trim());
              this.mode = "signin";
              // The same wording whether or not the email has an account.
              this.setMessage("info", "If that email has an account, a reset link is on its way.", { rerender: true });
            } catch (err) {
              this.setMessage("error", err.message);
            }
          },
        },
        this._banner(),
        h("label", { for: "acctEmail", text: "Email" }),
        email,
        h("button", { class: "btn btn-accent primary", type: "submit", text: "Send reset link" })
      ),
      h("button", { class: "acct-link", type: "button", onclick: () => this._go("signin"), text: "Back to sign in" })
    );
  }

  _newPassword() {
    const password = h("input", { id: "acctNew", type: "password", autocomplete: "new-password", required: true, minlength: String(MIN_PASSWORD) });
    return h(
      "div",
      { class: "acct-body" },
      h(
        "form",
        {
          class: "acct-form",
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            if (password.value.length < MIN_PASSWORD) return this.setMessage("error", `Use at least ${MIN_PASSWORD} characters.`);
            try {
              await auth.updatePassword(password.value);
              this.mode = "signin";
              this.setMessage("info", "Your password is updated.", { rerender: true });
            } catch (err) {
              this.setMessage("error", err.message);
            }
          },
        },
        this._banner(),
        h("label", { for: "acctNew", text: "New password" }),
        password,
        h("p", { class: "acct-hint", text: `At least ${MIN_PASSWORD} characters.` }),
        h("button", { class: "btn btn-accent primary", type: "submit", text: "Save password" })
      )
    );
  }

  _go(mode) {
    this.mode = mode;
    this.message = null;
    this.render();
    const first = this.dialog.querySelector("input");
    if (first) first.focus();
  }

  async _signOut() {
    await auth.signOut();
    this.mode = "signin";
    this.message = { kind: "info", text: "You're signed out." };
    this.render();
  }
}
