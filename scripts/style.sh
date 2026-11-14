#!/usr/bin/env bash
# Code style pipeline for the Kolvex monorepo.
#
#   scripts/style.sh <check|fix> [backend|web|mobile|all] [scope]
#
# Scopes (default: --base origin/main):
#   --base <ref>   files changed since the merge-base with <ref> (commits + working tree + untracked)
#   --staged       files staged for commit (used by the pre-commit hook)
#   --all          every file in the project
#
# Tools:
#   backend  ruff check (lint + import order) and ruff format   — config: kolvex-backend-py/pyproject.toml
#   web      prettier                                           — config: kolvex-frontend-web-nextjs/.prettierrc.json
#   mobile   prettier                                           — config: kolvex-mobile/.prettierrc.json
#
# ESLint for web runs in ci.yml; ESLint for mobile runs in style.yml.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

MODE="${1:-}"
[[ "$MODE" == "check" || "$MODE" == "fix" ]] || usage
shift

PROJECT="all"
if [[ $# -gt 0 && "$1" != --* ]]; then
  PROJECT="$1"
  shift
fi

SCOPE="base"
BASE_REF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) SCOPE="all" ;;
    --staged) SCOPE="staged" ;;
    --base)
      SCOPE="base"
      BASE_REF="${2:-}"
      [[ -n "$BASE_REF" ]] || usage
      shift
      ;;
    -h | --help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
  shift
done

if [[ "$SCOPE" == "base" && -z "$BASE_REF" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    BASE_REF="origin/main"
  else
    BASE_REF="main"
  fi
fi

# Prints changed files (repo-relative, one per line) that still exist.
changed_files() {
  case "$SCOPE" in
    staged)
      git diff --cached --name-only --diff-filter=ACMR
      ;;
    base)
      local merge_base
      if ! merge_base="$(git merge-base "$BASE_REF" HEAD 2>/dev/null)"; then
        echo "style.sh: cannot find merge-base with '$BASE_REF'" >&2
        exit 2
      fi
      {
        git diff --name-only --diff-filter=ACMR "$merge_base"
        git ls-files --others --exclude-standard
      } | sort -u
      ;;
  esac | while IFS= read -r f; do
    [[ -f "$f" ]] && printf '%s\n' "$f"
  done
}

FAILED=()

# --- backend: ruff -----------------------------------------------------------
run_backend() {
  local dir="kolvex-backend-py"
  local files=()
  if [[ "$SCOPE" == "all" ]]; then
    files=(".")
  else
    while IFS= read -r f; do
      files+=("${f#"$dir"/}")
    done < <(changed_files | grep -E "^$dir/.*\.pyi?$" || true)
    if [[ ${#files[@]} -eq 0 ]]; then
      echo "backend: no changed Python files"
      return 0
    fi
  fi

  local ruff="ruff"
  command -v ruff >/dev/null 2>&1 || ruff="python3 -m ruff"

  echo "backend: ruff $($ruff --version | awk '{print $2}') on ${#files[@]} path(s)"
  (
    cd "$dir"
    if [[ "$MODE" == "fix" ]]; then
      $ruff check --force-exclude --fix "${files[@]}" || true
      $ruff format --force-exclude "${files[@]}"
      # Report anything --fix could not resolve.
      $ruff check --force-exclude "${files[@]}"
    else
      local rc=0
      $ruff check --force-exclude --output-format="${RUFF_OUTPUT_FORMAT:-full}" "${files[@]}" || rc=1
      $ruff format --force-exclude --check --diff "${files[@]}" || rc=1
      exit $rc
    fi
  ) || FAILED+=("backend")
}

# --- web / mobile: prettier --------------------------------------------------
# $1 project dir, $2 regex (relative to project dir) of files to include in changed mode,
# $3.. paths used for --all
run_prettier() {
  local name="$1" dir="$2" include="$3"
  shift 3
  local all_paths=("$@")
  local files=()

  if [[ "$SCOPE" == "all" ]]; then
    files=("${all_paths[@]}")
  else
    while IFS= read -r f; do
      files+=("${f#"$dir"/}")
    done < <(changed_files | grep -E "^$dir/" | sed "s|^$dir/||" | grep -E "$include" | sed "s|^|$dir/|" || true)
    if [[ ${#files[@]} -eq 0 ]]; then
      echo "$name: no changed files to format"
      return 0
    fi
  fi

  local bin="$dir/node_modules/.bin/prettier"
  if [[ ! -x "$bin" ]]; then
    echo "$name: prettier not installed — run 'npm ci' in $dir" >&2
    FAILED+=("$name")
    return 0
  fi

  echo "$name: prettier on ${#files[@]} path(s)"
  local flag="--check"
  [[ "$MODE" == "fix" ]] && flag="--write"
  (
    cd "$dir"
    ./node_modules/.bin/prettier "$flag" --ignore-unknown "${files[@]}"
  ) || FAILED+=("$name")
}

run_web() {
  run_prettier web kolvex-frontend-web-nextjs \
    '\.(tsx?|jsx?|mjs|cjs|css)$' \
    .
}

run_mobile() {
  run_prettier mobile kolvex-mobile \
    '^(src|tests)/.*\.(tsx?|jsx?|mjs|cjs|css|json|md)$|^[^/]+\.(json|md)$' \
    src tests '*.json' '*.md'
}

case "$PROJECT" in
  backend) run_backend ;;
  web) run_web ;;
  mobile) run_mobile ;;
  all)
    run_backend
    run_web
    run_mobile
    ;;
  *) usage ;;
esac

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo
  echo "✗ Style check failed: ${FAILED[*]}"
  [[ "$MODE" == "check" ]] && echo "  Fix locally with: scripts/style.sh fix ${PROJECT}"
  exit 1
fi
echo "✓ Style OK"
