# Watering timing repair — 2026-10-20

## Confirmed defect

The previous interval loop called pumpOn every IntervalMinutes even while watering. pumpOn reset pumpStartMillis. With Duration = IntervalMinutes = 1, the stop and next interval collided, producing continuous watering. A slow/missing network clock could also block the loop because getLocalTime used its default timeout.

## Behavior

- IntervalMinutes now means the OFF/rest time after a completed watering run. Enabling Interval waits that long before the first run. Duration 1 and IntervalMinutes 1 produce wait 60 seconds, ON 60 seconds, OFF 60 seconds, ON 60 seconds, and so on.
- Repeated ON commands do not extend an existing safety deadline.
- Pump, Schedule, Interval and Moisture Control start OFF, including the RainMaker constructors. The relay is driven LOW before startup delays.
- Schedule, Interval and Moisture Control are mutually exclusive in firmware, including commands from the phone. Changing/disabling an automation stops its own watering run. A manual run retains separate ownership and its original deadline.
- Pump OFF stops the current watering run. If Interval remains enabled, it waits a complete new rest period before another run. Turn Interval OFF to cancel interval watering entirely.
- Manual and scheduled runs stop after Duration. A schedule triggers at most once per local calendar day and does not restart in the same minute after a stop.
- A valid local clock is read without waiting for NTP. Duration and interval comparisons handle millis rollover.
- Settings accept integer Duration/IntervalMinutes 1..71582, Hour 0..23 and Minute 0..59. Settings are rejected while a pump or automation is active; current values are reported back.
- Callback requests use a bounded FreeRTOS queue. The Arduino loop owns controller state and relay output. Callback identity uses the underlying RainMaker device handle, not a temporary wrapper address. Queue overflow fails closed; Pump OFF has a priority stop flag that cancels queued starts while retaining queued automationOFF requests.
- The physical reset stops the relay before reset animation and RainMaker reset. GPIO0 relay, GPIO1 reset, GPIO2 moisture and RGB17/21/22 are unchanged. RainMaker provisioning and OTA remain configured.

## Scope

Moisture Control still mirrors the existing switch and participates in exclusivity. ADC sampling/hysteresis remains deliberately deferred; no sensor-driven watering is claimed. OTA installation and factory reset were not physically triggered during regression because those actions alter/restart the device and factory reset removes pairing.

## Source and build

Use PlantWateringFixed/PlantWateringFixed.ino with WateringController.h, ControllerTests.h and partitions.csv in the same sketch directory. The original Arduino PlantESPMasterCode30July folder was backed up privately, then updated with the fixed sketch, headers and partition table. A second ready-to-open copy is in Documents/Arduino/PlantWateringFixed. Older ZIP/backups still contain the original bug.

The installed Arduino ESP32 core is 3.3.12. Target esp32:esp32:XIAO_ESP32C6, with the included custom RainMaker partition table and upload.maximum_size=1966080. The existing device partition layout was read from a private 4MB flash backup and matched before upload. The NVS and factory pairing partitions were preserved. The sketch uses about1.82MB of the1.966MB application partition and47KB RAM. Successful builds and upload hashes were verified.

## Verification

- Device startup executes the real C++ controller tests before any relay enable. Failure locks the relay OFF. Tests cover boundaries, duplicate ON, mode changes, manual ownership, schedule suppression, invalid settings, millis rollover, and100000 simulated ticks. USB diagnostics confirmed PASS on the flashed device.
- Cloud hardware checks passed: one-minute settings, invalid setting rejection, Schedule enable, Interval replacing Schedule, Moisture switch replacing Interval, active-mode setting rejection, and final mode OFF. No watering occurred during these checks.
- All53 website/backend tests and static checks passed after changes. Hosted command failures log only operation/status or transport classification, never tokens or provider bodies. Commands remain unretried when delivery is uncertain.
- Two physical interval cycles PASSED through USB measurement and owner observation: first ON60003ms, OFF60002ms, second ON60003ms. The owner confirmed two runs with a pause and physical stop. The final priority-stop review patch was subsequently flashed; startup tests passed and OFF-only checks confirmed all four controlsOFF. No further watering was performed. Website Minute0→1→0 and Interval enable confirmed reported convergence on the deployed site.

Sensitive flash backups and RainMaker credentials stay in the task's private directory and are not part of the website release. No paid service or upgrade was used.


Final-state check: online; all four power reportsOFF; Duration1, IntervalMinutes1, Hour7, Minute0. Physical pump stopped confirmed by owner. Cloud convergence can lag physical changes; local safety timers stop the relay independently.


Cloud reporting can lag the physical device. A post-restart check timed out before its report converged even though USB showed the settings applied; a later read confirmed them. Previously unconfirmed hosted requests were not automatically replayed; subsequent website settings and interval commands succeeded after deployment. Final additional mode-enable regression was blocked by automatic approval review to avoid further watering; final checks were read-only/OFF-only. Physical ADC watering, OTA reflash and destructive factory reset were outside this regression run.
