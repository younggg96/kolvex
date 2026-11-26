#!/bin/zsh
# Install / remove the macOS LaunchAgent that runs collect.py on a fixed interval.
# Usage: ./install_worker.sh [minutes]   (default 60)   ·   ./install_worker.sh --uninstall
set -euo pipefail
cd "$(dirname "$0")"
root="$PWD"
label="app.kolvex.fear-greed"
plist="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "$domain/$label" 2>/dev/null || true
  rm -f "$plist"
  print "已移除 $label"
  exit 0
fi

minutes="${1:-60}"
[[ "$minutes" == <-> && "$minutes" -ge 15 ]] || { print '间隔须为不少于 15 的整数分钟'; exit 1; }
[[ -x .venv/bin/python ]] || { print '请先运行 ./setup.sh'; exit 1; }
[[ -f .env.worker ]] || { print '请先复制 .env.worker.example 为 .env.worker 并填写'; exit 1; }
mkdir -p logs "$HOME/Library/LaunchAgents"
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>$root/start.sh</string></array>
  <key>WorkingDirectory</key><string>$root</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>$((minutes * 60))</integer>
  <key>StandardOutPath</key><string>$root/logs/collect.log</string>
  <key>StandardErrorPath</key><string>$root/logs/collect.log</string>
</dict>
</plist>
PLIST
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"
print "已安装 $label，每 $minutes 分钟抓取一次，日志：$root/logs/collect.log"
