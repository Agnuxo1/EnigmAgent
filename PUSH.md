# Pushing this repo to GitHub

The local repo is initialized at `D:\PROJECTS\EnigmAgent`, branch `main`,
with remote `origin` pointing at `https://github.com/agnuxo1/EnigmAgent.git`.

The remote repo does **not** exist yet. Pick one of the two paths below.

---

## Option A — GitHub Desktop (easiest, no token)

You already have GitHub Desktop installed.

1. Open **GitHub Desktop**.
2. **File → Add local repository…** → choose `D:\PROJECTS\EnigmAgent`.
3. It will say "this local repo has no matching remote". Click
   **Publish repository**.
4. In the dialog:
   - **Name**: `EnigmAgent`
   - **Description**: *Local-first credential & document vault for AI agents.
     Your LLM never sees your secrets — only placeholders.*
   - Leave **"Keep this code private"** unchecked if you want it public.
5. Click **Publish repository**.

Done. The repo will be at `https://github.com/agnuxo1/EnigmAgent`.

---

## Option B — Personal access token on the command line

1. Create a token at <https://github.com/settings/tokens/new>
   - Scopes needed: **`repo`** (and **`workflow`** if you add GH Actions later).
   - Copy the token (starts with `ghp_…` or `github_pat_…`).

2. Create the remote repo with curl:
   ```bash
   curl -X POST https://api.github.com/user/repos \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Accept: application/vnd.github+json" \
     -d '{"name":"EnigmAgent","description":"Local-first credential & document vault for AI agents.","private":false}'
   ```

3. Push from inside `D:\PROJECTS\EnigmAgent`:
   ```bash
   git push -u origin main
   ```
   When prompted, use your **GitHub username** and the **token** (not your
   account password) as the password.

---

## After pushing

- Add repo topics on the GitHub page: `security`, `llm`, `agents`,
  `credentials`, `webextension`, `privacy`, `local-first`.
- Pin the repo on your GitHub profile so visitors see it.
- Consider enabling **Discussions** for the placeholder-protocol spec.
