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
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
  }
  async onReady() {
    this.setState("info.connection", { val: false, ack: true });
    await this.setObjectNotExistsAsync("Sensors", {
      type: "device",
      common: {
        name: this.config.shortId.concat("_air-Q")
      },
      native: {}
    });
    this.setObjectNotExistsAsync(`Sensors.Health`, {
      type: "state",
      common: {
        name: "Health",
        type: "number",
        role: "value",
        read: true,
        write: true
      },
      native: {}
    });
    this.setObjectNotExistsAsync(`Sensors.Performance`, {
      type: "state",
      common: {
        name: "Performance",
        type: "number",
        role: "value",
        read: true,
        write: true
      },
      native: {}
    });
    const service = await this.findAirQInNetwork(this.config.shortId.concat("_air-q"));
    const ip = await this.getIp(service.name);
    const sensorArray = await this.getSensorsInDevice(ip, this.config.password);
    for (const element of sensorArray) {
      this.setObjectNotExistsAsync(`Sensors.${element}`, {
        type: "state",
        common: {
          name: element,
          type: "number",
          role: "value",
          read: true,
          write: true
        },
        native: {}
      });
      this.subscribeStates(`Sensors.${element}`);
    }
    this.setInterval(async () => {
      await this.setStates(ip, sensorArray);
    }, this.config.retrievalRate * 1e3);
  }
  async findAirQInNetwork(airQName) {
    return new Promise((resolve, reject) => {
      const instance = new import_bonjour_service.default();
      const config = { type: "http" };
      const findAirQ = instance.find(config, (service) => {
        if (service.name === airQName) {
          findAirQ.stop();
          this.setState("info.connection", { val: true, ack: true });
          resolve(service);
        }
      });
      setTimeout(() => {
        findAirQ.stop();
        reject(new Error("AirQ not found in network"));
      }, 3e4);
    });
  }
  async getIp(service) {
    return new Promise((resolve, reject) => {
      dns.lookup(service, 4, (err, address) => {
        if (err) {
          reject(err);
        } else {
          resolve(address);
        }
      });
    });
  }
  async getDataFromAirQ(ip, password) {
    try {
      const response = await import_axios.default.get(`http://${ip}/data`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        return sensorsData;
      } else {
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      throw error;
    }
  }
  async getAverageDataFromAirQ(ip, password) {
    try {
      const response = await import_axios.default.get(`http://${ip}/average`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        return sensorsData;
      } else {
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      throw error;
    }
  }
  async getSensorsInDevice(ip, password) {
    try {
      const response = await import_axios.default.get(`http://${ip}/config`, { responseType: "json" });
      const data = response.data.content;
      const decryptedData = (0, import_decryptAES256.decrypt)(data, password);
      if (decryptedData && typeof decryptedData === "object") {
        const sensorsData = decryptedData;
        const sensors = sensorsData.sensors;
        return sensors;
      } else {
        throw new Error("DecryptedData is undefined or not an object");
      }
    } catch (error) {
      throw error;
    }
  }
  getRetrievalType() {
    return this.config.retrievalType;
  }
  onStateChange(id, state) {
    const value = state == null ? void 0 : state.val;
    if (state) {
      this.getStateAsync(id, { val: value, ack: true });
    } else {
      this.log.info(`State ${id} deleted`);
    }
  }
  async setStates(ip, sensorArray) {
    this.getRetrievalType() === "data" ? this.setSensorData(ip, sensorArray) : this.setSensorAverageData(ip, sensorArray);
    this.onStateChange("Sensors.Health", await this.getStateAsync("Sensors.Health"));
    this.onStateChange("Sensors.Performance", await this.getStateAsync("Sensors.Performance"));
    for (const element of sensorArray) {
      const state = await this.getStateAsync(`Sensors.${element}`);
      this.onStateChange(`Sensors.${element}`, state);
    }
  }
  async setSensorData(ip, sensorArray) {
    const data = await this.getDataFromAirQ(ip, this.config.password);
    for (const element of sensorArray) {
      this.setStateAsync(`Sensors.${element}`, { val: data[element][0], ack: true });
    }
    this.setStateAsync("Sensors.Health", { val: data.health / 10, ack: true });
    this.setStateAsync("Sensors.Performance", { val: data.performance / 10, ack: true });
  }
  async setSensorAverageData(ip, sensorArray) {
    const data = await this.getAverageDataFromAirQ(ip, this.config.password);
    for (const element of sensorArray) {
      this.setStateAsync(`Sensors.${element}`, { val: data[element][0], ack: true });
    }
    this.setStateAsync("Sensors.Health", { val: data.health / 10, ack: true });
    this.setStateAsync("Sensors.Performance", { val: data.performance / 10, ack: true });
  }
}
if (require.main !== module) {
  module.exports = (options) => new AirQ(options);
} else {
  (() => new AirQ())();
}
//# sourceMappingURL=main.js.map
