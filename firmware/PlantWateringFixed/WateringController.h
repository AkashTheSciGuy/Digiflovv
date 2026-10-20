#pragma once
#include <stdint.h>

// Hardware-free controller. IntervalMinutes is the OFF time between runs.
class WateringController {
public:
    enum class Mode { None, Schedule, Interval, Moisture };
    enum class Owner { None, Manual, Schedule, Interval };
    Mode mode = Mode::None;
    Owner owner = Owner::None;
    uint32_t durationMinutes = 5, intervalMinutes = 10;
    int hour = 7, minute = 0;
    uint32_t startedAt = 0, idleSince = 0;
    int lastScheduleDay = -1;
    bool running() const { return owner != Owner::None; }
    static bool isStartCommand(int target, int value) {
        return target >= 0 && target < 4 && value != 0;
    }

    void stop(uint32_t now) {
        owner = Owner::None;
        idleSince = now;
    }
    void allOff(uint32_t now) { mode = Mode::None; stop(now); }
    void start(Owner requested, uint32_t now) {
        if (running()) return; // Duplicate ON must never extend a run.
        owner = requested;
        startedAt = now;
    }
    void manual(bool enabled, uint32_t now) {
        if (!enabled) { stop(now); return; }
        // Taking manual ownership preserves the existing safety deadline.
        if (running()) owner = Owner::Manual;
        else start(Owner::Manual, now);
    }
    void setMode(Mode requested, bool enabled, uint32_t now) {
        if (!enabled) {
            if (mode != requested) return;
            mode = Mode::None;
            if (owner != Owner::Manual) stop(now);
            return;
        }
        if (mode == requested) return;
        if (owner != Owner::Manual) stop(now);
        mode = requested;
        idleSince = now;
    }
    bool configure(int field, int value) {
        if (running() || mode != Mode::None) return false;
        if ((field == 0 || field == 3) && (value < 1 || value > 71582)) return false;
        if (field == 1 && (value < 0 || value > 23)) return false;
        if (field == 2 && (value < 0 || value > 59)) return false;
        switch (field) {
            case 0: durationMinutes = value; break;
            case 1: hour = value; break;
            case 2: minute = value; break;
            case 3: intervalMinutes = value; break;
            default: return false;
        }
        return true;
    }
    void tick(uint32_t now, int day = -1, int currentHour = -1, int currentMinute = -1) {
        if (running() && uint32_t(now - startedAt) >= durationMinutes * 60000UL) stop(now);
        if (mode == Mode::Interval && !running() && uint32_t(now - idleSince) >= intervalMinutes * 60000UL)
            start(Owner::Interval, now);
        if (mode == Mode::Schedule && day >= 0 && currentHour == hour && currentMinute == minute && lastScheduleDay != day) {
            lastScheduleDay = day; // Do not replay a skipped schedule during a manual run.
            start(Owner::Schedule, now);
        }
    }
};
