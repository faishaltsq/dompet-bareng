#!/bin/bash
# DompetBareng E2E Test Script via ADB
ADB="C:/Users/cubeb/AppData/Local/Android/Sdk/platform-tools/adb.exe"
PASS=0
FAIL=0

check() {
  local desc="$1" pattern="$2"
  $ADB shell uiautomator dump /data/local/tmp/uidump.xml 2>/dev/null
  local dump=$($ADB shell cat /data/local/tmp/uidump.xml 2>&1)
  if echo "$dump" | grep -q "$pattern"; then
    echo "✅ PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL: $desc (expected: $pattern)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== DompetBareng E2E Test ==="
echo ""

# TEST 1: Login Screen
echo "--- Test 1: Login Screen ---"
$ADB shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081" 2>/dev/null
sleep 10
check "Login screen loads" "DompetBareng"
check "Google login button exists" "Masuk dengan Google"
check "Dev mode button exists" "Masuk Mode Dev"

# TEST 2: Dev Login
echo "--- Test 2: Dev Login ---"
# Find and tap dev login
$ADB shell uiautomator dump /data/local/tmp/uidump.xml 2>/dev/null
DEVBTN=$($ADB shell cat /data/local/tmp/uidump.xml | grep -oP 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"[^>]*content-desc="[^"]*Masuk Mode Dev[^"]*"' | grep -oP 'bounds="\[\K[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+' | head -1)
if [ -n "$DEVBTN" ]; then
  X1=$(echo $DEVBTN | cut -d, -f1)
  Y1=$(echo $DEVBTN | cut -d, -f2 | cut -d] -f1)
  X2=$(echo $DEVBTN | cut -d[ -f2 | cut -d, -f1)
  Y2=$(echo $DEVBTN | cut -d[ -f2 | cut -d, -f2 | cut -d] -f1 2>/dev/null)
  CX=$(( (X1 + X2) / 2 ))
  CY=$(( (Y1 + Y2) / 2 ))
  $ADB shell "input tap $CX $CY"
else
  $ADB shell "input tap 540 2144"
fi
sleep 6
check "Logged in - Home screen" "Beranda"
check "3 tabs visible" "Statistik"
check "Settings tab" "Pengaturan"

# TEST 3: Create Workspace
echo "--- Test 3: Create Workspace ---"
$ADB shell "input tap 540 1372"
sleep 3
check "Create workspace form" "Buat Dompet Baru"

# Type name
$ADB shell "input tap 540 1907"
sleep 1
$ADB shell input text "Test%sDompet"
sleep 1

# Find Buat Dompet button and tap
$ADB shell uiautomator dump /data/local/tmp/uidump.xml 2>/dev/null
BDBTN=$($ADB shell cat /data/local/tmp/uidump.xml | grep -oP 'content-desc="Buat Dompet"[^>]*bounds="\[\K[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+' | head -1)
if [ -n "$BDBTN" ]; then
  BX1=$(echo $BDBTN | cut -d, -f1)
  BY1=$(echo $BDBTN | cut -d, -f2 | cut -d] -f1)
  BX2=$(echo $BDBTN | cut -d[ -f2 | cut -d, -f1)
  BY2=$(echo $BDBTN | cut -d[ -f2 | cut -d, -f2 | cut -d] -f1 2>/dev/null)
  BCX=$(( (BX1 + BX2) / 2 ))
  BCY=$(( (BY1 + BY2) / 2 ))
  $ADB shell "input tap $BCX $BCY"
else
  # Try hide keyboard then tap
  $ADB shell input keyevent 111
  sleep 1
  $ADB shell "input tap 540 2078"
fi
sleep 6
check "Workspace created - shows saldo" "Saldo"

# TEST 4: Add Transaction (Pengeluaran)
echo "--- Test 4: Add Transaction ---"
# Find "Pengeluaran" quick action or "+" button
$ADB shell uiautomator dump /data/local/tmp/uidump.xml 2>/dev/null
DUMP=$($ADB shell cat /data/local/tmp/uidump.xml)
if echo "$DUMP" | grep -q "Pengeluaran"; then
  # Find Pengeluaran button bounds
  PENBTN=$(echo "$DUMP" | grep -oP 'content-desc="[^"]*Pengeluaran[^"]*"[^>]*bounds="\[\K[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+' | head -1)
  if [ -n "$PENBTN" ]; then
    PX1=$(echo $PENBTN | cut -d, -f1)
    PY1=$(echo $PENBTN | cut -d, -f2 | cut -d] -f1)
    PX2=$(echo $PENBTN | cut -d[ -f2 | cut -d, -f1)
    PY2=$(echo $PENBTN | cut -d[ -f2 | cut -d, -f2)
    PCX=$(( (PX1 + PX2) / 2 ))
    PCY=$(( (PY1 + PY2) / 2 ))
    $ADB shell "input tap $PCX $PCY"
  else
    $ADB shell "input tap 270 900"
  fi
else
  $ADB shell "input tap 270 900"
fi
sleep 3
check "Transaction modal opens" "Simpan"

# TEST 5: Tab navigation - Statistik
echo "--- Test 5: Tab Navigation ---"
$ADB shell input keyevent 4
sleep 2
# Tap Statistik tab center = (540, 2246)
$ADB shell "input tap 540 2246"
sleep 3
check "Statistik tab loads" "Statistik"

# TEST 6: Pengaturan tab
echo "--- Test 6: Pengaturan Tab ---"
$ADB shell "input tap 900 2246"
sleep 3
check "Pengaturan tab loads" "Pengaturan"
check "Notification settings" "Pengingat"

# SUMMARY
echo ""
echo "=== RESULTS ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
echo "TOTAL: $((PASS + FAIL))"
