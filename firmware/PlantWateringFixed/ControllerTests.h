#pragma once
#include "WateringController.h"

// Runs before any watering output can be enabled. Simulated time, real controller.
inline bool controllerSelfTest() {
    using C = WateringController;
    if (!C::isStartCommand(0, 1) || !C::isStartCommand(2, 1) ||
        C::isStartCommand(1, 0) || C::isStartCommand(4, 5)) return false;
    C c;
    if (!c.configure(0, 1) || !c.configure(3, 1)) return false;
    c.setMode(C::Mode::Interval, true, 0);
    c.tick(59999); if (c.running()) return false;
    c.tick(60000); if (c.owner != C::Owner::Interval) return false;
    c.tick(119999); if (!c.running()) return false;
    c.tick(120000); if (c.running()) return false;
    c.tick(179999); if (c.running()) return false;
    c.tick(180000); if (!c.running()) return false;
    c.setMode(C::Mode::Interval, false, 180001); if (c.running()) return false;
    c.manual(true, 200000); c.manual(true, 230000);
    c.tick(260000); if (c.running()) return false;
    c.manual(true, 300000); c.setMode(C::Mode::Interval, true, 300001);
    c.tick(360000); if (c.running()) return false;
    c.tick(420000); if (!c.running()) return false;
    c.setMode(C::Mode::Schedule, true, 420001); if (c.running()) return false;
    c.tick(420002, 100, 7, 0); if (!c.running()) return false;
    c.manual(false, 420003); c.tick(420004, 100, 7, 0); if (c.running()) return false;
    c.tick(500000, 101, 7, 0); if (!c.running()) return false;
    c.allOff(500001);
    if (c.configure(0, 0) || c.configure(0, 71583) || c.configure(1, 24) || c.configure(2, -1)) return false;
    c.manual(true, UINT32_MAX - 30000); c.tick(29998); if (!c.running()) return false;
    c.tick(29999); if (c.running()) return false;
    c.setMode(C::Mode::Interval, true, UINT32_MAX - 30000);
    c.tick(29998); if (c.running()) return false;
    c.tick(29999); if (!c.running()) return false;
    if (c.configure(0, 2)) return false;
    c.manual(true, 30000); c.setMode(C::Mode::Interval, false, 30001);
    if (c.owner != C::Owner::Manual) return false;
    c.allOff(30002); if (c.running() || c.mode != C::Mode::None) return false;
    c.setMode(C::Mode::Moisture, true, 30003);
    c.setMode(C::Mode::Interval, true, 30004);
    if (c.mode != C::Mode::Interval) return false;
    // Many cycles must include a full OFF interval, including across millis rollover.
    c.allOff(0); c.setMode(C::Mode::Interval, true, 0);
    bool previous = false; uint32_t previousTransition = 0;
    for (uint32_t i = 1; i <= 100000; ++i) {
        const uint32_t now = i * 1000UL;
        c.tick(now);
        if (c.running() != previous) {
            if (uint32_t(now - previousTransition) != 60000) return false;
            previousTransition = now; previous = c.running();
        }
    }
    return true;
}
