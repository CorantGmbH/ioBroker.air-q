var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
var import_bonjour_service = __toESM(require("bonjour-service"));
var dns = __toESM(require("dns"));
var import_decryptAES256 = require("./decryptAES256");
var import_discovery = require("./discovery");
class AirQ extends utils.Adapter {
  _service;
  _ip = "";
  _sensorArray = [];
  _id = "";
  _password = "";
  _deviceName = "";
  _stateInterval;
  _timeout;
  _specialSensors = ["health", "performance"];
  _nightModeConfig = null;
  _lastNightModeCheck = 0;
  _nightModeRefreshInterval = 36e5;
  // 1 hour in milliseconds
  _warnedSensors = /* @__PURE__ */ new Set();
  constructor(options = {}) {
    super({
      ...options,
      name: "air-q"
    });
    import_axios.default.defaults.timeout = 4e3;
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
    this.on("message", this.onMessage.bind(this));
  }
  onUnload() {
    this.log.info("air-Q adapter stopped...");
    this.clearInterval(this._stateInterval);
    this.clearTimeout(this._timeout);
  }
  /**
   * Called when the admin UI (or another adapter) sends a message via sendTo().
   *
   * This is the ioBroker way for the admin config page to talk to the running
   * adapter. For example, the "Scan Network" button in the admin UI sends:
   *   sendTo('air-q.0', 'discoverDevices', {}, callback)
   *
   * The adapter receives that here, runs the mDNS scan, and sends back the
   * list of found devices via the callback.
   */
  async onMessage(obj) {
    if (!obj || !obj.command) {
      return;
    }
    switch (obj.command) {
      case "discoverDevices": {
        this.log.info("Received discoverDevices request from admin UI");
        try {
          const devices = await this.discoverAllAirQDevices();
          if (obj.callback) {
            const options = devices.map((d) => {
              const text = `${d.name || d.shortId + "_air-q"} (${d.shortId} \u2014 ${d.address})`;
              return { label: text, value: text };
            });
            this.sendTo(obj.from, obj.command, options, obj.callback);
          }
        } catch (error) {
          this.log.error(`Discovery failed: ${error}`);
          if (obj.callback) {
            this.sendTo(obj.from, obj.command, [], obj.callback);
          }
        }
        break;
      }
      default:
        this.log.warn(`Received unknown command: ${obj.command}`);
        break;
    }
  }
  async onReady() {
    if (this.config.password) {
      this.setState("info.connection", { val: false, ack: true });
      try {
        this.password = this.config.password;
        await this.checkConnectIP();
      } catch (error) {
        this.log.error(error);
      }
      if (this.config.respectNightMode) {
        this.log.info("Fetching night mode configuration from device");
        await this.fetchAndCacheNightMode();
      } else {
        this.log.info("Night mode is being ignored (respectNightMode setting disabled)");
      }
      await this.setObjectNotExistsAsync(`sensors.health`, {
        type: "state",
        common: {
          name: "health",
          type: "number",
          role: "value",
          unit: this.getUnit("health"),
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`sensors.performance`, {
        type: "state",
        common: {
          name: "performance",
          type: "number",
          role: "value",
          unit: this.getUnit("performance"),
          read: true,
          write: false
        },
        native: {}
      });
      this.sensorArray = await this.getSensorsInDevice();
      this.clearObsoleteSensors();
      try {
        for (const element of this.sensorArray) {
          await this.setObjectNotExistsAsync(this.replaceInvalidChars(`sensors.${element}`), {
            type: "state",
            common: {
              name: element,
              type: "number",
              role: this.setRole(element),
              unit: this.getUnit(element),
              read: true,
              write: false
            },
            native: {}
          });
        }
      } catch (error) {
        this.log.error("Error while iterating through the sensors: " + error + ". Possible reasons might be false credentials or your ioBroker system is not connected to the same network as the air-Q device. Please check again.");
      }
      this.extendObject("sensors", { common: { name: this.deviceName } });
      this._stateInterval = this.setInterval(async () => {
        await this.setStates();
      }, this.retrievalRate * 1e3);
    }
  }
  setRole(element) {
    switch (element) {
      case "temperature":
        return "value.temperature";
      case "fahrenheit":
        return "value.temperature";
      case "dewpt":
        return "value.temperature";
      case "humidity":
        return "value.humidity";
      case "pressure":
        return "level.pressure";
      case "co2":
        return "value.co2";
      default:
        return "value";
    }
  }
  async checkConnectIP() {
    try {
      if (this.config.connectViaIP) {
        this.service = "";
        this.isValidIP(this.config.deviceIP);
        this.id = await this.getShortId();
        this.deviceName = this.id.concat("_air-q");
      } else {
        this.id = this.config.shortId;
        this.deviceName = this.id.concat("_air-q");
        this.service = await this.findAirQInNetwork();
        this.ip = await this.getIp();
      }
    } catch (error) {
      throw error;
    }
  }
  isValidIP(ip) {
    const ip4Address = /^(\d{1,3}\.){3}\d{1,3}$/;
    const valid = ip4Address.test(ip);
    if (valid) {
      this.ip = this.config.deviceIP;
    } else {
      throw new Error("IP is not valid. Please check your IP address.");
    }
  }
  async findAirQInNetwork() {
    return new Promise((resolve, reject) => {
      const instance = new import_bonjour_service.default();
      const config = { type: "http" };
      const findAirQ = instance.find(config, (service) => {
        if (service.name === this.deviceName) {
          findAirQ.stop();
          this.setState("info.connection", { val: true, ack: true });
          resolve(service);
          this.log.info("air-Q connected.");
        }
      });
      this._timeout = this.setTimeout(() => {
        findAirQ.stop();
        reject(new Error("air-Q not found in network"));
      }, 5e4);
    });
  }
  /**
   * Scans the local network for ALL air-Q devices using mDNS (Bonjour).
   *
   * How it works:
   * - Every air-Q device advertises itself as an HTTP service (_http._tcp)
   *   via mDNS/Bonjour on the local network.
   * - Each device includes TXT record properties, notably:
   *     device: "air-q"       — identifies it as an air-Q device
   *     devicename: "My AirQ" — human-readable name
   *     id: "ABCDE12345"      — unique device ID (first 5 chars = shortId)
   * - This method browses for all _http._tcp services, filters by
   *   the TXT property `device === "air-q"`, and collects the results.
   *
   * Unlike findAirQInNetwork() which searches for ONE known device,
   * this method discovers ALL air-Q devices — useful for the admin UI
   * "Scan Network" feature and ioBroker.discovery integration.
   *
   * @param timeoutMs - How long to scan, in milliseconds (default: 10000)
   * @returns Array of discovered devices (may be empty if none found)
   */
  discoverAllAirQDevices(timeoutMs = 1e4) {
    return new Promise((resolve) => {
      const devices = [];
      const instance = new import_bonjour_service.default();
      const config = { type: "http" };
      const browser = instance.find(config, (service) => {
        const device = (0, import_discovery.tryParseAirQService)(service);
        if (device) {
          devices.push(device);
          this.log.debug(`Discovery found air-Q device: ${device.name} (${device.id}) at ${device.address}`);
        }
      });
      setTimeout(() => {
        browser.stop();
        instance.destroy();
        this.log.info(`Discovery complete: found ${devices.length} air-Q device(s)`);
        resolve(devices);
      }, timeoutMs);
    });
  }
  async getShortId() {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/config`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        const serial = sensorsData.SN;
        const shortID = serial.slice(0, 5);
        this.setState("info.connection", { val: true, ack: true });
        this.log.info("air-Q connected.");
        return shortID;
      }
    } catch (error) {
      throw error;
    }
  }
  getUnit(sensorName) {
    const sensorUnitMap = /* @__PURE__ */ new Map([
      ["health", "%"],
      ["performance", "%"],
      ["virus", "%"],
      ["co", "mg/m\xB3"],
      ["co2", "ppm"],
      ["no2", "\xB5g/m\xB3"],
      ["so2", "\xB5g/m\xB3"],
      ["o3", "\xB5g/m\xB3"],
      ["temperature", "\xB0C"],
      ["humidity", "%"],
      ["humidity_abs", "g/m\xB3"],
      ["dewpt", "\xB0C"],
      ["pm1", "\xB5g/m\xB3"],
      ["pm2_5", "\xB5g/m\xB3"],
      ["pm10", "\xB5g/m\xB3"],
      ["typps", "\xB5m"],
      ["sound", "db(A)"],
      ["sound_max", "db(A)"],
      ["tvoc", "ppb"],
      ["pressure", "hPa"],
      ["h2s", "\xB5g/m\xB3"],
      ["ch4_mipex", "\xB5g/m\xB3"],
      ["c3h8_mipex", "\xB5g/m\xB3"],
      ["tvoc_ionsc", "ppb"],
      ["radon", "Bq/m\xB3"],
      ["no2_insplorion", "\xB5g/m\xB3"],
      ["ethanol", "\xB5g/m\xB3"],
      ["nh3_mr100", "\xB5g/m\xB3"],
      ["acid_m100", "\xB5g/m\xB3"],
      ["h2_m1000", "\xB5g/m\xB3"],
      ["no_m250", "\xB5g/m\xB3"],
      ["cl2_m20", "\xB5g/m\xB3"],
      ["ch2o_m10", "\xB5g/m\xB3"],
      ["pm1_sps30", "\xB5g/m\xB3"],
      ["pm2_5_sps30", "\xB5g/m\xB3"],
      ["pm10_sps30", "\xB5g/m\xB3"],
      ["c2h4o", "\xB5g/m\xB3"],
      ["ash3", "\xB5g/m\xB3"],
      ["br2", "\xB5g/m\xB3"],
      ["ch4s", "\xB5g/m\xB3"],
      ["clo2", "\xB5g/m\xB3"],
      ["cs2", "\xB5g/m\xB3"],
      ["c2h4", "\xB5g/m\xB3"],
      ["f2", "\xB5g/m\xB3"],
      ["hcl", "\xB5g/m\xB3"],
      ["hcn", "\xB5g/m\xB3"],
      ["hf", "\xB5g/m\xB3"],
      ["h2o2", "\xB5g/m\xB3"],
      ["mold", "%"],
      ["ph3", "\xB5g/m\xB3"],
      ["r32", "%"],
      ["r454b", "%"],
      ["r454c", "%"],
      ["sih4", "\xB5g/m\xB3"],
      ["fahrenheit", "\xB0F"]
    ]);
    return sensorUnitMap.get(sensorName);
  }
  async getIp() {
    try {
      return new Promise((resolve, reject) => {
        dns.lookup(this.service.name, 4, (err, address) => {
          if (err) {
            reject(err);
          } else {
            resolve(address);
          }
        });
      });
    } catch (error) {
      this.log.error("Cannot seem to find IP address: " + error);
      this.stop();
    }
  }
  async getDataFromAirQ(route) {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/${route}`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && typeof decryptedData === "object") {
        const deviceData = decryptedData;
        return deviceData;
      } else {
        throw new Error("Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.");
      }
    } catch (error) {
      this.log.error("Error while getting data from air-Q: " + error + ". Check if the device is in the correct network and reachable.");
      this.stop();
      return void 0;
    }
  }
  async getSensorsInDevice() {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/config`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        const sensors = this.checkParticulates(sensorsData.sensors);
        return sensors;
      } else {
        throw new Error("Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.");
      }
    } catch (error) {
      this.log.error("Error while getting sensors from device: " + error);
      this.stop();
    }
  }
  checkParticulates(data) {
    if (data.includes("particulates")) {
      const pm = ["pm1", "pm2_5", "pm10"];
      const index = data.indexOf("particulates");
      data.splice(index, 1);
      data.splice(index, 0, ...pm);
      return data;
    } else {
      return data;
    }
  }
  getRetrievalType() {
    return this.config.retrievalType;
  }
  async setStates() {
    try {
      if (this.isInNightMode()) {
        this.log.debug("Skipping poll - device is in night mode with WiFi disabled");
        return;
      }
      await this.refreshNightModeIfNeeded();
      const data = await this.getDataFromAirQ(this.getRetrievalType());
      if (!data) {
        this.log.error("No data returned from getDataFromAirQ()");
        return;
      }
      this.log.silly(`Received from device: ${JSON.stringify(data, null, 2)}`);
      await this.setSensors(data);
    } catch (error) {
      this.log.error("Error while setting states: " + error);
    }
  }
  async setSensors(data) {
    var _a;
    try {
      for (const element of this.sensorArray) {
        let value = null;
        if (!data[element]) {
          const statusMsg = ((_a = data.Status) == null ? void 0 : _a[element]) ? ` Status: ${data.Status[element]}` : "";
          if (!this._warnedSensors.has(element)) {
            this.log.warn(`Sensor '${element}' not found in device response - skipping.${statusMsg}`);
            this._warnedSensors.add(element);
          } else {
            this.log.debug(`Sensor '${element}' not found in device response - skipping.${statusMsg}`);
          }
        } else if (this.config.clipNegativeValues) {
          const isNegative = this.checkNegativeValues(data, element);
          value = isNegative ? 0 : data[element][0];
        } else {
          value = data[element][0];
        }
        if (data[element] && this._warnedSensors.has(element)) {
          this._warnedSensors.delete(element);
        }
        await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: value, ack: true });
      }
      for (const element of this._specialSensors) {
        const value = data[element] / 10;
        await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: value, ack: true });
      }
    } catch (error) {
      this.log.error("Error while setting data from air-Q: " + error + ". Is one of the sensors not readable or in warm-up phase?");
    }
  }
  checkNegativeValues(data, element) {
    if (data[element][0] < 0 && element !== "temperature" && element !== "fahrenheit") {
      return true;
    } else {
      return false;
    }
  }
  /**
   * Creates a Date object for today at the specified UTC time
   * The Date object will automatically represent the time in local timezone
   *
   * @param utcTimeStr - Time in UTC format "HH:MM"
   * @returns Date object in local timezone
   */
  createUTCTimeToday(utcTimeStr) {
    const [hours, minutes] = utcTimeStr.split(":").map((num) => parseInt(num, 10));
    const date = /* @__PURE__ */ new Date();
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
  }
  /**
   * Checks if the current time falls within the night mode period
   * Returns true if we should skip polling (because WiFi is off)
   */
  isInNightMode() {
    if (!this.config.respectNightMode) {
      return false;
    }
    if (!this._nightModeConfig) {
      return false;
    }
    const { Activated, StartNight, StartDay, WifiNightOff } = this._nightModeConfig;
    if (!Activated || !WifiNightOff) {
      return false;
    }
    const now = /* @__PURE__ */ new Date();
    const nightStart = this.createUTCTimeToday(StartNight);
    const dayStart = this.createUTCTimeToday(StartDay);
    this.log.debug(
      `WiFi is off due to night mode between ${nightStart.toLocaleTimeString()} and ${dayStart.toLocaleTimeString()} today`
    );
    if (nightStart < dayStart) {
      return now >= nightStart && now <= dayStart;
    } else {
      return now <= dayStart || now >= nightStart;
    }
  }
  /**
   * Fetches the night mode configuration from the device and caches it
   */
  async fetchAndCacheNightMode() {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/config`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && decryptedData.NightMode) {
        this._nightModeConfig = decryptedData.NightMode;
        this._lastNightModeCheck = Date.now();
        this.log.info(
          `Night mode config cached: Activated=${this._nightModeConfig.Activated}, StartNight=${this._nightModeConfig.StartNight} UTC, StartDay=${this._nightModeConfig.StartDay} UTC, WifiNightOff=${this._nightModeConfig.WifiNightOff}`
        );
      } else {
        this.log.debug("No NightMode configuration found in device config");
      }
    } catch (error) {
      this.log.warn(`Could not fetch night mode config: ${error}`);
    }
  }
  /**
   * Checks if it's time to refresh the night mode config and does so if needed
   */
  async refreshNightModeIfNeeded() {
    if (this.isInNightMode()) {
      return;
    }
    const timeSinceLastCheck = Date.now() - this._lastNightModeCheck;
    if (timeSinceLastCheck > this._nightModeRefreshInterval) {
      this.log.debug("Refreshing night mode configuration");
      await this.fetchAndCacheNightMode();
    }
  }
  replaceInvalidChars(name) {
    return name.replace(this.FORBIDDEN_CHARS, "_");
  }
  async clearObsoleteSensors() {
    try {
      const existingStates = await this.getStatesOfAsync("sensors");
      this.log.debug(`Existing states retrieved: ${existingStates ? existingStates.length : 0}`);
      if (existingStates && existingStates.length > 0) {
        this.log.silly(`existingStates: ${JSON.stringify(existingStates, null, 2)}`);
        const existingSensorIds = existingStates.map(
          (state) => state._id.replace(`${this.namespace}.sensors.`, "")
        );
        this.log.silly(`existingSensorIds: ${JSON.stringify(existingSensorIds)}`);
        const validSensors = this.sensorArray.concat(this._specialSensors);
        this.log.silly(`Valid sensors (sensorArray + specialSensors): ${JSON.stringify(validSensors)}`);
        const obsoleteSensors = existingSensorIds.filter(
          (id) => !validSensors.includes(id)
        );
        this.log.silly(`obsoleteSensors: ${JSON.stringify(obsoleteSensors)}`);
        this.log.silly(`Current sensorArray: ${JSON.stringify(this.sensorArray)}`);
        for (const sensorId of obsoleteSensors) {
          const fullId = `sensors.${sensorId}`;
          await this.delObjectAsync(fullId);
          this.log.info(`Deleted obsolete sensor: ${fullId}`);
        }
      } else {
        this.log.debug("No existing sensor states found.");
      }
    } catch (err) {
      this.log.error("Error while clearing obsolete sensors: " + err);
    }
  }
  set service(value) {
    this._service = value;
  }
  get service() {
    return this._service;
  }
  set ip(value) {
    this._ip = value;
  }
  get ip() {
    return this._ip;
  }
  set sensorArray(value) {
    this._sensorArray = value;
  }
  get sensorArray() {
    return this._sensorArray;
  }
  set id(value) {
    this._id = value;
  }
  get id() {
    return this._id;
  }
  set password(value) {
    this._password = value;
  }
  get password() {
    return this._password;
  }
  set deviceName(value) {
    this._deviceName = value;
  }
  get deviceName() {
    return this._deviceName;
  }
  get retrievalRate() {
    if (this.config.retrievalRate > 3600) {
      return 3600;
    } else if (this.config.retrievalRate < 2) {
      return 2;
    } else {
      return this.config.retrievalRate;
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new AirQ(options);
} else {
  (() => new AirQ())();
}
//# sourceMappingURL=main.js.map
