#!/usr/bin/env bash
# skill.sh — pizx skill helper
# Source this in your zx/pizx scripts to get the pizx_use_skill() function.
#
# Usage:
#   source ./skill.sh
#   pizx_use_skill promp-engineering "write a system prompt for ..."
#
# The function finds a SKILL.md file by name, reads its content,
# and passes it as --system context to `pizx ask`.

PIZX_SKILL_PATHS=(
  ".pi/skills"
  ".agents/skills"
  "skills"
  "$HOME/.pi/agent/skills"
  "$HOME/.codewhale/skills"
  "$HOME/.claude/skills"
)

# ── find_skill ────────────────────────────────────────────────────────────────
# Searches PIZX_SKILL_PATHS for a skill directory matching $1.
# Prints the path to SKILL.md on stdout if found.
# Returns 0 if found, 1 otherwise.
find_skill() {
  local name="$1"
  for base in "${PIZX_SKILL_PATHS[@]}"; do
    local candidate="${base}/${name}/SKILL.md"
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# ── pizx_use_skill ───────────────────────────────────────────────────────────
# Loads a skill and runs pizx with it as system context.
#
# Arguments:
#   $1 — skill name (directory name under skills/)
#   $2 — prompt to send after loading the skill
#
# Example:
#   pizx_use_skill spec-driven-development "create a spec for a CLI tool"
pizx_use_skill() {
  local skill_name="$1"
  local prompt="$2"

  if [[ -z "$skill_name" || -z "$prompt" ]]; then
    echo "Usage: pizx_use_skill <skill-name> <prompt>" >&2
    return 1
  fi

  local skill_file
  skill_file=$(find_skill "$skill_name")
  if [[ -z "$skill_file" ]]; then
    echo "Skill '$skill_name' not found in: ${PIZX_SKILL_PATHS[*]}" >&2
    return 1
  fi

  local skill_content
  skill_content=$(<"$skill_file")

  echo "Using skill: ${skill_file}" >&2
  pizx -p --system "${skill_content}" "${prompt}"
}

# ── pizx_list_skills ─────────────────────────────────────────────────────────
# Lists all available skills across configured paths.
pizx_list_skills() {
  for base in "${PIZX_SKILL_PATHS[@]}"; do
    if [[ -d "$base" ]]; then
      for dir in "$base"/*/; do
        if [[ -f "${dir}SKILL.md" ]]; then
          local name
          name=$(basename "$dir")
          echo "  ${name}  →  ${dir}SKILL.md"
        fi
      done
    fi
  done
}

# Export functions for subshell use
export -f find_skill pizx_use_skill pizx_list_skills
export PIZX_SKILL_PATHS
