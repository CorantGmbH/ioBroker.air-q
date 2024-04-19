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
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
var import_bonjour_service = __toESM(require("bonjour-service"));
var dns = __toESM(require("dns"));
var import_decryptAES256 = require("./decryptAES256");
class AirQ extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "air-q"
    });
    this._ip = "";
    this._sensorArray = [];
    this._id = "";
    this._password = "";
    this._deviceName = "";
    import_axios.default.defaults.timeout = 4e3;
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  onUnload() {
    this.log.info("AirQ adapter stopped...");
    this.clearInterval(this._stateInterval);
    this.clearTimeout(this._timeout);
  }
  async onReady() {
    if (this.config.password) {
      this.clearSensors();
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
          unit: "%",
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
          unit: "%",
          read: true,
          write: false
        },
        native: {}
      });
      this.sensorArray = await this.getSensorsInDevice();
      for (const element of this.sensorArray) {
        const unit = await this.getUnit(element);
        await this.setObjectNotExistsAsync(this.replaceInvalidChars(`sensors.${element}`), {
          type: "state",
          common: {
            name: element,
            type: "number",
            role: this.setRole(element),
            unit,
            read: true,
            write: false
          },
          native: {}
        });
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
    try {
      if (ip4Address.test(ip)) {
        this.ip = this.config.deviceIP;
      }
    } catch (error) {
      throw "Invalid IP:" + error;
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
        }
      });
      this._timeout = this.setTimeout(() => {
        findAirQ.stop();
        reject(new Error("AirQ not found in network"));
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
        return shortID;
      } else {
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      throw error;
    }
  }
  async getUnit(sensorName) {
    try {
      const response = await import_axios.default.get(`http://${this.ip}/config`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, this.password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        this.log.debug("SensorInfo: " + JSON.stringify(sensorsData.SensorInfo[sensorName].Unit));
        this.log.debug("SensorInfo All Data: " + JSON.stringify(sensorsData.SensorInfo[sensorName]));
        let unit;
        switch (sensorName) {
          case "temperature": {
            unit = "\xB0C";
            break;
          }
          case "humidity": {
            unit = "%";
            break;
          }
          case "humidity_abs": {
            unit = "g/m^3";
            break;
          }
          case "dewpt":
            {
              unit = "\xB0C";
              break;
            }
            ;
          default: {
            unit = sensorsData.SensorInfo[sensorName].Unit;
          }
        }
        return unit;
      } else {
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      this.log.error("Error while getting sensor units: " + error);
    }
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
      throw error;
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
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      this.log.error("Error while getting data from AirQ: " + error);
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
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      this.log.error("Error while getting average data from AirQ: " + error);
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
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      this.log.error("Error while getting sensors from device: " + error);
    }
  }
  checkParticulates(data) {
    this.log.debug("Data in checkParticulates: " + data);
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
      this.log.error("Error while setting data from AirQ: " + error);
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
      this.log.error("Error while setting average data from AirQ: " + error);
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
  clearSensors() {
    this.getStatesOf("sensors", async (err, states) => {
      if (states) {
        for (const state of states) {
          this.delObject(state._id);
        }
      } else {
        this.log.error("Error while clearing sensors: " + err);
      }
    });
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
