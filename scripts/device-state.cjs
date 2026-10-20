'use strict';
const { revision } = require('./device-commands.cjs');
function sanitizeNode(node, observedAt, writable = false) {
  const online = node.status?.connectivity?.connected === true;
  const params = node.params || {};
  const power = name => online && typeof params[name]?.Power === 'boolean' ? params[name].Power : null;
  const integer = name => online && Number.isSafeInteger(params.Settings?.[name]) ? params.Settings[name] : null;
  return {
    id: node.id, name: String(node.config?.info?.name || 'Plant watering').slice(0, 120),
    online, observedAt, source: 'rainmaker-reported', writable, revision: revision(node),
    commandExpiresAt: Date.parse(observedAt) + 30000,
    power: { pump: power('Pump'), schedule: power('Schedule'), interval: power('Interval'), moisture: power('Moisture Control') },
    capabilities: { moisture: node.config?.devices?.some(device => device.name === 'Moisture Control') === true },
    settings: { duration: integer('Duration'), hour: integer('Hour'), minute: integer('Minute'), intervalMinutes: integer('IntervalMinutes') }
  };
}
module.exports = { sanitizeNode };
