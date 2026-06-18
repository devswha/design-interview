#!/bin/sh
# install.sh - Install design-interview as a skill for Claude Code and other AI agents.
# Usage: curl -fsSL https://raw.githubusercontent.com/devswha/design-interview/main/install.sh | bash
#
# design-interview ships its deterministic verification engine (src/) alongside the
# SKILL.md orchestrator. The non-visual lanes (intake/audit/preview/assets/crawl)
# have ZERO runtime dependencies, so a plain clone is enough to run the skill.
# The visual lane (shot, audit --visual) needs puppeteer — install it on demand:
#   cd "$HOME/.claude/skills/design-interview" && npm install
set -e

# Agent targets (set env vars to enable; all enabled by default if none specified).
INSTALL_CLAUDE="${INSTALL_CLAUDE:-true}"
INSTALL_CODEX="${INSTALL_CODEX:-true}"
INSTALL_CURSOR="${INSTALL_CURSOR:-true}"
INSTALL_OPCODE="${INSTALL_OPCODE:-true}"

CLAUDE_SKILLS_DIR="${HOME}/.claude/skills"
CODEX_SKILLS_DIR="${HOME}/.codex/skills"
CURSOR_RULES_DIR="${HOME}/.cursor/rules"
OPCODE_SKILLS_DIR="${HOME}/.config/opencode/skills"
DI_DIR="${CLAUDE_SKILLS_DIR}/design-interview"
# Source repo. Overridable for forks or local testing (e.g. DI_REPO_URL=/path/to/clone).
REPO_URL="${DI_REPO_URL:-https://github.com/devswha/design-interview.git}"
# Pin the installed checkout to a concrete ref. If unset, resolve the current
# remote HEAD once and check out that commit instead of tracking main.
DI_REF="${DI_REF:-}"

# Colors (only when outputting to a terminal).
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; RESET=''
fi

info()    { printf "%b\n" "${BOLD}$1${RESET}"; }
warn()    { printf "%b\n" "${YELLOW}$1${RESET}"; }
success() { printf "%b\n" "${GREEN}$1${RESET}"; }
error()   { printf "%b\n" "${RED}Error: $1${RESET}" >&2; exit 1; }

# Prerequisites.
command -v git >/dev/null 2>&1 || error "git is not installed. Please install git first."
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${NODE_MAJOR}" -lt 22 ] 2>/dev/null; then
    warn "node $(node --version) detected; design-interview needs Node >= 22.12. The skill may fail until you upgrade."
  fi
else
  warn "node not found on PATH. Install Node >= 22.12 before running the skill's CLI lanes."
fi

resolve_install_ref() {
  if [ -n "${DI_REF}" ]; then printf "%s" "${DI_REF}"; return 0; fi
  git ls-remote "${REPO_URL}" HEAD 2>/dev/null | awk 'NR == 1 { print $1 }'
}

checkout_install_ref() {
  dir="$1"; ref="$2"
  set +e
  (
    cd "${dir}"
    git fetch --depth=1 origin "${ref}" || exit 10
    git checkout --detach FETCH_HEAD >/dev/null 2>&1 || exit 11
  )
  rc="$?"
  set -e
  [ "${rc}" = "10" ] && error "Failed to fetch design-interview ref '${ref}'. Use DI_REF=<tag-or-full-sha>."
  [ "${rc}" = "11" ] && error "Failed to check out design-interview ref '${ref}'."
  [ "${rc}" != "0" ] && error "Failed to install design-interview ref '${ref}'."
  return 0
}

INSTALL_REF="$(resolve_install_ref)"
[ -z "${INSTALL_REF}" ] && error "Failed to resolve install ref. Set DI_REF=<tag-or-full-sha> and retry."

# --- Claude Code (canonical clone) ---
if [ "${INSTALL_CLAUDE}" = "true" ]; then
  info "Installing for Claude Code..."
  [ -d "${CLAUDE_SKILLS_DIR}" ] || { info "Creating ${CLAUDE_SKILLS_DIR}..."; mkdir -p "${CLAUDE_SKILLS_DIR}"; }

  if [ -d "${DI_DIR}/.git" ]; then
    info "Updating existing design-interview installation..."
    checkout_install_ref "${DI_DIR}" "${INSTALL_REF}"
  else
    [ -d "${DI_DIR}" ] && error "${DI_DIR} exists but is not a git repo. Remove it and try again."
    info "Cloning design-interview at ${INSTALL_REF}..."
    git clone --depth=1 "${REPO_URL}" "${DI_DIR}" || error "Failed to clone design-interview. Check your network connection."
    checkout_install_ref "${DI_DIR}" "${INSTALL_REF}"
  fi
  success "Claude Code: /design-interview ready"
else
  warn "Skipping Claude Code installation (INSTALL_CLAUDE=false)"
fi

# --- Codex CLI (symlink to the same clone) ---
if [ "${INSTALL_CODEX}" = "true" ]; then
  info "Installing for Codex CLI..."
  [ -d "${CODEX_SKILLS_DIR}" ] || { info "Creating ${CODEX_SKILLS_DIR}..."; mkdir -p "${CODEX_SKILLS_DIR}"; }
  if [ -d "${DI_DIR}" ]; then
    ln -snf "${DI_DIR}" "${CODEX_SKILLS_DIR}/design-interview"
    success "Codex: /design-interview linked to ${CODEX_SKILLS_DIR}"
  else
    warn "design-interview repo not found. Claude Code installation must succeed first."
  fi
else
  warn "Skipping Codex installation (INSTALL_CODEX=false)"
fi

# --- Cursor (rule file) ---
if [ "${INSTALL_CURSOR}" = "true" ]; then
  info "Installing for Cursor..."
  [ -d "${CURSOR_RULES_DIR}" ] || { info "Creating ${CURSOR_RULES_DIR}..."; mkdir -p "${CURSOR_RULES_DIR}"; }
  if [ -f "${DI_DIR}/.cursor/rules/design-interview.md" ]; then
    ln -snf "${DI_DIR}/.cursor/rules/design-interview.md" "${CURSOR_RULES_DIR}/design-interview.md"
    success "Cursor: rules linked to ${CURSOR_RULES_DIR}/design-interview.md"
  else
    warn "Cursor rule not found in repo. Run 'git pull' in ${DI_DIR} or check repo integrity."
  fi
else
  warn "Skipping Cursor installation (INSTALL_CURSOR=false)"
fi

# --- OpenCode / Sisyphus (symlink to the same clone) ---
if [ "${INSTALL_OPCODE}" = "true" ]; then
  info "Installing for OpenCode / Sisyphus..."
  [ -d "${OPCODE_SKILLS_DIR}" ] || { info "Creating ${OPCODE_SKILLS_DIR}..."; mkdir -p "${OPCODE_SKILLS_DIR}"; }
  if [ -d "${DI_DIR}" ]; then
    ln -snf "${DI_DIR}" "${OPCODE_SKILLS_DIR}/design-interview"
    success "OpenCode: skill linked to ${OPCODE_SKILLS_DIR}/design-interview"
  else
    warn "design-interview repo not found. Claude Code installation must succeed first."
  fi
else
  warn "Skipping OpenCode installation (INSTALL_OPCODE=false)"
fi

# Done.
printf "\n"
success "✓ design-interview installed."
info "  If it saves you a slop redesign, a star helps others find it → https://github.com/devswha/design-interview"
printf "\n"
info "Usage (Claude Code):"
printf "    /design-interview --standard ./slop-draft.md\n"
printf "    /design-interview --quick   https://example.com/landing\n"
printf "\n"
info "Visual lane (optional — full-page screenshots + rendered-geometry tells):"
printf "    cd %s && npm install   # pulls puppeteer; non-visual lanes work without it\n" "${DI_DIR}"
printf "\n"
info "Environment variables to control installation:"
printf "  DI_REF=<tag-or-full-sha>     Pin installed checkout (default: resolved remote HEAD SHA)\n"
printf "  DI_REPO_URL=<url-or-path>    Source repo for clone (default: github devswha/design-interview)\n"
printf "  INSTALL_CLAUDE=true|false    (default: true)\n"
printf "  INSTALL_CODEX=true|false     (default: true)\n"
printf "  INSTALL_CURSOR=true|false    (default: true)\n"
printf "  INSTALL_OPCODE=true|false    (default: true)\n"
printf "\n"
