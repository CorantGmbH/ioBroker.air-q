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
  constructor(options = {}) {
    super({
      ...options,
      name: "air-q"
    });
    import_axios.default.defaults.timeout = 4e3;
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  onUnload() {
    this.log.info("air-Q adapter stopped...");
    this.clearInterval(this._stateInterval);
    this.clearTimeout(this._timeout);
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
      ["iaq_spec", "ppb"],
      ["resp_irr_spec", "ppb"],
      ["nh3_mr100", "\xB5g/m\xB3"],
      ["acid_m100", "\xB5g/m\xB3"],
      ["h2_m1000", "\xB5g/m\xB3"],
      ["no_m250", "\xB5g/m\xB3"],
      ["cl2_m20", "\xB5g/m\xB3"],
      ["ch2o_m10", "\xB5g/m\xB3"],
      ["ch2o_winsen", "\xB5g/m\xB3"],
      ["pm1_sps30", "\xB5g/m\xB3"],
      ["pm2_5_sps30", "\xB5g/m\xB3"],
      ["pm10_sps30", "\xB5g/m\xB3"]
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
  async getDataFromAirQ() {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/data`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        return sensorsData;
      } else {
        throw new Error("Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.");
      }
    } catch (error) {
      this.log.error("Error while getting data from air-Q: " + error + ". Check if the device is in the correct network and reachable.");
      this.stop();
    }
  }
  async getAverageDataFromAirQ() {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/average`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        return sensorsData;
      } else {
        throw new Error("Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.");
      }
    } catch (error) {
      this.log.error("Error while getting average data from air-Q: " + error + ". Check if the device is in the correct network and reachable.");
      this.stop();
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
      this.getRetrievalType() === "data" ? await this.setSensorData() : await this.setSensorAverageData();
    } catch (error) {
      this.log.error("Error while setting states: " + error);
    }
  }
  async setSensorData() {
    try {
      const data = await this.getDataFromAirQ();
      for (const element of this.sensorArray) {
        if (this.config.rawData) {
          const isNegative = this.checkNegativeValues(data, element);
          const cappedValue = isNegative ? 0 : data[element][0];
          await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: cappedValue, ack: true });
        } else {
          await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: data[element][0], ack: true });
        }
      }
      this.setStateAsync("sensors.health", { val: data.health / 10, ack: true });
      this.setStateAsync("sensors.performance", { val: data.performance / 10, ack: true });
    } catch (error) {
      this.log.error("Error while setting data from air-Q: " + error + ". Is one of the sensors not readable or in warm-up phase?");
    }
  }
  async setSensorAverageData() {
    try {
      const data = await this.getAverageDataFromAirQ();
      for (const element of this.sensorArray) {
        if (this.config.rawData) {
          const isNegative = this.checkNegativeValues(data, element);
          const cappedValue = isNegative ? 0 : data[element][0];
          await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: cappedValue, ack: true });
        } else {
          await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: data[element][0], ack: true });
        }
      }
      this.setStateAsync("sensors.health", { val: data.health / 10, ack: true });
      this.setStateAsync("sensors.performance", { val: data.performance / 10, ack: true });
    } catch (error) {
      this.log.error("Error while setting average data from air-Q: " + error + ". Is one of the sensors not readable or in warm-up phase?");
    }
  }
  checkNegativeValues(data, element) {
    if (data[element][0] < 0 && element !== "temperature") {
      return true;
    } else {
      return false;
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
