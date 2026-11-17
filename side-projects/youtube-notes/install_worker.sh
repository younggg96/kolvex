#!/bin/zsh
# Install / remove the macOS LaunchAgent that keeps auto_import.py running.
set -euo pipefail
cd "$(dirname "$0")"
root="$PWD"
label="app.kolvex.youtube-import"
plist="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "$domain/$label" 2>/dev/null || true
  rm -f "$plist"
  print "已移除 $label"
  exit 0
fi

[[ -x .venv/bin/python ]] || { print '请先运行 ./setup.sh --whisper'; exit 1; }
[[ -f .env.worker ]] || { print '请先复制 .env.worker.example 为 .env.worker 并填写'; exit 1; }
mkdir -p batches "$HOME/Library/LaunchAgents"
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>$root/start.sh</string><string>worker</string></array>
  <key>WorkingDirectory</key><string>$root</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$root/batches/worker.log</string>
  <key>StandardErrorPath</key><string>$root/batches/worker.log</string>
</dict>
</plist>
PLIST
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"
print "已安装 $label，日志：$root/batches/worker.log"
