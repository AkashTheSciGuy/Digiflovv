#include "RMaker.h"
#include "WiFi.h"
#include "WiFiProv.h"
#include <time.h>
#include <atomic>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "WateringController.h"
#include "ControllerTests.h"

// Existing hardware assignments; relay is active HIGH.
#define RELAY_PUMP 0
#define RESET_BUTTON 1
#define MOISTURE_PIN 2
#define LED_RED 17
#define LED_GREEN 21
#define LED_BLUE 22
const char *service_name = "PlantWater";
const char *pop = "abcd1234";
Switch pumpSwitch("Pump", nullptr, false);
Switch scheduleSwitch("Schedule", nullptr, false);
Switch intervalSwitch("Interval", nullptr, false);
Switch moistureSwitch("Moisture Control", nullptr, false);
Device settings("Settings");
Param durationParam("Duration","custom.param",value(5),PROP_FLAG_READ | PROP_FLAG_WRITE);
Param hourParam("Hour","custom.param",value(7),PROP_FLAG_READ | PROP_FLAG_WRITE);
Param minuteParam("Minute","custom.param",value(0),PROP_FLAG_READ | PROP_FLAG_WRITE);
Param intervalParam("IntervalMinutes","custom.param",value(10),PROP_FLAG_READ | PROP_FLAG_WRITE);
WateringController controller;
using Mode = WateringController::Mode;
struct Command { int target; int value; };
QueueHandle_t commands;
std::atomic<bool> stopRequested{false}, failClosed{false}, reportRequested{false};
bool outputRunning = false;
bool controllerTestsPassed = false;
enum LedState { LED_BOOT, LED_READY, LED_NO_WIFI, LED_WATERING, LED_FACTORY_RESET, LED_OTA };
LedState currentLedState = LED_BOOT;
unsigned long ledTimer = 0, resetPressTime = 0;
bool ledBlinkState = false, resetCounting = false;
void setStatus(LedState state);
void applyOutput() {
    const bool running = controller.running();
    digitalWrite(RELAY_PUMP, running ? HIGH : LOW);
    if (running != outputRunning) {
        outputRunning = running;
        reportRequested = true;
        Serial.printf("PUMP %s uptime=%lu owner=%d\n", running ? "ON" : "OFF", millis(), int(controller.owner));
    }
    if (running) { if (currentLedState != LED_WATERING) setStatus(LED_WATERING); }
    else if (currentLedState != LED_BOOT) setStatus(WiFi.status() == WL_CONNECTED ? LED_READY : LED_NO_WIFI);
}
void reportState() {
    pumpSwitch.updateAndReportParam(ESP_RMAKER_DEF_POWER_NAME, controller.running());
    scheduleSwitch.updateAndReportParam(ESP_RMAKER_DEF_POWER_NAME, controller.mode == Mode::Schedule);
    intervalSwitch.updateAndReportParam(ESP_RMAKER_DEF_POWER_NAME, controller.mode == Mode::Interval);
    moistureSwitch.updateAndReportParam(ESP_RMAKER_DEF_POWER_NAME, controller.mode == Mode::Moisture);
    settings.updateAndReportParam("Duration", int(controller.durationMinutes));
    settings.updateAndReportParam("Hour", controller.hour);
    settings.updateAndReportParam("Minute", controller.minute);
    settings.updateAndReportParam("IntervalMinutes", int(controller.intervalMinutes));
}
// Callbacks only enqueue requests. The Arduino loop exclusively owns timers and relay state.
void write_callback(Device *device, Param *param, const param_val_t val, void *, write_ctx_t *) {
    const char *name = param->getParamName();
    Command command{-1, 0};
    if (strcmp(name, ESP_RMAKER_DEF_POWER_NAME) == 0 && val.type == RMAKER_VAL_TYPE_BOOLEAN) {
        if (device->getDeviceHandle() == pumpSwitch.getDeviceHandle()) command.target = 0;
        else if (device->getDeviceHandle() == scheduleSwitch.getDeviceHandle()) command.target = 1;
        else if (device->getDeviceHandle() == intervalSwitch.getDeviceHandle()) command.target = 2;
        else if (device->getDeviceHandle() == moistureSwitch.getDeviceHandle()) command.target = 3;
        command.value = val.val.b;
        if (command.target == 0 && !command.value) {
            stopRequested = true;
            return;
        }
    } else if (device->getDeviceHandle() == settings.getDeviceHandle() && val.type == RMAKER_VAL_TYPE_INTEGER) {
        const char *fields[] = {"Duration", "Hour", "Minute", "IntervalMinutes"};
        for (int i = 0; i < 4; ++i) if (strcmp(name, fields[i]) == 0) command.target = i + 4;
        command.value = val.val.i;
    } else if (strcmp(name, "Name") == 0 && val.type == RMAKER_VAL_TYPE_STRING) {
        param->updateAndReport(val);
        return;
    }
    if (command.target < 0) { reportRequested = true; return; }
    if (xQueueSend(commands, &command, 0) != pdTRUE) failClosed = true;
}
void allLEDOff()
{
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_BLUE, HIGH);
}

void setLED(bool r, bool g, bool b)
{
    // Common Anode RGB LED
    digitalWrite(LED_RED,   !r);
    digitalWrite(LED_GREEN, !g);
    digitalWrite(LED_BLUE,  !b);
}

void setStatus(LedState state)
{
    currentLedState = state;

    switch(state)
    {
        case LED_BOOT:
            setLED(true,true,false);      // Yellow
            break;

        case LED_READY:
            setLED(false,true,false);     // Green
            break;

        case LED_NO_WIFI:
            setLED(true,false,false);     // Red
            break;

        case LED_WATERING:
            break;

        case LED_FACTORY_RESET:
            break;

        case LED_OTA:
            break;
    }
}

void updateLED()
{
    if(millis()-ledTimer < 500)
        return;

    ledTimer = millis();

    ledBlinkState = !ledBlinkState;

    switch(currentLedState)
    {
        case LED_WATERING:

            if(ledBlinkState)
                setLED(false,false,true);
            else
                allLEDOff();

            break;

        case LED_FACTORY_RESET:

            if(ledBlinkState)
                setLED(true,false,false);
            else
                allLEDOff();

            break;

        case LED_OTA:

            if(ledBlinkState)
                setLED(true,false,true);
            else
                allLEDOff();

            break;

        default:
            break;
    }
}

void checkFactoryReset()
{
    if (digitalRead(RESET_BUTTON) == LOW)
    {
        if (!resetCounting)
        {
            resetCounting = true;
            resetPressTime = millis();
        }

        // Hold button for 10 seconds
        if (millis() - resetPressTime >= 10000)
        {
            Serial.println("Factory Reset Started");

            controller.allOff(millis());
            applyOutput();
            reportState();
            setStatus(LED_FACTORY_RESET);

            // Blink RED for 3 seconds
            unsigned long start = millis();

            while (millis() - start < 3000)
            {
                setLED(true, false, false);
                delay(250);

                allLEDOff();
                delay(250);
            }

            Serial.println("Erasing RainMaker Data...");

            RMakerFactoryReset(2);

            // Prevent this function from running again
            while (true)
            {
                delay(100);
            }
        }
    }
    else
    {
        resetCounting = false;
    }
}


void setup() {
    // Keep the relay OFF before delays, Wi-Fi, RainMaker or controller tests.
    digitalWrite(RELAY_PUMP, LOW);
    pinMode(RELAY_PUMP, OUTPUT);
    digitalWrite(RELAY_PUMP, LOW);
    pinMode(LED_RED, OUTPUT); pinMode(LED_GREEN, OUTPUT); pinMode(LED_BLUE, OUTPUT);
    pinMode(RESET_BUTTON, INPUT_PULLUP);
    allLEDOff(); setStatus(LED_BOOT);
    Serial.begin(115200);
    delay(500);
    controllerTestsPassed = controllerSelfTest();
    if (!controllerTestsPassed) {
        Serial.println("CONTROLLER TESTS FAILED; relay locked OFF");
        setStatus(LED_NO_WIFI);
        while (true) { digitalWrite(RELAY_PUMP, LOW); delay(100); }
    }
    Serial.println("CONTROLLER TESTS PASS: boundaries, rollover, ownership, mode conflicts, 100000 ticks");
    commands = xQueueCreate(16, sizeof(Command));
    if (!commands) { while (true) { digitalWrite(RELAY_PUMP, LOW); delay(100); } }
    Node node = RMaker.initNode("Plant Watering");
    pumpSwitch.addCb(write_callback); scheduleSwitch.addCb(write_callback);
    intervalSwitch.addCb(write_callback); moistureSwitch.addCb(write_callback); settings.addCb(write_callback);
    settings.addParam(durationParam); settings.addParam(hourParam);
    settings.addParam(minuteParam); settings.addParam(intervalParam);
    node.addDevice(pumpSwitch); node.addDevice(scheduleSwitch); node.addDevice(intervalSwitch);
    node.addDevice(moistureSwitch); node.addDevice(settings);
    configTime(19800, 0, "pool.ntp.org");
    RMaker.enableOTA(OTA_USING_PARAMS);
    RMaker.start();
    reportState();
    WiFiProv.beginProvision(NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_NONE,
                           NETWORK_PROV_SECURITY_1, pop, service_name);
    setStatus(WiFi.status() == WL_CONNECTED ? LED_READY : LED_NO_WIFI);
    Serial.println("DigiFlovv timer fix v1 ready; all controls OFF; interval = rest after watering");
}
void loop() {
    if (Serial.available() && Serial.read() == '?') {
        Serial.printf("STATUS timer-fix-v1 tests=%s uptime=%lu pump=%d mode=%d owner=%d duration=%lu interval=%lu\n",
                      controllerTestsPassed ? "PASS" : "FAIL", millis(), controller.running(), int(controller.mode),
                      int(controller.owner), (unsigned long)controller.durationMinutes, (unsigned long)controller.intervalMinutes);
    }
    const uint32_t now = millis();
    if (failClosed.exchange(false)) {
        xQueueReset(commands); controller.allOff(now); reportRequested = true;
    }
    const bool manualStop = stopRequested.exchange(false);
    if (manualStop) {
        controller.manual(false, now); reportRequested = true;
    }
    // Evaluate the safety deadline before processing any additional commands.
    controller.tick(now);
    applyOutput();
    Command command;
    for (int i = 0; i < 16 && xQueueReceive(commands, &command, 0) == pdTRUE; ++i) {
        // Cancel queued starts after STOP, but preserve queued automation OFF requests.
        if (manualStop && WateringController::isStartCommand(command.target, command.value)) continue;
        if (command.target == 0) controller.manual(command.value, millis());
        else if (command.target < 4) {
            const Mode modes[] = {Mode::None, Mode::Schedule, Mode::Interval, Mode::Moisture};
            controller.setMode(modes[command.target], command.value, millis());
        } else if (!controller.configure(command.target - 4, command.value)) {
            Serial.println("Settings rejected: invalid or watering/automation active");
        }
        reportRequested = true;
    }
    // time()/localtime_r never waits for NTP. A missing clock cannot delay pump stop.
    time_t clock = time(nullptr);
    struct tm local;
    if (clock >= 1704067200 && localtime_r(&clock, &local))
        controller.tick(millis(), (local.tm_year + 1900) * 366 + local.tm_yday, local.tm_hour, local.tm_min);
    else controller.tick(millis());
    applyOutput();
    checkFactoryReset();
    updateLED();
    if (reportRequested.exchange(false)) reportState();
    delay(5);
}
